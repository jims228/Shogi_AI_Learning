#!/usr/bin/env python3
import secrets


def main() -> None:
    # 32 bytes of randomness, URL-safe string (about 43 chars)
    print(secrets.token_urlsafe(32))


if __name__ == "__main__":
    main()
