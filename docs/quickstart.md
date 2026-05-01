# Quickstart

```bash
# Install the package in editable mode (development) or normally
pip install -e .   # or: pip install agenda-intelligence-md

# Check the CLI
agenda-intelligence --help

# Validate a brief (example file provided)
agenda-intelligence validate-brief examples/agenda-brief.json

# Validate an evidence pack
agenda-intelligence validate-evidence examples/source/evidence-pack.json
```

## Typical workflow
1. **Plan sources** – `agenda-intelligence source-plan <category>`
2. **Collect evidence** – assemble a JSON evidence pack.
3. **Validate** – run the `validate‑evidence` command.
4. **Write brief** – produce a JSON agenda brief.
5. **Validate brief** – `validate‑brief`.
6. **(optional) Score** – `agenda-intelligence score <before-after‑example>.md`

All markdown files (protocols, lenses, source‑plans) remain the source of truth; the CLI just loads them.
