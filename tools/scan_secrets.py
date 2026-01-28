#!/usr/bin/env python3
"""
Scan repo for secret-like strings.

Rules:
- Do NOT print any secret contents.
- Print only file path and line number.
- Exit non-zero if any hit is found.
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path
from typing import Iterable, Iterator, Tuple


ROOT = Path(__file__).resolve().parents[1]

SKIP_DIRS = {
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

PATTERNS = [
    re.compile(r"AIzaSy[A-Za-z0-9_-]{10,}"),
    re.compile(r"sk-[A-Za-z0-9]{10,}"),
    re.compile(r"(?i)authorization\\s*:\\s*bearer\\s+\\S+"),
    re.compile(r"(?i)\\bbearer\\s+[A-Za-z0-9._-]{10,}"),
]


def iter_files(root: Path) -> Iterator[Path]:
    for current, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for name in files:
            path = Path(current) / name
            if path.is_file():
                yield path


def scan_file(path: Path) -> Iterable[Tuple[Path, int]]:
    try:
        with path.open("r", encoding="utf-8", errors="ignore") as f:
            for idx, line in enumerate(f, start=1):
                for pattern in PATTERNS:
                    if pattern.search(line):
                        yield path, idx
                        break
    except Exception:
        return


def main() -> int:
    hits: list[Tuple[Path, int]] = []
    for path in iter_files(ROOT):
        for hit in scan_file(path):
            hits.append(hit)

    if not hits:
        print("scan_secrets: ok (no hits)")
        return 0

    print("scan_secrets: potential secrets detected")
    for path, line_no in hits:
        rel = path.relative_to(ROOT)
        print(f"{rel}:{line_no}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
