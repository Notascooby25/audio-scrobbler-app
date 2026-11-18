"""The app is written in UK English.

This scans the text strings in the backend and worker for common American spellings (colour,
favourite, authorise, normalise, ...). Names such as `accent_color`, `authorization_url` and
`color_service` are code, not text: a match must be a whole word on its own, so identifiers and
dictionary keys are never touched. Docstrings and comments are developer notes and are not scanned.
"""

from __future__ import annotations

import ast
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SCAN_DIRS = [ROOT / "backend" / "app", ROOT / "worker"]
SKIP_PARTS = {"tests", "migrations", "data", "__pycache__", "venv", ".venv"}

US_WORDS = [
    r"colors?",
    r"colored",
    r"coloring",
    r"colorful",
    r"favorites?",
    r"customiz\w*",
    r"catalogs?",
    r"authoriz\w*",
    r"normaliz\w*",
    r"analyz\w*",
    r"optimiz\w*",
    r"recogniz\w*",
    r"summariz\w*",
    r"personaliz\w*",
    r"prioritiz\w*",
    r"organiz\w*",
    r"visualiz\w*",
    r"synchroniz\w*",
    r"initializ\w*",
    r"utiliz\w*",
    r"emphasiz\w*",
    r"behaviors?",
    r"neighbors?",
    r"gray",
    r"canceled",
    r"canceling",
    r"traveled",
    r"traveling",
    r"labeled",
    r"labeling",
    r"theater",
    r"centered",
    r"centering",
]
WORD = re.compile(r"(?<![-_\w$.])(" + "|".join(US_WORDS) + r")(?![-_\w]|\s*:)", re.I)
NOT_PROSE = re.compile(r"^[\w./:-]+$|^\s*\w+\s*\(")


def find_american_spellings(source: str) -> list[str]:
    tree = ast.parse(source)
    docstrings: set[int] = set()
    for node in ast.walk(tree):
        if isinstance(node, (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
            body = getattr(node, "body", [])
            if body and isinstance(body[0], ast.Expr) and isinstance(body[0].value, ast.Constant):
                docstrings.add(id(body[0].value))
    # An f-string arrives in pieces; read it as one sentence, with a placeholder where each value goes.
    pieces: set[int] = set()
    texts: list[tuple[int, str]] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.JoinedStr):
            parts = []
            for part in node.values:
                if isinstance(part, ast.Constant):
                    pieces.add(id(part))
                    parts.append(str(part.value))
                else:
                    parts.append("{}")
            texts.append((node.lineno, "".join(parts)))
    for node in ast.walk(tree):
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            if id(node) not in docstrings and id(node) not in pieces:
                texts.append((node.lineno, node.value))
    found: list[str] = []
    for lineno, text in texts:
        if not re.search(r"\s", text.strip()) or NOT_PROSE.search(text):
            continue
        for word in WORD.finditer(text):
            found.append(f"line {lineno}: {word.group(0)!r} in: {text.strip()[:90]!r}")
    return found


def test_the_detector_flags_american_spellings_and_ignores_code_names():
    assert len(find_american_spellings('x = "Choose your favorite colors"')) == 2
    assert find_american_spellings('x = "Choose your favourite colours"') == []
    assert find_american_spellings('x = {"accent_color": "Unsupported accent colour"}') == []
    assert find_american_spellings('x = "authorization_url"') == []
    assert find_american_spellings('def f():\n    """Normalize the name."""\n    return 1') == []
    assert len(find_american_spellings('x = f"Failed to extract color for {name}"')) == 1


def test_no_american_spellings_in_backend_or_worker_text():
    problems: list[str] = []
    for base in SCAN_DIRS:
        for path in sorted(base.rglob("*.py")):
            if SKIP_PARTS & set(path.relative_to(ROOT).parts):
                continue
            for entry in find_american_spellings(path.read_text(encoding="utf-8")):
                problems.append(f"{path.relative_to(ROOT)} {entry}")
    assert problems == []


def test_every_persona_the_backend_can_return_has_an_icon_in_the_frontend():
    """The persona badge name is also a lookup key in the frontend, so the two must be spelt alike."""
    backend = (ROOT / "backend" / "app" / "services" / "analytics_service.py").read_text(encoding="utf-8")
    start = backend.index("(night_count / total) >= 0.30")
    names = set(re.findall(r'return "([^"]+)"', backend[start : start + 600]))
    frontend = (ROOT / "frontend" / "src" / "components" / "reports" / "ReportMilestones.jsx").read_text(
        encoding="utf-8"
    )
    icons = set(re.findall(r'"([^"]+)":\s*"[^"]*",', frontend[frontend.index("personaIcons") :][:400]))
    assert names == {"Night Owl", "Weekend Warrior", "Discovery Voyager", "Catalogue Loyalist", "Deep Diver"}
    assert names <= icons
