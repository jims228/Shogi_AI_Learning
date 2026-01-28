#!/usr/bin/env python3
"""
Environment audit helper.

Shows:
- current working directory and repo root
- detected .env/.env.* and .envrc files (repo-wide)
- effective GEMINI envs after loading ROOT/.env
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Iterable

from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parents[1]


def iter_env_files(root: Path) -> Iterable[Path]:
    skip_dirs = {
        ".git",
        "node_modules",
        ".venv",
        "venv",
        ".mypy_cache",
        ".pytest_cache",
        ".ruff_cache",
        ".pnpm-store",
        ".next",
        ".turbo",
        "dist",
        "build",
    }
    for current, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in skip_dirs]
        for name in files:
            if name == ".env" or name == ".envrc" or name.startswith(".env."):
                yield Path(current) / name


def mask_key(key: str) -> str:
    key = key or ""
    if not key:
        return "(unset)"
    return f"{key[:6]}...(len={len(key)})"


def main() -> int:
    cwd = Path.cwd()
    print(f"cwd:       {cwd}")
    print(f"repo root: {ROOT}")
    print("")

    env_files = sorted(iter_env_files(ROOT), key=lambda p: str(p))
    print("detected env files:")
    if not env_files:
        print("- (none)")
    else:
        for p in env_files:
            print(f"- {p.relative_to(ROOT)}")
    print("")

    # Load root .env only
    load_dotenv(ROOT / ".env", override=True)

    gemini_key = os.environ.get("GEMINI_API_KEY", "")
    google_key = os.environ.get("GOOGLE_API_KEY", "")
    gemini_model = os.environ.get("GEMINI_MODEL", "")
    openai_key = os.environ.get("OPENAI_API_KEY", "")
    openai_model = os.environ.get("OPENAI_MODEL", "")

    print("effective env after load_dotenv(ROOT/.env):")
    print(f"- GEMINI_API_KEY: {mask_key(gemini_key)}")
    print(f"- GOOGLE_API_KEY: {mask_key(google_key)}")
    print(f"- GEMINI_MODEL:   {gemini_model or '(unset)'}")
    print(f"- OPENAI_API_KEY: {mask_key(openai_key)}")
    print(f"- OPENAI_MODEL:   {openai_model or '(unset)'}")

    if google_key:
        print("warning: GOOGLE_API_KEY is set; remove/unset it to avoid conflicts.")
    print("")
    print("direnv hint: if you use direnv, run `direnv status` and ensure .envrc does NOT export GEMINI_* or GOOGLE_API_KEY.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
