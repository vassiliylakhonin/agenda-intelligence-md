#!/usr/bin/env python3
"""Backward‑compatible wrapper for the agenda‑intelligence CLI.

This script delegates all functionality to the installed console entry
point, ensuring a single source of truth for command behaviour.
"""
import sys
from pathlib import Path

# Ensure the package is importable when run as a script in a development checkout.
# This allows the script to work both after ``pip install -e .`` and when
# executed directly from a source checkout.
_repo_root = Path(__file__).resolve().parents[1]
_src_path = _repo_root / "src"
for _p in (_repo_root, _src_path):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))
# Remove the script's own directory from sys.path to avoid shadowing the package name.
_script_dir = Path(__file__).resolve().parent
if str(_script_dir) in sys.path:
    sys.path.remove(str(_script_dir))


from agenda_intelligence.cli import main  # noqa: E402

if __name__ == "__main__":
    raise SystemExit(main())
