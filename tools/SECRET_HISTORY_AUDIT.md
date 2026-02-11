# Secret History Audit

Commands executed:

- `git log -S "AIzaSy" --all --oneline`
- `git log -S "sk-" --all --oneline`
- `git grep -n "AIzaSy" || true`
- `git grep -n "sk-" || true`

Results:

- `git log -S "AIzaSy"`: hits found
  - 8b886f7
  - 90fdac3
  - a427283
  - 7c1c321
- `git log -S "sk-"`: no hits
- `git grep -n "AIzaSy"`: matches only in audit/report/regex files (no secrets printed)
- `git grep -n "sk-"`: matches only in audit/report/regex files (no secrets printed)

Notes:
- git-filter-repo is required for history rewrite; install it before running purge.
