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

async def check_counterparty(session, index):
    """Dispatch a single A2A request to the edge agent."""
    payload = {
        "jsonrpc": "2.0",
        "id": str(uuid.uuid4()),
        "method": "message/send",
        "params": {
            "capability": "cis_secondary_sanctions",
            "cis_secondary_sanctions_request": {
                "counterparty": {
                    "name": f"Synthetic Entity {index} LLC",
                    "jurisdiction": "ru"
                },
                "exposure_facets": ["ownership_or_control"],
                "supplied_sources": ["user_provided_note"]
            }
        }
    }
    
    start_time = time.monotonic()
    try:
        async with session.post(WORKER_URL, json=payload, timeout=30) as response:
            result = await response.json()
            latency = time.monotonic() - start_time
            
            # Extract status from the response
            status = "unknown"
            if "result" in result and "status" in result["result"]:
                status = result["result"]["status"].get("state", "completed")
                
            return {"index": index, "status": status, "latency": latency, "success": response.status == 200}
    except Exception as e:
        return {"index": index, "status": "error", "latency": time.monotonic() - start_time, "success": False, "error": str(e)}

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
    
    successful = sum(1 for r in results if r["success"])
    failed = len(results) - successful
    avg_latency = sum(r["latency"] for r in results) / len(results) if results else 0
    
    # Calculate Human vs Agent metrics
    human_hours = (BATCH_SIZE * MINUTES_PER_MANUAL_REVIEW) / 60
    human_cost = human_hours * HOURLY_WAGE
    
    # Approx LLM + Edge compute cost (tokens)
    agent_cost = BATCH_SIZE * 0.005 # $0.005 per agent run
    
    print("\n" + "="*50)
    print("📈 HIRING EMPLOYEES VS. AGENTS: BATCH RESULTS")
    print("="*50)
    print(f"Volume Processed   : {BATCH_SIZE} complex reviews")
    print(f"Agent Success Rate : {successful}/{BATCH_SIZE} ({(successful/BATCH_SIZE)*100:.1f}%)")
    print(f"Avg Agent Latency  : {avg_latency:.2f} seconds")
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
    print(f"  Agents    : Tokens (~${agent_cost:,.2f})")
    print("-" * 50)
    print(f"CAPABILITY")
    print(f"  Employees : Human intelligence (Prone to fatigue on document {BATCH_SIZE})")
    print(f"  Agents    : Machine intelligence (Consistent deterministic evaluation)")
    print("="*50 + "\n")

if __name__ == "__main__":
    asyncio.run(main())
