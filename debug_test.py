import sys
sys.path.insert(0, "src")
from agenda_intelligence import a2a_adapter
response = a2a_adapter.handle_jsonrpc({
    "jsonrpc": "2.0",
    "id": "coverage-1",
    "method": "message/send",
    "params": {
        "capability": "source_coverage",
        "category": "sanctions",
        "evidence_json": {
            "topic": "sanctions memo",
            "claims": []
        },
    },
})
print("DEBUG RESPONSE:", response)
