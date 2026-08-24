"""Local document adapter and reviewer-facing output for evidence packets.

The stable evidence-packet service remains pure and transport-neutral. This
module is a CLI adapter: it loads caller-selected local files, converts them to
the existing request contract, and formats the deterministic response. It does
not extract claims from prose, retrieve sources, or send document contents to a
model or network service.
"""

from __future__ import annotations

import html
import json
import os
import zipfile
from importlib import resources
from pathlib import Path
from xml.etree import ElementTree

from jsonschema.validators import validator_for

PACKAGE_NAME = "agenda_intelligence"
MAX_SOURCE_BYTES = 20 * 1024 * 1024
MAX_EXTRACTED_CHARACTERS = 2_000_000
MAX_PDF_PAGES = 500
_PLAIN_TEXT_SUFFIXES = {".txt", ".md", ".markdown", ".rst", ".csv", ".json"}
_WORD_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"


class EvidenceReviewError(ValueError):
    """A safe, user-facing failure while building a local review packet."""


def _bounded_text(text: str, *, source: Path) -> str:
    normalized = text.replace("\r\n", "\n").replace("\r", "\n").strip()
    if not normalized:
        raise EvidenceReviewError(f"No extractable text in source: {source}")
    if len(normalized) > MAX_EXTRACTED_CHARACTERS:
        raise EvidenceReviewError(f"Extracted text exceeds {MAX_EXTRACTED_CHARACTERS} characters: {source}")
    return normalized


def _check_file(path: Path) -> None:
    if not path.is_file():
        raise EvidenceReviewError(f"Source file not found: {path}")
    try:
        size = path.stat().st_size
    except OSError as exc:
        raise EvidenceReviewError(f"Cannot inspect source file {path}: {exc}") from exc
    if size > MAX_SOURCE_BYTES:
        raise EvidenceReviewError(f"Source file exceeds {MAX_SOURCE_BYTES} bytes: {path}")


def _read_plain_text(path: Path) -> str:
    try:
        return _bounded_text(path.read_text(encoding="utf-8-sig"), source=path)
    except UnicodeDecodeError as exc:
        raise EvidenceReviewError(f"Source is not valid UTF-8 text: {path}") from exc
    except OSError as exc:
        raise EvidenceReviewError(f"Cannot read source file {path}: {exc}") from exc


def _read_docx(path: Path) -> str:
    try:
        with zipfile.ZipFile(path) as archive:
            try:
                info = archive.getinfo("word/document.xml")
            except KeyError as exc:
                raise EvidenceReviewError(f"DOCX has no word/document.xml: {path}") from exc
            if info.file_size > MAX_SOURCE_BYTES:
                raise EvidenceReviewError(f"DOCX document XML exceeds {MAX_SOURCE_BYTES} bytes: {path}")
            xml = archive.read(info)
    except zipfile.BadZipFile as exc:
        raise EvidenceReviewError(f"Invalid DOCX container: {path}") from exc
    except OSError as exc:
        raise EvidenceReviewError(f"Cannot read DOCX source {path}: {exc}") from exc

    try:
        root = ElementTree.fromstring(xml)
    except ElementTree.ParseError as exc:
        raise EvidenceReviewError(f"Invalid DOCX document XML: {path}") from exc

    paragraph_tag = f"{{{_WORD_NAMESPACE}}}p"
    text_tag = f"{{{_WORD_NAMESPACE}}}t"
    paragraphs: list[str] = []
    for paragraph in root.iter(paragraph_tag):
        value = "".join(node.text or "" for node in paragraph.iter(text_tag)).strip()
        if value:
            paragraphs.append(value)
    return _bounded_text("\n".join(paragraphs), source=path)


def _read_pdf(path: Path) -> str:
    try:
        from pypdf import PdfReader  # type: ignore
    except ImportError as exc:
        raise EvidenceReviewError(
            'PDF extraction requires the optional dependency: pip install "agenda-intelligence-md[documents]"'
        ) from exc

    try:
        reader = PdfReader(str(path))
        if len(reader.pages) > MAX_PDF_PAGES:
            raise EvidenceReviewError(f"PDF exceeds {MAX_PDF_PAGES} pages: {path}")
        text = "\n\n".join((page.extract_text() or "").strip() for page in reader.pages)
    except EvidenceReviewError:
        raise
    except Exception as exc:
        raise EvidenceReviewError(f"Cannot extract PDF text from {path}: {exc}") from exc
    return _bounded_text(text, source=path)


def read_document_text(path: Path) -> str:
    """Extract bounded local text without network or model calls."""

    path = path.resolve()
    _check_file(path)
    suffix = path.suffix.casefold()
    if suffix in _PLAIN_TEXT_SUFFIXES:
        return _read_plain_text(path)
    if suffix == ".docx":
        return _read_docx(path)
    if suffix == ".pdf":
        return _read_pdf(path)
    raise EvidenceReviewError(
        f"Unsupported source type {suffix or '<none>'}: {path}. " "Use UTF-8 text, Markdown, DOCX, or PDF."
    )


def _validate_manifest(data: object) -> dict:
    if not isinstance(data, dict):
        raise EvidenceReviewError("Evidence review manifest must be a JSON object")
    schema_path = resources.files(PACKAGE_NAME) / "data" / "schemas" / "v1" / "evidence-review-request.schema.json"
    schema = json.loads(schema_path.read_text())
    validator_type = validator_for(schema)
    validator_type.check_schema(schema)
    errors = sorted(validator_type(schema).iter_errors(data), key=lambda error: list(error.path))
    if errors:
        details = "; ".join(error.message for error in errors)
        raise EvidenceReviewError(f"Invalid evidence review manifest: {details}")
    return data


def _resolve_source_path(manifest_dir: Path, value: str) -> Path:
    candidate = (manifest_dir / value).resolve()
    try:
        inside_manifest_dir = os.path.commonpath((str(manifest_dir), str(candidate))) == str(manifest_dir)
    except ValueError:
        inside_manifest_dir = False
    if not inside_manifest_dir:
        raise EvidenceReviewError(f"Source path is outside the manifest directory: {value}")
    return candidate


def load_review_manifest(path: Path) -> dict:
    """Load a file manifest and return a stable evidence-packet request."""

    manifest_path = path.resolve()
    _check_file(manifest_path)
    try:
        raw = json.loads(manifest_path.read_text(encoding="utf-8"))
    except UnicodeDecodeError as exc:
        raise EvidenceReviewError(f"Manifest is not valid UTF-8: {manifest_path}") from exc
    except json.JSONDecodeError as exc:
        raise EvidenceReviewError(f"Invalid JSON manifest: {exc}") from exc
    manifest = _validate_manifest(raw)

    packet = {key: manifest[key] for key in ("packet_id", "topic", "claims") if key in manifest}
    packet["sources"] = []
    for source in manifest["sources"]:
        source_path = _resolve_source_path(manifest_path.parent, source["path"])
        hydrated = {key: source[key] for key in ("source_id", "title", "url") if key in source}
        hydrated["text"] = read_document_text(source_path)
        packet["sources"].append(hydrated)
    return packet


def _cell(value: object) -> str:
    return (
        html.escape(str(value), quote=False)
        .replace("`", "&#96;")
        .replace("|", "\\|")
        .replace("\r", " ")
        .replace("\n", " ")
    )


def render_review_markdown(packet: dict, response: dict) -> str:
    """Render a deterministic, reviewer-facing projection without source text."""

    label = packet.get("topic") or packet.get("packet_id") or "Evidence packet"
    lines = [
        "# Evidence review",
        "",
        f"Packet: {_cell(label)}",
        f"Status: `{_cell(response['packet_status'])}`",
        f"Factuality: {_cell(response['factuality_status'].replace('_', ' '))}",
        f"Human review required: {'yes' if response['human_review_required'] else 'no'}",
        "",
        "## Claims",
        "",
        "| ID | Claim | Sources | Packet status | Lexical support | Coverage | Issues |",
        "|---|---|---|---|---|---:|---|",
    ]
    claims_by_id = {claim["claim_id"]: claim for claim in packet["claims"]}
    for result in response["claims"]:
        claim = claims_by_id.get(result["claim_id"], {})
        lexical = result["lexical_support"]
        lines.append(
            "| "
            + " | ".join(
                [
                    _cell(result["claim_id"]),
                    _cell(claim.get("text", "")),
                    _cell(", ".join(result["referenced_source_ids"]) or "none"),
                    _cell(result["packet_status"]),
                    _cell(lexical["status"]),
                    _cell(lexical["coverage"]),
                    _cell(", ".join(result["issues"]) or "none"),
                ]
            )
            + " |"
        )

    lines.extend(["", "## Reviewer actions", ""])
    if response["owner_actions"]:
        lines.extend(f"- {_cell(action)}" for action in response["owner_actions"])
    else:
        lines.append("- No structural or lexical issue was detected. Human review is still required.")

    lines.extend(["", "## Source inventory", ""])
    for source in packet["sources"]:
        title = source.get("title") or "untitled"
        lines.append(f"- `{_cell(source['source_id'])}` — {_cell(title)}")

    lines.extend(["", "## Limitations", ""])
    lines.extend(f"- {_cell(limitation)}" for limitation in response["limitations"])
    lines.append("")
    return "\n".join(lines)
