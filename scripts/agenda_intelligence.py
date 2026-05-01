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
if str(_repo_root) not in sys.path:
    sys.path.insert(0, str(_repo_root))

from agenda_intelligence.cli import main

if __name__ == "__main__":
    raise SystemExit(main())
