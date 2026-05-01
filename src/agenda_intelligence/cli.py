#!/usr/bin/env python3
import argparse
import json
import sys
from pathlib import Path

# Resource handling – works both in editable mode and from an installed package.
# All runtime assets are stored under ``agenda_intelligence/data``.
# ``importlib.resources`` (Python 3.9+) provides a unified API.

from importlib import resources

PACKAGE_NAME = __package__ or "agenda_intelligence"
ROOT = Path(__file__).resolve().parents[2]  # fallback for editable installs

def _resource_path(*parts: str) -> Path:
    """Return a Path object to a data file inside the package."""
    return (resources.files(PACKAGE_NAME) / "data" / Path(*parts)).as_posix()

def load_manifest():
    path = resources.files(PACKAGE_NAME) / "data" / "agent-manifest.json"
    return json.loads(path.read_text())

def read_path(rel: str) -> str:
    p = resources.files(PACKAGE_NAME) / "data" / rel
    if not p.is_file():
        raise SystemExit(f"Not found: {rel}")
    return p.read_text()


def cmd_manifest(args):
    print(json.dumps(load_manifest(), indent=2))


def cmd_list_lenses(args):
    manifest = load_manifest()
    lenses = manifest["lenses"]
    if args.type:
        lenses = {args.type: lenses.get(args.type, {})}
    print(json.dumps(lenses, indent=2))


def cmd_get_lens(args):
    manifest = load_manifest()
    try:
        rel = manifest["lenses"][args.type][args.id]
    except KeyError:
        raise SystemExit(f"Unknown lens: {args.type}/{args.id}")
    print(read_path(rel))


def cmd_get_protocol(args):
    manifest = load_manifest()
    if args.name == "entrypoint":
        print(read_path(manifest["entrypoint"]))
        return
    matches = [p for p in manifest["protocols"] if Path(p).stem == args.name or Path(p).name == args.name]
    if not matches:
        raise SystemExit(f"Unknown protocol: {args.name}")
    print(read_path(matches[0]))

# JSON Schema validation using jsonschema
from jsonschema import validate, ValidationError


def cmd_validate_brief(args):
    validate_json_file(args.path, "agenda-brief.schema.json", "agenda brief")


def cmd_validate_evidence(args):
    validate_json_file(args.path, "evidence-pack.schema.json", "evidence pack")


def cmd_validate_manifest(args):
    # Validate agent-manifest.json against its schema.
    from jsonschema import validate, ValidationError
    manifest = load_manifest()
    schema_path = resources.files(PACKAGE_NAME) / "data" / "schemas" / "agent-manifest.schema.json"
    if not schema_path.is_file():
        raise SystemExit("Manifest schema not found in package data")
    schema = json.loads(schema_path.read_text())
    try:
        validate(manifest, schema)
    except ValidationError as e:
        print(f"ERROR: {e.message}", file=sys.stderr)
        raise SystemExit(1)
    print("OK: manifest validates")


def cmd_source_types(args):
    # source-taxonomy is packaged under data
    p = resources.files(PACKAGE_NAME) / "data" / "source-taxonomy.json"
    print(json.dumps(json.loads(p.read_text()), indent=2))


def cmd_list_source_packs(args):
    manifest = load_manifest()
    print(json.dumps(manifest.get("source_acquisition", {}).get("requirements", {}), indent=2))


def cmd_source_plan(args):
    manifest = load_manifest()
    requirements = manifest.get("source_acquisition", {}).get("requirements", {})
    if args.category not in requirements:
        raise SystemExit(f"Unknown source category: {args.category}")
    # The file path in the manifest points to a relative location inside data.
    rel_path = requirements[args.category]
    p = resources.files(PACKAGE_NAME) / "data" / rel_path
    if not p.is_file():
        raise SystemExit(f"Source requirements file not bundled: {rel_path}")
    print(json.dumps(json.loads(p.read_text()), indent=2))


def cmd_start(args):
    """Guided start for a new agenda analysis.
    Shows a trimmed source plan (top 3 must_check) and a brief JSON template.
    """
    manifest = load_manifest()
    requirements = manifest.get("source_acquisition", {}).get("requirements", {})
    if args.category not in requirements:
        raise SystemExit(f"Unknown source category: {args.category}")
    rel_path = requirements[args.category]
    p = resources.files(PACKAGE_NAME) / "data" / rel_path
    if not p.is_file():
        raise SystemExit(f"Source requirements file not bundled: {rel_path}")
    data = json.loads(p.read_text())
    # Trim must_check to first 3 entries (now enforced in JSON, but keep safe)
    must_check = data.get("must_check", [])[:3]
    watch = data.get("watch_indicators", [])
    print("=== Trimmed source plan ===")
    print(json.dumps({"must_check": must_check, "watch_indicators": watch}, indent=2, ensure_ascii=False))
    # Brief template
    template = {
        "bottom_line": "<summary>",
        "signal_classification": "<noise|weak_signal|signal|structural_shift|trigger_event>",
        "what_changed": "<what changed>",
        "main_uncertainty": "<main uncertainty>",
        "watch_next": ["<indicator 1>", "<indicator 2>"]
    }
    print("\n=== Brief template (fill in) ===")
    print(json.dumps(template, indent=2, ensure_ascii=False))


def validate_json_file(path, schema_name, label):
    # Load schema from packaged data.
    schema_path = resources.files(PACKAGE_NAME) / "data" / "schemas" / schema_name
    if not schema_path.is_file():
        raise SystemExit(f"Schema not found in package data: {schema_name}")
    schema = json.loads(schema_path.read_text())
    data = json.loads(Path(path).read_text())
    try:
        validate(data, schema)
    except ValidationError as e:
        print(f"ERROR: {e.message}", file=sys.stderr)
        raise SystemExit(1)
    print(f"OK: {label} validates")



def cmd_score(args):
    import subprocess
    if args.path:
        text = Path(args.path).read_text()
        required = ["## Before: generic agent output", "## After: with Agenda-Intelligence.md"]
        missing = [r for r in required if r not in text]
        if missing:
            raise SystemExit(f"Not a before/after example: missing {missing}")
    # ``eval_before_after.py`` lives in the source tree; when the package is installed
    # we try to locate it relative to this file (editable install) via ``ROOT``.
    script_path = ROOT / "scripts" / "eval_before_after.py"
    if not script_path.is_file():
        # In a wheel install the helper script is not bundled; skip the eval.
        raise SystemExit("eval_before_after script not available in installed package")
    subprocess.run([sys.executable, str(script_path)], check=True)



def main():
    parser = argparse.ArgumentParser(description="Agenda-Intelligence.md helper CLI")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("manifest", help="Print agent-manifest.json").set_defaults(func=cmd_manifest)
    # list-lenses
    p = sub.add_parser("list-lenses", help="List available lenses")
    p.add_argument("--type", choices=["regional", "sector"])
    p.set_defaults(func=cmd_list_lenses)
    # get-lens
    p = sub.add_parser("get-lens", help="Print a lens by type/id")
    p.add_argument("type", choices=["regional", "sector"])
    p.add_argument("id")
    p.set_defaults(func=cmd_get_lens)
    # get-protocol
    p = sub.add_parser("get-protocol", help="Print entrypoint or base protocol")
    p.add_argument("name")
    p.set_defaults(func=cmd_get_protocol)
    # validate-brief
    p = sub.add_parser("validate-brief", help="Validate a JSON agenda brief")
    p.add_argument("path")
    p.set_defaults(func=cmd_validate_brief)
    # validate-evidence
    p = sub.add_parser("validate-evidence", help="Validate an evidence pack JSON file")
    p.add_argument("path")
    p.set_defaults(func=cmd_validate_evidence)
    # validate-manifest
    p = sub.add_parser("validate-manifest", help="Validate manifest JSON")
    p.set_defaults(func=cmd_validate_manifest)
    # source-types
    p = sub.add_parser("source-types", help="Print source taxonomy")
    p.set_defaults(func=cmd_source_types)
    # list-source-packs
    p = sub.add_parser("list-source-packs", help="List source requirement packs")
    p.set_defaults(func=cmd_list_source_packs)
    # source-plan
    p = sub.add_parser("source-plan", help="Print source requirements for a category")
    p.add_argument("category")
    p.set_defaults(func=cmd_source_plan)
    # score
    p = sub.add_parser("score", help="Run before/after eval harness")
    p.add_argument("path", nargs="?")
    p.set_defaults(func=cmd_score)
    # start – guided workflow for new analysis
    p = sub.add_parser("start", help="Guided start for a new agenda analysis")
    p.add_argument("category", help="Source category (e.g., conflict-security)")
    p.set_defaults(func=cmd_start)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
