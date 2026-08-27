const fs = require('fs');

let content = fs.readFileSync('deploy/cloudflare-worker/src/index.js', 'utf8');

content = content.replace(
    'async function handleJsonRpc(payload, request, env = {}, ctx = {}) {',
    'async function _handleJsonRpcInner(payload, request, env = {}, ctx = {}) {'
);

const newFunc = `
function generateHtmlDashboard(profile, response) {
  const jsonStr = JSON.stringify(response, null, 2);
  let actions = '';
  const ownerActions = response.owner_actions || [];
  if (ownerActions.length > 0) {
    actions = ownerActions.map(action =>
      '<li class="flex items-start"><span class="flex-shrink-0 w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center mr-3 mt-0.5 text-xs">!</span><span class="text-sm text-gray-700">' + action + '</span></li>'
    ).join('');
  } else {
    actions = '<p class="text-sm text-gray-500 italic">No pending actions. Packet is fully grounded.</p>';
  }

  const statusStr = String(response.packet_status || response.decision || 'completed').toUpperCase();
  const profileName = String(profile).replace(/_/g, ' ').replace(/\\b\\w/g, l => l.toUpperCase());

  return \`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>\${profileName} Dashboard</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        .agenda-gradient {
            background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
        }
    </style>
</head>
<body class="bg-gray-50 text-gray-900 font-sans antialiased">
    <div class="max-w-6xl mx-auto py-8 px-4">
        <header class="agenda-gradient text-white rounded-xl shadow-lg p-8 mb-8 flex justify-between items-center">
            <div>
                <h1 class="text-3xl font-bold mb-2">\${profileName}</h1>
                <p class="text-blue-100 opacity-90">Agenda Intelligence Interactive Audit</p>
            </div>
            <div class="bg-white/20 px-4 py-2 rounded-lg text-sm font-semibold tracking-wide">
                STATUS: \${statusStr}
            </div>
        </header>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div class="lg:col-span-2 space-y-6">
                <!-- Main Audit Log -->
                <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <h2 class="text-xl font-bold mb-4 flex items-center">
                        <svg class="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                        Structured Output
                    </h2>
                    <pre class="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm"><code>\${jsonStr}</code></pre>
                </div>
            </div>

            <div class="space-y-6">
                <!-- Action Items -->
                <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <h3 class="text-lg font-bold mb-4">Required Actions</h3>
                    <ul class="space-y-3">
                        \${actions}
                    </ul>
                </div>
            </div>
        </div>
    </div>
</body>
</html>\`;
}

async function handleJsonRpc(payload, request, env = {}, ctx = {}) {
  const response = await _handleJsonRpcInner(payload, request, env, ctx);

  try {
    const method = payload && payload.method;
    if (method && (method === "message/send" || method === "tasks/send" || method === "SendMessage")) {
      const params = payload.params || {};
      const requestedOutput = params.requested_output || "markdown";

      if ((requestedOutput === "html" || requestedOutput === "both") && response && response.result) {
        const result = response.result;
        const state = result.status && result.status.state;

        if (state === "TASK_STATE_COMPLETED" || state === "TASK_STATE_FAILED") {
          const metadata = result.metadata || {};
          const profile = metadata.product_profile || "agenda";
          const innerResponse = metadata.response;

          if (innerResponse) {
            const htmlContent = generateHtmlDashboard(profile, innerResponse);
            if (!result.artifacts) result.artifacts = [];
            if (result.artifacts.length > 0) {
              if (!result.artifacts[0].parts) result.artifacts[0].parts = [];
              result.artifacts[0].parts.push({
                text: htmlContent,
                mediaType: "text/html"
              });
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("Failed to generate HTML dashboard wrapper:", err);
  }

  return response;
}
`;

content += '\n' + newFunc;
fs.writeFileSync('deploy/cloudflare-worker/src/index.js', content);
