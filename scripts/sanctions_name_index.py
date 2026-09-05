#!/usr/bin/env python3
"""Build a public static sanctions-name index for browser-side preview.

This intentionally performs only string-index preparation. It does not verify
legal-entity identity, resolve ownership, determine 50% rule exposure, or give
legal/compliance advice.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
import tempfile
import time
import urllib.error
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit
from urllib.request import Request, urlopen

# Defaults land in the directory that gets published to Cloudflare Pages, which
# is what SNAPSHOT_INDEX_URL points at. Override with --output / --compact-output
# to build somewhere else.
ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUTPUT = ROOT / "deploy" / "snapshot-site" / "sanctions-name-index.json"
# Compact derivative for server-side (Cloudflare Worker) consumption: drops the
# precomputed normalized string `s`, entity type `t`, and id (the worker
# re-normalizes on load), and de-duplicates (authority, list) into a `src`
# table referenced by index. Same names, ~half the bytes, fast to parse.
DEFAULT_COMPACT_OUTPUT = ROOT / "deploy" / "snapshot-site" / "sanctions-name-index-compact.json"
USER_AGENT = "agenda-intelligence-md static sanctions name index/1.0"

# `min_bytes` is a sanity floor, not a size assertion: it is set far below the
# real file size (roughly a fifth of the 2026-07 sizes) so it only catches an
# upstream error page or a truncated body served with HTTP 200.
SOURCES = [
    {
        "id": "ofac_sdn_xml",
        "authority": "US OFAC",
        "list_name": "SDN",
        "url": "https://www.treasury.gov/ofac/downloads/sdn.xml",
        "format": "ofac_xml",
        "min_bytes": 5 * 1024 * 1024,
    },
    {
        "id": "ofac_consolidated_xml",
        "authority": "US OFAC",
        "list_name": "Consolidated non-SDN",
        "url": "https://www.treasury.gov/ofac/downloads/consolidated/consolidated.xml",
        "format": "ofac_xml",
        "min_bytes": 200 * 1024,
    },
    {
        "id": "eu_full_consolidated_xml",
        "authority": "European Union",
        "list_name": "EU consolidated financial sanctions",
        "url": "https://webgate.ec.europa.eu/fsd/fsf/public/files/xmlFullSanctionsList/content?token=dG9rZW4tMjAxNw",
        "format": "eu_xml",
        "min_bytes": 5 * 1024 * 1024,
    },
    {
        "id": "uk_sanctions_list_csv",
        "authority": "United Kingdom FCDO",
        "list_name": "UK Sanctions List",
        "url": "https://sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.csv",
        "format": "uk_csv",
        "min_bytes": 5 * 1024 * 1024,
    },
]

HTML_PREFIXES = (b"<!doctype html", b"<html")


class SourceError(RuntimeError):
    """An upstream source returned something that is not its published payload."""


def first_line(head: bytes, limit: int = 200) -> str:
    text = head.decode("utf-8", errors="replace")
    for line in text.splitlines():
        line = line.strip()
        if line:
            return line[:limit] + ("..." if len(line) > limit else "")
    return "(empty body)"


def looks_like_html(content_type: str, head: bytes) -> bool:
    if "html" in (content_type or "").lower():
        return True
    prefix = head.lstrip().lower()
    return prefix.startswith(HTML_PREFIXES)


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def public_url(url: str) -> str:
    parts = urlsplit(url)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, "", ""))


def normalized_name(value: str) -> str:
    value = value.upper()
    value = re.sub(r"[^A-Z0-9]+", " ", value)
    return " ".join(value.split())


def clean_name(*parts: str | None) -> str:
    return " ".join(str(part).strip() for part in parts if part and str(part).strip())


def local_name(element: ET.Element) -> str:
    return element.tag.rsplit("}", 1)[-1]


def child_text(element: ET.Element, wanted: str) -> str:
    for child in element:
        if local_name(child) == wanted and child.text:
            return child.text.strip()
    return ""


def iter_children(element: ET.Element, wanted: str):
    for child in element:
        if local_name(child) == wanted:
            yield child


def _download_once(source: dict[str, object], timeout: int, max_bytes: int) -> tuple[Path, dict[str, object]]:
    request = Request(str(source["url"]), headers={"User-Agent": USER_AGENT})
    sha256 = hashlib.sha256()
    size = 0
    head = b""
    tmp = tempfile.NamedTemporaryFile(delete=False)
    tmp_path = Path(tmp.name)
    try:
        with urlopen(request, timeout=timeout) as response:
            status = int(getattr(response, "status", 0) or 0)
            content_type = response.headers.get("Content-Type") or ""
            final_url = response.geturl()
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                if len(head) < 512:
                    head += chunk[: 512 - len(head)]
                size += len(chunk)
                if size > max_bytes:
                    raise ValueError(f"source exceeded max bytes: {max_bytes}")
                sha256.update(chunk)
                tmp.write(chunk)
    except BaseException:
        tmp.close()
        tmp_path.unlink(missing_ok=True)
        raise
    finally:
        tmp.close()

    def reject(reason: str) -> SourceError:
        tmp_path.unlink(missing_ok=True)
        return SourceError(
            f"source {source['id']} ({source['authority']} / {source['list_name']}) {reason}\n"
            f"  final URL: {public_url(final_url)}\n"
            f"  HTTP status: {status}\n"
            f"  content-type: {content_type or '(none)'}\n"
            f"  size: {size} bytes\n"
            f"  first line of body: {first_line(head)}"
        )

    if looks_like_html(content_type, head):
        raise reject("returned an HTML page instead of its published payload (likely an upstream outage)")
    min_bytes = int(source.get("min_bytes", 0) or 0)
    if size < min_bytes:
        raise reject(f"returned a body below the sanity floor of {min_bytes} bytes")

    meta = {
        "id": source["id"],
        "authority": source["authority"],
        "list_name": source["list_name"],
        "source_url": public_url(str(source["url"])),
        "source_url_query_redacted": source["url"] != public_url(str(source["url"])),
        "final_url": public_url(final_url),
        "final_url_query_redacted": final_url != public_url(final_url),
        "retrieved_at_utc": utc_now(),
        "size_bytes": size,
        "sha256": sha256.hexdigest(),
    }
    return tmp_path, meta


def download_error_detail(exc: BaseException) -> str:
    if isinstance(exc, urllib.error.HTTPError):
        return f"HTTP {exc.code} {exc.reason}"
    if isinstance(exc, urllib.error.URLError):
        return f"{type(exc).__name__}: {exc.reason}"
    return f"{type(exc).__name__}: {exc}"


def is_retryable_download_error(exc: BaseException) -> bool:
    if isinstance(exc, urllib.error.HTTPError):
        return exc.code in {408, 425, 429} or 500 <= exc.code < 600
    return isinstance(exc, (urllib.error.URLError, TimeoutError))


def download(
    source: dict[str, object],
    timeout: int,
    max_bytes: int,
    *,
    retries: int = 3,
    retry_delay_seconds: float = 5,
) -> tuple[Path, dict[str, object]]:
    """Download one source, retrying failures that are likely temporary."""
    if retries < 1:
        raise ValueError("retries must be at least 1")
    if retry_delay_seconds < 0:
        raise ValueError("retry_delay_seconds must not be negative")

    last_error: BaseException | None = None
    attempts_made = 0
    for attempt in range(1, retries + 1):
        attempts_made = attempt
        try:
            return _download_once(source, timeout, max_bytes)
        except (urllib.error.URLError, TimeoutError) as exc:
            last_error = exc
            if not is_retryable_download_error(exc) or attempt == retries:
                break
            delay = retry_delay_seconds * (2 ** (attempt - 1))
            print(
                f"warning: source {source['id']} download attempt {attempt}/{retries} failed: "
                f"{download_error_detail(exc)}; retrying in {delay:g}s",
                file=sys.stderr,
            )
            time.sleep(delay)

    assert last_error is not None
    attempt_word = "attempt" if attempts_made == 1 else "attempts"
    raise SourceError(
        f"source {source['id']} ({source['authority']} / {source['list_name']}) could not be downloaded "
        f"after {attempts_made} {attempt_word}: {download_error_detail(last_error)}\n"
        f"  URL: {public_url(str(source['url']))}"
    ) from last_error


def add_entry(
    entries: list[dict[str, object]],
    seen: set[tuple[str, str]],
    source: dict[str, object],
    name: str,
    entity_type: str = "",
    entity_id: str = "",
) -> None:
    name = " ".join(name.split())
    norm = normalized_name(name)
    if len(norm) < 3:
        return
    key = (str(source["id"]), norm)
    if key in seen:
        return
    seen.add(key)
    entries.append(
        {
            "n": name,
            "s": norm,
            "a": source["authority"],
            "l": source["list_name"],
            "t": entity_type,
            "id": entity_id,
        }
    )


def parse_ofac_xml(
    path: Path,
    source: dict[str, object],
    entries: list[dict[str, object]],
    seen: set[tuple[str, str]],
) -> int:
    before = len(entries)
    for _event, elem in ET.iterparse(path, events=("end",)):
        if local_name(elem) != "sdnEntry":
            continue
        entity_id = child_text(elem, "uid")
        entity_type = child_text(elem, "sdnType")
        primary = clean_name(child_text(elem, "firstName"), child_text(elem, "lastName"))
        add_entry(entries, seen, source, primary, entity_type, entity_id)
        for aka_list in iter_children(elem, "akaList"):
            for aka in iter_children(aka_list, "aka"):
                aka_name = clean_name(child_text(aka, "firstName"), child_text(aka, "lastName"))
                add_entry(entries, seen, source, aka_name, entity_type, entity_id)
        elem.clear()
    return len(entries) - before


def parse_eu_xml(
    path: Path,
    source: dict[str, object],
    entries: list[dict[str, object]],
    seen: set[tuple[str, str]],
) -> int:
    before = len(entries)
    entity_id = ""
    entity_type = ""
    for event, elem in ET.iterparse(path, events=("start", "end")):
        tag = local_name(elem)
        if event == "start" and tag == "sanctionEntity":
            entity_id = elem.attrib.get("logicalId", "")
            entity_type = ""
        elif event == "end" and tag == "subjectType":
            entity_type = elem.attrib.get("code", "")
        elif event == "end" and tag == "nameAlias":
            name = elem.attrib.get("wholeName") or clean_name(
                elem.attrib.get("firstName"), elem.attrib.get("middleName"), elem.attrib.get("lastName")
            )
            add_entry(entries, seen, source, name, entity_type, entity_id)
        elif event == "end" and tag == "sanctionEntity":
            elem.clear()
    return len(entries) - before


def parse_uk_csv(
    path: Path,
    source: dict[str, object],
    entries: list[dict[str, object]],
    seen: set[tuple[str, str]],
) -> int:
    before = len(entries)
    with path.open(newline="", encoding="utf-8-sig", errors="ignore") as fh:
        first = fh.readline()
        if not first.startswith("Report Date:"):
            fh.seek(0)
        reader = csv.DictReader(fh)
        for row in reader:
            parts = [row.get(f"Name {i}", "") for i in range(1, 7)]
            # UK CSV stores the first visible component in Name 6 for many rows.
            name = clean_name(*parts)
            add_entry(
                entries,
                seen,
                source,
                name,
                row.get("Designation Type", "") or row.get("Type of entity", ""),
                row.get("Unique ID", "") or row.get("OFSI Group ID", ""),
            )
    return len(entries) - before


def build_index(args: argparse.Namespace) -> dict[str, object]:
    entries: list[dict[str, object]] = []
    seen: set[tuple[str, str]] = set()
    source_meta = []
    for source in SOURCES:
        path, meta = download(source, args.timeout, args.max_bytes)
        try:
            if source["format"] == "ofac_xml":
                count = parse_ofac_xml(path, meta, entries, seen)
            elif source["format"] == "eu_xml":
                count = parse_eu_xml(path, meta, entries, seen)
            elif source["format"] == "uk_csv":
                count = parse_uk_csv(path, meta, entries, seen)
            else:
                raise ValueError(f"unknown format: {source['format']}")
            if count == 0:
                raise SourceError(
                    f"source {source['id']} ({source['authority']} / {source['list_name']}) parsed to zero names\n"
                    f"  final URL: {meta['final_url']}\n"
                    f"  size: {meta['size_bytes']} bytes"
                )
            meta["name_count"] = count
            source_meta.append(meta)
        except (ET.ParseError, csv.Error) as exc:
            raise SourceError(
                f"source {source['id']} ({source['authority']} / {source['list_name']}) failed to parse "
                f"as {source['format']}: {exc.__class__.__name__}: {exc}\n"
                f"  final URL: {meta['final_url']}\n"
                f"  size: {meta['size_bytes']} bytes"
            ) from exc
        finally:
            path.unlink(missing_ok=True)

    entries.sort(key=lambda item: (item["s"], item["a"], item["l"]))
    return {
        "schema_version": "sanctions-name-index.v1",
        "generated_at_utc": utc_now(),
        "retrieval_scope": "static_public_list_name_index_for_browser_preview",
        "performed": ["static_string_name_indexing"],
        "not_performed": [
            "legal_entity_identity_verification",
            "ownership_resolution",
            "50_percent_rule_determination",
            "legal_or_compliance_opinion",
        ],
        "matching_notice": (
            "Possible string matches only. A name match is not identity verification, "
            "sanctions clearance, ownership analysis, or legal/compliance advice."
        ),
        "summary": {
            "source_count": len(source_meta),
            "name_count": len(entries),
        },
        "sources": source_meta,
        "entries": entries,
    }


def to_compact(index: dict[str, object]) -> dict[str, object]:
    """Derive the worker-facing compact index from a full index dict."""
    src_list: list[list[str]] = []
    src_idx: dict[tuple[str, str], int] = {}
    centries: list[list[object]] = []
    for entry in index["entries"]:  # type: ignore[index]
        key = (str(entry["a"]), str(entry["l"]))
        if key not in src_idx:
            src_idx[key] = len(src_list)
            src_list.append([key[0], key[1]])
        centries.append([entry["n"], src_idx[key]])
    return {
        "schema_version": "sanctions-name-index-compact.v1",
        "generated_at_utc": index["generated_at_utc"],
        "retrieval_scope": "static_public_list_name_index_for_server_side_preview",
        "matching_notice": index["matching_notice"],
        "summary": index["summary"],
        "src": src_list,
        "entries": centries,
    }


def write_json(path: Path, payload: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Build public static sanctions-name index.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--compact-output", type=Path, default=DEFAULT_COMPACT_OUTPUT)
    parser.add_argument("--timeout", type=int, default=60)
    parser.add_argument("--max-bytes", type=int, default=120 * 1024 * 1024)
    parser.add_argument(
        "--derive-compact-from",
        type=Path,
        default=None,
        help="Skip downloads: read an existing full index JSON and write only the compact derivative.",
    )
    args = parser.parse_args()

    if args.derive_compact_from is not None:
        index = json.loads(args.derive_compact_from.read_text(encoding="utf-8"))
        compact = to_compact(index)
        write_json(args.compact_output, compact)
        print(f"Wrote {args.compact_output} ({compact['summary']['name_count']} names, derived)")
        return 0

    try:
        index = build_index(args)
    except SourceError as exc:
        # Fail loudly and write nothing: a partial index would quietly shrink
        # coverage for the served compact index.
        print(f"error: {exc}", file=sys.stderr)
        print("error: no output written; the index must cover every source.", file=sys.stderr)
        return 1

    write_json(args.output, index)
    print(f"Wrote {args.output} ({index['summary']['name_count']} names)")
    compact = to_compact(index)
    write_json(args.compact_output, compact)
    print(f"Wrote {args.compact_output} ({compact['summary']['name_count']} names, compact)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
