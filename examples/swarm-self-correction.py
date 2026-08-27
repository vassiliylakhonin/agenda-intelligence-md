import sys
import json
import logging
from pathlib import Path
from agenda_intelligence.services import check_evidence_packet, build_repair_prompt

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

def get_flawed_packet():
    return {
        "topic": "Testing Self Correction",
        "claims": [
            {
                "claim_id": "c1",
                "text": "The widget requires an export license to Kazakhstan.",
                "source_ids": ["doc1"],
                "quotes": [
                    {
                        "source_id": "doc1",
                        "text": "This widget requires a license to Kazakhstan."
                    }
                ]
            }
        ],
        "sources": [
            {
                "source_id": "doc1",
                "title": "Export Regulations",
                "text": "This widget requires a license to all CIS countries, except for Kazakhstan where it is freely available."
            }
        ]
    }

def verify_packet(packet):
    logging.info("Agent A (Verifier): Checking evidence packet...")
    result = check_evidence_packet(packet)
    return result

def fix_packet(packet, repair_prompt):
    logging.info("Agent B (Fixer): Received repair prompt. Fixing packet...")
    if "contradicts" in repair_prompt.lower() or "missing" in repair_prompt.lower() or "unsupported" in repair_prompt.lower() or "gap" in repair_prompt.lower() or "quote" in repair_prompt.lower() or "excerpt" in repair_prompt.lower() or "not found" in repair_prompt.lower():
        packet["claims"][0]["text"] = "This widget is freely available to Kazakhstan."
        packet["claims"][0]["quotes"][0]["text"] = "This widget requires a license to all CIS countries, except for Kazakhstan where it is freely available."

    return packet

def main():
    print("--- Starting Self-Correction Swarm ---")
    packet = get_flawed_packet()

    iteration = 1
    max_iterations = 3

    while iteration <= max_iterations:
        print(f"\n--- Iteration {iteration} ---")
        result = verify_packet(packet)

        # Valid property indicates structural success, repair_needed indicates factual/quote failures
        if result.get("valid") and result.get("response", {}).get("packet_status") == "packet_complete":
            logging.info("Agent A (Verifier): Packet is fully grounded and valid!")
            print("Swarm successfully converged on a valid packet.")
            break

        logging.warning("Agent A (Verifier): Packet is flawed.")

        repair_prompt = build_repair_prompt(packet, result.get("response"))
        if repair_prompt:
             print("\nGenerated Repair Prompt:")
             print("-" * 40)
             print(repair_prompt)
             print("-" * 40)
        else:
             logging.warning("No repair prompt generated.")
             break

        packet = fix_packet(packet, repair_prompt)
        iteration += 1

    if iteration > max_iterations:
        print("Swarm failed to converge within max iterations.")

if __name__ == "__main__":
    main()
