import json


def generate_html_dashboard(profile: str, response: dict) -> str:
    """Generates an interactive Tailwind HTML dashboard for the agent response."""
    json_str = json.dumps(response, indent=2)

    actions_html = "".join(
        f'<li class="flex items-start">'
        f'<span class="flex-shrink-0 w-5 h-5 rounded-full bg-red-100 text-red-600 '
        f'flex items-center justify-center mr-3 mt-0.5 text-xs">!</span>'
        f'<span class="text-sm text-gray-700">{action}</span></li>'
        for action in response.get("owner_actions", [])
    )
    no_actions_html = '<p class="text-sm text-gray-500 italic">No pending actions. Packet is fully grounded.</p>'

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>{profile.replace('_', ' ').title()} Dashboard</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        .agenda-gradient {{ background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); }}
    </style>
</head>
<body class="bg-gray-50 text-gray-900 font-sans antialiased">
    <div class="max-w-6xl mx-auto py-8 px-4">
        <header class="agenda-gradient text-white rounded-xl shadow-lg p-8 mb-8 flex justify-between items-center">
            <div>
                <h1 class="text-3xl font-bold mb-2">{profile.replace('_', ' ').title()}</h1>
                <p class="text-blue-100 opacity-90">Agenda Intelligence Interactive Audit</p>
            </div>
            <div class="bg-white/20 px-4 py-2 rounded-lg text-sm font-semibold tracking-wide">
                STATUS: {response.get('packet_status', response.get('decision', 'completed')).upper()}
            </div>
        </header>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div class="lg:col-span-2 space-y-6">
                <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <h2 class="text-xl font-bold mb-4 flex items-center">
                        Structured Output
                    </h2>
                    <pre class="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm"><code>{json_str}</code></pre>  # noqa: E501
                </div>
            </div>

            <div class="space-y-6">
                <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <h3 class="text-lg font-bold mb-4">Required Actions</h3>
                    <ul class="space-y-3">
                        {actions_html}
                    </ul>
                    {"" if response.get("owner_actions") else no_actions_html}
                </div>
            </div>
        </div>
    </div>
</body>
</html>"""
