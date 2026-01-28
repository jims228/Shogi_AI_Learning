#!/usr/bin/env python3
"""
Generate beginner-friendly explanations for wkbk articles via OpenAI/Gemini,
with SQLite cache and JSONL rebuild.

Usage:
  # (example) generate 3 records for 詰将棋, ignoring cache
  python3 tools/generate_wkbk_explanations_gemini.py --only-lineage "詰将棋" --limit 3 --force

Input:
  tools/datasets/wkbk/wkbk_articles.jsonl

Cache DB:
  tools/datasets/wkbk/wkbk_explanations.sqlite

Output (rebuilt from DB; only status=ok):
  tools/datasets/wkbk/wkbk_explanations.jsonl

Notes:
- .env is loaded ONLY from repo root (.env) to avoid dotenv find_dotenv() issues.
- Provider defaults to OpenAI; use --provider=gemini to switch.
- GOOGLE_API_KEY is removed from env to avoid accidental Gemini SDK override.
"""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable, Tuple

from dotenv import load_dotenv
from pydantic import BaseModel, Field, ValidationError
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from tqdm import tqdm

from google import genai
from google.genai import types
from google.api_core import exceptions as gax_exceptions


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_IN = ROOT / "tools" / "datasets" / "wkbk" / "wkbk_articles.jsonl"
DEFAULT_DB = ROOT / "tools" / "datasets" / "wkbk" / "wkbk_explanations.sqlite"
DEFAULT_OUT = ROOT / "tools" / "datasets" / "wkbk" / "wkbk_explanations.jsonl"
DEFAULT_PROVIDER = "openai"
DEFAULT_OPENAI_MODEL = "gpt-4o-mini"
DEFAULT_GEMINI_MODEL = "gemini-2.0-flash-exp"


class MoveExplain(BaseModel):
    move_usi: str = Field(..., description="USI形式の指し手。例: 7g7f, B*9e")
    why: str = Field(..., description="その手の狙い・理由を短く")


class WkbkExplanation(BaseModel):
    key: str
    title: str
    lineage_key: str
    tags: list[str] = Field(default_factory=list)
    difficulty: int | None = None

    goal: str = Field(..., description="この問題の狙いを1文で")
    summary: str = Field(..., description="全体の解説（初心者向け・短め）")
    sequence: list[MoveExplain] = Field(..., description="正解手順の解説（1手ずつ）")
    common_mistakes: list[str] = Field(default_factory=list, description="ありがちな失敗/注意点")
    next_hint: str = Field(..., description="次に覚えると良い観点/練習ポイント")


SYSTEM_PROMPT = """あなたは将棋の初心者向けコーチです。
入力として「初期局面SFEN」と「正解手順(USI)」が与えられます。
初心者が理解できる短い言葉で、狙い・要点・注意点を説明してください。

制約:
- 返答は必ず JSON のみ（余計な文章は禁止）
- sequence は「正解手順」の指し手数と同じ数だけ出す
- why は1〜2文で短く
"""


def now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def mask_key(key: str) -> str:
    key = key or ""
    if not key:
        return "(unset)"
    prefix = key[:6]
    return f"{prefix}...(len={len(key)})"


def read_jsonl(path: Path) -> Iterable[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            yield json.loads(line)


def ensure_db(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS explanations (
            key TEXT PRIMARY KEY,
            status TEXT NOT NULL,                 -- 'ok' | 'error'
            explanation_json TEXT,                -- when ok
            provider TEXT,
            model TEXT,
            prompt_tokens INTEGER,
            completion_tokens INTEGER,
            total_tokens INTEGER,
            estimated_cost_usd REAL,
            error_type TEXT,                      -- when error
            error_message TEXT,                   -- when error
            raw_text TEXT,                        -- raw model text when error (if available)
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_explanations_status ON explanations(status);")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_explanations_updated ON explanations(updated_at);")
    db_ensure_columns(conn)
    conn.commit()


def db_ensure_columns(conn: sqlite3.Connection) -> None:
    cur = conn.execute("PRAGMA table_info(explanations)")
    existing = {row[1] for row in cur.fetchall()}
    columns: dict[str, str] = {
        "provider": "TEXT",
        "model": "TEXT",
        "prompt_tokens": "INTEGER",
        "completion_tokens": "INTEGER",
        "total_tokens": "INTEGER",
        "estimated_cost_usd": "REAL",
    }
    for name, col_type in columns.items():
        if name not in existing:
            conn.execute(f"ALTER TABLE explanations ADD COLUMN {name} {col_type}")


def db_get_status(conn: sqlite3.Connection, key: str) -> str | None:
    row = conn.execute("SELECT status FROM explanations WHERE key=?", (key,)).fetchone()
    return row[0] if row else None


def db_upsert_ok(
    conn: sqlite3.Connection,
    key: str,
    explanation: dict[str, Any],
    provider: str,
    model: str,
    prompt_tokens: int | None,
    completion_tokens: int | None,
    total_tokens: int | None,
    estimated_cost_usd: float | None,
) -> None:
    ts = now_iso()
    payload = json.dumps(explanation, ensure_ascii=False)
    conn.execute(
        """
        INSERT INTO explanations(
          key,status,explanation_json,provider,model,prompt_tokens,completion_tokens,total_tokens,estimated_cost_usd,
          error_type,error_message,raw_text,created_at,updated_at
        )
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(key) DO UPDATE SET
          status=excluded.status,
          explanation_json=excluded.explanation_json,
          provider=excluded.provider,
          model=excluded.model,
          prompt_tokens=excluded.prompt_tokens,
          completion_tokens=excluded.completion_tokens,
          total_tokens=excluded.total_tokens,
          estimated_cost_usd=excluded.estimated_cost_usd,
          error_type=NULL,
          error_message=NULL,
          raw_text=NULL,
          updated_at=excluded.updated_at;
        """,
        (
            key,
            "ok",
            payload,
            provider,
            model,
            prompt_tokens,
            completion_tokens,
            total_tokens,
            estimated_cost_usd,
            None,
            None,
            None,
            ts,
            ts,
        ),
    )
    conn.commit()


def db_upsert_error(
    conn: sqlite3.Connection,
    key: str,
    provider: str,
    model: str,
    prompt_tokens: int | None,
    completion_tokens: int | None,
    total_tokens: int | None,
    estimated_cost_usd: float | None,
    err_type: str,
    err_msg: str,
    raw_text: str | None,
) -> None:
    ts = now_iso()
    conn.execute(
        """
        INSERT INTO explanations(
          key,status,explanation_json,provider,model,prompt_tokens,completion_tokens,total_tokens,estimated_cost_usd,
          error_type,error_message,raw_text,created_at,updated_at
        )
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(key) DO UPDATE SET
          status=excluded.status,
          explanation_json=NULL,
          provider=excluded.provider,
          model=excluded.model,
          prompt_tokens=excluded.prompt_tokens,
          completion_tokens=excluded.completion_tokens,
          total_tokens=excluded.total_tokens,
          estimated_cost_usd=excluded.estimated_cost_usd,
          error_type=excluded.error_type,
          error_message=excluded.error_message,
          raw_text=excluded.raw_text,
          updated_at=excluded.updated_at;
        """,
        (
            key,
            "error",
            None,
            provider,
            model,
            prompt_tokens,
            completion_tokens,
            total_tokens,
            estimated_cost_usd,
            err_type,
            err_msg,
            raw_text,
            ts,
            ts,
        ),
    )
    conn.commit()


def print_recent_errors(conn: sqlite3.Connection, limit: int = 5) -> None:
    rows = conn.execute(
        """
        SELECT key, updated_at, error_type, substr(error_message,1,180)
        FROM explanations
        WHERE status != 'ok'
        ORDER BY updated_at DESC
        LIMIT ?;
        """,
        (limit,),
    ).fetchall()

    if not rows:
        print("recent errors: (none)")
        return

    print("recent errors (latest first):")
    for k, t, et, em in rows:
        print(f"- {t}  {k}  {et}: {em}")


def rebuild_output(conn: sqlite3.Connection, out_path: Path) -> int:
    rows = conn.execute(
        "SELECT explanation_json FROM explanations WHERE status='ok' ORDER BY updated_at ASC"
    ).fetchall()

    out_path.parent.mkdir(parents=True, exist_ok=True)
    n = 0
    with out_path.open("w", encoding="utf-8") as f:
        for (payload,) in rows:
            if not payload:
                continue
            f.write(payload.strip() + "\n")
            n += 1
    return n


def build_schema_with_ordering() -> dict[str, Any]:
    # Gemini 2.0 系では propertyOrdering が効く/要求されるケースがあるため付与しておく（害は少ない）
    schema = WkbkExplanation.model_json_schema()
    schema["propertyOrdering"] = [
        "key", "title", "lineage_key", "tags", "difficulty",
        "goal", "summary", "sequence", "common_mistakes", "next_hint",
    ]
    return schema


class RetryableGeminiError(RuntimeError):
    pass


class RetryableOpenAIError(RuntimeError):
    pass


class OpenAIErrorWithBody(RetryableOpenAIError):
    def __init__(self, message: str, raw_text: str | None):
        super().__init__(message)
        self.raw_text = raw_text


def _load_price_env(prefix: str) -> Tuple[float | None, float | None]:
    in_key = f"{prefix}_PRICE_INPUT_USD_PER_1K"
    out_key = f"{prefix}_PRICE_OUTPUT_USD_PER_1K"
    raw_in = os.environ.get(in_key, "").strip()
    raw_out = os.environ.get(out_key, "").strip()
    try:
        price_in = float(raw_in) if raw_in else None
    except ValueError:
        price_in = None
    try:
        price_out = float(raw_out) if raw_out else None
    except ValueError:
        price_out = None
    return price_in, price_out


def estimate_cost_usd(
    provider: str,
    prompt_tokens: int | None,
    completion_tokens: int | None,
) -> float | None:
    if prompt_tokens is None and completion_tokens is None:
        return None
    prompt_tokens = prompt_tokens or 0
    completion_tokens = completion_tokens or 0
    if provider == "openai":
        price_in, price_out = _load_price_env("OPENAI")
    else:
        price_in, price_out = _load_price_env("GEMINI")
    if price_in is None or price_out is None:
        return None
    return (prompt_tokens / 1000.0) * price_in + (completion_tokens / 1000.0) * price_out


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    retry=retry_if_exception_type(RetryableGeminiError),
    reraise=True,
)
def gemini_generate_json(
    client: genai.Client,
    model: str,
    system_prompt: str,
    user_text: str,
    response_schema: dict[str, Any],
) -> tuple[dict[str, Any], str, dict[str, int | None]]:
    prompt = f"{system_prompt}\n\n### INPUT\n{user_text}\n"
    try:
        resp = client.models.generate_content(
            model=model,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_json_schema=response_schema,
            ),
        )
        raw_text = (resp.text or "").strip()
        if not raw_text:
            raise RetryableGeminiError("Empty response text from Gemini.")
        try:
            payload = json.loads(raw_text)
        except json.JSONDecodeError as je:
            # 返答が JSON 以外になったケースはリトライ対象にする
            raise RetryableGeminiError(f"JSON decode failed: {je}") from je
        usage_meta = getattr(resp, "usage_metadata", None)
        prompt_tokens = getattr(usage_meta, "prompt_token_count", None) if usage_meta else None
        completion_tokens = getattr(usage_meta, "candidates_token_count", None) if usage_meta else None
        total_tokens = getattr(usage_meta, "total_token_count", None) if usage_meta else None
        return payload, raw_text, {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": total_tokens,
        }
    except RetryableGeminiError:
        raise
    except gax_exceptions.ResourceExhausted as e:
        detail = getattr(e, "message", "") or str(e)
        raise RetryableGeminiError(f"ResourceExhausted: {detail}") from e
    except gax_exceptions.TooManyRequests as e:
        detail = getattr(e, "message", "") or str(e)
        raise RetryableGeminiError(f"TooManyRequests: {detail}") from e
    except Exception as e:
        # ネットワーク/429/一時エラーなどもリトライ対象に寄せる
        raise RetryableGeminiError(f"Gemini call failed: {type(e).__name__}: {e}") from e


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    retry=retry_if_exception_type(RetryableOpenAIError),
    reraise=True,
)
def openai_generate_json(
    api_key: str,
    model: str,
    system_prompt: str,
    user_text: str,
    response_schema: dict[str, Any],
) -> tuple[dict[str, Any], str, dict[str, int | None]]:
    body = {
        "model": model,
        "input": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_text},
        ],
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "wkbk_explanation",
                "schema": response_schema,
                "strict": True,
            },
        },
    }
    req = urllib.request.Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw_text = resp.read().decode("utf-8")
        data = json.loads(raw_text)
        # Extract JSON payload
        payload_text = None
        output = data.get("output", [])
        if output:
            content = output[0].get("content", [])
            if content:
                payload_text = content[0].get("text")
        if not payload_text and "output_text" in data:
            payload_text = data.get("output_text")
        if not payload_text:
            raise RetryableOpenAIError("OpenAI response missing output text")
        payload = json.loads(payload_text)
        usage = data.get("usage") or {}
        return payload, payload_text, {
            "prompt_tokens": usage.get("input_tokens"),
            "completion_tokens": usage.get("output_tokens"),
            "total_tokens": usage.get("total_tokens"),
        }
    except urllib.error.HTTPError as e:
        raw = ""
        try:
            raw = e.read().decode("utf-8")
        except Exception:
            raw = ""
        raise OpenAIErrorWithBody(f"HTTP {e.code}: {raw[:300]}", raw) from e
    except RetryableOpenAIError:
        raise
    except Exception as e:
        raise RetryableOpenAIError(f"OpenAI call failed: {type(e).__name__}: {e}") from e


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", type=str, default=str(DEFAULT_IN))
    ap.add_argument("--db", type=str, default=str(DEFAULT_DB))
    ap.add_argument("--output", type=str, default=str(DEFAULT_OUT))
    ap.add_argument("--only-lineage", type=str, default=None)
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--max-items", type=int, default=None)
    ap.add_argument("--max-cost-usd", type=float, default=None)
    ap.add_argument("--max-rpm", type=float, default=None)
    ap.add_argument("--sleep-secs", type=float, default=0.0)
    ap.add_argument("--max-requests", type=int, default=50)
    ap.add_argument("--max-total-tokens", type=int, default=2_000_000)
    ap.add_argument("--max-estimated-cost-usd", type=float, default=5.0)
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--provider", type=str, choices=["openai", "gemini"], default=DEFAULT_PROVIDER)
    args = ap.parse_args()

    # 1) .env は repo root 固定（find_dotenv を使わない）
    load_dotenv(ROOT / ".env", override=True)
    had_google = os.environ.get("GOOGLE_API_KEY")
    os.environ.pop("GOOGLE_API_KEY", None)

    provider = args.provider
    if provider == "openai":
        api_key = os.environ.get("OPENAI_API_KEY", "").strip()
        if not api_key:
            print(
                "OPENAI_API_KEY is missing. Put it into .env at repo root or export it.\n"
                "Example .env:\n  OPENAI_API_KEY=xxxx\n  OPENAI_MODEL=gpt-4o-mini\n",
                file=sys.stderr,
            )
            return 2
        model = os.environ.get("OPENAI_MODEL", DEFAULT_OPENAI_MODEL).strip()
    else:
        api_key = os.environ.get("GEMINI_API_KEY", "").strip()
        if not api_key:
            print(
                "GEMINI_API_KEY is missing. Put it into .env at repo root or export it.\n"
                "Example .env:\n  GEMINI_API_KEY=xxxx\n  GEMINI_MODEL=gemini-2.0-flash-exp\n",
                file=sys.stderr,
            )
            return 2
        model = os.environ.get("GEMINI_MODEL", DEFAULT_GEMINI_MODEL).strip()

    in_path = Path(args.input)
    db_path = Path(args.db)
    out_path = Path(args.output)

    if had_google:
        print("warning: GOOGLE_API_KEY was set and has been removed to avoid conflicts.")
    print(f"using provider: {provider}")
    print(f"using model: {model}")
    print(f"using API key: {mask_key(api_key)}")

    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    ensure_db(conn)

    client = genai.Client(api_key=api_key) if provider == "gemini" else None
    schema = build_schema_with_ordering()

    # load + filter
    records: list[dict[str, Any]] = []
    for o in read_jsonl(in_path):
        if args.only_lineage and o.get("lineage_key") != args.only_lineage:
            continue
        records.append(o)

    matched = len(records)
    if args.limit is not None:
        records = records[: args.limit]
    if args.max_items is not None:
        records = records[: args.max_items]

    processed = 0
    done_ok = 0
    skipped_cache = 0
    errors = 0
    quota_exhausted = False
    total_cost = 0.0
    cost_guard_enabled = True
    guardrail_warned = False
    request_count = 0
    cumulative_prompt_tokens = 0
    cumulative_completion_tokens = 0
    cumulative_total_tokens = 0
    last_request_at: float | None = None

    for o in tqdm(records, desc="records"):
        key = o.get("key")
        if not key:
            continue

        if (not args.force) and db_get_status(conn, key) == "ok":
            skipped_cache += 1
            continue

        if request_count >= args.max_requests:
            db_upsert_error(
                conn,
                key,
                provider,
                model,
                None,
                None,
                None,
                None,
                "GuardrailExceeded",
                "guardrail: exceeded max-requests",
                None,
            )
            print("guardrail: exceeded max-requests; stopping.")
            break

        title = (o.get("title") or "").strip()
        lineage_key = (o.get("lineage_key") or "").strip()
        tags = o.get("tag_list") or []
        difficulty = o.get("difficulty")

        init_sfen = (o.get("init_sfen") or "").strip()
        moves_answers = o.get("moves_answers") or []
        # pick first solution as canonical
        solution = (moves_answers[0].get("moves_str") if moves_answers else "") or ""
        solution = solution.strip()

        user_text = json.dumps(
            {
                "key": key,
                "title": title,
                "lineage_key": lineage_key,
                "tags": tags,
                "difficulty": difficulty,
                "init_sfen": init_sfen,
                "answer_moves_usi": solution,
                "note": "answer_moves_usi は空白区切りのUSI手順です。sequence はこれと同じ手数で返してください。",
            },
            ensure_ascii=False,
        )

        raw_text: str | None = None
        usage = {"prompt_tokens": None, "completion_tokens": None, "total_tokens": None}
        if args.max_items is not None and processed >= args.max_items:
            break
        if args.max_cost_usd is not None and total_cost >= args.max_cost_usd:
            print(f"max-cost-usd reached: {total_cost:.6f} >= {args.max_cost_usd:.6f}. stopping.")
            break
        if args.max_total_tokens is not None and cumulative_total_tokens >= args.max_total_tokens:
            db_upsert_error(
                conn,
                key,
                provider,
                model,
                None,
                None,
                None,
                None,
                "GuardrailExceeded",
                "guardrail: exceeded max-total-tokens",
                None,
            )
            print("guardrail: exceeded max-total-tokens; stopping.")
            break
        if args.max_estimated_cost_usd is not None and total_cost >= args.max_estimated_cost_usd:
            db_upsert_error(
                conn,
                key,
                provider,
                model,
                None,
                None,
                None,
                None,
                "GuardrailExceeded",
                "guardrail: exceeded max-estimated-cost-usd",
                None,
            )
            print("guardrail: exceeded max-estimated-cost-usd; stopping.")
            break
        if args.max_rpm:
            min_interval = 60.0 / args.max_rpm
            if last_request_at is not None:
                elapsed = time.time() - last_request_at
                if elapsed < min_interval:
                    time.sleep(min_interval - elapsed)
        try:
            request_count += 1
            if provider == "openai":
                payload, raw_text, usage = openai_generate_json(api_key, model, SYSTEM_PROMPT, user_text, schema)
            else:
                payload, raw_text, usage = gemini_generate_json(client, model, SYSTEM_PROMPT, user_text, schema)
            # validate
            exp = WkbkExplanation.model_validate(payload)

            # ensure metadata (trust input more if model omitted)
            exp = exp.model_copy(
                update={
                    "key": key,
                    "title": title or exp.title,
                    "lineage_key": lineage_key or exp.lineage_key,
                    "tags": tags or exp.tags,
                    "difficulty": difficulty if difficulty is not None else exp.difficulty,
                }
            )

            estimated_cost = estimate_cost_usd(
                provider,
                usage.get("prompt_tokens"),
                usage.get("completion_tokens"),
            )
            if estimated_cost is None and not guardrail_warned:
                print("warning: price per 1K tokens not set; cost guardrails may be ineffective.")
                guardrail_warned = True
            if estimated_cost is not None:
                total_cost += estimated_cost
            prompt_tokens = usage.get("prompt_tokens") or 0
            completion_tokens = usage.get("completion_tokens") or 0
            total_tokens = usage.get("total_tokens")
            if total_tokens is None:
                total_tokens = prompt_tokens + completion_tokens
            cumulative_prompt_tokens += prompt_tokens
            cumulative_completion_tokens += completion_tokens
            cumulative_total_tokens += total_tokens
            if args.max_total_tokens is not None and cumulative_total_tokens > args.max_total_tokens:
                db_upsert_error(
                    conn,
                    key,
                    provider,
                    model,
                    usage.get("prompt_tokens"),
                    usage.get("completion_tokens"),
                    usage.get("total_tokens"),
                    estimated_cost,
                    "GuardrailExceeded",
                    "guardrail: exceeded max-total-tokens",
                    raw_text,
                )
                print("guardrail: exceeded max-total-tokens; stopping.")
                break
            if args.max_estimated_cost_usd is not None and estimated_cost is not None and total_cost > args.max_estimated_cost_usd:
                db_upsert_error(
                    conn,
                    key,
                    provider,
                    model,
                    usage.get("prompt_tokens"),
                    usage.get("completion_tokens"),
                    usage.get("total_tokens"),
                    estimated_cost,
                    "GuardrailExceeded",
                    "guardrail: exceeded max-estimated-cost-usd",
                    raw_text,
                )
                print("guardrail: exceeded max-estimated-cost-usd; stopping.")
                break
            db_upsert_ok(
                conn,
                key,
                exp.model_dump(),
                provider,
                model,
                usage.get("prompt_tokens"),
                usage.get("completion_tokens"),
                usage.get("total_tokens"),
                estimated_cost,
            )
            done_ok += 1
            print(
                f"[{key}] tokens in/out/total="
                f"{usage.get('prompt_tokens')}/{usage.get('completion_tokens')}/{usage.get('total_tokens')} "
                f"est_cost_usd={estimated_cost if estimated_cost is not None else 'n/a'}"
            )
            print(
                "cumulative tokens in/out/total="
                f"{cumulative_prompt_tokens}/{cumulative_completion_tokens}/{cumulative_total_tokens} "
                f"estimated_cost_usd={total_cost:.6f}"
            )
        except (ValidationError, Exception) as e:
            et = type(e).__name__
            em = str(e)
            if isinstance(e, OpenAIErrorWithBody) and raw_text is None:
                raw_text = e.raw_text
            if "ResourceExhausted" in em or "TooManyRequests" in em or "429" in em:
                quota_exhausted = True
            db_upsert_error(
                conn,
                key,
                provider,
                model,
                usage.get("prompt_tokens"),
                usage.get("completion_tokens"),
                usage.get("total_tokens"),
                None,
                et,
                em[:400],
                raw_text,
            )
            errors += 1
            print(f"[{key}] error: {et}: {em[:200]}")
            print(
                "cumulative tokens in/out/total="
                f"{cumulative_prompt_tokens}/{cumulative_completion_tokens}/{cumulative_total_tokens} "
                f"estimated_cost_usd={total_cost:.6f}"
            )
        processed += 1
        last_request_at = time.time()
        if args.sleep_secs:
            time.sleep(args.sleep_secs)

    rebuilt = rebuild_output(conn, out_path)

    print("----")
    print(f"input:   {in_path}")
    print(f"db:      {db_path}")
    print(f"output:  {out_path}")
    print(f"matched: {matched}")
    print(f"done:    {processed}")
    print(f"ok_count: {done_ok}")
    print(f"error_count: {errors}")
    print(f"skipped_cache: {skipped_cache}")
    print(f"estimated_total_cost_usd: {total_cost:.6f}")
    print(f"rebuilt output lines: {rebuilt}")
    print_recent_errors(conn, limit=5)
    if quota_exhausted:
        print("Note: 429/Resource exhausted detected. Please check Billing/Quota.")

    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
