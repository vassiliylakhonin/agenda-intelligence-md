#!/usr/bin/env python3
"""
Infinite Scalability Demonstration: Hiring Employees vs. Agents

This script demonstrates the "Infinitely Scalable" and "Cost: Tokens" value
proposition of Agenda Intelligence MD. It dispatches a massive batch of
compliance checks asynchronously to the Cloudflare Worker edge, simulating
a workload that would take a human compliance team weeks to process.

Usage:
    pip install aiohttp
    python3 examples/infinite-swarm-batch.py
"""

import asyncio
import json
import time
import uuid

try:
    import aiohttp
except ImportError:
    raise SystemExit("Please install aiohttp: pip install aiohttp")

# The deployed Cloudflare Worker endpoint
WORKER_URL = "https://cis-secondary-sanctions-a2a.vassiliy-lakhonin.workers.dev/"

# Simulated volume
BATCH_SIZE = 250

# Human cost metrics (for comparison)
MINUTES_PER_MANUAL_REVIEW = 45
HOURLY_WAGE = 50.0

# Per-call spend on the Worker path. No LLM runs there and this demo sends no
# `live_retrieval` request, so the deterministic triage path costs nothing per
# ADR 0014 — the paid OpenSanctions upstream (EUR 0.10/call) is never reached.
AGENT_COST_PER_CALL_EUR = 0.0


def build_request(index):
    """A request shaped the way the gate actually reads one.

    The gate takes its structured payload from `params.message.parts[].data`;
    a capability-named sibling key is not read and the request is rejected as
    unstructured. `dated_sources` are objects, not bare source-type strings,
    and both `risk_question` and `decision_stage` are required.
    """
    return {
        "counterparty": {
            "name": f"Synthetic Entity {index} LLC",
            "jurisdiction": "ru",
            "sector": "trading_house",
        },
        "exposure_facets": ["ownership_or_control"],
        "dated_sources": [
            {
                "id": f"cis-{index}-1",
                "source_type": "ofac_sdn_extract",
                "title": "OFAC SDN extract",
                "date": "2026-08-01",
            }
        ],
        "risk_question": (
            "Is this counterparty ready for onboarding review under "
            "secondary-sanctions exposure?"
        ),
        "decision_stage": "onboarding",
    }


async def check_counterparty(session, index):
    """Dispatch a single A2A request to the edge agent."""
    payload = {
        "jsonrpc": "2.0",
        "id": str(uuid.uuid4()),
        "method": "message/send",
        "params": {
            "message": {
                "role": "user",
                "parts": [{"data": build_request(index)}],
            }
        },
    }

    start_time = time.monotonic()
    try:
        async with session.post(WORKER_URL, json=payload, timeout=30) as response:
            result = await response.json()
            latency = time.monotonic() - start_time

            # JSON-RPC answers 200 whether the gate screened the request or
            # refused it, so the HTTP code says nothing about the outcome.
            # The task state is the only honest signal.
            if "error" in result:
                return {
                    "index": index,
                    "state": "rpc_error",
                    "latency": latency,
                    "screened": False,
                    "detail": result["error"].get("message", "JSON-RPC error"),
                }

            task = result.get("result") or {}
            state = (task.get("status") or {}).get("state", "unknown")
            return {
                "index": index,
                "state": state,
                "latency": latency,
                "screened": state == "TASK_STATE_COMPLETED",
                "detail": first_rejection_reason(task),
            }
    except Exception as e:
        return {
            "index": index,
            "state": "transport_error",
            "latency": time.monotonic() - start_time,
            "screened": False,
            "detail": str(e),
        }


def first_rejection_reason(task):
    """The gate explains a refusal in the data part of its guidance artifact."""
    for artifact in task.get("artifacts") or []:
        for part in artifact.get("parts") or []:
            errors = (part.get("data") or {}).get("errors")
            if errors:
                return errors[0]
    return ""


async def main():
    print(f"\n🚀 Launching Infinite Swarm Batch Processor")
    print(f"Target: {BATCH_SIZE} compliance reviews in parallel against Edge Agents...\n")

    start_time = time.time()

    # Use a TCP connector with high limit for parallel fan-out
    connector = aiohttp.TCPConnector(limit=500)
    async with aiohttp.ClientSession(connector=connector) as session:
        tasks = [check_counterparty(session, i) for i in range(1, BATCH_SIZE + 1)]

        # Gather all results concurrently
        print("Dispatching agents...")
        results = await asyncio.gather(*tasks)

    end_time = time.time()
    total_time = end_time - start_time

    screened = sum(1 for r in results if r["screened"])
    rejected = sum(1 for r in results if not r["screened"])
    avg_latency = sum(r["latency"] for r in results) / len(results) if results else 0

    # Calculate Human vs Agent metrics
    human_hours = (BATCH_SIZE * MINUTES_PER_MANUAL_REVIEW) / 60
    human_cost = human_hours * HOURLY_WAGE
    agent_cost = BATCH_SIZE * AGENT_COST_PER_CALL_EUR

    print("\n" + "=" * 50)
    print("📈 HIRING EMPLOYEES VS. AGENTS: BATCH RESULTS")
    print("=" * 50)
    print(f"Volume Dispatched  : {BATCH_SIZE} complex reviews")
    print(f"Screened           : {screened}/{BATCH_SIZE} ({(screened / BATCH_SIZE) * 100:.1f}%)")
    print(f"Not screened       : {rejected}/{BATCH_SIZE}")
    print(f"Avg Agent Latency  : {avg_latency:.2f} seconds")

    # A run where nothing was screened is a failed run, however fast it was.
    # Naming the states keeps a broken request shape from reading as a result.
    if rejected:
        print("-" * 50)
        print("NOT SCREENED — BY STATE")
        states = {}
        for r in results:
            if r["screened"]:
                continue
            key = (r["state"], r["detail"])
            states[key] = states.get(key, 0) + 1
        for (state, detail), count in sorted(states.items(), key=lambda kv: -kv[1]):
            suffix = f" — {detail}" if detail else ""
            print(f"  {count:>4} x {state}{suffix}")

    print("-" * 50)
    print(f"SCALABILITY")
    print(f"  Employees : Hard to scale (Requires hiring 10+ analysts)")
    print(f"  Agents    : Infinitely scalable (Done in {total_time:.2f} seconds)")
    print("-" * 50)
    print(f"MAINTENANCE")
    print(f"  Employees : High (HR, management, turnover)")
    print(f"  Agents    : Low (Serverless edge deployment)")
    print("-" * 50)
    print(f"COST (for {BATCH_SIZE} reviews)")
    print(f"  Employees : Salaries (~${human_cost:,.2f} at {human_hours:,.1f} hours)")
    print(f"  Agents    : ~EUR {agent_cost:,.2f} (deterministic triage, no LLM, no paid upstream)")
    print("-" * 50)
    print(f"CAPABILITY")
    print(f"  Employees : Human intelligence (Prone to fatigue on document {BATCH_SIZE})")
    print(f"  Agents    : Machine intelligence (Consistent deterministic evaluation)")
    print("=" * 50 + "\n")


if __name__ == "__main__":
    asyncio.run(main())
