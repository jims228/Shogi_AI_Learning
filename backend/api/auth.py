from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional, Set

from fastapi import Header, HTTPException, status


@dataclass(frozen=True)
class Principal:
    scheme: str
    subject: str


def _parse_api_keys(raw: str) -> Set[str]:
    keys = set()
    for part in (raw or "").split(","):
        k = part.strip()
        if k:
            keys.add(k)
    return keys


def get_configured_api_keys() -> Set[str]:
    """Return configured API keys (empty means auth disabled).

    This is intentionally simple so it can be replaced with JWT validation later.
    """
    return _parse_api_keys(os.getenv("API_KEYS", ""))


def get_principal(api_key: str) -> Principal:
    """Map an authenticated credential to a principal.

    Future JWT migration: replace this with token decode + claims mapping.
    """
    return Principal(scheme="api_key", subject=api_key)


def require_api_key(x_api_key: Optional[str] = Header(default=None, alias="X-API-Key")) -> Principal:
    """FastAPI dependency: validates X-API-Key against API_KEYS.

    - If API_KEYS is empty/unset: no-op (keeps local dev/tests unchanged).
    - If API_KEYS is set: missing/invalid key returns 401.
    """
    keys = get_configured_api_keys()
    # Security guardrail: if LLM is enabled, require API_KEYS to be configured.
    if not keys:
        if (os.getenv("USE_LLM", "0") or "0") == "1":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="API_KEYS must be set when USE_LLM=1",
            )
        return Principal(scheme="none", subject="anonymous")

    if not x_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-API-Key",
        )

    if x_api_key not in keys:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid X-API-Key",
        )

    return get_principal(x_api_key)
