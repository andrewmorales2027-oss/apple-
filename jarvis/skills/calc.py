"""Arithmetic, evaluated without ``eval``."""

from __future__ import annotations

import ast
import operator
import re

from jarvis.core.skills import Reply, skill

_OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
}
_UNARY = {ast.UAdd: operator.pos, ast.USub: operator.neg}

_WORDS = [
    (r"\bplus\b|\band\b", "+"),
    (r"\bminus\b|\bless\b", "-"),
    (r"\btimes\b|\bmultiplied by\b", "*"),
    (r"\bdivided by\b|\bover\b", "/"),
    (r"\bto the power of\b|\bsquared\b", "**"),
    (r"\bmod(?:ulo)?\b", "%"),
    (r"\bpercent of\b", "/100*"),
    (r"\^", "**"),
]
# A power big enough to hang the process is a denial of service, not a sum.
_MAX_EXPONENT = 64


class UnsafeExpression(ValueError):
    """The expression contains something we refuse to evaluate."""


def to_expression(text: str) -> str:
    """Turn spoken arithmetic into something Python's parser accepts."""
    expression = text.strip().lower().rstrip("?=.")
    if "squared" in expression:
        expression = re.sub(r"(\d+(?:\.\d+)?)\s*squared", r"\1**2", expression)
    for pattern, symbol in _WORDS:
        expression = re.sub(pattern, symbol, expression)
    expression = expression.replace("x", "*").replace("×", "*").replace("÷", "/")
    expression = re.sub(r"(?<=\d),(?=\d{3}\b)", "", expression)  # 1,000 -> 1000
    return " ".join(expression.split())


def evaluate(expression: str) -> float:
    """Evaluate arithmetic safely by walking the AST ourselves."""
    try:
        tree = ast.parse(expression, mode="eval")
    except SyntaxError as exc:
        raise UnsafeExpression(f"that is not an expression I can parse: {exc.msg}") from exc
    return _walk(tree.body)


def _walk(node: ast.AST) -> float:
    if isinstance(node, ast.Constant):
        if isinstance(node.value, bool) or not isinstance(node.value, (int, float)):
            raise UnsafeExpression("only numbers are allowed")
        return node.value
    if isinstance(node, ast.BinOp):
        handler = _OPERATORS.get(type(node.op))
        if handler is None:
            raise UnsafeExpression("that operator is not allowed")
        left, right = _walk(node.left), _walk(node.right)
        if isinstance(node.op, ast.Pow) and abs(right) > _MAX_EXPONENT:
            raise UnsafeExpression("that exponent is too large")
        if isinstance(node.op, (ast.Div, ast.FloorDiv, ast.Mod)) and right == 0:
            raise UnsafeExpression("division by zero")
        return handler(left, right)
    if isinstance(node, ast.UnaryOp):
        handler = _UNARY.get(type(node.op))
        if handler is None:
            raise UnsafeExpression("that operator is not allowed")
        return handler(_walk(node.operand))
    raise UnsafeExpression("only plain arithmetic is allowed")


def _format(value: float) -> str:
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    if isinstance(value, float):
        value = round(value, 6)
    return f"{value:,}"


@skill(
    "calculate",
    "Evaluate an arithmetic expression. Supports + - * / % and powers.",
    patterns=[
        r"\b(?:what(?:'s| is)|calculate|compute|work out|how much is)\s+"
        r"(?P<expression>[\d(][\d\s+\-*/%^().,]*[\d)])\s*$",
        r"^(?P<expression>[\d(][\d\s+\-*/%^().,]*[\d)])$",
        r"\b(?:what(?:'s| is)|calculate|compute|work out|how much is)\s+"
        r"(?P<expression>\d[\d.,\s]*(?:plus|minus|times|multiplied by|divided by|over|"
        r"to the power of|percent of|squared)[\w\s\d.,]*)$",
    ],
    parameters={
        "expression": {
            "type": "string",
            "description": "Arithmetic to evaluate, e.g. '17 * 3 + 2'.",
        }
    },
    required=["expression"],
    # Above 1.0 so a sum beats the broader question-shaped skills on a tie.
    weight=1.1,
    examples=["what is 17 times 3", "calculate 240 / 8"],
)
def calculate(expression: str) -> Reply:
    prepared = to_expression(expression)
    if not prepared:
        return Reply(speech="There was no expression to work out.")
    try:
        value = evaluate(prepared)
    except UnsafeExpression as exc:
        return Reply(speech=f"I cannot do that one: {exc}.")
    except (OverflowError, ZeroDivisionError):
        return Reply(speech="That does not have a finite answer.")
    return Reply(
        speech=f"{_format(value)}.",
        display=f"{prepared} = {_format(value)}",
        data={"expression": prepared, "result": value},
    )
