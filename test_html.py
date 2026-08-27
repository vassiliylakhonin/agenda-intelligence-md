from agenda_intelligence.a2a_adapter import handle_jsonrpc
import json

request = {
    "jsonrpc": "2.0",
    "id": "1",
    "method": "message/send",
    "params": {
        "capability": "critical_minerals_due_diligence",
        "requested_output": "html",
        "critical_minerals_request": {
            "project_name": "Test Project",
            "commodity": "lithium",
            "origin_jurisdiction": "Chile",
            "decision_question": "Should we invest?",
            "decision_stage": "pre_investment_decision",
            "supplied_sources": []
        }
    }
}

response = handle_jsonrpc(request)
if "result" in response:
    print(json.dumps(response, indent=2))
    print(f"Found {len(parts)} parts in artifact.")
    for part in parts:
        print("Media Type:", part.get("mediaType"))
        if part.get("mediaType") == "text/html":
            print("HTML length:", len(part.get("text", "")))
else:
    print(response)
