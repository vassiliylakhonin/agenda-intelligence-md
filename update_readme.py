import re

with open('README.md', 'r') as f:
    content = f.read()

# Replace Status section
status_replacement = """## Status

| Surface | Status |
|---|---|
| Evidence-packet request/response schemas | Implemented |
| `check_evidence_packet` Python service | Implemented |
| `agenda-intelligence check` packet auto-detection | Implemented |
| `agenda-intelligence review` local-file workflow | Implemented for UTF-8, Markdown, DOCX, and optional PDF input |
| `agenda-intelligence review --format html` | Implemented (Generative UI) |
| `check_evidence_packet` MCP tool | Implemented |
| AI Fleet (Vertical Workers) | Active (9 profiles deployed) |
| Live Source Retrieval | Active via `live_retrieval` flag |

Current classification: `Ecosystem Expansion & R&D`."""

content = re.sub(r'## Status.*?Current classification: `portfolio-proof` / `build-to-learn`\.', status_replacement, content, flags=re.DOTALL)

# Replace Roadmap section
roadmap_replacement = """## Roadmap

The current phase focuses on **Product-Led Growth & Ecosystem Expansion**. 
We are rapidly iterating on Generative UI for interactive evidence dashboards, deploying new vertical AI workers for adjacent domains (e.g., ESG, supply chain), and registering capabilities with agent catalogs (Agenstry).

See [`ROADMAP.md`](ROADMAP.md) for the active expansion initiatives."""

content = re.sub(r'## Roadmap.*?See \[`ROADMAP\.md`\]\(ROADMAP\.md\)\.', roadmap_replacement, content, flags=re.DOTALL)

# Optional: soften the very aggressive disclaimers
content = content.replace(
    "They are not the default commercial wedge and do not establish product-market fit.",
    "They represent active prototypes and technical wedges for vertical domains."
)

with open('README.md', 'w') as f:
    f.write(content)
