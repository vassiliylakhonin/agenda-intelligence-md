#!/usr/bin/env python3
"""
Master Edge Fleet Health Check & Drift Guard Runner.
Executes zero-mock live proofs against all 11 Cloudflare Workers:
1. Vizier Security Kernel (OFAC 50% Rule, DLP Scanner, Web Console)
2. CIS Secondary Sanctions A2A
3. Gulf Maritime Exposure A2A
4. Agent Output Verification A2A
5. Agentic Interaction Trust A2A
6. Kazakhstan Market Entry Readiness A2A
7. Middle Corridor Deal Risk Gate A2A
8. Critical Minerals Due Diligence A2A
9. Dual-Use Technology Export A2A
10. Corridor Sanctions Assistant A2A
11. Agenda Intelligence Root Gateway A2A
"""

import os
import sys
import time
import subprocess
import argparse
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE_DIR = Path(__file__).parent / "fleet_health"

WORKERS = [
    {
        "id": 1,
        "name": "vizier",
        "title": "Vizier Security Kernel",
        "url": "https://vizier.vassiliy-lakhonin.workers.dev",
        "script": "proof_worker1_vizier.py"
    },
    {
        "id": 2,
        "name": "cis-secondary-sanctions-a2a",
        "title": "CIS Secondary Sanctions A2A",
        "url": "https://cis-secondary-sanctions-a2a.vassiliy-lakhonin.workers.dev",
        "script": "proof_worker2_cis_secondary_sanctions.py"
    },
    {
        "id": 3,
        "name": "gulf-maritime-exposure-a2a",
        "title": "Gulf Maritime Exposure A2A",
        "url": "https://gulf-maritime-exposure-a2a.vassiliy-lakhonin.workers.dev",
        "script": "proof_worker3_gulf_maritime_exposure.py"
    },
    {
        "id": 4,
        "name": "agent-output-verification-a2a",
        "title": "Agent Output Verification A2A",
        "url": "https://agent-output-verification-a2a.vassiliy-lakhonin.workers.dev",
        "script": "proof_worker4_agent_output_verification.py"
    },
    {
        "id": 5,
        "name": "agentic-interaction-trust-a2a",
        "title": "Agentic Interaction Trust A2A",
        "url": "https://agentic-interaction-trust-a2a.vassiliy-lakhonin.workers.dev",
        "script": "proof_worker5_agentic_interaction_trust.py"
    },
    {
        "id": 6,
        "name": "kazakhstan-market-entry-readiness-a2a",
        "title": "Kazakhstan Market Entry Readiness A2A",
        "url": "https://kazakhstan-market-entry-readiness-a2a.vassiliy-lakhonin.workers.dev",
        "script": "proof_worker6_kazakhstan_market_entry_readiness.py"
    },
    {
        "id": 7,
        "name": "middle-corridor-deal-risk-gate-a2a",
        "title": "Middle Corridor Deal Risk Gate A2A",
        "url": "https://middle-corridor-deal-risk-gate-a2a.vassiliy-lakhonin.workers.dev",
        "script": "proof_worker7_middle_corridor_deal_risk_gate.py"
    },
    {
        "id": 8,
        "name": "critical-minerals-due-diligence-a2a",
        "title": "Critical Minerals Due Diligence A2A",
        "url": "https://critical-minerals-due-diligence-a2a.vassiliy-lakhonin.workers.dev",
        "script": "proof_worker8_critical_minerals_due_diligence.py"
    },
    {
        "id": 9,
        "name": "dual-use-technology-export-a2a",
        "title": "Dual-Use Technology Export A2A",
        "url": "https://dual-use-technology-export-a2a.vassiliy-lakhonin.workers.dev",
        "script": "proof_worker9_dual_use_technology_export.py"
    },
    {
        "id": 10,
        "name": "corridor-sanctions-assistant-a2a",
        "title": "Corridor Sanctions Assistant A2A",
        "url": "https://corridor-sanctions-assistant-a2a.vassiliy-lakhonin.workers.dev",
        "script": "proof_worker10_corridor_sanctions_assistant.py"
    },
    {
        "id": 11,
        "name": "agenda-intelligence-a2a",
        "title": "Agenda Intelligence Root Gateway A2A",
        "url": "https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev",
        "script": "proof_worker11_agenda_intelligence_root.py"
    }
]

def run_proof(worker: dict) -> dict:
    script_path = BASE_DIR / worker["script"]
    start_time = time.perf_counter()
    
    try:
        proc = subprocess.run(
            [sys.executable, str(script_path)],
            capture_output=True,
            text=True,
            timeout=40
        )
        duration = time.perf_counter() - start_time
        success = proc.returncode == 0
        return {
            **worker,
            "success": success,
            "returncode": proc.returncode,
            "duration": duration,
            "stdout": proc.stdout,
            "stderr": proc.stderr
        }
    except subprocess.TimeoutExpired:
        duration = time.perf_counter() - start_time
        return {
            **worker,
            "success": False,
            "returncode": -1,
            "duration": duration,
            "stdout": "",
            "stderr": "Execution timed out after 40 seconds."
        }
    except Exception as e:
        duration = time.perf_counter() - start_time
        return {
            **worker,
            "success": False,
            "returncode": -2,
            "duration": duration,
            "stdout": "",
            "stderr": str(e)
        }

def main():
    parser = argparse.ArgumentParser(description="Run Cloudflare Workers Fleet Health Check")
    parser.add_argument("--concurrency", type=int, default=4, help="Parallel concurrency level (default: 4)")
    parser.add_argument("--worker", type=str, default=None, help="Run only a specific worker (e.g. '1', 'vizier', '11')")
    args = parser.parse_args()

    targets = WORKERS
    if args.worker:
        targets = [w for w in WORKERS if str(w["id"]) == args.worker or w["name"] == args.worker]
        if not targets:
            sys.exit(f"Worker '{args.worker}' not found in fleet.")

    print("=" * 80)
    print(" 🚀 CLOUDFLARE WORKERS FLEET & VIZIER SECURITY KERNEL HEALTH CHECK")
    print(f" Targets: {len(targets)} workers | Concurrency: {args.concurrency}")
    print("=" * 80)

    start_total = time.perf_counter()
    results = []

    with ThreadPoolExecutor(max_workers=args.concurrency) as executor:
        futures = {executor.submit(run_proof, w): w for w in targets}
        for future in as_completed(futures):
            res = future.result()
            results.append(res)
            status_icon = "✅" if res["success"] else "❌"
            print(f"  {status_icon} [{res['id']:2d}/11] {res['title']:<40} ({res['duration']:.2f}s)")

    results.sort(key=lambda x: x["id"])
    total_elapsed = time.perf_counter() - start_total

    print("\n" + "=" * 80)
    print(" SUMMARY RESULTS MATRIX")
    print("=" * 80)
    header = f"| {'#':<2} | {'Worker Service':<36} | {'Duration':<8} | {'Status':<7} |"
    sep = f"|{'-'*4}|{'-'*38}|{'-'*10}|{'-'*9}|"
    print(header)
    print(sep)

    passed_count = sum(1 for r in results if r["success"])
    total_count = len(results)

    for r in results:
        status_label = "PASS" if r["success"] else "FAIL"
        icon = "✅" if r["success"] else "❌"
        print(f"| {r['id']:<2} | {r['name']:<36} | {r['duration']:>6.2f}s  | {icon} {status_label:<4} |")

    print(sep)
    print(f"\nFinal Score: {passed_count}/{total_count} Passed in {total_elapsed:.2f}s")

    # Generate GitHub Actions Step Summary if running in CI
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        with open(summary_path, "a", encoding="utf-8") as f:
            f.write("# 🛡️ Edge Fleet Health Check & Drift Guard\n\n")
            f.write(f"- **Fleet Status:** {'✅ **100% HEALTHY**' if passed_count == total_count else '❌ **DEGRADED / DRIFT DETECTED**'}\n")
            f.write(f"- **Score:** `{passed_count}/{total_count}` workers passing live edge proofs\n")
            f.write(f"- **Total Duration:** `{total_elapsed:.2f}s`\n\n")
            
            f.write("| # | Worker Service | Role | Edge URL | Duration | Status |\n")
            f.write("|---|---|---|---|---|---|\n")
            for r in results:
                icon = "✅" if r["success"] else "❌"
                f.write(f"| **{r['id']}** | `{r['name']}` | {r['title']} | [{r['url']}]({r['url']}) | `{r['duration']:.2f}s` | {icon} **{'PASS' if r['success'] else 'FAIL'}** |\n")
            
            f.write("\n---\n\n")
            f.write("### 📋 Detailed Worker Proof Logs\n\n")
            for r in results:
                icon = "✅" if r["success"] else "❌"
                f.write(f"<details><summary>{icon} <b>Worker #{r['id']}: {r['title']}</b> ({r['duration']:.2f}s)</summary>\n\n")
                f.write("```text\n")
                if r["stdout"]:
                    f.write(r["stdout"])
                if r["stderr"]:
                    f.write("\nSTDERR:\n" + r["stderr"])
                f.write("\n```\n</details>\n\n")

    if passed_count != total_count:
        print("\n❌ One or more edge worker proofs failed! See logs above.", file=sys.stderr)
        sys.exit(1)

    print("\n🏆 ALL EDGE WORKER PROOFS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    main()
