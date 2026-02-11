# Security Maintenance

This repository has had secret-scanning guardrails added and may require history
rewrites if past secrets were committed.

## History rewrite (secrets purge)
If secret strings were committed in the past, run a history rewrite and force
push. This is **destructive** and affects collaborators.

Recommended steps (run on a clean working tree, in a throwaway branch):

1) Install git-filter-repo
```bash
git filter-repo --version
```
If missing, install it (one of):
```bash
sudo apt-get update && sudo apt-get install -y git-filter-repo
```
or
```bash
python3 -m pip install --user git-filter-repo
```

2) Create replace rules (no secret values included):
```bash
cat > /tmp/replace-secrets.txt <<'EOF'
regex:AIzaSy[0-9A-Za-z\-_]{20,}=REDACTED_GOOGLE_API_KEY
regex:sk-[0-9A-Za-z]{20,}=REDACTED_OPENAI_API_KEY
regex:Authorization:\s*Bearer\s+[0-9A-Za-z\-\._]+==>Authorization: Bearer REDACTED
regex:eyJ[0-9A-Za-z\-_]{10,}\.[0-9A-Za-z\-_]{10,}\.[0-9A-Za-z\-_]{10,}=REDACTED_JWT
EOF
```

3) Rewrite history:
```bash
git filter-repo --force --replace-text /tmp/replace-secrets.txt
```

4) Cleanup:
```bash
rm -rf .git/refs/original
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

5) Verify:
```bash
git log -S "AIzaSy" --all --oneline || true
git log -S "sk-" --all --oneline || true
git grep -n "AIzaSy" $(git rev-list --all) || true
git grep -n "sk-" $(git rev-list --all) || true
```

## Force push and collaborator guidance
- After a rewrite, you must force push:
  - `git push --force --all origin`
  - `git push --force --tags origin`
- Collaborators should re-clone or hard reset to the rewritten history:
  - **Re-clone** (recommended)
  - Or: `git fetch --all && git reset --hard origin/main && git clean -fd`

## Ongoing prevention
- Keep all keys in repo-root `.env` only.
- Run `python3 tools/scan_secrets.py` before commits.
- Enable pre-commit: `pre-commit install`
