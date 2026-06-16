"""Deal-risk report rendering.

Turns a Middle Corridor deal-risk response (the structured contract emitted by
``middle_corridor_deal_risk`` / the live A2A worker) into a human-facing
evidence-readiness memo in Markdown, self-contained HTML (print-to-PDF ready),
or PDF.

This is the deliverable behind the concierge offer: an operator receives a deal,
runs the triage, and hands the client a branded memo. The renderer reformats the
structured response faithfully — it invents nothing, performs no factual-truth
verification, and is not legal / sanctions / compliance / financial / investment
/ insurance / trading advice. Human review is required before any commercial
action; the disclaimer rides on every rendered artifact.

Markdown and HTML have no third-party dependencies. PDF rendering uses ``fpdf2``,
declared as the optional ``pdf`` extra (``pip install agenda-intelligence-md[pdf]``)
so the core package stays dependency-light.
"""

from __future__ import annotations

from datetime import datetime as _datetime
from datetime import timezone
from html import escape
from typing import Any

# Brand-book identity (see Middle Corridor Deal Risk Gate brand book).
BRAND_TEAL = "#0f766e"
BRAND_INK = "#0f172a"
BRAND_MUTED = "#475569"
BRAND_BORDER = "#e2e8f0"
VERDICT_COLORS = {
    "proceed": "#15803d",  # green
    "conditions": "#b45309",  # amber
    "hold": "#b45309",  # amber (brand verdict system: only escalate is red)
    "escalate": "#b91c1c",  # red
}
_RGB = {
    "#0f766e": (15, 118, 110),
    "#0f172a": (15, 23, 42),
    "#475569": (71, 85, 105),
    "#e2e8f0": (226, 232, 240),
    "#15803d": (21, 128, 61),
    "#b45309": (180, 83, 9),
    "#b91c1c": (185, 28, 28),
    "#ffffff": (255, 255, 255),
    "#f8fafc": (248, 250, 252),
}

_TRIAGE_TO_TIER = {
    "ready_for_human_review": ("PROCEED", "proceed"),
    "escalate_before_signature": ("ESCALATE", "escalate"),
    "escalate_before_shipment": ("ESCALATE", "escalate"),
    "not_decision_ready": ("HOLD", "hold"),
    "insufficient_information": ("HOLD", "hold"),
}
_DECISION_TO_TIER = {
    "proceed": ("PROCEED", "proceed"),
    "proceed_with_conditions": ("PROCEED WITH CONDITIONS", "conditions"),
    "hold": ("HOLD", "hold"),
    "escalate": ("ESCALATE", "escalate"),
}

GENERATED_LABEL = "draft for human review"


def _unwrap(response: dict[str, Any]) -> dict[str, Any]:
    """Accept either a raw response object or a service-result wrapper."""
    if "triage_recommendation" not in response and isinstance(response.get("response"), dict):
        return response["response"]
    return response


def _verdict(d: dict[str, Any]) -> tuple[str, str, str]:
    """Return (verb, tier, rationale). Prefers the worker's operational_decision."""
    od = d.get("operational_decision") or {}
    decision = od.get("decision")
    if decision in _DECISION_TO_TIER:
        verb, tier = _DECISION_TO_TIER[decision]
        return verb, tier, od.get("rationale") or ""
    verb, tier = _TRIAGE_TO_TIER.get(str(d.get("triage_recommendation")), ("HOLD", "hold"))
    return verb, tier, ""


def _today() -> str:
    return _datetime.now(timezone.utc).date().isoformat()


def _counterparty_lines(d: dict[str, Any]) -> list[str]:
    out = []
    for c in d.get("counterparties") or []:
        juris = f" ({c['jurisdiction']})" if c.get("jurisdiction") else ""
        out.append(f"{c.get('role', 'unknown')}: {c.get('name', '')}{juris}")
    return out


def _shipment_value(d: dict[str, Any]) -> str | None:
    sv = d.get("shipment_value") or {}
    if sv.get("amount") is not None:
        return f"{sv['amount']:,.0f} {sv.get('currency', '')}".strip()
    return None


# --------------------------------------------------------------------------- #
# Markdown
# --------------------------------------------------------------------------- #
def render_markdown(response: dict[str, Any]) -> str:
    d = _unwrap(response)
    verb, _tier, rationale = _verdict(d)
    L: list[str] = []
    L.append("# Kazakhstan / Middle Corridor — Deal Risk Gate")
    L.append(f"**Evidence-readiness memo** ({GENERATED_LABEL}) · generated {_today()} · illustrative")
    L.append("")
    L.append("## Deal")
    L.append(f"- **Route:** {d.get('route', 'unspecified')}")
    L.append(f"- **Cargo:** {d.get('cargo', 'unspecified')}")
    sv = _shipment_value(d)
    if sv:
        L.append(f"- **Shipment value:** {sv}")
    cps = _counterparty_lines(d)
    if cps:
        L.append("- **Counterparties:**")
        L.extend(f"  - {c}" for c in cps)
    L.append("")
    L.append(f"## Read — {verb}")
    if rationale:
        L.append(rationale)
    L.append(
        f"- **Decision-readiness:** {d.get('decision_readiness_score', 0)}/100 "
        f"({d.get('decision_readiness_label', 'n/a')})"
    )
    L.append(
        f"- **Triage:** {d.get('triage_recommendation', 'n/a')} · " f"**Risk signal:** {d.get('risk_signal', 'n/a')}"
    )
    cr = d.get("counterparty_readiness")
    if cr:
        L.append("")
        L.append("## Dossier completeness")
        L.append(
            f"{cr.get('supplied_count', 0)} of {cr.get('required_total', 0)} required documents "
            f"supplied ({cr.get('status', 'n/a')})."
        )
        if cr.get("outstanding_documents"):
            L.append(f"Outstanding: {', '.join(cr['outstanding_documents'])}")

    def section(title: str, items: list[str] | None) -> None:
        L.append("")
        L.append(f"## {title}")
        if items:
            L.extend(f"- {x}" for x in items)
        else:
            L.append("- (none)")

    section("Evidence gaps (missing before go)", d.get("evidence_gaps"))
    section("Top risks", d.get("top_risks"))
    if d.get("limitations"):
        section("Flags for human review", d.get("limitations"))
    section("Watch next", d.get("watch_next"))
    L.append("")
    L.append("---")
    notice = d.get("not_advice_notice") or "Evidence-readiness triage only. Not advice."
    L.append(f"_{notice}_")
    L.append(
        "_Prepares the file before screening and counsel; not a clearance. "
        "Human review required before any commercial action._"
    )
    prov = d.get("run_provenance") or {}
    if prov.get("contract_version"):
        L.append(f"_Contract {prov['contract_version']} · {prov.get('input_digest', '')}_")
    return "\n".join(L)


# --------------------------------------------------------------------------- #
# HTML (self-contained, print-to-PDF ready)
# --------------------------------------------------------------------------- #
_GATE_MARK = (
    '<svg viewBox="0 0 48 48" width="34" height="34" aria-hidden="true">'
    '<rect x="2" y="2" width="44" height="44" rx="11" fill="#fff"/>'
    '<g fill="none" stroke="#0f766e" stroke-width="2.6" stroke-linecap="round">'
    '<path d="M11 19H37"/><path d="M11 29H37"/><path d="M24 11V37"/></g>'
    '<circle cx="24" cy="24" r="3.9" fill="#0f766e"/></svg>'
)


def _ul(items: list[str] | None) -> str:
    if not items:
        return '<p class="muted">none</p>'
    return "<ul>" + "".join(f"<li>{escape(str(x))}</li>" for x in items) + "</ul>"


def render_html(response: dict[str, Any]) -> str:
    d = _unwrap(response)
    verb, tier, rationale = _verdict(d)
    color = VERDICT_COLORS[tier]
    score = d.get("decision_readiness_score", 0)
    label = escape(str(d.get("decision_readiness_label", "n/a")))
    triage = escape(str(d.get("triage_recommendation", "n/a")))
    signal = escape(str(d.get("risk_signal", "n/a")))
    sv = _shipment_value(d)
    cps = _counterparty_lines(d)
    notice = d.get("not_advice_notice") or "Evidence-readiness triage only. Not advice."
    cr = d.get("counterparty_readiness")
    prov = d.get("run_provenance") or {}

    rows = [
        f'<div class="kv"><span>Route</span><b>{escape(str(d.get("route", "unspecified")))}</b></div>',
        f'<div class="kv"><span>Cargo</span><b>{escape(str(d.get("cargo", "unspecified")))}</b></div>',
    ]
    if sv:
        rows.append(f'<div class="kv"><span>Shipment value</span><b>{escape(sv)}</b></div>')
    if cps:
        cp_html = "".join(f"<li>{escape(c)}</li>" for c in cps)
        rows.append(f'<div class="kv"><span>Counterparties</span><ul class="cp">{cp_html}</ul></div>')

    dossier = ""
    if cr:
        outstanding = ""
        if cr.get("outstanding_documents"):
            outstanding = f'<p class="muted">Outstanding: {escape(", ".join(cr["outstanding_documents"]))}</p>'
        dossier = (
            "<h2>Dossier completeness</h2>"
            f'<p>{cr.get("supplied_count", 0)} of {cr.get("required_total", 0)} required documents '
            f'supplied &mdash; <b>{escape(str(cr.get("status", "n/a")))}</b>.</p>{outstanding}'
        )

    flags = f"<h2>Flags for human review</h2>{_ul(d.get('limitations'))}" if d.get("limitations") else ""
    prov_line = (
        f'<p class="prov">Contract {escape(str(prov.get("contract_version", "")))} '
        f'&middot; {escape(str(prov.get("input_digest", "")))}</p>'
        if prov.get("contract_version")
        else ""
    )

    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Deal Risk Gate — evidence-readiness memo</title>
<style>
  :root {{ --teal:{BRAND_TEAL}; --ink:{BRAND_INK}; --muted:{BRAND_MUTED}; --bd:{BRAND_BORDER}; --v:{color}; }}
  * {{ box-sizing:border-box; }}
  body {{ font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    color:var(--ink); margin:0; line-height:1.55; }}
  .sheet {{ max-width:760px; margin:0 auto; padding:0 0 2rem; }}
  .head {{ background:var(--teal); color:#fff; padding:1.1rem 1.3rem; display:flex; align-items:center; gap:.7rem; }}
  .head .kick {{ font:700 .62rem ui-monospace,Menlo,monospace; letter-spacing:.14em; text-transform:uppercase;
    color:#99f6e4; }}
  .head .word {{ font-weight:700; font-size:1.15rem; }}
  .body {{ padding:1.3rem; }}
  .verdict {{ border-left:6px solid var(--v); background:#f8fafc; border:1px solid var(--bd); border-left-width:6px;
    border-radius:10px; padding:.8rem 1rem; margin:0 0 1rem; }}
  .verdict .verb {{ font-size:1.5rem; font-weight:800; color:var(--v); line-height:1.1; }}
  .verdict .why {{ color:var(--muted); margin:.3rem 0 0; }}
  .meta {{ display:flex; flex-wrap:wrap; gap:.5rem 1.5rem; margin:.5rem 0 0; font-size:.9rem; color:var(--muted); }}
  .meta b {{ color:var(--ink); }}
  .kv {{ display:flex; gap:.8rem; padding:.3rem 0; border-bottom:1px solid var(--bd); }}
  .kv span {{ flex:0 0 130px; color:var(--muted); font-size:.85rem; }}
  .kv ul.cp {{ margin:0; padding-left:1rem; }}
  h2 {{ font-size:1.02rem; margin:1.2rem 0 .3rem; }}
  ul {{ margin:.2rem 0; padding-left:1.2rem; }} li {{ margin:.12rem 0; }}
  .muted {{ color:var(--muted); }}
  .disc {{ margin-top:1.3rem; border:1px solid #fde68a; background:#fffbeb; color:#92400e; border-radius:10px;
    padding:.7rem .9rem; font-size:.88rem; }}
  .gen {{ font-size:.8rem; color:var(--muted); margin-top:.2rem; }}
  .prov {{ font-family:ui-monospace,Menlo,monospace; font-size:.72rem; color:#94a3b8; }}
  @media print {{ .sheet {{ max-width:none; }} body {{ font-size:11.5pt; }} @page {{ margin:14mm; }} }}
</style></head>
<body><div class="sheet">
  <div class="head">{_GATE_MARK}
    <div><div class="kick">Kazakhstan &middot; Middle Corridor</div><div class="word">Deal Risk Gate</div></div>
  </div>
  <div class="body">
    <p class="gen">Evidence-readiness memo &mdash; {GENERATED_LABEL} &middot; generated {_today()} &middot; illustrative</p>
    <div class="verdict"><div class="verb">{escape(verb)}</div>
      {f'<p class="why">{escape(rationale)}</p>' if rationale else ''}
      <div class="meta"><span>Decision-readiness <b>{score}/100</b> ({label})</span>
        <span>Triage <b>{triage}</b></span>
        <span>Risk signal <b>{signal}</b></span></div>
    </div>
    <h2>Deal</h2>{''.join(rows)}
    {dossier}
    <h2>Evidence gaps (missing before go)</h2>{_ul(d.get('evidence_gaps'))}
    <h2>Top risks</h2>{_ul(d.get('top_risks'))}
    {flags}
    <h2>Watch next</h2>{_ul(d.get('watch_next'))}
    <div class="disc"><b>{escape(notice)}</b><br>
      Prepares the file before screening and counsel; not a clearance. No live source retrieval, no factual-truth
      verification. Human review is required before any commercial action.</div>
    {prov_line}
  </div>
</div></body></html>"""


# --------------------------------------------------------------------------- #
# PDF (optional: requires the `pdf` extra / fpdf2)
# --------------------------------------------------------------------------- #
def _latin1(s: str) -> str:
    """Make text safe for fpdf2 core fonts (latin-1), transliterating common glyphs."""
    repl = {"—": "-", "–": "-", "•": "-", "→": "->", "·": "-", "’": "'", "“": '"', "”": '"', "…": "..."}
    for k, v in repl.items():
        s = s.replace(k, v)
    return s.encode("latin-1", "replace").decode("latin-1")


def render_pdf(response: dict[str, Any]) -> bytes:
    try:
        from fpdf import FPDF  # type: ignore
    except ImportError as exc:  # pragma: no cover - exercised only without the extra
        raise RuntimeError(
            "PDF output requires the optional 'pdf' extra. Install it with: "
            "pip install agenda-intelligence-md[pdf]  (or: pip install fpdf2)"
        ) from exc

    d = _unwrap(response)
    verb, tier, rationale = _verdict(d)
    vr, vg, vb = _RGB[VERDICT_COLORS[tier]]

    pdf = FPDF(format="A4", unit="mm")
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    pdf.set_margins(15, 15, 15)
    width = pdf.w - 30

    # Teal header band with a drawn gate glyph.
    pdf.set_fill_color(*_RGB[BRAND_TEAL])
    pdf.rect(0, 0, pdf.w, 26, style="F")
    pdf.set_draw_color(255, 255, 255)
    pdf.set_line_width(0.7)
    for y in (10, 13, 16):
        pdf.line(16, y, 27, y)
    pdf.line(21.5, 7, 21.5, 19)
    pdf.set_xy(32, 6)
    pdf.set_text_color(180, 235, 230)
    pdf.set_font("Helvetica", "B", 7)
    pdf.cell(0, 4, _latin1("KAZAKHSTAN - MIDDLE CORRIDOR"), ln=1)
    pdf.set_x(32)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 15)
    pdf.cell(0, 8, "Deal Risk Gate", ln=1)

    pdf.set_xy(15, 32)
    pdf.set_text_color(*_RGB[BRAND_MUTED])
    pdf.set_font("Helvetica", "", 8)
    pdf.cell(0, 4, _latin1(f"Evidence-readiness memo - {GENERATED_LABEL} - generated {_today()} - illustrative"), ln=1)
    pdf.ln(2)

    # Verdict box.
    box_y = pdf.get_y()
    pdf.set_fill_color(248, 250, 252)
    pdf.set_draw_color(*(vr, vg, vb))
    pdf.set_line_width(1.5)
    pdf.rect(15, box_y, width, 22, style="DF")
    pdf.set_xy(18, box_y + 2)
    pdf.set_text_color(vr, vg, vb)
    pdf.set_font("Helvetica", "B", 17)
    pdf.cell(0, 9, _latin1(verb), ln=1)
    if rationale:
        pdf.set_x(18)
        pdf.set_text_color(*_RGB[BRAND_MUTED])
        pdf.set_font("Helvetica", "", 9)
        pdf.multi_cell(width - 6, 4.5, _latin1(rationale), align="L")
    pdf.set_xy(15, box_y + 24)
    pdf.set_text_color(*_RGB[BRAND_INK])
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(
        0,
        5,
        _latin1(
            f"Decision-readiness {d.get('decision_readiness_score', 0)}/100 "
            f"({d.get('decision_readiness_label', 'n/a')})  -  "
            f"triage {d.get('triage_recommendation', 'n/a')}  -  "
            f"risk signal {d.get('risk_signal', 'n/a')}"
        ),
        ln=1,
    )
    pdf.ln(2)

    def heading(title: str) -> None:
        pdf.set_font("Helvetica", "B", 11)
        pdf.set_text_color(*_RGB[BRAND_INK])
        pdf.cell(0, 6, _latin1(title), ln=1)

    def bullets(items: list[str] | None) -> None:
        pdf.set_font("Helvetica", "", 9.5)
        pdf.set_text_color(*_RGB[BRAND_INK])
        if not items:
            pdf.cell(0, 5, "(none)", ln=1)
            return
        for x in items:
            pdf.set_x(17)
            pdf.multi_cell(width - 2, 5, _latin1(f"- {x}"), align="L")

    def para(text: str) -> None:
        # multi_cell leaves the cursor at the cell's right edge; reset to the left
        # margin before each paragraph so consecutive lines do not march rightward.
        pdf.set_x(15)
        pdf.set_font("Helvetica", "", 9.5)
        pdf.set_text_color(*_RGB[BRAND_INK])
        pdf.multi_cell(width, 5, _latin1(text), align="L")

    heading("Deal")
    para(f"Route: {d.get('route', 'unspecified')}")
    para(f"Cargo: {d.get('cargo', 'unspecified')}")
    sv = _shipment_value(d)
    if sv:
        para(f"Shipment value: {sv}")
    for c in _counterparty_lines(d):
        pdf.set_x(17)
        pdf.multi_cell(width - 2, 5, _latin1(f"- {c}"), align="L")
    pdf.ln(1)

    cr = d.get("counterparty_readiness")
    if cr:
        heading("Dossier completeness")
        para(
            f"{cr.get('supplied_count', 0)} of {cr.get('required_total', 0)} required documents supplied "
            f"({cr.get('status', 'n/a')})."
        )
        if cr.get("outstanding_documents"):
            para(f"Outstanding: {', '.join(cr['outstanding_documents'])}")
        pdf.ln(1)

    heading("Evidence gaps (missing before go)")
    bullets(d.get("evidence_gaps"))
    pdf.ln(1)
    heading("Top risks")
    bullets(d.get("top_risks"))
    pdf.ln(1)
    if d.get("limitations"):
        heading("Flags for human review")
        bullets(d.get("limitations"))
        pdf.ln(1)
    heading("Watch next")
    bullets(d.get("watch_next"))
    pdf.ln(2)

    notice = d.get("not_advice_notice") or "Evidence-readiness triage only. Not advice."
    pdf.set_draw_color(*_RGB[BRAND_BORDER])
    pdf.set_line_width(0.3)
    pdf.line(15, pdf.get_y(), 15 + width, pdf.get_y())
    pdf.ln(1)
    pdf.set_font("Helvetica", "I", 8)
    pdf.set_text_color(*_RGB[BRAND_MUTED])
    pdf.multi_cell(
        width,
        4,
        _latin1(
            f"{notice} Prepares the file before screening and counsel; not a clearance. No live source retrieval, "
            "no factual-truth verification. Human review is required before any commercial action."
        ),
        align="L",
    )

    out = pdf.output()
    return bytes(out)


def render_report(response: dict[str, Any], fmt: str = "md") -> str | bytes:
    """Render a deal-risk response as ``md``, ``html``, or ``pdf``."""
    if fmt == "md":
        return render_markdown(response)
    if fmt == "html":
        return render_html(response)
    if fmt == "pdf":
        return render_pdf(response)
    raise ValueError(f"Unknown report format: {fmt!r} (expected md, html, or pdf)")


__all__ = ["render_report", "render_markdown", "render_html", "render_pdf"]
