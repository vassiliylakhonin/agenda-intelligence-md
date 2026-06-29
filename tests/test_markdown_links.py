import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MARKDOWN_LINK_RE = re.compile(r"\[[^\]]+\]\(([^)]+)\)")
URI_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9+.-]*:")
SKIP_DIRS = {
    ".git",
    ".mypy_cache",
    ".pytest_cache",
    ".ruff_cache",
    ".venv",
    ".wheel-smoke-venv",
    "node_modules",
}


def _markdown_files() -> list[Path]:
    return [path for path in ROOT.rglob("*.md") if not any(part in SKIP_DIRS for part in path.relative_to(ROOT).parts)]


def _local_markdown_target(raw_target: str) -> str | None:
    target = raw_target.split("#", 1)[0].strip()
    if not target or target.startswith("#") or URI_RE.match(target):
        return None
    if target.startswith("<") and target.endswith(">"):
        target = target[1:-1]
    return target or None


def test_relative_markdown_links_resolve():
    """Relative markdown links should not point agents at missing repo files.

    External URLs are intentionally out of scope; this is a local authoring
    guard for repo-internal docs, examples, packaged mirrors, and release notes.
    """
    missing = []
    for path in _markdown_files():
        text = path.read_text(encoding="utf-8")
        for match in MARKDOWN_LINK_RE.finditer(text):
            target = _local_markdown_target(match.group(1))
            if target is None:
                continue
            resolved = (path.parent / target).resolve()
            try:
                resolved.relative_to(ROOT)
            except ValueError:
                continue
            if not resolved.exists():
                line = text.count("\n", 0, match.start()) + 1
                missing.append(f"{path.relative_to(ROOT)}:{line} -> {target}")

    assert not missing, "Broken relative markdown links:\n" + "\n".join(missing)
