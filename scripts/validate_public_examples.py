#!/usr/bin/env python3
"""Validate public JSON examples and runnable documentation commands."""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

from jsonschema import ValidationError, validate

ROOT = Path(__file__).resolve().parents[1]
NON_ASCII_HYPHENS = "\u2010\u2011\u2012\u2013\u2014\u2015\u2212"
DOCS_WITH_COMMANDS = [
    ROOT / "README.md",
    ROOT / "docs" / "quickstart.md",
    ROOT / "docs" / "tutorial.md",
]

MANUAL_DOC_COMMANDS = [
    "agenda-intelligence --help",
    "agenda-intelligence start technology-ai",
    "agenda-intelligence validate-brief examples/agenda-brief.json",
    "agenda-intelligence validate-evidence examples/source/evidence-pack.json",
    "agenda-intelligence source-plan technology-ai",
    "agenda-intelligence score examples/agenda-brief.json",
    "agenda-intelligence score examples/agenda-brief.json --evidence examples/source/evidence-pack.json",
    "agenda-intelligence score examples/before-after/eu-ai-act.md",
    "agenda-intelligence score examples/before-after/sanctions-routing.md",
    "agenda-intelligence score examples/before-after/red-sea-shipping.md",
    "agenda-intelligence memo-quality-bench tests/fixtures/memo_quality --format json",
    "agenda-intelligence weekly-delta-bench tests/fixtures/weekly_delta --format json",
]


def load_json(path: Path) -> object:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise SystemExit(f"Invalid JSON in {path.relative_to(ROOT)}: {exc}") from exc


def validate_with_schema(path: Path, schema: object, label: str) -> None:
    try:
        validate(load_json(path), schema)
    except ValidationError as exc:
        where = "/".join(str(part) for part in exc.absolute_path) or "<root>"
        raise SystemExit(f"{path.relative_to(ROOT)} failed {label} schema at {where}: {exc.message}") from exc


def validate_a2a_jsonrpc_example(path: Path) -> None:
    data = load_json(path)
    if not isinstance(data, dict):
        raise SystemExit(f"{path.relative_to(ROOT)} is not a JSON object")
    if data.get("jsonrpc") != "2.0":
        raise SystemExit(f"{path.relative_to(ROOT)} must set jsonrpc to 2.0")
    if not isinstance(data.get("id"), str):
        raise SystemExit(f"{path.relative_to(ROOT)} must include a string id")
    if data.get("method") not in {"agent/card", "message/send"}:
        raise SystemExit(f"{path.relative_to(ROOT)} must use a supported A2A example method")
    if data.get("method") == "message/send" and not isinstance(data.get("params"), dict):
        raise SystemExit(f"{path.relative_to(ROOT)} message/send example must include params")


def validate_examples() -> None:
    evidence_schema = load_json(ROOT / "schemas" / "v1" / "evidence-pack.schema.json")
    brief_schema = load_json(ROOT / "schemas" / "v1" / "agenda-brief.schema.json")
    audit_schema = load_json(ROOT / "schemas" / "v1" / "evidence-audit.schema.json")
    request_schema = load_json(ROOT / "schemas" / "v1" / "agenda-request.schema.json")

    json_files = sorted((ROOT / "examples").glob("**/*.json"))
    if not json_files:
        raise SystemExit("No examples/**/*.json files found")

    trace_dir = ROOT / "examples" / "product-shell" / "full-analyze-trace"
    trace_request_files = {trace_dir / "01-request.json"}
    trace_doc_files = {
        trace_dir / "02-routing.json",
        trace_dir / "03-memo.json",
        trace_dir / "04-validation.json",
        trace_dir / "05-audit.json",
        trace_dir / "06-score.json",
    }
    commercial_fixture_dirs = {
        ROOT / "examples" / "kazakhstan-middle-corridor",
        ROOT / "examples" / "kazakhstan-market-entry-readiness",
        ROOT / "examples" / "cis-secondary-sanctions",
        ROOT / "examples" / "agentic-interaction-trust",
        ROOT / "examples" / "gulf-maritime-exposure",
    }
    a2a_fixture_dir = ROOT / "examples" / "a2a"

    for path in json_files:
        load_json(path)

        if path in trace_request_files:
            validate_with_schema(path, request_schema, "agenda-request")
        elif path in trace_doc_files:
            continue
        elif path.is_relative_to(a2a_fixture_dir):
            validate_a2a_jsonrpc_example(path)
        elif any(path.is_relative_to(directory) for directory in commercial_fixture_dirs):
            continue
        elif path.name.endswith(".evidence.json") or path.name == "evidence-pack.json":
            validate_with_schema(path, evidence_schema, "evidence-pack")
        elif path.name == "agenda-brief.json" or path.name.endswith(".brief.json"):
            validate_with_schema(path, brief_schema, "agenda-brief")
        elif path.name.endswith(".audit.json"):
            validate_with_schema(path, audit_schema, "evidence-audit")
        elif path.name == "agenda-request.json" or path.name.endswith(".request.json"):
            validate_with_schema(path, request_schema, "agenda-request")
        else:
            raise SystemExit(f"No validation rule for public example JSON: {path.relative_to(ROOT)}")

    source_backed = sorted((ROOT / "examples" / "source-backed").glob("*.evidence.json"))
    if not source_backed:
        raise SystemExit("No examples/source-backed/*.evidence.json files found")
    for path in source_backed:
        data = load_json(path)
        if not isinstance(data, dict):
            raise SystemExit(f"{path.relative_to(ROOT)} is not a JSON object")
        if data.get("evidence_mode") not in {"live_source_backed", "mixed"}:
            raise SystemExit(f"{path.relative_to(ROOT)} must use live_source_backed or mixed evidence_mode")
        if data.get("evidence_mode") == "live_source_backed" and not data.get("retrieved_at"):
            raise SystemExit(f"{path.relative_to(ROOT)} missing retrieved_at for live source-backed evidence")
        if "example.com" in path.read_text(encoding="utf-8"):
            raise SystemExit(f"{path.relative_to(ROOT)} contains example.com; use real or clearly synthetic URLs")


def iter_shell_blocks(markdown: str) -> list[str]:
    return re.findall(r"```(?:bash|sh|shell)\n(.*?)```", markdown, flags=re.DOTALL)


def extract_runnable_commands(block: str) -> list[str]:
    commands: list[str] = []
    for raw_line in block.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.endswith("\\"):
            # Multiline continuations are common in documentation examples
            # (curl, pip with many flags). Only fail if the multiline command
            # is one the smoke test would otherwise execute, since silent
            # truncation of an agenda-intelligence command would mask coverage.
            if line.startswith(("agenda-intelligence ", "mkdir ", "cp ")):
                raise SystemExit(f"Multiline runnable command is not supported by doc smoke test: {line}")
            continue
        if any(ch in line for ch in NON_ASCII_HYPHENS):
            raise SystemExit(f"Non-ASCII hyphen in shell command: {line}")
        if "source-requirements/technology-ai/" in line:
            raise SystemExit(f"Directory-style technology-ai source path in shell command: {line}")
        # Installation, cloning, and cd snippets are copyable docs, but not useful as
        # package smoke tests inside CI. Local mkdir/cp setup lines are safe and keep
        # following validation commands runnable.
        if line.startswith(("pip ", "python -m pip ", "git ", "cd ")):
            continue
        if ">" in line or "<" in line:
            continue
        if line.startswith(("agenda-intelligence ", "mkdir ", "cp ")):
            commands.append(line)
    return commands


def command_to_python_module(command: str) -> list[str]:
    parts = command.split()
    if parts[0] != "agenda-intelligence":
        raise ValueError(command)
    return [sys.executable, "-m", "agenda_intelligence.cli", *parts[1:]]


def run_command(command: str) -> subprocess.CompletedProcess[str]:
    if command.startswith("agenda-intelligence "):
        return subprocess.run(
            command_to_python_module(command),
            cwd=ROOT,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )
    return subprocess.run(
        command,
        cwd=ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        shell=True,
        check=False,
    )


def smoke_markdown_commands() -> None:
    runnable: list[tuple[Path, str]] = []
    for path in DOCS_WITH_COMMANDS:
        text = path.read_text(encoding="utf-8")
        for block in iter_shell_blocks(text):
            runnable.extend((path, cmd) for cmd in extract_runnable_commands(block))

    for command in MANUAL_DOC_COMMANDS:
        if command not in [cmd for _, cmd in runnable]:
            runnable.append((ROOT / "<manual-doc-command>", command))

    if not runnable:
        raise SystemExit("No runnable agenda-intelligence commands found in docs")

    cleanup_paths = [ROOT / "evidence-pack.json"]
    try:
        for path, command in runnable:
            result = run_command(command)
            if result.returncode != 0:
                raise SystemExit(
                    f"Markdown command failed in {path.relative_to(ROOT)}:\n"
                    f"  {command}\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
                )
    finally:
        for cleanup_path in cleanup_paths:
            cleanup_path.unlink(missing_ok=True)


def main() -> None:
    validate_examples()
    smoke_markdown_commands()
    print("OK: public examples and markdown commands validate")


if __name__ == "__main__":
    main()
