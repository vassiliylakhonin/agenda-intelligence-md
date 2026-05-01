#!/usr/bin/env python3
"""Backward‑compatible wrapper for the agenda‑intelligence CLI.

This script delegates all functionality to the installed console entry
point, ensuring a single source of truth for command behaviour.
"""

from agenda_intelligence.cli import main

if __name__ == "__main__":
    raise SystemExit(main())
