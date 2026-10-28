"""Run the local report -> OV -> caller revision workflow; no hosted calls."""

import argparse
import json
from pathlib import Path

from agenda_intelligence.report_review import review_report_revision

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("original", type=Path)
parser.add_argument("revised", type=Path)
args = parser.parse_args()
result = review_report_revision(json.loads(args.original.read_text()), json.loads(args.revised.read_text()))
print(json.dumps(result, indent=2, ensure_ascii=False))
