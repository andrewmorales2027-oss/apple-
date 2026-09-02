"""The HUD server, exercised over a real socket."""

from __future__ import annotations

import json
import threading
import urllib.error
import urllib.request

import pytest

from jarvis import Assistant
from jarvis.server.app import serve


@pytest.fixture
def server(config):
    assistant = Assistant(config)
    instance = serve(assistant, "127.0.0.1", 0)
    thread = threading.Thread(target=instance.serve_forever, daemon=True)
    thread.start()
    yield instance, f"http://127.0.0.1:{instance.server_address[1]}"
    instance.shutdown()
    instance.server_close()
    assistant.shutdown()


def get(url, headers=None):
    request = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(request, timeout=5) as response:
        return response.status, json.loads(response.read())


def post(url, payload, headers=None):
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", **(headers or {})},
    )
    with urllib.request.urlopen(request, timeout=5) as response:
        return response.status, json.loads(response.read())


def test_health(server):
    _, base = server
    status, body = get(f"{base}/health")
    assert status == 200 and body["ok"] is True


def test_the_page_is_served(server):
    _, base = server
    with urllib.request.urlopen(f"{base}/", timeout=5) as response:
        body = response.read().decode()
    assert response.status == 200
    assert "<title>JARVIS</title>" in body


def test_skills_endpoint_describes_the_assistant(server):
    _, base = server
    _, body = get(f"{base}/api/skills")
    assert body["brain"] is False
    assert len(body["skills"]) > 10
    assert body["wake_word"] == "jarvis"


def test_asking_returns_the_reply(server):
    _, base = server
    status, body = post(f"{base}/api/ask", {"text": "what is 6 times 7"})
    assert status == 200
    assert body["speech"].startswith("42")
    assert body["path"] == "reflex"


def test_events_stream_carries_the_reply(server):
    instance, base = server
    channel = instance.events.subscribe()
    post(f"{base}/api/ask", {"text": "what is 2 plus 2"})
    kinds = []
    while not channel.empty():
        kinds.append(json.loads(channel.get_nowait())["type"])
    assert "thinking" in kinds and "reply" in kinds


def test_a_cross_origin_post_is_refused(server):
    """Any page the user visits could otherwise drive the assistant."""
    _, base = server
    with pytest.raises(urllib.error.HTTPError) as caught:
        post(f"{base}/api/ask", {"text": "hello"}, {"Origin": "https://evil.example"})
    assert caught.value.code == 403


def test_a_rebound_host_header_is_refused(server):
    """Guards against DNS rebinding onto the loopback port."""
    _, base = server
    with pytest.raises(urllib.error.HTTPError) as caught:
        get(f"{base}/health", {"Host": "evil.example"})
    assert caught.value.code == 403


def test_an_oversized_body_is_rejected(server):
    _, base = server
    with pytest.raises(urllib.error.HTTPError) as caught:
        post(f"{base}/api/ask", {"text": "x" * 70_000})
    assert caught.value.code == 413


def test_malformed_json_is_a_400(server):
    _, base = server
    request = urllib.request.Request(
        f"{base}/api/ask", data=b"not json",
        headers={"Content-Type": "application/json"},
    )
    with pytest.raises(urllib.error.HTTPError) as caught:
        urllib.request.urlopen(request, timeout=5)
    assert caught.value.code == 400


def test_unknown_routes_are_404(server):
    _, base = server
    with pytest.raises(urllib.error.HTTPError) as caught:
        get(f"{base}/api/nope")
    assert caught.value.code == 404
