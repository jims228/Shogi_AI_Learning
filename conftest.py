import os
import socket
import urllib.request
import pytest


@pytest.fixture(autouse=True)
def _disable_external_llm(monkeypatch: pytest.MonkeyPatch):
    """テスト中の外部LLM呼び出しを既定で無効化する。

    必要なら `ALLOW_EXTERNAL_LLM=1` で解除可能。
    """
    if os.getenv("ALLOW_EXTERNAL_LLM", "0") == "1":
        return

    monkeypatch.setenv("USE_LLM", "0")
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)


@pytest.fixture(autouse=True)
def _block_network(monkeypatch: pytest.MonkeyPatch):
    """テスト中の外部ネットワークを禁止。

    依存追加なしで、誤って外部へ出ようとした瞬間にFailさせる。
    必要なら `ALLOW_NETWORK=1` で解除。
    """
    if os.getenv("ALLOW_NETWORK", "0") == "1":
        return

    allowed_hosts = {"localhost", "127.0.0.1", "::1"}

    orig_connect = socket.socket.connect
    orig_connect_ex = socket.socket.connect_ex

    def _host_from_addr(address):
        # address: (host, port) or (host, port, flowinfo, scopeid)
        if isinstance(address, tuple) and len(address) >= 2:
            return address[0]
        return None

    def guarded_connect(self, address):
        host = _host_from_addr(address)
        if host in allowed_hosts:
            return orig_connect(self, address)
        raise RuntimeError(f"Network disabled in tests: connect({address})")

    def guarded_connect_ex(self, address):
        host = _host_from_addr(address)
        if host in allowed_hosts:
            return orig_connect_ex(self, address)
        raise RuntimeError(f"Network disabled in tests: connect_ex({address})")

    monkeypatch.setattr(socket.socket, "connect", guarded_connect, raising=True)
    monkeypatch.setattr(socket.socket, "connect_ex", guarded_connect_ex, raising=True)

    def blocked_urlopen(*args, **kwargs):
        raise RuntimeError("Network disabled in tests: urllib.request.urlopen()")

    monkeypatch.setattr(urllib.request, "urlopen", blocked_urlopen, raising=True)


@pytest.fixture
def runner():
    from test_reasoning_v2_standalone import TestRunner

    return TestRunner()
