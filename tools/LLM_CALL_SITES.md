# LLM Call Sites Audit

This memo lists places that call LLM APIs (Gemini/OpenAI) and notes whether they
are batch/loop/parallel. This is a static audit for guardrail visibility.

## Batch / loop call sites
- `tools/generate_wkbk_explanations_gemini.py`
  - **Batch loop** over JSONL records (sequential, 1 request per item by default).
  - Guardrails should stop large runs.

## Request-time call sites (per API request)
- `backend/api/services/ai_service.py`
  - Uses `google.generativeai` when LLM features are enabled.
  - **Per API call**, not a batch loop.
- `backend/api/utils/shogi_explain_core.py`
  - References Gemini envs; used in API request flow.
  - **Per API call**, no explicit batch loop.
- `backend/api/ai_explanation.py`
  - Reads `GEMINI_API_KEY`, used in API handlers.
  - **Per API call**.
- `backend/ai/reasoning_llm.py`
  - Gemini/OpenAI calls with fallback loops (model/version retry).
  - **Per call**, but may iterate over fallback candidates.

## Tests / tools that may call LLM
- `backend/api/check_models.py`
  - Local check; can hit LLM depending on env.
- `test_ai_reasoning.py`, `test_reasoning_v2_standalone.py`, `tests/ai/test_reasoning_v2.py`
  - May call LLM if env is set; ensure guardrails in tools for batch runs.

## Notes
- No `.envrc` in repo; main risk is manual exports or non-root `.env` files.
- For batch runs, use the guardrails in `tools/generate_wkbk_explanations_gemini.py`.
