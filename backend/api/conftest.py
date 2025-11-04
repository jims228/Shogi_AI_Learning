import os
import pytest

# Ensure tests run without real OpenAI key or large engine time settings
os.environ.setdefault("OPENAI_API_KEY", "")
os.environ.setdefault("ENGINE_PER_MOVE_MS", "10")
os.environ.setdefault("ENGINE_HASH_MB", "16")


def _make_dummy_engine(api_main):
    """Return a dummy engine object that provides the minimal interface used by tests.

    The real engine is a USIEngine instance which would try to spawn a process
    on startup. Tests (and CI) should not require a real engine binary, so we
    replace it with this light-weight dummy that responds synchronously.
    """

    class DummyEngine:
        def start(self):
            # no-op for startup
            return None

        def quit(self):
            # no-op for shutdown
            return None

        def analyze(self, req):
            # Provide a minimal AnalyzeResponse-like object using types from main
            PVItem = api_main.PVItem
            AnalyzeResponse = api_main.AnalyzeResponse
            # Construct a trivial PV item and response
            pv = PVItem(move="7g7f", score_cp=0, score_mate=None, depth=1, pv=["7g7f"])
            return AnalyzeResponse(bestmove="7g7f", candidates=[pv])

        def set_options(self, opts):
            # Return a SettingsResponse-like object to satisfy callers
            SettingsResponse = api_main.SettingsResponse
            return SettingsResponse(ok=True, applied={})

    return DummyEngine()


@pytest.fixture(autouse=True, scope="session")
def replace_engine_for_tests():
    """Autouse fixture that replaces backend.api.main.engine with a dummy engine.

    This fixture runs once per test session before test modules are imported,
    ensuring that TestClient creation (which triggers FastAPI startup) will
    call the dummy engine.start instead of trying to spawn a real process.
    """
    # Import here so conftest is processed before test modules import backend.api.main
    import importlib

    api_main = importlib.import_module("backend.api.main")

    # Replace the engine with a dummy implementation
    api_main.engine = _make_dummy_engine(api_main)

    # yield to allow tests to run; teardown is unnecessary for the dummy
    yield
