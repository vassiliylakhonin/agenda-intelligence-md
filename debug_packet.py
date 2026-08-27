import sys
import json
from agenda_intelligence.services import check_evidence_packet

packet = {
    "topic": "Testing Self Correction",
    "claims": [
        {
            "claim_id": "c1",
            "text": "The widget requires an export license to Kazakhstan.",
            "source_ids": ["doc1"],
            "quotes": [
                {
                    "source_id": "doc1",
                    "text": "This widget requires a license to Kazakhstan."
                }
            ]
        }
    ],
    "sources": [
        {
            "source_id": "doc1",
            "title": "Export Regulations",
            "text": "This widget requires a license to all CIS countries, except for Kazakhstan where it is freely available."
        }
    ]
}

result = check_evidence_packet(packet)
print(json.dumps(result, indent=2))
