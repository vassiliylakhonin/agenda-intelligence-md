#!/usr/bin/env python3
import argparse
import json
import shlex
import shutil
import subprocess
import sys
from importlib import resources
from pathlib import Path

# Resource handling – works both in editable mode and from an installed package.
# All runtime assets are stored under ``agenda_intelligence/data``.
# ``importlib.resources`` (Python 3.9+) provides a unified API.


PACKAGE_NAME = __package__ or "agenda_intelligence"
ROOT = Path(__file__).resolve().parents[2]  # fallback for editable installs
SRC_ROOT = Path(__file__).resolve().parents[1]
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from agenda_intelligence import __version__  # noqa: E402


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
from jsonschema import ValidationError, validate  # noqa: E402


def cmd_validate_brief(args):
    validate_json_file(args.path, "agenda-brief.schema.json", "agenda brief")


def cmd_validate_evidence(args):
    validate_json_file(args.path, "evidence-pack.schema.json", "evidence pack")


def cmd_validate_manifest(args):
    # Validate agent-manifest.json against its schema.
    from jsonschema import ValidationError, validate

    manifest = load_manifest()
    schema_path = resources.files(PACKAGE_NAME) / "data" / "schemas" / "v1" / "agent-manifest.schema.json"
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


def cmd_source_categories(args):
    from agenda_intelligence.mcp_server import list_source_categories

    result = list_source_categories()
    if result.get("error"):
        print(f"ERROR: {result['error']}", file=sys.stderr)
        raise SystemExit(1)
    if args.format == "json":
        print(json.dumps(result, indent=2, ensure_ascii=False))
    else:
        for item in result["categories"]:
            print(
                f"{item['category']}: must_check={item['must_check_count']} "
                f"supporting={item['supporting_sources_count']} watch={item['watch_indicators_count']}"
            )


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


def cmd_source_coverage(args):
    """Diagnose source-plan coverage for an evidence pack and category."""
    from agenda_intelligence.mcp_server import source_coverage

    path = Path(args.path)
    if not path.is_file():
        raise SystemExit(f"Not found: {path}")
    try:
        evidence_json = json.loads(path.read_text())
    except json.JSONDecodeError as e:
        raise SystemExit(f"Invalid JSON: {e}")
    if not isinstance(evidence_json, dict):
        raise SystemExit("Source coverage expects a JSON object")

    result = source_coverage(evidence_json, args.category)
    if result.get("error"):
        print(f"ERROR: {result['error']}", file=sys.stderr)
        raise SystemExit(1)

    if args.format == "json":
        print(json.dumps(result, indent=2, ensure_ascii=False))
    else:
        print(f"source-plan coverage: {result['category']}")
        print(f"  required sources: {len(result['required_sources'])}")
        print(f"  covered required sources: {len(result['covered_required_sources'])}")
        print(f"  missing required sources: {len(result['missing_required_sources'])}")
        if result["covered_required_sources"]:
            print("  covered:")
            for source in result["covered_required_sources"]:
                print(f"    - {source}")
                detail = next(item for item in result["required_source_details"] if item["required_source"] == source)
                matches = [
                    match.get("name") or match.get("evidence_id") or f"source_index={match['source_index']}"
                    for match in detail["matched_sources"]
                ]
                if matches:
                    print(f"      matched by: {', '.join(str(match) for match in matches)}")
        if result["missing_required_sources"]:
            print("  missing:")
            for source in result["missing_required_sources"]:
                print(f"    - {source}")
        print(f"note: {result['note']}")

    if args.strict and result["missing_required_sources"]:
        raise SystemExit(1)


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
        "signal_markers": ["<optional: compliance_relevant_development|enforcement_marker|escalation_marker>"],
        "what_changed": "<what changed>",
        "data_integrity_notes": [
            {
                "risk_type": (
                    "<optional: prompt_injection|source_anomaly|" "stale_or_conflicting_source|retrieval_limit|other>"
                ),
                "note": "<optional data-integrity concern surfaced by analyst or agent>",
            }
        ],
        "main_uncertainty": "<main uncertainty>",
        "watch_next": ["<indicator 1>", "<indicator 2>"],
    }
    print("\n=== Brief template (fill in) ===")
    print(json.dumps(template, indent=2, ensure_ascii=False))


def validate_json_file(path, schema_name, label):
    # Load schema from packaged data.
    schema_path = resources.files(PACKAGE_NAME) / "data" / "schemas" / "v1" / schema_name
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
        path = Path(args.path)
        if path.suffix == ".json":
            from agenda_intelligence.eval import format_score, score_brief

            data = json.loads(path.read_text())
            if not isinstance(data, dict):
                raise SystemExit("Brief score expects a JSON object")
            evidence_pack = None
            if args.evidence:
                evidence_pack = json.loads(Path(args.evidence).read_text())
                if not isinstance(evidence_pack, dict):
                    raise SystemExit("Evidence score expects a JSON object")
            result = score_brief(data, evidence_pack=evidence_pack)
            if getattr(args, "format", "text") == "json":
                print(json.dumps(result, indent=2, ensure_ascii=False))
            else:
                print(format_score(result))
            min_score = getattr(args, "min_score", None)
            if min_score is not None and result["score"] < min_score:
                print(
                    f"FAIL: score {result['score']}/{result['max_score']} below threshold {min_score}",
                    file=sys.stderr,
                )
                raise SystemExit(2)
            return
        if args.evidence:
            raise SystemExit("--evidence can only be used when scoring a JSON brief")
        text = path.read_text()
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


def cmd_memory_search(args):
    """Search in AnalysisBank memory cards."""
    query = args.query.lower()
    # Path to analysis-bank inside data
    bank_path = resources.files(PACKAGE_NAME) / "data" / "analysis-bank"
    if not bank_path.is_dir():
        raise SystemExit("AnalysisBank directory not found in package data")
    results = []
    # Walk through the directory (works with importlib.resources on Python 3.9+)
    # Traverse using Path if possible, otherwise fallback to os.listdir
    try:
        base = Path(bank_path.as_posix())
    except Exception:
        base = Path(str(bank_path))
    for md_file in base.rglob("*.md"):
        text = md_file.read_text(encoding="utf-8")
        if query in text.lower():
            results.append({"file": md_file.name, "path": str(md_file.relative_to(base))})
    if results:
        print(json.dumps(results, indent=2, ensure_ascii=False))
    else:
        print(f"No results for query: {args.query}")


def _fetch_url_text(url: str, timeout: int = 10) -> str:
    """Fetch URL and return plain text (HTML stripped, stdlib only)."""
    import html.parser
    import urllib.request

    class _StripHTML(html.parser.HTMLParser):
        def __init__(self):
            super().__init__()
            self._buf: list[str] = []
            self._skip = False

        def handle_starttag(self, tag, attrs):
            if tag in ("script", "style"):
                self._skip = True

        def handle_endtag(self, tag):
            if tag in ("script", "style"):
                self._skip = False

        def handle_data(self, data):
            if not self._skip:
                self._buf.append(data)

        def get_text(self) -> str:
            return " ".join(self._buf)

    req = urllib.request.Request(
        url,
        headers={"User-Agent": "agenda-intelligence/1 (+https://github.com/vassiliylakhonin/agenda-intelligence-md)"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read(1_000_000)
        charset = resp.headers.get_content_charset() or "utf-8"
    text = raw.decode(charset, errors="replace")
    if "<html" in text.lower()[:1000] or "<!doctype" in text.lower()[:100]:
        parser = _StripHTML()
        parser.feed(text)
        text = parser.get_text()
    return text


def cmd_verify_quotes(args):
    """Verify that quoted fragments cited in a pack are present in source texts.

    Accepts both shapes: evidence-pack ``sources`` / ``evidence`` items that carry
    a ``quote``, and span-level ``supporting_quotes`` harvested from the ``claims``
    of an evidence-audit-shaped doc (results carry the originating ``claim_id``).

    Scope: answers only "is the cited quote present in the source text?" — not
    "is the claim true?" and not "is the source reputable?".

    Source text lookup order (local mode):
    - --texts-dir <dir>/<evidence_id>.txt (preferred)
    - --texts-dir <dir>/<source name slugified>.txt

    With --fetch: sources that have a `url` and no local text file are fetched
    over HTTP. Fetched text is not cached.
    """
    import re
    import unicodedata

    pack_path = Path(args.path)
    if not pack_path.is_file():
        raise SystemExit(f"Not found: {pack_path}")
    pack = json.loads(pack_path.read_text())
    sources = pack.get("sources") or pack.get("evidence") or []
    claims = pack.get("claims") or []
    if not sources and not claims:
        raise SystemExit("No 'sources', 'evidence', or 'claims' array found in pack")

    texts_dir = Path(args.texts_dir) if args.texts_dir else pack_path.parent / "evidence_text"
    do_fetch = getattr(args, "fetch", False)

    def _slugify(name: str) -> str:
        s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
        return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")

    def _normalize(s: str) -> str:
        s = unicodedata.normalize("NFKC", s)
        return re.sub(r"\s+", " ", s).strip().lower()

    # Unified list of quote checks: source/evidence-level quotes plus span-level
    # supporting_quotes harvested from an evidence-audit-shaped doc.
    checks: list[dict] = []
    for source in sources:
        quote = source.get("quote") or source.get("quote_or_excerpt")
        if not quote:
            continue
        ident = source.get("evidence_id") or _slugify(source.get("name", "source"))
        checks.append({"id": ident, "quote": quote, "name": source.get("name"), "url": source.get("url")})

    evidence_by_id = {e.get("evidence_id"): e for e in (pack.get("evidence") or []) if e.get("evidence_id")}
    for claim in claims:
        claim_id = claim.get("claim_id")
        for sq in claim.get("supporting_quotes", []) or []:
            quote = sq.get("quote")
            eid = sq.get("evidence_id")
            if not quote or not eid:
                continue
            ev = evidence_by_id.get(eid, {})
            checks.append(
                {"id": eid, "quote": quote, "name": ev.get("name"), "url": ev.get("url"), "claim_id": claim_id}
            )

    results: list[dict] = []
    for check in checks:
        ident = check["id"]
        quote = check["quote"]
        extra = {"claim_id": check["claim_id"]} if check.get("claim_id") else {}
        candidates = [texts_dir / f"{ident}.txt"]
        if check.get("name"):
            candidates.append(texts_dir / f"{_slugify(check['name'])}.txt")
        text_path = next((p for p in candidates if p.is_file()), None)
        if text_path is not None:
            text = _normalize(text_path.read_text(encoding="utf-8"))
            match = _normalize(quote) in text
            status = "present" if match else "absent"
            results.append({"id": ident, "status": status, "source_text": str(text_path), **extra})
            continue
        if do_fetch and check.get("url"):
            try:
                raw_text = _fetch_url_text(check["url"])
                match = _normalize(quote) in _normalize(raw_text)
                status = "present" if match else "absent"
                results.append({"id": ident, "status": status, "mode": "fetched", "url": check["url"], **extra})
            except Exception as exc:
                results.append(
                    {"id": ident, "status": "fetch_error", "url": check.get("url"), "error": str(exc), **extra}
                )
            continue
        results.append(
            {"id": ident, "status": "missing_source_text", "looked_in": [str(p) for p in candidates], **extra}
        )

    note = (
        "Verifies presence of cited fragment in source text. Does not discover sources, "
        "score source reputation, gather live news, or verify factual truth."
    )
    if do_fetch:
        note = "Local-text + network fetch mode. " + note
    summary = {
        "total_quotes": len(results),
        "present": sum(1 for r in results if r["status"] == "present"),
        "absent": sum(1 for r in results if r["status"] == "absent"),
        "missing_source_text": sum(1 for r in results if r["status"] == "missing_source_text"),
        "fetch_error": sum(1 for r in results if r["status"] == "fetch_error"),
        "from_supporting_quotes": sum(1 for r in results if r.get("claim_id")),
        "note": note,
    }
    if args.format == "json":
        print(json.dumps({"summary": summary, "results": results}, indent=2, ensure_ascii=False))
    else:
        print(f"quotes checked: {summary['total_quotes']}")
        print(f"  present: {summary['present']}")
        print(f"  absent: {summary['absent']}")
        print(f"  missing source text: {summary['missing_source_text']}")
        for r in results:
            tag = f" (claim {r['claim_id']})" if r.get("claim_id") else ""
            print(f"  - {r['id']}: {r['status']}{tag}")
        print(f"note: {summary['note']}")
    if args.strict and (summary["absent"] or summary["missing_source_text"] or summary["fetch_error"]):
        raise SystemExit(1)


def cmd_bench(args):
    """Run schema validation, evidence audit, and heuristic scoring across
    a directory of cases. Each case is a `<name>.brief.json` with optional
    sibling `<name>.evidence.json` and `<name>.audit.json`.

    Output: Markdown report (default) or JSON with --format json.
    No LLM calls; deterministic given the input files.
    """
    from agenda_intelligence.bench import (
        discover_cases,
        render_markdown,
        run_case,
        summarize,
        to_json,
    )

    root = Path(args.path)
    if not root.is_dir():
        raise SystemExit(f"Not a directory: {root}")
    cases = discover_cases(root)
    if not cases:
        raise SystemExit(f"No *.brief.json files found under {root}")

    results = [run_case(c["brief"], c["evidence"], c["audit"]) for c in cases]
    summary = summarize(results)

    if args.format == "json":
        print(json.dumps(to_json(results, summary), indent=2, ensure_ascii=False))
    else:
        print(render_markdown(results, summary))

    if args.min_score is not None and summary.get("mean_score") is not None:
        if summary["mean_score"] < args.min_score:
            print(
                f"FAIL: mean score {summary['mean_score']} below threshold {args.min_score}",
                file=sys.stderr,
            )
            raise SystemExit(2)
    if args.strict and summary.get("audit_orphan_total"):
        print(
            f"FAIL: {summary['audit_orphan_total']} orphan evidence_id ref(s) in claim-level audits",
            file=sys.stderr,
        )
        raise SystemExit(1)


def cmd_audit_claims(args):
    """Validate a claim-level evidence-audit JSON file against
    schemas/v1/evidence-audit.schema.json and emit a small
    summary: support-level distribution, orphan claim_ids, and
    unsupported_claims count.
    """
    path = Path(args.path)
    if not path.is_file():
        raise SystemExit(f"Not found: {path}")
    try:
        data = json.loads(path.read_text())
    except json.JSONDecodeError as e:
        raise SystemExit(f"Invalid JSON: {e}")

    schema_path = resources.files(PACKAGE_NAME) / "data" / "schemas" / "v1" / "evidence-audit.schema.json"
    if not schema_path.is_file():
        raise SystemExit("evidence-audit schema not bundled")
    schema = json.loads(schema_path.read_text())
    try:
        validate(data, schema)
    except ValidationError as e:
        print(f"ERROR: {e.message}", file=sys.stderr)
        raise SystemExit(1)

    claims = data.get("claims", [])
    evidence = data.get("evidence", [])
    evidence_ids = {e["evidence_id"] for e in evidence}
    levels: dict[str, int] = {}
    orphans: list[dict] = []
    for c in claims:
        levels[c["support_level"]] = levels.get(c["support_level"], 0) + 1
        missing = [eid for eid in c.get("evidence_ids", []) if eid not in evidence_ids]
        if missing:
            orphans.append({"claim_id": c["claim_id"], "missing_evidence_ids": missing})

    summary = {
        "valid": True,
        "claim_count": len(claims),
        "evidence_count": len(evidence),
        "support_levels": levels,
        "orphan_evidence_refs": orphans,
        "unsupported_claims_listed": len(data.get("unsupported_claims", [])),
        "note": "Claim-level evidence audit is schema-level only; does not verify factual truth.",
    }
    if args.format == "json":
        print(json.dumps(summary, indent=2, ensure_ascii=False))
    else:
        print(f"OK: evidence audit validates ({len(claims)} claims, {len(evidence)} evidence items)")
        for level, count in sorted(levels.items()):
            print(f"  support_level={level}: {count}")
        if orphans:
            print(f"WARN: {len(orphans)} claim(s) reference missing evidence_ids:", file=sys.stderr)
            for o in orphans:
                print(f"  - {o['claim_id']} -> {o['missing_evidence_ids']}", file=sys.stderr)
        if data.get("unsupported_claims"):
            print(f"  unsupported_claims listed: {len(data['unsupported_claims'])}")
    if args.strict and orphans:
        raise SystemExit(1)


def cmd_deal_report(args):
    """Render a Middle Corridor deal-risk response as an evidence-readiness memo.

    Input is the structured response JSON (the contract emitted by the
    ``middle_corridor_deal_risk`` service / live A2A worker), either the raw
    response object or a ``{"response": {...}}`` service-result wrapper. This
    reformats the structured output; it is not advice, performs no factual-truth
    verification, and requires human review before any commercial action.
    """
    from agenda_intelligence import reporting

    path = Path(args.path)
    if not path.is_file():
        raise SystemExit(f"Not found: {path}")
    try:
        data = json.loads(path.read_text())
    except json.JSONDecodeError as e:
        raise SystemExit(f"Invalid JSON: {e}")

    try:
        rendered = reporting.render_report(data, args.format)
    except RuntimeError as e:  # optional pdf extra not installed
        raise SystemExit(str(e))

    if isinstance(rendered, bytes):
        if not args.out:
            raise SystemExit("PDF output requires --out <file.pdf>.")
        Path(args.out).write_bytes(rendered)
        print(f"Wrote {args.out}")
    elif args.out:
        Path(args.out).write_text(rendered)
        print(f"Wrote {args.out}")
    else:
        print(rendered)


def cmd_report(args):
    """Generate a concise Markdown report combining schema check + heuristic
    structure scoring for an agenda brief JSON file.

    The report does not verify factual truth — it summarizes form, evidence
    labeling, and decision-readiness signals, in line with the project's
    eval-layer positioning.
    """
    path = Path(args.path)
    if not path.is_file():
        raise SystemExit(f"Not found: {path}")
    try:
        data = json.loads(path.read_text())
    except json.JSONDecodeError as e:
        raise SystemExit(f"Invalid JSON: {e}")

    schema_path = resources.files(PACKAGE_NAME) / "data" / "schemas" / "v1" / "agenda-brief.schema.json"
    schema = json.loads(schema_path.read_text())
    structure_ok = True
    structure_error = ""
    try:
        validate(data, schema)
    except ValidationError as e:
        structure_ok = False
        structure_error = e.message

    required_signals = ["bottom_line", "what_changed", "main_uncertainty", "watch_next"]
    present = [k for k in required_signals if data.get(k)]
    decision_signals = {
        "has_uncertainty": bool(data.get("main_uncertainty")),
        "has_watch_next": bool(data.get("watch_next")),
        "has_scenarios": bool(data.get("scenarios")),
        "has_affected_actors": bool(data.get("affected_actors")),
        "evidence_mode": data.get("evidence_mode") or "unspecified",
    }

    lines = [
        f"# Report: {path.name}",
        "",
        "## Structural validation",
        f"- schema: {'PASS' if structure_ok else 'FAIL'}",
    ]
    if not structure_ok:
        lines.append(f"- error: {structure_error}")
    lines += [
        "",
        "## Decision-readiness signals (heuristic)",
        f"- required fields present: {len(present)}/{len(required_signals)}",
        f"- evidence_mode: {decision_signals['evidence_mode']}",
        f"- has main_uncertainty: {decision_signals['has_uncertainty']}",
        f"- has watch_next: {decision_signals['has_watch_next']}",
        f"- has scenarios: {decision_signals['has_scenarios']}",
        f"- has affected_actors: {decision_signals['has_affected_actors']}",
        "",
        "## Notes",
        "- This report does not verify factual truth.",
        "- It summarizes structure, evidence labeling, and decision-readiness signals only.",
    ]
    print("\n".join(lines))
    if not structure_ok:
        raise SystemExit(1)


def cmd_fetch(args):
    """Legacy source-plan alias; brief evidence fetching is not implemented."""
    import json as _json

    if args.category:
        manifest = load_manifest()
        requirements = manifest.get("source_acquisition", {}).get("requirements", {})
        if args.category not in requirements:
            raise SystemExit(f"Unknown source category: {args.category}")
        rel_path = requirements[args.category]
        p = resources.files(PACKAGE_NAME) / "data" / rel_path
        if not p.is_file():
            raise SystemExit(f"Source requirements file not bundled: {rel_path}")
        data = _json.loads(p.read_text())
        print(_json.dumps(data, indent=2, ensure_ascii=False))
    elif args.brief:
        print("Fetching evidence for brief is not yet implemented.")
    else:
        raise SystemExit("Provide --category or --brief")


def render_mcp_config(client: str) -> str:
    if client == "codex":
        return "\n".join(
            [
                "[mcp_servers.agenda-intelligence]",
                'command = "agenda-intelligence-mcp"',
                "enabled = true",
                "startup_timeout_sec = 10",
                "tool_timeout_sec = 30",
            ]
        )

    server_config: dict[str, object] = {"command": "agenda-intelligence-mcp"}
    if client in {"claude-desktop", "cursor"}:
        server_config = {
            "type": "stdio",
            "command": "agenda-intelligence-mcp",
            "args": [],
            "env": {},
        }
    config = {"mcpServers": {"agenda-intelligence": server_config}}
    return json.dumps(config, indent=2)


def cmd_mcp_config(args):
    print(render_mcp_config(args.client))


def _doctor_check(name, ok, detail):
    return {"name": name, "ok": bool(ok), "detail": detail}


def _doctor_manifest_check():
    try:
        manifest = load_manifest()
        schema_path = resources.files(PACKAGE_NAME) / "data" / "schemas" / "v1" / "agent-manifest.schema.json"
        schema = json.loads(schema_path.read_text())
        validate(manifest, schema)
        return _doctor_check("packaged manifest", True, f"version={manifest.get('version')}")
    except Exception as exc:
        return _doctor_check("packaged manifest", False, str(exc))


def _doctor_mcp_config_checks():
    checks = []
    for client in ["generic", "claude-desktop", "cursor", "codex"]:
        try:
            if client == "codex":
                output = render_mcp_config(client)
                ok = "[mcp_servers.agenda-intelligence]" in output and 'command = "agenda-intelligence-mcp"' in output
            else:
                data = json.loads(render_mcp_config(client))
                ok = data["mcpServers"]["agenda-intelligence"]["command"] == "agenda-intelligence-mcp"
            checks.append(_doctor_check(f"mcp-config {client}", ok, "prints expected config"))
        except Exception as exc:
            checks.append(_doctor_check(f"mcp-config {client}", False, str(exc)))
    return checks


def _doctor_command_check(command):
    parts = shlex.split(command)
    if not parts:
        return _doctor_check("mcp command", False, "empty command")
    executable = parts[0]
    if shutil.which(executable) is None:
        return _doctor_check("mcp command", False, f"{executable} not found on PATH")
    return _doctor_check("mcp command", True, command)


def _doctor_mcp_tools_check(command):
    expected_tools = {
        "validate_brief",
        "validate_evidence",
        "get_protocol",
        "list_lenses",
        "get_lens",
        "list_source_categories",
        "source_plan",
        "source_coverage",
        "audit_claims",
        "score_output",
        "verify_quotes",
    }
    requests = [
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {"protocolVersion": "2025-03-26", "capabilities": {}, "clientInfo": {"name": "doctor"}},
        },
        {"jsonrpc": "2.0", "method": "notifications/initialized"},
        {"jsonrpc": "2.0", "id": 2, "method": "tools/list"},
    ]
    stdin = "\n".join(json.dumps(request) for request in requests) + "\n"
    try:
        result = subprocess.run(
            shlex.split(command),
            input=stdin,
            capture_output=True,
            text=True,
            check=False,
            timeout=10,
        )
    except Exception as exc:
        return _doctor_check("mcp tools/list", False, str(exc))
    if result.returncode != 0:
        return _doctor_check("mcp tools/list", False, result.stderr.strip() or f"exit={result.returncode}")
    try:
        responses = [json.loads(line) for line in result.stdout.splitlines() if line.strip()]
        tools = {tool["name"] for tool in responses[-1]["result"]["tools"]}
    except Exception as exc:
        return _doctor_check("mcp tools/list", False, f"invalid MCP response: {exc}")
    missing = sorted(expected_tools - tools)
    if missing:
        return _doctor_check("mcp tools/list", False, f"missing tools: {', '.join(missing)}")
    return _doctor_check("mcp tools/list", True, f"{len(tools)} tools available")


def cmd_doctor(args):
    checks = [
        _doctor_check("package version", True, __version__),
        _doctor_manifest_check(),
        *_doctor_mcp_config_checks(),
        _doctor_command_check(args.mcp_command),
        _doctor_mcp_tools_check(args.mcp_command),
    ]
    ok = all(check["ok"] for check in checks)
    payload = {"ok": ok, "version": __version__, "checks": checks}
    if args.json:
        print(json.dumps(payload, indent=2))
    else:
        print(f"Agenda Intelligence doctor: {'OK' if ok else 'ISSUES FOUND'}")
        for check in checks:
            marker = "OK" if check["ok"] else "FAIL"
            print(f"[{marker}] {check['name']}: {check['detail']}")
    if not ok and args.strict:
        raise SystemExit(1)


def main():
    parser = argparse.ArgumentParser(prog="agenda-intelligence", description="Agenda-Intelligence.md helper CLI")
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("manifest", help="Print agent-manifest.json").set_defaults(func=cmd_manifest)
    # check (alias of validate-brief)
    p = sub.add_parser("check", help="Validate a brief (alias of validate-brief)")
    p.add_argument("path")
    p.set_defaults(func=cmd_validate_brief)
    # audit (alias of validate-evidence)
    p = sub.add_parser("audit", help="Audit an evidence pack (alias of validate-evidence)")
    p.add_argument("path")
    p.set_defaults(func=cmd_validate_evidence)
    # report
    p = sub.add_parser("report", help="Generate a Markdown report from a brief")
    p.add_argument("path")
    p.set_defaults(func=cmd_report)
    # deal-report — render a vertical-worker deal-risk response as a memo
    p = sub.add_parser("deal-report", help="Render a Middle Corridor deal-risk response as a memo (md/html/pdf)")
    p.add_argument("path", help="Path to the deal-risk response JSON")
    p.add_argument("--format", choices=["md", "html", "pdf"], default="md", help="Output format (default: md)")
    p.add_argument("--out", help="Write to this file instead of stdout (required for pdf)")
    p.set_defaults(func=cmd_deal_report)
    # eval (alias of score)
    p = sub.add_parser("eval", help="Run the eval/scoring rubric (alias of score)")
    p.add_argument("path", nargs="?")
    p.set_defaults(func=cmd_score)
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
    # source-categories
    p = sub.add_parser("source-categories", help="List source requirement categories")
    p.add_argument("--format", choices=["text", "json"], default="text")
    p.set_defaults(func=cmd_source_categories)
    # source-plan
    p = sub.add_parser("source-plan", help="Print source requirements for a category")
    p.add_argument("category")
    p.set_defaults(func=cmd_source_plan)
    # source-coverage
    p = sub.add_parser(
        "source-coverage",
        help="Diagnose evidence-pack coverage against category source requirements",
    )
    p.add_argument("path", help="Evidence pack JSON file")
    p.add_argument("--category", help="Source category, e.g. sanctions. Defaults to evidence_json.source_category")
    p.add_argument("--format", choices=["text", "json"], default="text")
    p.add_argument("--strict", action="store_true", help="Exit 1 when required source coverage is missing")
    p.set_defaults(func=cmd_source_coverage)
    # score
    p = sub.add_parser("score", help="Score a JSON brief or run the before/after eval harness")
    p.add_argument("path", nargs="?")
    p.add_argument("--evidence", help="Optional evidence-pack JSON for brief scoring")
    p.add_argument("--format", choices=["text", "json"], default="text", help="Output format for JSON-brief scoring")
    p.add_argument("--min-score", type=int, help="Exit with code 2 if total score is below this threshold")
    p.set_defaults(func=cmd_score)
    # audit-claims: claim-level evidence audit
    p = sub.add_parser(
        "audit-claims",
        help="Validate a claim-level evidence-audit JSON file",
    )
    p.add_argument("path")
    p.add_argument("--format", choices=["text", "json"], default="text")
    p.add_argument("--strict", action="store_true", help="Exit 1 on orphan evidence_id refs")
    p.set_defaults(func=cmd_audit_claims)
    # bench
    p = sub.add_parser(
        "bench",
        help="Run validate + audit + score across a directory of *.brief.json cases",
    )
    p.add_argument("path", help="Directory containing <name>.brief.json [+ .evidence.json, .audit.json]")
    p.add_argument("--format", choices=["text", "json"], default="text")
    p.add_argument("--min-score", type=int, help="Exit 2 if mean score below this threshold")
    p.add_argument("--strict", action="store_true", help="Exit 1 on any audit orphan ref")
    p.set_defaults(func=cmd_bench)
    # verify-quotes
    p = sub.add_parser(
        "verify-quotes",
        help="Check cited quote presence in local or fetched text; does not verify factual truth",
    )
    p.add_argument("path", help="Evidence pack JSON file with optional 'quote' fields per source")
    p.add_argument(
        "--texts-dir",
        help="Directory with <evidence_id>.txt source texts (default: <pack_dir>/evidence_text)",
    )
    p.add_argument(
        "--fetch",
        action="store_true",
        help="Fetch already-specified source URLs for quotes without local text (outbound HTTP; no source discovery)",
    )
    p.add_argument("--format", choices=["text", "json"], default="text")
    p.add_argument(
        "--strict",
        action="store_true",
        help="Exit 1 on any absent, missing source text, or fetch error",
    )
    p.set_defaults(func=cmd_verify_quotes)
    # start – guided workflow for new analysis
    p = sub.add_parser("start", help="Guided start for a new agenda analysis")
    p.add_argument("category", help="Source category (e.g., conflict-security)")
    p.set_defaults(func=cmd_start)
    # memory search – fuzzy search in analysis‑bank
    p = sub.add_parser("memory-search", help="Search compact descriptors in analysis‑bank")
    p.add_argument("query", help="Search query string")
    p.set_defaults(func=cmd_memory_search)
    # fetch – legacy alias for source-plan; brief evidence fetching is not implemented.
    p = sub.add_parser("fetch", help="Print source plan for a category; brief evidence fetching is not implemented")
    p.add_argument("--category", help="Source category to print (e.g., technology-ai)")
    p.add_argument("--brief", help="Short brief text to analyze")
    p.set_defaults(func=cmd_fetch)
    # mcp-config – print a copy-pasteable local MCP client config
    p = sub.add_parser("mcp-config", help="Print MCP stdio client configuration")
    p.add_argument(
        "--client",
        choices=["generic", "claude-desktop", "cursor", "codex"],
        default="generic",
        help="Client config format to print",
    )
    p.set_defaults(func=cmd_mcp_config)
    # doctor – local install and MCP self-diagnosis
    p = sub.add_parser("doctor", help="Check local package, MCP config, and MCP tool availability")
    p.add_argument("--json", action="store_true", help="Print machine-readable JSON")
    p.add_argument(
        "--mcp-command",
        default="agenda-intelligence-mcp",
        help="MCP server command to test",
    )
    p.add_argument("--strict", action="store_true", help="Exit non-zero when any check fails")
    p.set_defaults(func=cmd_doctor)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
