"""Local document adapter and reviewer-facing output for evidence packets.

The stable evidence-packet service remains pure and transport-neutral. This
module is a CLI adapter: it loads caller-selected local files, converts them to
the existing request contract, and formats the deterministic response. It does
not extract claims from prose, retrieve sources, or send document contents to a
model or network service.
"""

from __future__ import annotations

import csv
import html
import json
import os
import zipfile
from html.parser import HTMLParser
from importlib import resources
from pathlib import Path
from xml.etree import ElementTree

from jsonschema.validators import validator_for

PACKAGE_NAME = "agenda_intelligence"
MAX_SOURCE_BYTES = 20 * 1024 * 1024
MAX_EXTRACTED_CHARACTERS = 2_000_000
MAX_PDF_PAGES = 500
_PLAIN_TEXT_SUFFIXES = {".txt", ".md", ".markdown", ".rst", ".json"}
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


def _read_csv(path: Path) -> str:
    delimiter = "\t" if path.suffix.casefold() == ".tsv" else ","
    try:
        content = path.read_text(encoding="utf-8-sig")
    except UnicodeDecodeError as exc:
        raise EvidenceReviewError(f"Table source is not valid UTF-8 text: {path}") from exc
    except OSError as exc:
        raise EvidenceReviewError(f"Cannot read table source {path}: {exc}") from exc

    lines: list[str] = []
    try:
        reader = csv.reader(content.splitlines(), delimiter=delimiter)
        for row in reader:
            non_empty = [cell.strip() for cell in row if cell.strip()]
            if non_empty:
                lines.append(" | ".join(non_empty))
    except csv.Error as exc:
        raise EvidenceReviewError(f"Cannot parse CSV/TSV table {path}: {exc}") from exc

    return _bounded_text("\n".join(lines), source=path)


class _HTMLTextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._chunks: list[str] = []
        self._ignore = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in ("script", "style", "head", "noscript", "svg"):
            self._ignore = True

    def handle_endtag(self, tag: str) -> None:
        if tag in ("script", "style", "head", "noscript", "svg"):
            self._ignore = False
        elif tag in ("p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "li", "tr", "br"):
            self._chunks.append("\n")

    def handle_data(self, data: str) -> None:
        if not self._ignore:
            text = data.strip()
            if text:
                self._chunks.append(text + " ")

    def get_text(self) -> str:
        return "".join(self._chunks)


def _read_html(path: Path) -> str:
    try:
        raw = path.read_text(encoding="utf-8-sig")
    except UnicodeDecodeError as exc:
        raise EvidenceReviewError(f"HTML source is not valid UTF-8 text: {path}") from exc
    except OSError as exc:
        raise EvidenceReviewError(f"Cannot read HTML source {path}: {exc}") from exc

    parser = _HTMLTextExtractor()
    parser.feed(raw)
    parser.close()
    return _bounded_text(parser.get_text(), source=path)


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

    normalized = text.replace("\r\n", "\n").replace("\r", "\n").strip()
    if not normalized:
        raise EvidenceReviewError(
            f"No extractable text layer found in PDF (scanned/raster document or OCR required): {path}"
        )
    return _bounded_text(normalized, source=path)


def read_document_text(path: Path) -> str:
    """Extract bounded local text without network or model calls."""

    path = path.resolve()
    _check_file(path)
    suffix = path.suffix.casefold()
    if suffix in _PLAIN_TEXT_SUFFIXES:
        return _read_plain_text(path)
    if suffix in (".csv", ".tsv"):
        return _read_csv(path)
    if suffix in (".html", ".htm"):
        return _read_html(path)
    if suffix == ".docx":
        return _read_docx(path)
    if suffix == ".pdf":
        return _read_pdf(path)
    raise EvidenceReviewError(
        f"Unsupported source type {suffix or '<none>'}: {path}. "
        "Use UTF-8 text, Markdown, CSV, TSV, HTML, DOCX, or PDF."
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


def render_review_html(packet: dict, response: dict) -> str:
    """Render a standalone, interactive HTML reviewer report with zero external CDN dependencies."""
    label = packet.get("topic") or packet.get("packet_id") or "Evidence packet"
    status = response.get("packet_status", "unknown")
    factuality = response.get("factuality_status", "not_assessed").replace("_", " ")
    counts = response.get("counts", {})

    status_color = {
        "packet_complete": "#1a7f37",
        "source_review_required": "#9a6700",
        "packet_incomplete": "#cf222e",
    }.get(status, "#57606a")

    status_bg = {
        "packet_complete": "#dafbe1",
        "source_review_required": "#fff8c5",
        "packet_incomplete": "#ffebe9",
    }.get(status, "#f6f8fa")

    claims_by_id = {claim["claim_id"]: claim for claim in packet.get("claims", [])}
    claim_rows = []
    for result in response.get("claims", []):
        cid = result["claim_id"]
        c_text = claims_by_id.get(cid, {}).get("text", "")
        sources_str = ", ".join(result.get("referenced_source_ids", [])) or "none"
        c_status = result.get("packet_status", "")
        lex = result.get("lexical_support", {})
        cov_pct = int(lex.get("coverage", 0.0) * 100)
        issues = result.get("issues", [])
        issues_html = (
            "".join(f"<span class='issue-tag'>{html.escape(iss)}</span>" for iss in issues)
            or "<span class='text-muted'>none</span>"
        )

        claim_rows.append(f"""<tr class="claim-row status-{c_status}" data-sources="{html.escape(sources_str)}">
              <td><code>{html.escape(cid)}</code></td>
              <td class="claim-text">{html.escape(c_text)}</td>
              <td><code>{html.escape(sources_str)}</code></td>
              <td><span class="badge badge-{c_status}">{html.escape(c_status)}</span></td>
              <td>
                <div class="cov-bar"><div class="cov-fill" style="width: {cov_pct}%;"></div></div>
                <span class="cov-label">{cov_pct}% ({html.escape(lex.get('status', ''))})</span>
              </td>
              <td>{issues_html}</td>
            </tr>""")

    actions_html = []
    for i, action in enumerate(response.get("owner_actions", []), 1):
        actions_html.append(f"""<label class="action-item">
              <input type="checkbox" id="action-{i}" />
              <span>{html.escape(action)}</span>
            </label>""")
    if not actions_html:
        actions_html.append("<p class='text-muted'>No structural or lexical issue detected. Human review required.</p>")

    sources_html = []
    for source in packet.get("sources", []):
        sid = source.get("source_id", "")
        stitle = source.get("title") or "untitled"
        surl = source.get("url")
        url_link = f' &middot; <a href="{html.escape(surl)}" target="_blank" rel="noopener">Link</a>' if surl else ""
        sources_html.append(f"""<div class="source-item" id="source-{html.escape(sid)}">
              <code>{html.escape(sid)}</code> &mdash; <strong>{html.escape(stitle)}</strong>{url_link}
            </div>""")

    limitations_html = "".join(f"<li>{html.escape(lim)}</li>" for lim in response.get("limitations", []))

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Evidence Review: {html.escape(label)}</title>
  <style>
    :root {{
      --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      --font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
      --bg: #ffffff; --fg: #24292f; --border: #d0d7de; --muted: #57606a;
      --complete-bg: #dafbe1; --complete-fg: #1a7f37;
      --review-bg: #fff8c5; --review-fg: #9a6700;
      --incomplete-bg: #ffebe9; --incomplete-fg: #cf222e;
    }}
    @media (prefers-color-scheme: dark) {{
      :root {{
        --bg: #0d1117; --fg: #c9d1d9; --border: #30363d; --muted: #8b949e;
        --complete-bg: #1f3b28; --complete-fg: #3fb950;
        --review-bg: #3c3214; --review-fg: #d29922;
        --incomplete-bg: #441c1e; --incomplete-fg: #f85149;
      }}
    }}
    body {{ font-family: var(--font-sans); background: var(--bg); color: var(--fg); margin: 0; padding: 24px; }}
    .container {{ max-width: 1100px; margin: 0 auto; }}
    .header {{ border-bottom: 1px solid var(--border); padding-bottom: 16px; margin-bottom: 24px; }}
    .status-banner {{
      display: inline-block; font-weight: 600; padding: 6px 14px; border-radius: 6px;
      background: {status_bg}; color: {status_color}; font-size: 1.1em;
    }}
    .stats-grid {{
      display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px; margin: 20px 0;
    }}
    .stat-card {{
      border: 1px solid var(--border); border-radius: 6px; padding: 14px;
      background: rgba(128,128,128,0.05);
    }}
    .stat-val {{ font-size: 1.4em; font-weight: bold; margin-top: 4px; }}
    table {{ width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 0.9em; }}
    th, td {{ border: 1px solid var(--border); padding: 10px 12px; text-align: left; vertical-align: top; }}
    th {{ background: rgba(128,128,128,0.08); font-weight: 600; }}
    .claim-row {{ cursor: pointer; transition: background 0.15s; }}
    .claim-row:hover {{ background: rgba(128,128,128,0.06); }}
    .claim-row.active {{ background: rgba(56, 139, 253, 0.12); outline: 2px solid #58a6ff; }}
    code {{
      font-family: var(--font-mono); font-size: 0.9em; padding: 2px 4px;
      border-radius: 4px; background: rgba(128,128,128,0.12);
    }}
    .badge {{ display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 0.8em; font-weight: 600; }}
    .badge-packet_complete {{ background: var(--complete-bg); color: var(--complete-fg); }}
    .badge-source_review_required {{ background: var(--review-bg); color: var(--review-fg); }}
    .badge-packet_incomplete {{ background: var(--incomplete-bg); color: var(--incomplete-fg); }}
    .issue-tag {{
      display: inline-block; margin: 2px; padding: 2px 6px; border-radius: 4px;
      font-size: 0.8em; background: var(--incomplete-bg); color: var(--incomplete-fg);
      font-family: var(--font-mono);
    }}
    .cov-bar {{
      width: 100%; height: 8px; background: rgba(128,128,128,0.2);
      border-radius: 4px; overflow: hidden; margin-bottom: 4px;
    }}
    .cov-fill {{ height: 100%; background: #2da44e; }}
    .cov-label {{ font-size: 0.8em; color: var(--muted); }}
    .action-item {{
      display: flex; align-items: baseline; gap: 10px; margin: 8px 0;
      padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px;
    }}
    .source-item {{
      padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px;
      margin: 6px 0; transition: border-color 0.2s, background 0.2s;
    }}
    .source-item.highlight {{ border-color: #58a6ff; background: rgba(56, 139, 253, 0.1); }}
    .limitations {{
      background: rgba(128,128,128,0.05); border-radius: 6px;
      padding: 14px 20px; font-size: 0.85em; color: var(--muted);
    }}
    .text-muted {{ color: var(--muted); }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Evidence Review Report</h1>
      <p><strong>Topic:</strong> {html.escape(label)}</p>
      <div><span class="status-banner">{html.escape(status)}</span></div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="text-muted">Total Claims</div>
        <div class="stat-val">{len(response.get('claims', []))}</div>
      </div>
      <div class="stat-card">
        <div class="text-muted">Complete / Gaps / Incomplete</div>
        <div class="stat-val">
          {counts.get('packet_complete', 0)} /
          {counts.get('source_review_required', 0)} /
          {counts.get('packet_incomplete', 0)}
        </div>
      </div>
      <div class="stat-card">
        <div class="text-muted">Factuality Status</div>
        <div class="stat-val">{html.escape(factuality)}</div>
      </div>
      <div class="stat-card">
        <div class="text-muted">Human Review</div>
        <div class="stat-val">{'Required' if response.get('human_review_required') else 'Not Required'}</div>
      </div>
    </div>

    <h2>Claims Evaluation</h2>
    <p class="text-muted">Click any row to highlight its referenced sources.</p>
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Claim</th>
          <th>Sources</th>
          <th>Status</th>
          <th>Lexical Coverage</th>
          <th>Issues</th>
        </tr>
      </thead>
      <tbody>
        {"".join(claim_rows)}
      </tbody>
    </table>

    <h2>Reviewer Action Items</h2>
    <div class="actions-list">
      {"".join(actions_html)}
    </div>

    <h2>Source Inventory</h2>
    <div class="sources-list">
      {"".join(sources_html)}
    </div>

    <h2>Limitations</h2>
    <div class="limitations">
      <ul>
        {limitations_html}
      </ul>
    </div>
  </div>

  <script>
    document.querySelectorAll('.claim-row').forEach(row => {{
      row.addEventListener('click', () => {{
        const wasActive = row.classList.contains('active');
        document.querySelectorAll('.claim-row').forEach(r => r.classList.remove('active'));
        document.querySelectorAll('.source-item').forEach(s => s.classList.remove('highlight'));
        if (!wasActive) {{
          row.classList.add('active');
          const sids = (row.getAttribute('data-sources') || '').split(',').map(s => s.trim());
          sids.forEach(sid => {{
            const el = document.getElementById('source-' + sid);
            if (el) el.classList.add('highlight');
          }});
        }}
      }});
    }});
  </script>
</body>
</html>"""
