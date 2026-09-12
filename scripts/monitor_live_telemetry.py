#!/usr/bin/env python3
"""
Live Edge Telemetry & External Agent Monitor.
Queries Cloudflare Workers KV and /stats endpoint to track incoming autonomous agent traffic
(Microsoft GAIP, AgenstryBot, Cursor, Claude, etc.) and schema adoption.

Usage:
    python3 scripts/monitor_live_telemetry.py
    python3 scripts/monitor_live_telemetry.py --date 2026-09-12
    python3 scripts/monitor_live_telemetry.py --events 10
"""

import argparse
import datetime
import json
import subprocess
import sys
import urllib.request

STATS_TOKEN = "037ad1c7556b4880fb415c17f967ac033d62877aafe67f99f7f4b8ad932d92e0"
DEFAULT_BASE_URL = "https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/stats"
KV_NAMESPACE_ID = "d2228183999246ccbec8aa2d5f130bfc"


def fetch_stats(date_str: str, base_url: str = DEFAULT_BASE_URL) -> dict:
    url = f"{base_url}?token={STATS_TOKEN}&date={date_str}"
    req = urllib.request.Request(url, headers={"User-Agent": "curl/8.4.0"})
    try:
        with urllib.request.urlopen(req, timeout=10.0) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"Error fetching stats for {date_str}: {e}", file=sys.stderr)
        return {}


def fetch_recent_kv_events(date_str: str, limit: int = 10) -> list:
    """Fetch individual recent usage events via wrangler CLI if available."""
    cmd = [
        "npx",
        "wrangler",
        "kv",
        "key",
        "list",
        "--remote",
        "--namespace-id",
        KV_NAMESPACE_ID,
        "--prefix",
        f"usage-event:{date_str}",
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        if result.returncode != 0:
            return []
        keys = json.loads(result.stdout)
        keys = keys[-limit:]  # most recent
        events = []
        for item in keys:
            key_name = item["name"]
            get_cmd = [
                "npx",
                "wrangler",
                "kv",
                "key",
                "get",
                "--remote",
                "--namespace-id",
                KV_NAMESPACE_ID,
                key_name,
            ]
            get_res = subprocess.run(get_cmd, capture_output=True, text=True, timeout=10)
            if get_res.returncode == 0 and get_res.stdout.strip():
                try:
                    events.append(json.loads(get_res.stdout))
                except Exception:
                    pass
        return events
    except Exception:
        return []


def print_dashboard(data: dict, events: list = None):
    counters = data.get("counters", {})
    total = counters.get("total", 0)
    non_probe = counters.get("non_probe", 0)
    avg_chars = counters.get("prompt_chars_avg", 0)
    machine_reqs = counters.get("machine_requests", 0)
    human_reqs = counters.get("human_requests", 0)
    ext_input = counters.get("external_input_required", 0)

    print("\n" + "=" * 76)
    print(f"   AGENDA INTELLIGENCE — LIVE FLEET TELEMETRY ({data.get('date', 'today')})")
    print("=" * 76)

    print("\n[SUMMARY]")
    print(f"  Total Requests:        {total:<6} | Non-Probe Active:    {non_probe}")
    print(f"  Machine Traffic:       {machine_reqs:<6} | Human Traffic:        {human_reqs}")
    print(f"  Average Payload:       {avg_chars} chars | Self-Healing Hints:  {ext_input}")

    # Networks / External Actors
    print("\n[IDENTIFIED CALLERS & NETWORKS]")
    for net in data.get("networks", []):
        name = net.get("name")
        count = net.get("count")
        pct = (count / total * 100) if total else 0
        tag = ""
        if "Microsoft" in name:
            tag = " <-- [GAIP AI Agent Research Cohort]"
        elif "Google" in name:
            tag = " <-- [Google Cloud / LLM Crawler]"
        elif "ALMANET" in name:
            tag = " <-- [Central Asia Regional Gateway]"
        print(f"  • {name:<35} : {count:>4} calls ({pct:>5.1f}%){tag}")

    # Clients / User-Agents
    print("\n[CLIENTS & TRANSPORTS]")
    for ua in data.get("user_agents", []):
        print(f"  • {ua.get('name'):<45} : {ua.get('count'):>4} calls")

    methods_str = ", ".join(f"{m.get('name')} ({m.get('count')})" for m in data.get("methods", []))
    print(f"  Methods: {methods_str}")

    # Outcomes
    print("\n[OUTCOMES DISTRIBUTION]")
    for out in data.get("outcomes", []):
        name = out.get("name")
        count = out.get("count")
        pct = (count / total * 100) if total else 0
        if name == "completed":
            icon = "✅"
        elif "escalate" in name:
            icon = "⚠️"
        elif "block" in name or name == "stop":
            icon = "🛑"
        else:
            icon = "💡"
        print(f"  {icon} {name:<30} : {count:>4} calls ({pct:>5.1f}%)")

    # Gate Activity
    print("\n[GATE PROFILES ACTIVITY]")
    print(f"  {'Profile':<34} | {'Calls':<6} | {'Target Host'}")
    print("  " + "-" * 72)
    for prof in data.get("agent_profiles", []):
        name = prof.get("name")
        count = prof.get("count")
        host = next((h.get("name") for h in data.get("hosts", []) if name.replace("_", "-") in h.get("name")), "active")
        print(f"  {name:<34} | {count:>6} | {host}")

    # Recent Live Events Stream
    if events:
        print(f"\n[RECENT EVENT STREAM (Last {len(events)} Events)]")
        for ev in events:
            ts = ev.get("timestamp", "").split("T")[-1].replace("Z", "")
            prof = ev.get("agent_profile", "unknown")
            meth = ev.get("jsonrpc_method", "REST")
            out = ev.get("outcome", "unknown")
            net = ev.get("as_org", "unknown")[:20]
            fields = ", ".join(ev.get("input_required_fields", [])) if ev.get("input_required_fields") else "none"
            print(f"  [{ts}] {prof:<28} | {meth:<10} | {out:<16} | AS: {net:<20} | Missing: {fields}")

    print("\n" + "=" * 76 + "\n")


def main():
    parser = argparse.ArgumentParser(description="Agenda Intelligence Live Fleet Telemetry Monitor")
    default_date = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
    parser.add_argument("--date", default=default_date, help="Date (YYYY-MM-DD)")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help="Stats endpoint URL")
    parser.add_argument(
        "--events",
        type=int,
        default=0,
        help="Number of individual KV events to fetch and display (slow)",
    )

    args = parser.parse_args()
    data = fetch_stats(args.date, args.base_url)
    if not data:
        print(f"No stats returned for {args.date}.")
        return

    events = []
    if args.events > 0:
        events = fetch_recent_kv_events(args.date, limit=args.events)

    print_dashboard(data, events)


if __name__ == "__main__":
    main()
