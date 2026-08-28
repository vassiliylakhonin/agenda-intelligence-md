#!/usr/bin/env python3
"""
Catalog Distribution: Massive Fleet Generator

Generates a catalog of 100 specialized vertical compliance agents to demonstrate
"Infinite Scalability" of roles and readiness for AI agent registries (like Agenstry).

Outputs to `massive-fleet-catalog.json`.

Usage:
    python3 scripts/generate-massive-fleet.py
"""

import json
import time

DOMAINS = [
    "ESG",
    "Crypto AML",
    "Real Estate DD",
    "Supply Chain",
    "Maritime Shipping",
    "Aviation",
    "Healthcare",
    "Pharmaceutical",
    "Defense",
    "Energy",
    "Agriculture",
    "Fintech",
    "Telecom",
    "Media",
    "Automotive",
    "Logistics",
    "Retail",
    "Gaming",
    "Biotech",
    "Semiconductor",
]

REGIONS = ["Global", "EU", "US", "APAC", "LATAM", "MENA", "CIS", "Africa", "Nordics", "ASEAN"]


def generate_fleet():
    agents = []

    print("🚀 Booting Infinite Scalability Agent Factory...")

    for i, domain in enumerate(DOMAINS):
        for j, region in enumerate(REGIONS[:5]):  # 100 agents total
            agent_id = f"{region.lower()}_{domain.lower().replace(' ', '_')}_auditor"
            name = f"{region} {domain} Compliance Agent"

            agent = {
                "name": agent_id,
                "description": f"Autonomously evaluates {name} evidence packets and readiness.",
                "capabilities": ["evidence_readiness", "pre_action_check"],
                "inputSchema": {
                    "type": "object",
                    "properties": {f"{agent_id}_request": {"type": "object", "description": f"Payload for {name}"}},
                },
                "pricing": {"model": "per_token", "estimate": "$0.001 / check"},
                "status": "active",
            }
            agents.append(agent)

    catalog = {
        "metadata": {
            "title": "Agenda Intelligence MD - Infinite Fleet Catalog",
            "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "total_agents": len(agents),
            "theme": "Hiring Agents, Not Employees",
        },
        "agents": agents,
    }

    with open("massive-fleet-catalog.json", "w") as f:
        json.dump(catalog, f, indent=2)

    print(f"✅ Generated {len(agents)} specialized agents in massive-fleet-catalog.json")
    print("This catalog is ready to be ingested by Agenstry and other AI agent registries.")


if __name__ == "__main__":
    generate_fleet()
