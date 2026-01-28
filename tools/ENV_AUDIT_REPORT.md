# Env/Secret Audit Report

## Env file inventory
See `tools/ENV_FILE_INVENTORY.md`.

## Secret-like string locations (path:line)
These are **matches on keywords only**; values are not included.

- `tools/LLM_CALL_SITES.md`: 7, 19, 33
- `tools/generate_wkbk_explanations_gemini.py`: 8, 21, 22, 53, 54, 55, 352, 367, 420, 443, 501, 506, 507, 510, 511, 514, 515, 519, 521, 524, 525, 529, 536, 545, 673, 674, 676
- `README.md`: 48, 58, 64, 65, 75
- `.env.example`: 12, 13, 15, 16, 21, 22, 26, 27, 28
- `tools/env_audit.py`: 69, 70, 71, 72, 73, 76, 77, 78, 79, 80, 83, 85
- `backend/api/auth.py`: 46, 47, 52, 83, 86, 103
- `backend/api/services/ai_service.py`: 33, 34, 45, 53, 56, 57, 59, 212, 258, 307
- `backend/api/utils/shogi_explain_core.py`: 792, 802, 803, 806, 837, 838
- `test_reasoning_v2_standalone.py`: 271, 282, 283, 284, 287, 290, 291, 292, 293
- `tests/ai/test_reasoning_v2.py`: 258, 269, 270, 271, 272, 275, 276, 277, 278, 280, 286, 290, 299, 302
- `test_ai_reasoning.py`: 61, 62, 64, 75, 76, 78, 79, 228, 229
- `scripts/entrypoint.sh`: 8, 51, 52, 53, 57, 58, 59, 64
- `scripts/run_backend.sh`: 31, 32, 33, 36, 37
- `conftest.py`: 17, 18
- `docker-compose.yml`: 16
- `backend/api/test_explain.py`: 8, 53, 54, 62
- `backend/ai/reasoning_llm.py`: 39, 41, 43, 55, 67, 77, 84, 124, 184, 196, 201, 221, 245, 289, 428, 431, 432, 433, 434, 505, 536, 537, 538, 539, 544, 546, 561, 587, 641, 643, 659
- `.env.prod.example`: 47, 48, 50, 51, 53, 54
- `AI_REASONING_README.md`: 58, 61, 62, 65, 67, 68, 85, 86, 92, 93, 183
- `.github/workflows/api-tests.yml`: 23, 24
- `.github/workflows/monorepo-ci.yml`: 15, 16
- `backend/api/ai_explanation.py`: 12, 89
- `backend/api/check_models.py`: 9, 13
- `backend/ai/reasoning.py`: 470, 477, 488, 489, 490, 491, 526, 527, 528, 529
- `backend/api/conftest.py`: 5
- `backend/app/main.py`: 60, 62

## Git history scan (secret patterns)
- `git log -S "AIzaSy" --all --oneline`: **hits found**
  - 90fdac3
  - a427283
  - 7c1c321
- `git log -S "sk-" --all --oneline`: **no hits**
- `git grep -n "AIzaSy" $(git rev-list --all)`: **no hits in current scan**
- `git grep -n "sk-" $(git rev-list --all)`: **no hits**

Note: History hits indicate past inclusion; consider history rewrite if you need complete removal.
