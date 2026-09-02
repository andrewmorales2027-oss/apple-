"""A dependency-free HTTP server for the browser HUD.

Tokens reach the page over Server-Sent Events rather than a WebSocket: the
traffic is one-directional (the browser POSTs an utterance, the server streams
the answer back), and SSE needs no third-party package, no handshake and no
framing code.  That keeps the whole HUD in the standard library.
"""

from __future__ import annotations

import json
import logging
import queue
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from jarvis.core.assistant import Assistant

log = logging.getLogger("jarvis.server")

STATIC = Path(__file__).parent / "static"
MAX_BODY = 64 * 1024
LOCAL_HOSTS = {"localhost", "127.0.0.1", "[::1]", "::1"}


class Broadcaster:
    """Fan events out to every connected page."""

    def __init__(self) -> None:
        self._clients: list[queue.Queue[str]] = []
        self._lock = threading.Lock()

    def subscribe(self) -> queue.Queue[str]:
        channel: queue.Queue[str] = queue.Queue(maxsize=1000)
        with self._lock:
            self._clients.append(channel)
        return channel

    def unsubscribe(self, channel: queue.Queue[str]) -> None:
        with self._lock:
            if channel in self._clients:
                self._clients.remove(channel)

    def send(self, kind: str, **payload: Any) -> None:
        message = json.dumps({"type": kind, **payload})
        with self._lock:
            clients = list(self._clients)
        for channel in clients:
            try:
                channel.put_nowait(message)
            except queue.Full:
                # A page that cannot keep up gets dropped rather than blocking
                # the answer for everybody else.
                log.debug("dropping event for a slow client")

    @property
    def count(self) -> int:
        with self._lock:
            return len(self._clients)


class Handler(BaseHTTPRequestHandler):
    server_version = "JARVIS"
    protocol_version = "HTTP/1.1"

    # -- plumbing -------------------------------------------------------
    @property
    def assistant(self) -> Assistant:
        return self.server.assistant  # type: ignore[attr-defined]

    @property
    def events(self) -> Broadcaster:
        return self.server.events  # type: ignore[attr-defined]

    def log_message(self, fmt: str, *args: Any) -> None:
        log.debug("%s - %s", self.address_string(), fmt % args)

    def _send(self, status: int, body: bytes, content_type: str) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def _json(self, status: int, payload: dict[str, Any]) -> None:
        self._send(status, json.dumps(payload).encode(), "application/json; charset=utf-8")

    def _local_only(self) -> bool:
        """Reject requests that did not come from the loopback page.

        Without this, any website the user visits could POST to the assistant
        (or rebind DNS to this port) and drive it silently.
        """
        host = (self.headers.get("Host") or "").rsplit(":", 1)[0]
        if host and host not in LOCAL_HOSTS:
            return False
        origin = self.headers.get("Origin")
        if origin:
            hostname = urlparse(origin).hostname or ""
            if hostname not in LOCAL_HOSTS:
                return False
        return True

    # -- routes ---------------------------------------------------------
    def do_GET(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler's naming
        route = urlparse(self.path).path
        if not self._local_only():
            self._json(403, {"error": "this assistant only answers to localhost"})
            return
        if route in ("/", "/index.html"):
            self._serve_static("index.html", "text/html; charset=utf-8")
        elif route == "/health":
            self._json(200, {"ok": True, "clients": self.events.count})
        elif route == "/api/skills":
            self._json(200, {
                "skills": self.assistant.describe(),
                "brain": self.assistant.brain_ready,
                "name": self.assistant.config.name,
                "wake_word": self.assistant.config.wake_word,
            })
        elif route == "/api/events":
            self._stream_events()
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        route = urlparse(self.path).path
        if not self._local_only():
            self._json(403, {"error": "this assistant only answers to localhost"})
            return
        if route != "/api/ask":
            self._json(404, {"error": "not found"})
            return

        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            self._json(400, {"error": "bad content length"})
            return
        if length > MAX_BODY:
            self._json(413, {"error": "utterance too long"})
            return
        try:
            payload = json.loads(self.rfile.read(length) or b"{}")
            text = str(payload.get("text", ""))
            source = str(payload.get("source", "text"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            self._json(400, {"error": "expected JSON with a 'text' field"})
            return

        self.events.send("thinking", text=text)
        try:
            reply = self.assistant.ask(
                text,
                on_token=lambda chunk: self.events.send("token", text=chunk),
                on_tool=lambda name, args: self.events.send("tool", name=name, arguments=args),
                source=source,
            )
        except Exception as exc:  # noqa: BLE001 - a bad turn must not kill the server
            log.exception("ask failed")
            self.events.send("error", message=str(exc))
            self._json(500, {"error": str(exc)})
            return

        self.events.send("reply", **reply.as_dict())
        self._json(200, reply.as_dict())

    def _serve_static(self, name: str, content_type: str) -> None:
        path = (STATIC / name).resolve()
        if not path.is_file() or STATIC.resolve() not in path.parents:
            self._json(404, {"error": "not found"})
            return
        self._send(200, path.read_bytes(), content_type)

    def _stream_events(self) -> None:
        """Hold the connection open and push events as they happen."""
        channel = self.events.subscribe()
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self.end_headers()
        try:
            self.wfile.write(b": connected\n\n")
            self.wfile.flush()
            while True:
                try:
                    message = channel.get(timeout=15)
                except queue.Empty:
                    # A comment frame keeps proxies and browsers from timing
                    # the idle connection out.
                    self.wfile.write(b": keep-alive\n\n")
                    self.wfile.flush()
                    continue
                self.wfile.write(f"data: {message}\n\n".encode())
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass  # the page navigated away
        finally:
            self.events.unsubscribe(channel)


class JarvisServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, address: tuple[str, int], assistant: Assistant) -> None:
        super().__init__(address, Handler)
        self.assistant = assistant
        self.events = Broadcaster()
        # Timers firing are the one thing the assistant says unprompted.
        assistant.on_notify = lambda message: self.events.send("notify", text=message)


def serve(assistant: Assistant, host: str, port: int) -> JarvisServer:
    return JarvisServer((host, port), assistant)
