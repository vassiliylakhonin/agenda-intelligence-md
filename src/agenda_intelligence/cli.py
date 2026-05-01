#!/usr/bin/env python3
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "agent-manifest.json"


def load_manifest():
    return json.loads(MANIFEST.read_text())


def read_path(rel):
    path = ROOT / rel
    if not path.exists():
        raise SystemExit(f"Not found: {rel}")
    return path.read_text()


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
    # simple check: load manifest and ensure required keys
    load_manifest()
    print("OK: manifest loads")


def cmd_source_types(args):
    print(json.dumps(json.loads((ROOT / "source-taxonomy.json").read_text()), indent=2))


def cmd_list_source_packs(args):
    manifest = load_manifest()
    print(json.dumps(manifest.get("source_acquisition", {}).get("requirements", {}), indent=2))


def cmd_source_plan(args):
    manifest = load_manifest()
    requirements = manifest.get("source_acquisition", {}).get("requirements", {})
    if args.category not in requirements:
        raise SystemExit(f"Unknown source category: {args.category}")
    print(json.dumps(json.loads((ROOT / requirements[args.category]).read_text()), indent=2))


def validate_json_file(path, schema_name, label):
    schema = json.loads((ROOT / "schemas" / schema_name).read_text())
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
    subprocess.run([sys.executable, str(ROOT / "scripts" / "eval_before_after.py")], check=True)



def main():
    parser = argparse.ArgumentParser(description="Agenda-Intelligence.md helper CLI")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("manifest", help="Print agent-manifest.json").set_defaults(func=cmd_manifest)
    sub.add_parser("list-lenses", help="List available lenses").add_argument("--type", choices=["regional", "sector"]).set_defaults(func=cmd_list_lenses)
    sub.add_parser("get-lens", help="Print a lens by type/id").add_argument("type", choices=["regional", "sector"]).add_argument("id").set_defaults(func=cmd_get_lens)
    sub.add_parser("get-protocol", help="Print entrypoint or base protocol").add_argument("name").set_defaults(func=cmd_get_protocol)
    sub.add_parser("validate-brief", help="Validate a JSON agenda brief").add_argument("path").set_defaults(func=cmd_validate_brief)
    sub.add_parser("validate-evidence", help="Validate an evidence pack JSON file").add_argument("path").set_defaults(func=cmd_validate_evidence)
    sub.add_parser("validate-manifest", help="Validate manifest JSON").set_defaults(func=cmd_validate_manifest)
    sub.add_parser("source-types", help="Print source taxonomy").set_defaults(func=cmd_source_types)
    sub.add_parser("list-source-packs", help="List source requirement packs").set_defaults(func=cmd_list_source_packs)
    sub.add_parser("source-plan", help="Print source requirements for a category").add_argument("category").set_defaults(func=cmd_source_plan)
    sub.add_parser("score", help="Run before/after eval harness").add_argument("path", nargs="?").set_defaults(func=cmd_score)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
