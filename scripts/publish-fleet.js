const fs = require('fs');
const https = require('https');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const wranglerPath = path.join(repoRoot, 'deploy/cloudflare-worker/wrangler.toml');
const manifestPath = path.join(repoRoot, 'agent-manifest.json');

async function fetchCard(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            resolve({ status: 'ok', data: JSON.parse(data) });
          } else {
            resolve({ status: 'error', code: res.statusCode });
          }
        } catch(e) {
          resolve({ status: 'error', message: e.message });
        }
      });
    }).on('error', (e) => resolve({ status: 'error', message: e.message }));
  });
}

async function registerToAgenstry(cardUrl) {
  console.log(`[Agenstry] Submitting agent card: ${cardUrl}`);
  // Mock registration logic
  return new Promise(resolve => setTimeout(() => resolve('Registered successfully.'), 500));
}

async function main() {
  const toml = fs.readFileSync(wranglerPath, 'utf8');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  
  // Extract all environments from wrangler.toml
  const envRegex = /\[env\.([a-zA-Z0-9\-]+)\]/g;
  let match;
  const envs = new Set();
  while ((match = envRegex.exec(toml)) !== null) {
    if (!match[1].includes('.')) envs.add(match[1]);
  }

  const envsList = Array.from(envs);

  // The top-level worker is also an environment (production)
  const topLevelRegex = /^name\s*=\s*"([^"]+)"/m;
  const topMatch = topLevelRegex.exec(toml);
  if (topMatch) {
    envsList.unshift('top-level');
  }

  console.log(`Discovered ${envsList.length} worker environments in wrangler.toml`);
  console.log('Verifying /.well-known/agent-card.json for each...\n');

  let markdown = `# Agenda Intelligence AI Fleet Directory\n\n`;
  markdown += `*Automatically generated fleet registry.*\n\n`;
  markdown += `| Profile | Status | Card URL |\n`;
  markdown += `|---|---|---|\n`;

  let alive = 0;
  for (const env of envsList) {
    let hostname;
    if (env === 'top-level') {
      hostname = `${topMatch[1]}.vassiliy-lakhonin.workers.dev`;
    } else {
      const envNameRegex = new RegExp(`\\[env\\.${env}\\]\\s*name\\s*=\\s*"([^"]+)"`);
      const nameMatch = envNameRegex.exec(toml);
      if (nameMatch) {
        hostname = `${nameMatch[1]}.vassiliy-lakhonin.workers.dev`;
      } else {
        hostname = `${env}.vassiliy-lakhonin.workers.dev`;
      }
    }

    const cardUrl = `https://${hostname}/.well-known/agent-card.json`;
    const result = await fetchCard(cardUrl);
    
    if (result.status === 'ok') {
      const profile = result.data.name || env;
      console.log(`✅ [OK] ${profile.padEnd(45)} -> ${cardUrl}`);
      markdown += `| **${profile}** | ✅ Online | [agent-card.json](${cardUrl}) |\n`;
      alive++;
      
      // Auto-register
      await registerToAgenstry(cardUrl);
    } else {
      console.log(`❌ [FAIL] ${env.padEnd(43)} -> ${cardUrl} (Error: ${result.code || result.message})`);
      markdown += `| **${env}** | ❌ Offline | [agent-card.json](${cardUrl}) |\n`;
    }
  }

  const outPath = path.join(repoRoot, 'FLEET_DIRECTORY.md');
  fs.writeFileSync(outPath, markdown);
  console.log(`\nFleet check complete. ${alive}/${envsList.length} workers online.`);
  console.log(`Generated ${outPath}`);
}

main().catch(console.error);
