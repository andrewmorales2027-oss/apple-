"""Command line entry points."""

from __future__ import annotations

import argparse
import logging
import sys
import time
import webbrowser
from typing import Any

from jarvis.config import load_config
from jarvis.core.assistant import Assistant

CYAN, AMBER, GREEN, DIM, RED, RESET = (
    "\033[36m", "\033[33m", "\033[32m", "\033[2m", "\033[31m", "\033[0m"
)


def _colour(stream: Any = sys.stdout) -> bool:
    return hasattr(stream, "isatty") and stream.isatty()


def paint(text: str, colour: str) -> str:
    return f"{colour}{text}{RESET}" if _colour() else text


def build_parser() -> argparse.ArgumentParser:
    # The global flags live on a parent parser so they are accepted on either
    # side of the subcommand - `jarvis --no-brain ask ...` and
    # `jarvis ask ... --no-brain` both work, which is what people actually type.
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--config", help="path to a jarvis.toml")
    common.add_argument("--model", help="override the Claude model")
    common.add_argument("--no-brain", action="store_true",
                        help="skills only; never call the API")
    common.add_argument("-v", "--verbose", action="store_true", help="debug logging")

    parser = argparse.ArgumentParser(
        prog="jarvis",
        parents=[common],
        description="A voice assistant with a reflex path and a reasoning path.",
    )
    sub = parser.add_subparsers(dest="command")
    sub.add_parser("chat", parents=[common], help="interactive text session (default)")

    ask = sub.add_parser("ask", parents=[common], help="answer one utterance and exit")
    ask.add_argument("utterance", nargs="+")

    serve = sub.add_parser("serve", parents=[common], help="run the browser HUD")
    serve.add_argument("--host"), serve.add_argument("--port", type=int)
    serve.add_argument("--open", action="store_true", help="open a browser on start")

    sub.add_parser("listen", parents=[common],
                   help="native microphone loop (needs the voice extras)")
    sub.add_parser("skills", parents=[common], help="list every registered skill")

    explain = sub.add_parser("explain", parents=[common], help="show how an utterance routes")
    explain.add_argument("utterance", nargs="+")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.WARNING,
        format="%(levelname)s %(name)s: %(message)s",
    )

    overrides: dict[str, Any] = {}
    if args.model:
        overrides["model"] = args.model
    if args.no_brain:
        overrides["brain_enabled"] = False
    if getattr(args, "host", None):
        overrides["host"] = args.host
    if getattr(args, "port", None):
        overrides["port"] = args.port

    config = load_config(args.config, **overrides)
    assistant = Assistant(config)
    try:
        command = args.command or "chat"
        if command == "chat":
            return run_chat(assistant)
        if command == "ask":
            return run_once(assistant, " ".join(args.utterance))
        if command == "serve":
            return run_server(assistant, open_browser=args.open)
        if command == "listen":
            return run_listen(assistant)
        if command == "skills":
            return run_skills(assistant)
        if command == "explain":
            return run_explain(assistant, " ".join(args.utterance))
    finally:
        assistant.shutdown()
    return 0


def _banner(assistant: Assistant) -> None:
    config = assistant.config
    brain = paint("Claude online", GREEN) if assistant.brain_ready else paint("skills only", DIM)
    print(paint(f"  {config.name}", CYAN), paint(f"· {len(assistant.registry)} skills · {brain}", DIM))


def run_chat(assistant: Assistant) -> int:
    _banner(assistant)
    print(paint("  Type an utterance, or 'exit'. Ctrl-C stops.\n", DIM))
    assistant.on_notify = lambda message: print(f"\n{paint('◆ ' + message, AMBER)}\n> ", end="")

    while True:
        try:
            text = input(paint("> ", CYAN))
        except (EOFError, KeyboardInterrupt):
            print()
            return 0
        if text.strip().lower() in {"exit", "quit", "bye"}:
            return 0
        if not text.strip():
            continue

        streamed = False

        def on_token(chunk: str) -> None:
            nonlocal streamed
            if not streamed:
                print(paint("  ", DIM), end="")
                streamed = True
            print(chunk, end="", flush=True)

        def on_tool(name: str, arguments: dict) -> None:
            print(paint(f"  · {name}({_short(arguments)})", DIM))

        reply = assistant.ask(text, on_token=on_token, on_tool=on_tool)
        if streamed:
            print()
        else:
            colour = RED if reply.data.get("error") else ""
            print(paint(f"  {reply.display}", colour) if colour else f"  {reply.display}")
        if reply.skill or reply.path != "reflex":
            tag = reply.skill or reply.path
            print(paint(f"  [{reply.path}: {tag}]\n", DIM))
        else:
            print()


def _short(arguments: dict) -> str:
    parts = [f"{k}={v!r}" for k, v in arguments.items()]
    joined = ", ".join(parts)
    return joined if len(joined) <= 60 else joined[:57] + "..."


def run_once(assistant: Assistant, utterance: str) -> int:
    reply = assistant.ask(utterance, on_token=lambda chunk: print(chunk, end="", flush=True))
    if reply.path != "brain":
        print(reply.display)
    else:
        print()
    return 0


def run_server(assistant: Assistant, open_browser: bool = False) -> int:
    from jarvis.server.app import serve

    config = assistant.config
    server = serve(assistant, config.host, config.port)
    url = f"http://{config.host}:{config.port}"
    _banner(assistant)
    print(paint(f"  HUD on {url}", CYAN))
    print(paint("  Voice runs in the browser - no audio packages needed.", DIM))
    print(paint("  Ctrl-C to stop.\n", DIM))
    if open_browser:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print(paint("\n  Shutting down.", DIM))
    finally:
        server.shutdown()
        server.server_close()
    return 0


def run_listen(assistant: Assistant) -> int:
    from jarvis.voice.speech import Ears, Speaker

    config = assistant.config
    speaker = Speaker(config.speech_rate, config.voice_id, config.mute)
    ears = Ears(config.wake_word)
    if not ears.available:
        print(paint(f"  Cannot listen: {ears.error}", RED))
        print(paint("  Try `jarvis serve` instead - the browser HUD needs nothing "
                    "installed.", DIM))
        return 1

    _banner(assistant)
    print(paint(f"  Listening. Say “{config.wake_word}” then your request.\n", CYAN))
    assistant.on_notify = lambda message: (print(paint(f"◆ {message}", AMBER)), speaker.say(message))
    if speaker.available:
        speaker.say(f"{config.name} online.")

    while True:
        try:
            heard = ears.listen()
            if not heard:
                continue
            woken, command = ears.strip_wake_word(heard)
            if not woken or not command:
                continue
            print(paint(f"> {command}", DIM))
            reply = assistant.ask(command, source="voice")
            print(f"  {reply.speech}")
            speaker.say(reply.speech)
        except KeyboardInterrupt:
            print(paint("\n  Standing down.", DIM))
            return 0


def run_skills(assistant: Assistant) -> int:
    for entry in assistant.describe():
        flag = "" if entry["tool"] else paint("  (reflex only)", DIM)
        print(f"{paint(entry['name'], CYAN)}{flag}")
        print(f"  {entry['description']}")
        for example in entry["examples"]:
            print(paint(f'  e.g. "{example}"', DIM))
        print()
    print(paint(f"{len(assistant.registry)} skills, "
                f"{len(assistant.registry.tools())} of them offered to Claude.", DIM))
    return 0


def run_explain(assistant: Assistant, utterance: str) -> int:
    from jarvis.core.skills import normalize

    print(f'utterance : "{utterance}"')
    print(f'normalised: "{normalize(utterance)}"')
    print(f"threshold : {assistant.router.threshold}\n")
    ranked = assistant.explain(utterance)
    if not ranked:
        print("No skill matched. This would go to the brain.")
        return 0
    for row in ranked:
        mark = paint("ROUTED", GREEN) if row["routed"] else paint("below ", DIM)
        print(f"{mark} {row['score']:>5.2f}  {row['skill']:<20} {row['arguments'] or ''}")
    if not any(row["routed"] for row in ranked):
        print("\nNothing cleared the threshold - this would go to the brain.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
