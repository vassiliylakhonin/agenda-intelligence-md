# How to integrate Agenda‑Intelligence with trading‑systems

This guide shows a **minimal pipeline** that turns a raw news headline into a structured, decision‑ready signal and pushes it to a Slack channel. The same pattern works for any downstream system (email alerts, Auto‑ML models, risk dashboards, etc.).

---

## 1️⃣ Prerequisites

- **Python 3.9+** (the repository already provides a virtual‑env setup script).  
- **Agenda‑Intelligence** installed (see the main README).  
- **Slack webhook URL** for the channel you want to notify (create one in *Settings → Integrations → Incoming Webhooks*).  
- **A news source** – for the demo we use the free NewsAPI.org endpoint, but any RSS feed, custom scraper or broker news‑feed works.

```bash
# Example virtual‑env setup (run from the repo root)
python3 -m venv .venv && source .venv/bin/activate
pip install -e .[dev]   # installs agenda‑intelligence + jsonschema, mypy, ruff
```

---

## 2️⃣ Pull the latest headline (example with NewsAPI)

```python
import os, requests, json

NEWS_API_KEY = os.getenv("NEWS_API_KEY")   # set this in your .env or CI secret
SLACK_WEBHOOK = os.getenv("SLACK_WEBHOOK")

# Grab the most recent headline about the "Hormuz Strait" (you can change the query)
resp = requests.get(
    "https://newsapi.org/v2/everything",
    params={
        "q": "Hormuz Strait",
        "language": "en",
        "pageSize": 1,
        "sortBy": "publishedAt",
        "apiKey": NEWS_API_KEY,
    },
)
article = resp.json()["articles"][0]
headline = article["title"]
url = article["url"]
print("Raw headline:", headline)
```

---

## 3️⃣ Run the agenda‑intelligence CLI on the headline

The CLI can accept a **brief string** directly. We wrap the call with `subprocess` so we can capture the nicely formatted output.

```python
import subprocess, textwrap

brief = f'Brief: "{headline}"'
cmd = ["agenda-intelligence", brief]

# Capture stdout (the formatted brief) and decode to UTF‑8
result = subprocess.run(cmd, capture_output=True, text=True)
if result.returncode != 0:
    print("CLI error:", result.stderr)
    exit(1)

formatted_brief = result.stdout.strip()
print("Structured brief:\n", formatted_brief)
```

---

## 4️⃣ Send the brief to Slack

Use the captured `formatted_brief` as the Slack message payload. We also attach the original news URL for context.

```python
import json, requests

slack_payload = {
    "text": f"*Agenda‑Intelligence Brief*\n{formatted_brief}\n\n<{url}|Read original article>",
    "mrkdwn": True,
}

resp = requests.post(
    SLACK_WEBHOOK,
    data=json.dumps(slack_payload),
    headers={"Content-Type": "application/json"},
)
if resp.status_code == 200:
    print("✅ Sent to Slack!")
else:
    print("Slack error:", resp.text)
```

---

## 5️⃣ Full pipeline script (ready‑to‑run)

Save the following as `examples/trading_pipeline.py` and run it with a cron job or a scheduler (e.g., *Apache Airflow*, *GitHub Actions*).

```python
#!/usr/bin/env python3
"""
Minimal trading‑signal pipeline:
  1. Fetch latest headline about a keyword.
  2. Run agenda‑intelligence to structure it.
  3. Push the structured brief to Slack.
"""

import os, requests, json, subprocess, sys

def main():
    NEWS_API_KEY = os.getenv("NEWS_API_KEY")
    SLACK_WEBHOOK = os.getenv("SLACK_WEBHOOK")
    if not (NEWS_API_KEY and SLACK_WEBHOOK):
        print("Set NEWS_API_KEY and SLACK_WEBHOOK environment variables.")
        sys.exit(1)

    # 1️⃣ Fetch headline
    resp = requests.get(
        "https://newsapi.org/v2/everything",
        params={"q": "Hormuz Strait", "language": "en", "pageSize": 1, "sortBy": "publishedAt", "apiKey": NEWS_API_KEY},
    )
    resp.raise_for_status()
    article = resp.json()["articles"][0]
    headline = article["title"]
    url = article["url"]

    # 2️⃣ Run agenda‑intelligence
    result = subprocess.run(
        ["agenda-intelligence", f'Brief: "{headline}"'],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        print("CLI failed:", result.stderr)
        sys.exit(1)
    brief = result.stdout.strip()

    # 3️⃣ Send to Slack
    slack_payload = {
        "text": f"*Agenda‑Intelligence Brief*\n{brief}\n\n<{url}|Read original article>",
        "mrkdwn": True,
    }
    r = requests.post(SLACK_WEBHOOK, json=slack_payload)
    if r.status_code == 200:
        print("✅ Pipeline succeeded!")
    else:
        print("Slack error:", r.text)

if __name__ == "__main__":
    main()
```

---

## 6️⃣ Extending the pipeline

| Idea | How |
|------|-----|
| **Multiple keywords** | Loop over a list (`["Hormuz", "Baltic Dry Index", "EU AI Act"]` and run the CLI for each. |
| **Database storage** | Insert the structured brief (JSON) into Postgres/InfluxDB for historical analysis. |
| **Risk scoring** | Parse the `Signal classification` line and map it to a numeric risk score (0‑100). |
| **Auto‑trading trigger** | If `Signal classification` is `trigger event`, call a broker API (e.g., Interactive Brokers). |
| **Email/Telegram alerts** | Replace the Slack webhook with SMTP or a Telegram bot token. |

---

## 7️⃣ Testing the integration

```bash
# Set secrets (in CI or locally)
export NEWS_API_KEY="your_newsapi_key"
export SLACK_WEBHOOK="https://hooks.slack.com/services/..."

# Run the pipeline
python3 examples/trading_pipeline.py
```

You should see a nicely formatted brief in your Slack channel, ready for a trader or risk‑manager to act on.

---

**Why this matters:**
Raw news is noisy. Agenda-Intelligence strips the noise, keeps the signal, and delivers a decision-ready brief in seconds.

---

**Disclaimer.** This document is for informational and educational purposes only. It does not constitute investment, financial, legal, or trading advice. Agenda Intelligence MD is an open-source structural validation toolkit — it does not verify factual truth, predict market outcomes, or recommend trades. Any trading or investment decisions are solely the responsibility of the user. Use at your own risk.
