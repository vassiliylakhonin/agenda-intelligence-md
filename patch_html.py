import re

with open("src/agenda_intelligence/a2a_adapter.py", "r") as f:
    content = f.read()

# Find def handle_jsonrpc and rewrite the returns.
# But it's easier to rename handle_jsonrpc to _handle_jsonrpc_inner
# and define a new handle_jsonrpc that calls it and modifies the result!

content = content.replace(
    'def handle_jsonrpc(payload: dict, base_url: str = "http://localhost:8080") -> dict:',
    'def _handle_jsonrpc_inner(payload: dict, base_url: str = "http://localhost:8080") -> dict:'
)

new_func = '''
from agenda_intelligence.html_dashboard import generate_html_dashboard

def handle_jsonrpc(payload: dict, base_url: str = "http://localhost:8080") -> dict:
    """Handle the first A2A JSON-RPC slice, with optional HTML dashboard rendering."""
    response = _handle_jsonrpc_inner(payload, base_url)

    # If the request asked for HTML output, and the response was successful
    method = payload.get("method")
    if method in {"message/send", "tasks/send", "SendMessage"} and "result" in response:
        params = payload.get("params") or {}
        requested_output = params.get("requested_output", "markdown")

        if requested_output in ("html", "both"):
            result = response["result"]
            if result.get("status", {}).get("state") in ("TASK_STATE_COMPLETED", "TASK_STATE_FAILED"):
                metadata = result.get("metadata", {})
                profile = metadata.get("product_profile", "agenda")
                inner_response = metadata.get("response", {})

                # We can generate the dashboard if there's a response payload
                if inner_response:
                    html_content = generate_html_dashboard(profile, inner_response)

                    if "artifacts" not in result:
                        result["artifacts"] = []

                    if len(result["artifacts"]) > 0:
                        # Append to the first artifact
                        if "parts" not in result["artifacts"][0]:
                            result["artifacts"][0]["parts"] = []
                        result["artifacts"][0]["parts"].append({
                            "text": html_content,
                            "mediaType": "text/html"
                        })

    return response
'''

content += "\n" + new_func

with open("src/agenda_intelligence/a2a_adapter.py", "w") as f:
    f.write(content)
