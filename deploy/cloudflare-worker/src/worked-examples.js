// Generated locally from published synthetic MCP examples. No live upstream or payment.
export const WORKED_EXAMPLES = {
  "agenda": {
    "kind": "precomputed_synthetic_fixture",
    "tool": "strategic_risk_triage",
    "request": {
      "text": "What evidence is needed before entering the Kazakhstan market?"
    },
    "response": {
      "intent": "evidence_audit",
      "modules": [
        {
          "module": "global-think-tank-analyst",
          "role": "reasoning_method"
        },
        {
          "module": "central-asia-caspian",
          "role": "regional_specialist"
        }
      ],
      "signal_screen": {
        "intent": "evidence_audit",
        "risk_signal": "Strategic-risk question requires source-backed triage before raising confidence. Named in this request: Kazakhstan.",
        "subject": {
          "jurisdictions": [
            "Kazakhstan"
          ],
          "chokepoints": [],
          "commodities": [],
          "actions": [
            "build an evidence pack for review"
          ]
        },
        "subject_line": "jurisdictions Kazakhstan | asked to build an evidence pack for review",
        "applicable_regimes": [
          "Kazakhstan: OFAC EO 14024 / EO 14114 named-sector and correspondent-banking exposure — the route's secondary-sanctions surface",
          "Kazakhstan: EU circumvention-watch measures on Central Asia re-export flows — whether the transit leg is itself the flagged step",
          "Kazakhstan: KZ State Revenue Committee customs declaration and transit paperwork — that the declared route is the route"
        ],
        "port_notes": [],
        "affected_regions": [
          "Central Asia/Caspian"
        ],
        "source_categories_required": [
          "primary official source",
          "independent context source",
          "dated retrieval note",
          "corridor operator",
          "customs/transport authority",
          "state-company or IFI source"
        ],
        "evidence_gaps": [
          "No caller-supplied primary official source evidence in this live A2A request.",
          "No caller-supplied independent context source evidence in this live A2A request.",
          "No caller-supplied dated retrieval note evidence in this live A2A request.",
          "No caller-supplied corridor operator evidence in this live A2A request.",
          "No caller-supplied customs/transport authority evidence in this live A2A request."
        ],
        "evidence_requests": [
          "primary official source — the rule, designation or notice as published by the body that issued it — settles what the measure actually says",
          "independent context source — one independent report on the same fact — settles whether the primary source is being read the way the market reads it",
          "dated retrieval note — the date each source was retrieved — settles how stale this screen is when someone reads it next month",
          "corridor operator — port or corridor operator notice for the transit window — settles whether the declared route was open",
          "customs/transport authority — customs declaration and transit documents — settles that the declared route is the route",
          "state-company or IFI source — state-company or development-bank documentation where the counterparty is state-linked"
        ],
        "open_items": [
          "primary official source",
          "independent context source",
          "dated retrieval note",
          "corridor operator",
          "customs/transport authority",
          "state-company or IFI source"
        ],
        "watch_next": [
          "new primary-source update that changes the triggering fact",
          "contradictory official statement or implementation guidance",
          "corridor disruption notice, customs rule change, tariff update, or state-company statement"
        ],
        "recommended_mcp_tool": "audit_claims",
        "confidence": "triage_only_no_live_retrieval"
      },
      "deal_risk_gate": null,
      "deal_risk_contract": null,
      "source_plan": [
        "primary official source for the triggering event or rule",
        "independent secondary context that does not replace the primary source",
        "dated retrieval notes so stale-risk can be reviewed later",
        "Central Asia/Caspian government, customs, transport, corridor, and state-company sources",
        "IFI, logistics, energy, or regional-market sources that expose corridor and counterparty constraints"
      ],
      "quality_gates": [
        "Check source-category coverage before treating the evidence pack as complete.",
        "Separate facts, assessments, assumptions, and unknowns.",
        "Attach evidence ids to load-bearing claims.",
        "Mark unsupported claims instead of smoothing them away.",
        "State what would change the judgment."
      ],
      "next_actions": [
        "Run audit_claims with the memo and evidence pack.",
        "Review unsupported_claims and orphan evidence references before publishing the analysis."
      ],
      "install": {
        "package": "https://pypi.org/project/agenda-intelligence-md/",
        "command": "pip install agenda-intelligence-md",
        "mcp_server_command": "agenda-intelligence-mcp"
      }
    }
  },
  "kazakhstan": {
    "kind": "precomputed_synthetic_fixture",
    "tool": "middle_corridor_deal_risk",
    "request": {
      "route": "Altynkol -> Aktau/Kuryk -> Baku -> Poti",
      "cargo": "industrial equipment",
      "shipment_value": {
        "amount": 2400000,
        "currency": "USD"
      },
      "counterparties": [
        {
          "role": "forwarder",
          "name": "Kazakhstan forwarder",
          "jurisdiction": "Kazakhstan"
        }
      ],
      "dated_sources": [
        {
          "id": "e1",
          "source_type": "port_operator_notice",
          "title": "Port operator notice",
          "date": "2026-05-20",
          "url": "https://example.com/port-notice"
        }
      ],
      "risk_question": "Should this be escalated before contract signature?",
      "decision_stage": "pre_signature",
      "requested_output": "structured_json"
    },
    "response": {
      "triage_recommendation": "escalate_before_signature",
      "risk_signal": "medium_high",
      "decision_readiness_score": 20,
      "decision_readiness_label": "not_decision_ready",
      "operational_decision": {
        "decision": "escalate",
        "applies_to": "quote / sign the booking",
        "rationale": "Route to compliance or legal before you quote / sign the booking."
      },
      "route": "Altynkol -> Aktau/Kuryk -> Baku -> Poti",
      "cargo": "industrial equipment",
      "counterparties": [
        {
          "role": "forwarder",
          "name": "Kazakhstan forwarder",
          "jurisdiction": "Kazakhstan"
        }
      ],
      "supplied_sources": [
        "port_operator_notice"
      ],
      "minimum_sources_before_go": [
        "counterparty_registry_extract",
        "beneficial_ownership_source",
        "sanctions_list_extract",
        "customs_or_regulatory_source",
        "insurance_clause_or_underwriter_note",
        "vessel_or_carrier_history"
      ],
      "evidence_gaps": [
        "No counterparty registry extract supplied.",
        "No beneficial ownership source supplied.",
        "No sanctions screening result supplied.",
        "No customs or regulatory source supplied.",
        "No insurance clause or underwriter note supplied.",
        "No carrier, vessel, or rail-operator history supplied."
      ],
      "top_risks": [
        "sanctions adjacency",
        "Caspian crossing capacity and draft exposure",
        "customs/documentation uncertainty",
        "insurance exclusions",
        "counterparty and ownership uncertainty",
        "carrier / vessel / rail-operator history gap"
      ],
      "exposure_layers": {
        "domestic_legal_layer": [
          "Home-jurisdiction legal and licensing posture not assessed here (this product does not verify export-control licensing or documentation); confirm with qualified review.",
          "No customs or regulatory source supplied to review documentation posture."
        ],
        "foreign_sanctions_exposure_layer": [
          "Secondary / extraterritorial sanctions adjacency present; exposure not adjudicated.",
          "No sanctions screening result supplied to review listed-party exposure.",
          "No beneficial ownership source — indirect / ownership-based exposure cannot be reviewed; the OFAC/EU 50 Percent Rule (aggregate blocked-person ownership) is a human-review step the file is not yet ready for."
        ]
      },
      "watch_next": [
        "new sanctions designations",
        "Caspian ferry-slot, tonnage, or draft notice",
        "port delays or operator notices",
        "rail capacity constraints",
        "customs enforcement changes",
        "carrier or vessel history updates",
        "insurance or underwriter terms changes"
      ],
      "human_review_required": true,
      "not_advice_notice": "Pre-compliance evidence triage only. Not legal, sanctions, compliance, financial, investment, insurance, or trading advice.",
      "counterparty_readiness": {
        "status": "incomplete",
        "required_total": 6,
        "supplied_count": 0,
        "missing_count": 6,
        "outstanding_documents": [
          "counterparty_registry_extract",
          "beneficial_ownership_source",
          "sanctions_list_extract",
          "customs_or_regulatory_source",
          "insurance_clause_or_underwriter_note",
          "vessel_or_carrier_history"
        ],
        "document_ledger": [
          {
            "source_type": "counterparty_registry_extract",
            "status": "missing"
          },
          {
            "source_type": "beneficial_ownership_source",
            "status": "missing"
          },
          {
            "source_type": "sanctions_list_extract",
            "status": "missing"
          },
          {
            "source_type": "customs_or_regulatory_source",
            "status": "missing"
          },
          {
            "source_type": "insurance_clause_or_underwriter_note",
            "status": "missing"
          },
          {
            "source_type": "vessel_or_carrier_history",
            "status": "missing"
          }
        ],
        "presentable_note": "Dossier-completeness view for presenting enhanced-due-diligence evidence to a bank, insurer, or counterparty. Tracks completeness of the required-before-go evidence set only; it is not clearance, approval, a sanctions determination, or compliance advice. Human review is required before any commercial action."
      },
      "route_sanctions_exposure_indicators": [
        "Iran transit legs (Rasht-Astara rail, Bandar Abbas / Chabahar sea): screen for OFAC Iran-program exposure.",
        "Russia Northern Corridor overlaps (Russian rail or territory as a leg or fallback): screen for diversion.",
        "Sanctioned Caspian ports, operators, or flagged vessels: screen operator and vessel against designations.",
        "Onward connection into a sanctions-relevant jurisdiction: confirm ultimate consignee and destination first."
      ],
      "customs_harmonization_indicators": [
        "Permitting clarity: confirm licenses and permits needed at each crossing; flag any unharmonized leg.",
        "Harmonized transit: check which crossings run under eTIR or another harmonized digital-customs regime.",
        "Document acceptance: confirm transit documents are accepted at all crossings without re-declaration.",
        "Tariff consistency: confirm cargo tariff classification and duties are consistent across corridor states.",
        "Customs-rule change watch: flag recent customs-rule or enforcement changes at any crossing on the route.",
        "Rail gauge-change points: confirm transloading and gauge-change handling and capacity at Khorgos / Altynkol and at the Caspian rail-ferry interchange (the corridor is rail-dominant, not maritime).",
        "Caspian dwell exposure: flag demurrage, wagon-detention, and ferry-slot risk at Aktau / Kuryk and onward Black Sea ports."
      ],
      "vessel_due_diligence_indicators": [
        "AIS continuity: check for extended transmission gaps or disablement over the voyage.",
        "Vessel identity consistency: check for MMSI / name / IMO manipulation or misclassification.",
        "Certificate-of-origin integrity: confirm shipping documents match declared cargo origin and destination.",
        "Ship-to-ship transfer history: check for undisclosed STS transfers along the route.",
        "Flag history: check for recent flag changes or registration with a high-risk registry."
      ],
      "reexport_control_indicators": [
        "End-user statement: obtain a signed end-user / end-use statement naming the ultimate consignee.",
        "No-re-export clause: confirm the counterparty accepts a no-re-export / no-diversion contract clause.",
        "End-use consistency: check the stated end-use is consistent with the cargo type and the ordering party.",
        "Onward destination: confirm disclosure of any onward destination beyond the first delivery point.",
        "Order-vs-destination match: flag a stated end-user in a different country from the order origin."
      ],
      "source_of_funds_indicators": [
        "Source of funds: obtain evidence of the funds used for this deal (bank statement, loan or sale proceeds).",
        "Source of wealth: obtain evidence of the counterparty's overall wealth origin (business, prior trade).",
        "Consistency: check the declared source of funds fits the counterparty profile and the deal size.",
        "Payer match: confirm the paying entity and account match the contracting counterparty.",
        "Funds-jurisdiction flag: flag funds routed through a high-risk or sanctions-relevant jurisdiction."
      ],
      "pep_screening_indicators": [
        "PEP screening: screen each counterparty and its beneficial owners against PEP lists.",
        "Family and close associates: extend screening to immediate family and known close associates.",
        "Senior-management approval: confirm sign-off where a PEP relationship is identified.",
        "Source of funds/wealth: apply enhanced SOF/SOW checks for any identified PEP.",
        "Ongoing monitoring: apply enhanced monitoring for the duration of any PEP relationship."
      ],
      "front_company_indicators": [
        "Business substance: confirm the counterparty is a real operating business, not a recently formed shell.",
        "Web and registry footprint: check for a verifiable web presence and a registry record that predates the deal.",
        "Address integrity: flag an address shared with multiple unrelated companies or with a sanctioned entity.",
        "Line-of-business fit: confirm the goods or service fit the counterparty's stated line of business.",
        "Representation: flag contact only via an intermediary with broad power of attorney, principals unavailable."
      ],
      "shipment_value": {
        "amount": 2400000,
        "currency": "USD"
      },
      "readiness_contract": {
        "profile": "middle_corridor_deal_risk",
        "status": "not_decision_ready",
        "score": 20,
        "routing": {
          "field": "triage_recommendation",
          "value": "escalate_before_signature"
        },
        "signal": {
          "field": "risk_signal",
          "value": "medium_high"
        },
        "blocking_gaps": [
          "No counterparty registry extract supplied.",
          "No beneficial ownership source supplied.",
          "No sanctions screening result supplied.",
          "No customs or regulatory source supplied.",
          "No insurance clause or underwriter note supplied.",
          "No carrier, vessel, or rail-operator history supplied."
        ],
        "non_blocking_gaps": [],
        "claim_audit": [],
        "owner_actions": [],
        "watch_next": [
          "new sanctions designations",
          "Caspian ferry-slot, tonnage, or draft notice",
          "port delays or operator notices",
          "rail capacity constraints",
          "customs enforcement changes",
          "carrier or vessel history updates",
          "insurance or underwriter terms changes"
        ],
        "human_review_required": true,
        "boundary_notice": "Pre-compliance evidence triage only. Not legal, sanctions, compliance, financial, investment, insurance, or trading advice."
      }
    }
  },
  "cis_secondary_sanctions": {
    "kind": "precomputed_synthetic_fixture",
    "tool": "cis_secondary_sanctions_exposure",
    "request": {
      "counterparty": {
        "name": "Example Kazakhstan Trading LLP",
        "jurisdiction": "Kazakhstan",
        "sector": "trading_house",
        "ownership_layers": [
          "Holding A (KZ)",
          "Holding B (UAE)"
        ]
      },
      "exposure_facets": [
        "ownership_or_control",
        "ict_or_dual_use_goods",
        "transit_or_re_export"
      ],
      "jurisdiction_review_scope": [
        "ofac",
        "eu",
        "uk_ofsi"
      ],
      "dated_sources": [
        {
          "id": "s1",
          "source_type": "ofac_sdn_extract",
          "title": "OFAC SDN list excerpt",
          "date": "2026-05-20"
        }
      ],
      "risk_question": "Does the disclosed ownership chain create indirect exposure under OFAC EO 14114 or EU sanctions package?",
      "decision_stage": "onboarding"
    },
    "response": {
      "triage_recommendation": "escalate_before_onboarding",
      "secondary_exposure_signal": "medium_high",
      "decision_readiness_score": 24,
      "decision_readiness_label": "not_decision_ready",
      "counterparty": {
        "name": "Example Kazakhstan Trading LLP",
        "jurisdiction": "Kazakhstan",
        "sector": "trading_house",
        "ownership_layers": [
          "Holding A (KZ)",
          "Holding B (UAE)"
        ]
      },
      "exposure_facets": [
        "ownership_or_control",
        "ict_or_dual_use_goods",
        "transit_or_re_export"
      ],
      "supplied_sources": [
        "ofac_sdn_extract"
      ],
      "minimum_sources_before_review": [
        "eu_consolidated_extract",
        "ownership_chain_evidence",
        "bank_correspondent_evidence",
        "transit_or_invoice_evidence"
      ],
      "evidence_gaps": [
        "No EU consolidated sanctions list extract supplied.",
        "No ownership chain evidence supplied.",
        "No bank correspondent evidence supplied.",
        "No transit or invoice evidence supplied."
      ],
      "top_exposure_dimensions": [
        "indirect ownership or control exposure",
        "transit or re-export exposure under EU sanctions package / OFAC EO 14114",
        "ICT or dual-use goods diversion exposure",
        "ownership chain not yet documented"
      ],
      "watch_next": [
        "new OFAC SDN designations",
        "new EU sanctions package",
        "new UK OFSI listing",
        "new EAG typology report",
        "FATF grey-list or black-list update",
        "national regulator enforcement update"
      ],
      "human_review_required": true,
      "not_advice_notice": "Pre-compliance evidence triage only. Not legal, sanctions, compliance, financial, investment, insurance, or trading advice.",
      "limitations": [
        "Live sanctions-list retrieval is not currently enabled; triage is based on user-supplied evidence only.",
        "Name match against a sanctions list is not legal-entity identity verification. Human review is required."
      ],
      "readiness_contract": {
        "profile": "cis_secondary_sanctions",
        "status": "not_decision_ready",
        "score": 24,
        "routing": {
          "field": "triage_recommendation",
          "value": "escalate_before_onboarding"
        },
        "signal": {
          "field": "secondary_exposure_signal",
          "value": "medium_high"
        },
        "blocking_gaps": [
          "No EU consolidated sanctions list extract supplied.",
          "No ownership chain evidence supplied.",
          "No bank correspondent evidence supplied.",
          "No transit or invoice evidence supplied."
        ],
        "non_blocking_gaps": [],
        "claim_audit": [],
        "owner_actions": [],
        "watch_next": [
          "new OFAC SDN designations",
          "new EU sanctions package",
          "new UK OFSI listing",
          "new EAG typology report",
          "FATF grey-list or black-list update",
          "national regulator enforcement update"
        ],
        "human_review_required": true,
        "boundary_notice": "Pre-compliance evidence triage only. Not legal, sanctions, compliance, financial, investment, insurance, or trading advice."
      }
    }
  },
  "agentic_interaction_trust": {
    "kind": "precomputed_synthetic_fixture",
    "tool": "agentic_interaction_trust",
    "request": {
      "actor": {
        "declared_type": "ai_agent",
        "declared_name": "Example Shopping Agent",
        "operator": "Example Consumer",
        "declared_user_agent": "ExampleShoppingAgent/1.0",
        "authentication_context": "session_cookie"
      },
      "target_surface": "checkout",
      "requested_action": "complete purchase of two restricted-delivery items",
      "asset_or_resource": "order-123",
      "decision_stage": "pre_execution",
      "dated_sources": [
        {
          "id": "ait-1",
          "source_type": "agent_identity_claim",
          "title": "Declared agent identity header",
          "date": "2026-05-28"
        }
      ],
      "risk_question": "Is this agent-mediated checkout ready to allow, step up, or route to human review?",
      "requested_output": "structured_json"
    },
    "response": {
      "triage_recommendation": "escalate_to_human_review",
      "trust_signal": "unknown",
      "decision_readiness_score": 20,
      "decision_readiness_label": "not_decision_ready",
      "actor": {
        "declared_type": "ai_agent",
        "declared_name": "Example Shopping Agent",
        "operator": "Example Consumer",
        "declared_user_agent": "ExampleShoppingAgent/1.0",
        "authentication_context": "session_cookie"
      },
      "target_surface": "checkout",
      "requested_action": "complete purchase of two restricted-delivery items",
      "supplied_sources": [
        "agent_identity_claim"
      ],
      "minimum_sources_before_action": [
        "operator_or_principal_authorization",
        "agent_card_or_manifest",
        "tool_scope_or_permission_evidence",
        "session_authentication_evidence",
        "action_intent_evidence",
        "transaction_or_target_action_evidence"
      ],
      "evidence_gaps": [
        "No operator or principal authorization supplied.",
        "No agent card or signed manifest supplied.",
        "No tool-scope or permission evidence supplied.",
        "No session authentication evidence supplied.",
        "No action-intent evidence supplied.",
        "No transaction or target-action evidence supplied."
      ],
      "top_risk_dimensions": [
        "delegated action authority is not evidenced",
        "agent identity is declared but not independently anchored",
        "requested tool or action scope is not evidenced",
        "action intent is not evidenced",
        "checkout action may need step-up before completion"
      ],
      "watch_next": [
        "agent identity spoofing pattern",
        "unexpected tool-scope expansion",
        "checkout or transaction anomaly",
        "account takeover signal",
        "rate-limit or scraping burst",
        "provider allowlist or policy change",
        "mcp or a2a endpoint metadata change",
        "credential leakage or secret exposure report"
      ],
      "human_review_required": true,
      "not_advice_notice": "Agentic interaction evidence triage only. Not cybersecurity monitoring, fraud adjudication, identity verification, transaction authorization, legal advice, compliance advice, or financial advice.",
      "limitations": [
        "This response does not verify the identity of the actor, operator, or principal.",
        "This response does not authorize, approve, deny, or block the requested action."
      ],
      "asset_or_resource": "order-123",
      "readiness_contract": {
        "profile": "agentic_interaction_trust",
        "status": "not_decision_ready",
        "score": 20,
        "routing": {
          "field": "triage_recommendation",
          "value": "escalate_to_human_review"
        },
        "signal": {
          "field": "trust_signal",
          "value": "unknown"
        },
        "blocking_gaps": [
          "No operator or principal authorization supplied.",
          "No agent card or signed manifest supplied.",
          "No tool-scope or permission evidence supplied.",
          "No session authentication evidence supplied.",
          "No action-intent evidence supplied.",
          "No transaction or target-action evidence supplied."
        ],
        "non_blocking_gaps": [],
        "claim_audit": [],
        "owner_actions": [],
        "watch_next": [
          "agent identity spoofing pattern",
          "unexpected tool-scope expansion",
          "checkout or transaction anomaly",
          "account takeover signal",
          "rate-limit or scraping burst",
          "provider allowlist or policy change",
          "mcp or a2a endpoint metadata change",
          "credential leakage or secret exposure report"
        ],
        "human_review_required": true,
        "boundary_notice": "Agentic interaction evidence triage only. Not cybersecurity monitoring, fraud adjudication, identity verification, transaction authorization, legal advice, compliance advice, or financial advice."
      }
    }
  },
  "agent_output_verification": {
    "kind": "precomputed_synthetic_fixture",
    "tool": "agent_output_verification",
    "request": {
      "claims": [
        {
          "claim_id": "c1",
          "claim": "The example record says registration is active.",
          "support_level": "direct",
          "evidence_ids": [
            "e1"
          ],
          "supporting_quotes": [
            {
              "evidence_id": "e1",
              "quote": "Registration active"
            }
          ]
        }
      ],
      "evidence": [
        {
          "evidence_id": "e1",
          "name": "Synthetic registry excerpt",
          "source_type": "official_document",
          "content": "Registration active"
        }
      ]
    },
    "response": {
      "verdict": "verify_before_relay",
      "trust_signal": "medium",
      "readiness_score": 0,
      "score_scope": "declared_evidence_structure_only",
      "factual_verification_performed": false,
      "readiness_label": "not_decision_ready",
      "claim_count": 1,
      "grounded_claim_count": 1,
      "unsafe_claims": [],
      "weak_claims": [],
      "unsupported_statements": [],
      "evidence_gaps": [
        "Illustrative or placeholder evidence cannot establish decision readiness; provide original dated sources."
      ],
      "owner_actions": [],
      "watch_next": [
        "producing agent revises claims after this verdict",
        "new evidence supplied for previously unsupported or orphaned claims",
        "cited source freshness or provenance change"
      ],
      "human_review_required": true,
      "not_advice_notice": "Agent-output relay-readiness triage only. Schema-level and structural: it does not verify that any claim or quote is factually true, does not fetch or validate cited sources, and does not authorize an action or provide legal, compliance, sanctions, financial, or investment advice. This gate never issues allow_relay from caller-declared packs: human review is required before a consuming agent acts on any verdict it returns.",
      "limitations": [
        "Schema-level and structural only. Does not verify that any claim or quote is factually true.",
        "Does not fetch or validate cited sources; it checks declared support structure only.",
        "Caller-declared evidence is never externally verified here, so allow_relay and trust high are never issued from this gate: the best possible routing is verify_before_relay with mandatory human review. A quote counts as grounded only when its text appears in the cited evidence content."
      ]
    }
  },
  "gulf_maritime_exposure": {
    "kind": "precomputed_synthetic_fixture",
    "tool": "gulf_maritime_exposure",
    "request": {
      "vessel": {
        "name": "Example Tanker",
        "flag": "Panama",
        "vessel_type": "crude oil tanker"
      },
      "voyage": {
        "chokepoint": "strait_of_hormuz",
        "origin": "undisclosed Gulf terminal",
        "destination": "ship-to-ship area, Gulf of Oman"
      },
      "cargo": "crude oil",
      "counterparties": [
        {
          "role": "registered_owner",
          "name": "Example Holding Ltd",
          "jurisdiction": "Marshall Islands"
        },
        {
          "role": "insurer_or_pi_club",
          "name": "Unknown"
        }
      ],
      "exposure_facets": [
        "iran_oil_exposure",
        "dark_fleet_indicators",
        "sts_transfer",
        "insurance_or_pi_gap"
      ],
      "jurisdictions_in_scope": [
        "OFAC",
        "EU",
        "UK_OFSI"
      ],
      "decision_stage": "pre_fixture",
      "dated_sources": [
        {
          "id": "g1",
          "source_type": "ais_track_record",
          "title": "AIS track extract",
          "date": "2026-05-28"
        }
      ],
      "risk_question": "Is this Hormuz transit ready to fix, or should it be escalated before fixture?",
      "requested_output": "structured_json"
    },
    "response": {
      "triage_recommendation": "escalate_before_fixture",
      "exposure_signal": "high",
      "decision_readiness_score": 24,
      "decision_readiness_label": "not_decision_ready",
      "voyage": {
        "chokepoint": "strait_of_hormuz",
        "origin": "undisclosed Gulf terminal",
        "destination": "ship-to-ship area, Gulf of Oman"
      },
      "exposure_facets": [
        "iran_oil_exposure",
        "dark_fleet_indicators",
        "sts_transfer",
        "insurance_or_pi_gap"
      ],
      "supplied_sources": [
        "ais_track_record"
      ],
      "minimum_sources_before_review": [
        "vessel_registry_extract",
        "pi_insurance_certificate",
        "ownership_or_control_evidence",
        "sanctions_list_extract"
      ],
      "evidence_gaps": [
        "No vessel registry extract supplied.",
        "No P&I insurance certificate supplied.",
        "No ownership or control evidence supplied.",
        "No sanctions list extract supplied."
      ],
      "top_exposure_dimensions": [
        "Iran-origin oil sanctions exposure (OFAC / EU)",
        "dark-fleet indicators (aged tanker, opaque ownership, no mainstream P&I)",
        "ship-to-ship transfer concealment exposure",
        "insurance or P&I cover gap",
        "vessel ownership or control not yet documented",
        "P&I cover not yet confirmed"
      ],
      "chokepoint_disruption_watch": [
        "Strait of Hormuz transit advisory or security incident",
        "Iran IRGC interdiction or detention report",
        "war-risk premium or underwriter advisory change for the transit area"
      ],
      "watch_next": [
        "new OFAC vessel or entity designation",
        "new EU or UK OFSI shipping-related listing",
        "P&I club cover withdrawal or confirmation change",
        "flag-registry deregistration or flag-hopping report",
        "AIS gap, spoofing, or dark-activity report on the vessel"
      ],
      "human_review_required": true,
      "not_advice_notice": "Maritime sanctions and chokepoint-disruption evidence triage only. Not legal, sanctions, compliance, financial, investment, insurance, or trading advice. Does not resolve vessel ownership or verify identity.",
      "limitations": [
        "Triage is based on caller-supplied evidence and live maritime sanctions verification; this service does not resolve physical vessel ownership or verify identity.",
        "A name match against a sanctions list is not legal-entity or vessel-identity verification. Human review is required."
      ],
      "vessel": {
        "name": "Example Tanker",
        "flag": "Panama",
        "vessel_type": "crude oil tanker"
      },
      "cargo": "crude oil",
      "readiness_contract": {
        "profile": "gulf_maritime_exposure",
        "status": "not_decision_ready",
        "score": 24,
        "routing": {
          "field": "triage_recommendation",
          "value": "escalate_before_fixture"
        },
        "signal": {
          "field": "exposure_signal",
          "value": "high"
        },
        "blocking_gaps": [
          "No vessel registry extract supplied.",
          "No P&I insurance certificate supplied.",
          "No ownership or control evidence supplied.",
          "No sanctions list extract supplied."
        ],
        "non_blocking_gaps": [],
        "claim_audit": [],
        "owner_actions": [],
        "watch_next": [
          "new OFAC vessel or entity designation",
          "new EU or UK OFSI shipping-related listing",
          "P&I club cover withdrawal or confirmation change",
          "flag-registry deregistration or flag-hopping report",
          "AIS gap, spoofing, or dark-activity report on the vessel"
        ],
        "human_review_required": true,
        "boundary_notice": "Maritime sanctions and chokepoint-disruption evidence triage only. Not legal, sanctions, compliance, financial, investment, insurance, or trading advice. Does not resolve vessel ownership or verify identity."
      }
    }
  },
  "market_entry_readiness": {
    "kind": "precomputed_synthetic_fixture",
    "tool": "kazakhstan_market_entry_readiness",
    "request": {
      "project_name": "Example EV distribution entry",
      "partner_or_company": "Example Motors Ltd",
      "market": "Kazakhstan",
      "decision_question": "Is this entry ready for a pre-signature human review?",
      "decision_stage": "pre_signature",
      "supplied_sources": [
        {
          "id": "me-1",
          "source_type": "user_provided_note",
          "title": "Partner background note",
          "date": "2026-08-01"
        }
      ]
    },
    "response": {
      "gate_decision": "pause_for_evidence",
      "readiness_label": "concept_ready",
      "human_review_required": true,
      "summary": "The concept is taking shape, but the validation-tier evidence is incomplete, so the file is not yet ready for controlled validation.",
      "confirmed_facts": [
        "The decision is at pre signature stage."
      ],
      "assumptions": [
        "Public cost benchmarks are not signed quotes.",
        "Supplier prices are not Kazakhstan landed costs.",
        "The final commercial structure depends on local legal, tax, customs, and operational review."
      ],
      "evidence_gaps": [
        {
          "source_type": "partner_company_profile",
          "evidence_needed": "Supply the partner company profile for this market-entry file.",
          "why_it_matters": "The partner company profile is a required gate input that is not yet in the evidence pack.",
          "owner": "Project lead",
          "next_action": "Request or produce the partner company profile.",
          "decision_blocked": "Progression to the next market-entry commitment."
        },
        {
          "source_type": "product_or_project_description",
          "evidence_needed": "Supply the product or project description for this market-entry file.",
          "why_it_matters": "The product or project description is a required gate input that is not yet in the evidence pack.",
          "owner": "Project lead",
          "next_action": "Request or produce the product or project description.",
          "decision_blocked": "Progression to the next market-entry commitment."
        },
        {
          "source_type": "commercial_objective",
          "evidence_needed": "Supply the commercial objective for this market-entry file.",
          "why_it_matters": "The commercial objective is a required gate input that is not yet in the evidence pack.",
          "owner": "Project lead",
          "next_action": "Request or produce the commercial objective.",
          "decision_blocked": "Progression to the next market-entry commitment."
        },
        {
          "source_type": "law_firm_opinion",
          "evidence_needed": "Written recommendation on branch, representative office, LLP, distributor, importer, or dealer structure.",
          "why_it_matters": "The legal form affects sales, import, service, tax, contracting, and liability.",
          "owner": "Kazakhstan legal counsel",
          "next_action": "Request a short legal-structure memo.",
          "decision_blocked": "Signature or entity setup."
        },
        {
          "source_type": "counterparty_registry_extract",
          "evidence_needed": "Current registry extract for the partner and any local counterparty (status, directors, address).",
          "why_it_matters": "A live registry extract confirms the counterparty exists and who can bind it before any contract.",
          "owner": "Legal counsel",
          "next_action": "Pull a fresh registry extract for each named counterparty.",
          "decision_blocked": "Partner appointment and signature."
        },
        {
          "source_type": "beneficial_ownership_source",
          "evidence_needed": "Beneficial-ownership record showing who ultimately owns and controls the counterparty.",
          "why_it_matters": "Ownership drives integrity, sanctions, and conflict exposure; an unknown UBO is an unmanaged risk.",
          "owner": "Compliance / legal counsel",
          "next_action": "Obtain a UBO declaration or registry source for each counterparty.",
          "decision_blocked": "Partner appointment and signature."
        },
        {
          "source_type": "counterparty_integrity_due_diligence",
          "evidence_needed": "Integrity / anti-corruption due diligence on the distributor, agents, and any government-facing intermediaries (ownership, embedded officials, adverse media, sanctions and PEP screening).",
          "why_it_matters": "Under FCPA / UK Bribery Act the foreign parent can be liable for an intermediary's conduct; engaging a partner who touches customs, certification, or akimat without integrity DD is an unmanaged exposure.",
          "owner": "Compliance / legal counsel",
          "next_action": "Run integrity DD before appointing or contracting any local partner or agent.",
          "decision_blocked": "Partner appointment and signature."
        },
        {
          "source_type": "bank_account_and_kyc_onboarding",
          "evidence_needed": "Bank-account opening readiness: full UBO pack (apostilled), source-of-funds and expected-turnover statement, and the presence / timeline the chosen bank requires.",
          "why_it_matters": "Account opening for a foreign-owned entity is document-heavy and slow; until it clears, the entity cannot pay suppliers or receive revenue.",
          "owner": "Finance lead",
          "next_action": "Confirm the bank's KYC checklist and start onboarding in parallel with entity setup.",
          "decision_blocked": "Supplier payment and revenue collection."
        },
        {
          "source_type": "business_substance_evidence",
          "evidence_needed": "Evidence the entry vehicle has real substance (office, staff, local decision-making) appropriate to the chosen model.",
          "why_it_matters": "Thin substance undermines tax treatment, banking onboarding, and counterparty trust.",
          "owner": "Operations lead",
          "next_action": "Document the planned substance for the chosen entry model.",
          "decision_blocked": "Entity model choice and signature."
        },
        {
          "source_type": "authority_to_sign_evidence",
          "evidence_needed": "Evidence that the individual signing for each counterparty has authority to bind it.",
          "why_it_matters": "A contract signed without authority is unenforceable and a fraud vector.",
          "owner": "Legal counsel",
          "next_action": "Collect powers of attorney or board authorizations for the signatories.",
          "decision_blocked": "Signature."
        },
        {
          "source_type": "contract_or_term_sheet_draft",
          "evidence_needed": "Draft contract or term sheet covering scope, pricing, territory, exclusivity, term, and exit.",
          "why_it_matters": "Commercial terms must be on paper before signature so they can be reviewed and negotiated.",
          "owner": "Commercial lead / legal counsel",
          "next_action": "Produce a term sheet or draft contract for review.",
          "decision_blocked": "Signature."
        },
        {
          "source_type": "tax_accounting_note",
          "evidence_needed": "Note on VAT, corporate tax, withholding, and accounting treatment for the chosen entry model.",
          "why_it_matters": "Tax and accounting treatment change the real cost and reporting load of the entry model.",
          "owner": "Tax advisor",
          "next_action": "Request a tax and accounting memo for each candidate entry model.",
          "decision_blocked": "Entity model choice and signature."
        },
        {
          "source_type": "permanent_establishment_or_tax_residency_assessment",
          "evidence_needed": "Assessment of whether the chosen entry model (branch, representative office, LLP, or direct contracting) creates a taxable permanent establishment or resident status.",
          "why_it_matters": "Permanent-establishment and residency treatment drive tax registration, reporting load, and the real cost of the entry model.",
          "owner": "Tax advisor",
          "next_action": "Request a permanent-establishment and tax-residency memo for each candidate entry model.",
          "decision_blocked": "Entity model choice and signature."
        },
        {
          "source_type": "currency_control_and_repatriation_note",
          "evidence_needed": "Note on currency-contract registration (mandatory at the USD 50,000 threshold for legal entities under the 2026 currency-control rules), repatriation reporting, and how supplier payments, intercompany flows, and profit repatriation will clear local banks.",
          "why_it_matters": "Under the 2026 currency-control regime local banks can delay or refuse cross-border intercompany transfers (capital, shareholder loans, royalties, management fees) that lack demonstrable economic substance, so substance evidence affects how, and how quickly, money moves after commitment.",
          "owner": "Treasury / banking advisor",
          "next_action": "Confirm currency-contract registration at the USD 50,000 threshold and prepare economic-substance evidence for intercompany flows with the servicing bank.",
          "decision_blocked": "Cross-border payment, intercompany-flow, and profit-repatriation planning."
        },
        {
          "source_type": "work_permit_and_local_employment_quota_note",
          "evidence_needed": "Note on work-permit requirements and local-employment ratio / quota obligations for the planned expatriate and local headcount.",
          "why_it_matters": "Foreign-worker quotas and local-employment ratios constrain who can be deployed and when.",
          "owner": "HR / legal counsel",
          "next_action": "Confirm work-permit and local-employment quota requirements for the staffing plan.",
          "decision_blocked": "Staffing and entity operation."
        }
      ],
      "claim_audit": [
        {
          "claim": "The project can move into controlled validation.",
          "status": "needs_professional_confirmation",
          "how_to_use_now": "Do not rely on this yet; close the validation-tier evidence first."
        },
        {
          "claim": "The project is ready for launch commitment.",
          "status": "unsupported",
          "how_to_use_now": "Do not use. Replace with the current readiness label until the evidence gaps are closed."
        }
      ],
      "owner_actions": [
        {
          "timeframe": "48_hours",
          "owner": "Project lead",
          "action": "Send the missing-evidence request to the partner and named advisors.",
          "output": "Evidence-request pack and missing-document checklist."
        },
        {
          "timeframe": "7_days",
          "owner": "Project lead",
          "action": "Collect the legal, tax, banking, customs, certification, and operational inputs the gate flagged.",
          "output": "Gate evidence pack."
        },
        {
          "timeframe": "30_days",
          "owner": "Project lead",
          "action": "Convert the validation evidence into a committee-ready entry decision memo.",
          "output": "Committee-ready gate memo."
        }
      ],
      "watch_next": [
        "partner commitment change",
        "bank KYC or account-opening tightening for foreign-owned entities",
        "tax or VAT treatment change",
        "currency-control or profit-repatriation rule change",
        "anti-corruption enforcement or third-party due-diligence expectation change",
        "government or regulator signal"
      ],
      "boundary_notice": "Internal evidence triage only. Not legal, compliance, customs, tax, financial, investment, insurance, sanctions, or launch-authorization advice.",
      "strongest_reason_to_proceed": "The Kazakhstan use case and commercial objective are specific enough to start advisor requests, quote collection, and partner validation.",
      "strongest_reason_to_pause": "The current evidence pack is not sufficient for signature, import, lease, first-batch order, advertising spend, or partner appointment.",
      "management_note": "The opportunity can move at the level of its readiness label, but should not move to launch commitment until the flagged legal, customs, certification, landed-cost, service, lease, and partner evidence gaps are closed.",
      "readiness_contract": {
        "profile": "kazakhstan_market_entry_readiness",
        "status": "concept_ready",
        "score": null,
        "routing": {
          "field": "gate_decision",
          "value": "pause_for_evidence"
        },
        "signal": null,
        "blocking_gaps": [
          {
            "source_type": "partner_company_profile",
            "evidence_needed": "Supply the partner company profile for this market-entry file.",
            "why_it_matters": "The partner company profile is a required gate input that is not yet in the evidence pack.",
            "owner": "Project lead",
            "next_action": "Request or produce the partner company profile.",
            "decision_blocked": "Progression to the next market-entry commitment."
          },
          {
            "source_type": "product_or_project_description",
            "evidence_needed": "Supply the product or project description for this market-entry file.",
            "why_it_matters": "The product or project description is a required gate input that is not yet in the evidence pack.",
            "owner": "Project lead",
            "next_action": "Request or produce the product or project description.",
            "decision_blocked": "Progression to the next market-entry commitment."
          },
          {
            "source_type": "commercial_objective",
            "evidence_needed": "Supply the commercial objective for this market-entry file.",
            "why_it_matters": "The commercial objective is a required gate input that is not yet in the evidence pack.",
            "owner": "Project lead",
            "next_action": "Request or produce the commercial objective.",
            "decision_blocked": "Progression to the next market-entry commitment."
          },
          {
            "source_type": "law_firm_opinion",
            "evidence_needed": "Written recommendation on branch, representative office, LLP, distributor, importer, or dealer structure.",
            "why_it_matters": "The legal form affects sales, import, service, tax, contracting, and liability.",
            "owner": "Kazakhstan legal counsel",
            "next_action": "Request a short legal-structure memo.",
            "decision_blocked": "Signature or entity setup."
          },
          {
            "source_type": "counterparty_registry_extract",
            "evidence_needed": "Current registry extract for the partner and any local counterparty (status, directors, address).",
            "why_it_matters": "A live registry extract confirms the counterparty exists and who can bind it before any contract.",
            "owner": "Legal counsel",
            "next_action": "Pull a fresh registry extract for each named counterparty.",
            "decision_blocked": "Partner appointment and signature."
          },
          {
            "source_type": "beneficial_ownership_source",
            "evidence_needed": "Beneficial-ownership record showing who ultimately owns and controls the counterparty.",
            "why_it_matters": "Ownership drives integrity, sanctions, and conflict exposure; an unknown UBO is an unmanaged risk.",
            "owner": "Compliance / legal counsel",
            "next_action": "Obtain a UBO declaration or registry source for each counterparty.",
            "decision_blocked": "Partner appointment and signature."
          },
          {
            "source_type": "counterparty_integrity_due_diligence",
            "evidence_needed": "Integrity / anti-corruption due diligence on the distributor, agents, and any government-facing intermediaries (ownership, embedded officials, adverse media, sanctions and PEP screening).",
            "why_it_matters": "Under FCPA / UK Bribery Act the foreign parent can be liable for an intermediary's conduct; engaging a partner who touches customs, certification, or akimat without integrity DD is an unmanaged exposure.",
            "owner": "Compliance / legal counsel",
            "next_action": "Run integrity DD before appointing or contracting any local partner or agent.",
            "decision_blocked": "Partner appointment and signature."
          },
          {
            "source_type": "bank_account_and_kyc_onboarding",
            "evidence_needed": "Bank-account opening readiness: full UBO pack (apostilled), source-of-funds and expected-turnover statement, and the presence / timeline the chosen bank requires.",
            "why_it_matters": "Account opening for a foreign-owned entity is document-heavy and slow; until it clears, the entity cannot pay suppliers or receive revenue.",
            "owner": "Finance lead",
            "next_action": "Confirm the bank's KYC checklist and start onboarding in parallel with entity setup.",
            "decision_blocked": "Supplier payment and revenue collection."
          },
          {
            "source_type": "business_substance_evidence",
            "evidence_needed": "Evidence the entry vehicle has real substance (office, staff, local decision-making) appropriate to the chosen model.",
            "why_it_matters": "Thin substance undermines tax treatment, banking onboarding, and counterparty trust.",
            "owner": "Operations lead",
            "next_action": "Document the planned substance for the chosen entry model.",
            "decision_blocked": "Entity model choice and signature."
          },
          {
            "source_type": "authority_to_sign_evidence",
            "evidence_needed": "Evidence that the individual signing for each counterparty has authority to bind it.",
            "why_it_matters": "A contract signed without authority is unenforceable and a fraud vector.",
            "owner": "Legal counsel",
            "next_action": "Collect powers of attorney or board authorizations for the signatories.",
            "decision_blocked": "Signature."
          },
          {
            "source_type": "contract_or_term_sheet_draft",
            "evidence_needed": "Draft contract or term sheet covering scope, pricing, territory, exclusivity, term, and exit.",
            "why_it_matters": "Commercial terms must be on paper before signature so they can be reviewed and negotiated.",
            "owner": "Commercial lead / legal counsel",
            "next_action": "Produce a term sheet or draft contract for review.",
            "decision_blocked": "Signature."
          },
          {
            "source_type": "tax_accounting_note",
            "evidence_needed": "Note on VAT, corporate tax, withholding, and accounting treatment for the chosen entry model.",
            "why_it_matters": "Tax and accounting treatment change the real cost and reporting load of the entry model.",
            "owner": "Tax advisor",
            "next_action": "Request a tax and accounting memo for each candidate entry model.",
            "decision_blocked": "Entity model choice and signature."
          },
          {
            "source_type": "permanent_establishment_or_tax_residency_assessment",
            "evidence_needed": "Assessment of whether the chosen entry model (branch, representative office, LLP, or direct contracting) creates a taxable permanent establishment or resident status.",
            "why_it_matters": "Permanent-establishment and residency treatment drive tax registration, reporting load, and the real cost of the entry model.",
            "owner": "Tax advisor",
            "next_action": "Request a permanent-establishment and tax-residency memo for each candidate entry model.",
            "decision_blocked": "Entity model choice and signature."
          },
          {
            "source_type": "currency_control_and_repatriation_note",
            "evidence_needed": "Note on currency-contract registration (mandatory at the USD 50,000 threshold for legal entities under the 2026 currency-control rules), repatriation reporting, and how supplier payments, intercompany flows, and profit repatriation will clear local banks.",
            "why_it_matters": "Under the 2026 currency-control regime local banks can delay or refuse cross-border intercompany transfers (capital, shareholder loans, royalties, management fees) that lack demonstrable economic substance, so substance evidence affects how, and how quickly, money moves after commitment.",
            "owner": "Treasury / banking advisor",
            "next_action": "Confirm currency-contract registration at the USD 50,000 threshold and prepare economic-substance evidence for intercompany flows with the servicing bank.",
            "decision_blocked": "Cross-border payment, intercompany-flow, and profit-repatriation planning."
          },
          {
            "source_type": "work_permit_and_local_employment_quota_note",
            "evidence_needed": "Note on work-permit requirements and local-employment ratio / quota obligations for the planned expatriate and local headcount.",
            "why_it_matters": "Foreign-worker quotas and local-employment ratios constrain who can be deployed and when.",
            "owner": "HR / legal counsel",
            "next_action": "Confirm work-permit and local-employment quota requirements for the staffing plan.",
            "decision_blocked": "Staffing and entity operation."
          }
        ],
        "non_blocking_gaps": [],
        "claim_audit": [
          {
            "claim": "The project can move into controlled validation.",
            "status": "needs_professional_confirmation",
            "how_to_use_now": "Do not rely on this yet; close the validation-tier evidence first."
          },
          {
            "claim": "The project is ready for launch commitment.",
            "status": "unsupported",
            "how_to_use_now": "Do not use. Replace with the current readiness label until the evidence gaps are closed."
          }
        ],
        "owner_actions": [
          {
            "timeframe": "48_hours",
            "owner": "Project lead",
            "action": "Send the missing-evidence request to the partner and named advisors.",
            "output": "Evidence-request pack and missing-document checklist."
          },
          {
            "timeframe": "7_days",
            "owner": "Project lead",
            "action": "Collect the legal, tax, banking, customs, certification, and operational inputs the gate flagged.",
            "output": "Gate evidence pack."
          },
          {
            "timeframe": "30_days",
            "owner": "Project lead",
            "action": "Convert the validation evidence into a committee-ready entry decision memo.",
            "output": "Committee-ready gate memo."
          }
        ],
        "watch_next": [
          "partner commitment change",
          "bank KYC or account-opening tightening for foreign-owned entities",
          "tax or VAT treatment change",
          "currency-control or profit-repatriation rule change",
          "anti-corruption enforcement or third-party due-diligence expectation change",
          "government or regulator signal"
        ],
        "human_review_required": true,
        "boundary_notice": "Internal evidence triage only. Not legal, compliance, customs, tax, financial, investment, insurance, sanctions, or launch-authorization advice."
      }
    }
  },
  "critical_minerals_due_diligence": {
    "kind": "precomputed_synthetic_fixture",
    "tool": "critical_minerals_due_diligence",
    "request": {
      "project_name": "Example spodumene offtake",
      "commodity": "lithium",
      "origin_jurisdiction": "KZ",
      "processing_jurisdiction": "CN",
      "target_market": "eu",
      "decision_question": "Is this offtake ready for a pre-signature human review?",
      "decision_stage": "pre_offtake_agreement",
      "supplied_sources": [
        {
          "source_type": "mining_concession_or_license_extract",
          "title": "Concession extract",
          "date": "2026-08-01"
        },
        {
          "source_type": "certified_ore_assay_report",
          "title": "Certified assay",
          "date": "2026-08-02"
        }
      ]
    },
    "response": {
      "triage_recommendation": "escalate_before_offtake",
      "risk_signal": "high",
      "decision_readiness_score": 33,
      "decision_readiness_label": "not_decision_ready",
      "operational_decision": {
        "decision": "request_evidence",
        "reason_code": "critical_evidence_gaps",
        "blocking_gaps": [
          "Missing required source: beneficial ownership due diligence",
          "Missing required source: export quota and permit clearance",
          "Missing required source: csddd human rights and esg audit",
          "Missing required source: processing and refining tolling agreement"
        ],
        "next_permitted_action": "ACTION CHECKLIST BEFORE OFFTAKE: (1) Require authenticated assay and mining concession extract; (2) Enforce dual-control committee sign-off (4-eyes quorum); (3) Screen direct and indirect shareholders under OFAC 50% Rule."
      },
      "commodity": "lithium",
      "origin_jurisdiction": "KZ",
      "traceability_status": "verified",
      "export_control_exposure": {
        "quota_restricted": false,
        "processing_monopoly_risk": false,
        "jurisdiction_risk_flags": []
      },
      "supplied_sources": [
        "mining_concession_or_license_extract",
        "certified_ore_assay_report"
      ],
      "minimum_sources_before_go": [
        "beneficial_ownership_due_diligence",
        "export_quota_and_permit_clearance",
        "csddd_human_rights_and_esg_audit",
        "processing_and_refining_tolling_agreement"
      ],
      "evidence_gaps": [
        "Missing required source: beneficial ownership due diligence",
        "Missing required source: export quota and permit clearance",
        "Missing required source: csddd human rights and esg audit",
        "Missing required source: processing and refining tolling agreement"
      ],
      "top_risks": [
        {
          "category": "Supply Chain & Origin Traceability",
          "severity": "low",
          "description": "Traceability status is verified for lithium originating from KZ."
        }
      ],
      "exposure_layers": [
        {
          "layer": "Origin Concession & Mining Rights",
          "level": "verified",
          "summary": "Mining concession / license extract status in source ledger."
        },
        {
          "layer": "Processing & Beneficiation Route",
          "level": "gap",
          "summary": "Refining, smelter, and tolling contract agreements."
        },
        {
          "layer": "ESG & CSDDD Compliance",
          "level": "gap",
          "summary": "Human rights, environmental, and tailings due diligence audit."
        }
      ],
      "watch_next": [
        "EU Critical Raw Materials Act strategic project announcements",
        "Export quota and licensing rule revisions in producing states",
        "OFAC / EU / UK sanctions updates on mining conglomerates",
        "Refinery tolling fee and capacity bottlenecks",
        "CSDDD supply-chain due diligence compliance audits"
      ],
      "human_review_required": true,
      "not_advice_notice": "Pre-compliance evidence triage only on caller-supplied documentation. Does not perform live retrieval, factual-truth verification, mineral assay testing, or provide legal, sanctions, trade-compliance, ESG certification, or investment advice.",
      "run_provenance": {
        "contract_version": "1.14.0",
        "input_digest": "sha256:canonical",
        "schema_uri": "https://github.com/vassiliylakhonin/agenda-intelligence-md/tree/main/schemas/v1/critical-minerals-due-diligence-response.schema.json"
      },
      "processing_jurisdiction": "CN",
      "target_market": "eu",
      "readiness_contract": {
        "profile": "critical_minerals_due_diligence",
        "status": "not_decision_ready",
        "score": 33,
        "routing": {
          "field": "triage_recommendation",
          "value": "escalate_before_offtake"
        },
        "signal": null,
        "blocking_gaps": [
          "Missing required source: beneficial ownership due diligence",
          "Missing required source: export quota and permit clearance",
          "Missing required source: csddd human rights and esg audit",
          "Missing required source: processing and refining tolling agreement"
        ],
        "non_blocking_gaps": [],
        "claim_audit": [],
        "owner_actions": [],
        "watch_next": [
          "EU Critical Raw Materials Act strategic project announcements",
          "Export quota and licensing rule revisions in producing states",
          "OFAC / EU / UK sanctions updates on mining conglomerates",
          "Refinery tolling fee and capacity bottlenecks",
          "CSDDD supply-chain due diligence compliance audits"
        ],
        "human_review_required": true,
        "boundary_notice": "Pre-compliance evidence triage only on caller-supplied documentation. Does not perform live retrieval, factual-truth verification, mineral assay testing, or provide legal, sanctions, trade-compliance, ESG certification, or investment advice."
      }
    }
  },
  "dual_use_technology_export": {
    "kind": "precomputed_synthetic_fixture",
    "tool": "dual_use_technology_export",
    "request": {
      "shipment": {
        "hs_code": "854231",
        "eccn": "3A001",
        "description": "Example integrated circuits",
        "origin": "DE",
        "destination": "KZ",
        "transit_countries": [
          "TR"
        ],
        "end_user_sector": "civilian"
      },
      "dated_sources": [
        {
          "id": "du-1",
          "source_type": "classification_note",
          "title": "Exporter classification note",
          "date": "2026-08-01"
        },
        {
          "id": "du-2",
          "source_type": "end_user_statement",
          "title": "Signed end-user statement",
          "date": "2026-08-02"
        }
      ],
      "risk_question": "Is this file complete enough for export-control human review?"
    },
    "response": {
      "contract_version": "1.14.0",
      "profile": "dual_use_technology_export",
      "export_risk_triage": {
        "status": "ready_for_human_review",
        "score": 69,
        "score_scope": "declared_evidence_structure_only",
        "factual_verification_performed": false,
        "human_review_required": true,
        "not_advice_notice": "Pre-compliance evidence triage only. Not legal, sanctions, compliance, financial, investment, insurance, or trading advice.",
        "evidence_gaps": [
          "Source content, classification, licensing requirements and end-use have not been independently verified."
        ],
        "primary_risk_vectors": [
          "CHPL Status: Tier 1 (Battlefield High Priority) matched (HS 854231). Heightened diversion risk under EU Reg 833/2014 Annex XL, US BIS EAR Common High Priority List, and UK Russia Regulations.",
          "OFAC E.O. 14114 Warning: Secondary sanctions exposure for Foreign Financial Institutions (FFIs) facilitating transactions involving CHPL Tier 1–2 items.",
          "Transit countries are present; human review must assess diversion and re-export controls for each leg."
        ],
        "evidence_ledger": [
          "du-1: classification_note — Exporter classification note (2026-08-01)",
          "du-2: end_user_statement — Signed end-user statement (2026-08-02)",
          "Regulatory Classification: Tier 1 (Battlefield High Priority) — Electronic integrated circuits, microcontrollers, processors, and memories."
        ]
      }
    }
  },
  "corridor_sanctions_assistant": {
    "kind": "precomputed_synthetic_fixture",
    "tool": "corridor_sanctions_assistant",
    "request": {
      "text": "What evidence is needed before shipping industrial equipment from Aktau to Baku?"
    },
    "response": {
      "kind": "orientation_and_routing",
      "selected_route": {
        "name": "Gulf Maritime Exposure Gate",
        "use_when": "a vessel/voyage through the Gulf, Strait of Hormuz, Bab-el-Mandeb, or Red Sea needs sanctions/chokepoint exposure triage",
        "a2a": "https://gulf-maritime-exposure-a2a.vassiliy-lakhonin.workers.dev",
        "profile": "gulf_maritime_exposure"
      },
      "next_gate_input": "Send a structured request to https://gulf-maritime-exposure-a2a.vassiliy-lakhonin.workers.dev/message/send with voyage, vessel, cargo, exposure_facets, dated_sources, risk_question, decision_stage. See the agent-card for a copy-paste envelope.",
      "message": "Corridor & sanctions orientation: routing to the structured gates and person-led work. No triage or screening performed here.",
      "caller_text": "What evidence is needed before shipping industrial equipment from Aktau to Baku?",
      "gates": [
        {
          "name": "Gulf Maritime Exposure Gate",
          "use_when": "a vessel/voyage through the Gulf, Strait of Hormuz, Bab-el-Mandeb, or Red Sea needs sanctions/chokepoint exposure triage",
          "a2a": "https://gulf-maritime-exposure-a2a.vassiliy-lakhonin.workers.dev",
          "profile": "gulf_maritime_exposure"
        }
      ],
      "engagement": {
        "offer": "Person-led review of a current deal or counterparty, scoped and quoted before work starts.",
        "contact_email": "vassiliy.lakhonin@gmail.com",
        "support_hours": "Mon–Fri 09:00–18:00 Asia/Almaty (UTC+5)",
        "next_step": "Email a one-line description (route or counterparty + the next decision or review). Fit, scope, fee, and timing are confirmed before work starts."
      },
      "human_review_required": true,
      "not_advice_notice": "Orientation and routing only. Not legal, compliance, sanctions, financial, investment, or insurance advice, and not an autonomous decision system. The structured gates perform the triage; human review is required before any commercial action."
    }
  },
  "agent_financial_guard": {
    "kind": "precomputed_synthetic_fixture",
    "tool": "agent_financial_pre_sign_check",
    "request": {
      "request": {
        "run_id": "tx-guard-example-001",
        "agent": {
          "id": "procurement-agent-7",
          "model": "claude-3-5-sonnet",
          "operator": "autonomous-finance-corp"
        },
        "transaction": {
          "network": "base_mainnet",
          "token": "USDC",
          "amount_usd": 150,
          "recipient": "0x5b5296a3a7bac0f5f096f93b60c1c121f2e5c663",
          "method": "transfer"
        },
        "policy_limits": {
          "max_single_limit_usd": 500,
          "daily_velocity_limit_usd": 2000,
          "velocity_24h_usd": 350
        },
        "intent": {
          "prompt": "Disburse automated payment for verified API compute consumption.",
          "caller_task_id": "task-compute-bill-99"
        }
      }
    },
    "response": {
      "contract_version": "1.0.0",
      "profile": "agent_financial_guard",
      "financial_guard_verdict": {
        "status": "not_decision_ready",
        "decision": "step_up_human_required",
        "score": 55,
        "checks": {
          "sanctions_aml": false,
          "contract_security": true,
          "velocity_limits": false,
          "prompt_injection": true
        },
        "violations": [],
        "evidence_gaps": [
          "Authoritative wallet spending history and enforced policy are unavailable; caller-reported velocity is unverified.",
          "Current network-specific sanctions/AML screening is unavailable; only a local risk denylist was checked."
        ],
        "vizier_status": "attestation_unavailable",
        "vizier_clearance_receipt": null,
        "x402_challenge": {
          "protocol": "x402",
          "network": "base",
          "chain_id": 8453,
          "asset": "USDC",
          "amount_usdc": 0.05,
          "recipient": "0x5b5296a3a7bac0f5f096f93b60c1c121f2e5c663",
          "contract": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "attestation_type": "payment_confirmation_only",
          "instructions": "Payment confirmation does not authorize signing or provide a security clearance."
        },
        "human_review_required": true,
        "not_advice_notice": "Heuristic pre-sign review only; not transaction authorization or sanctions clearance.",
        "check_scope": {
          "sanctions_aml": "local_denylist_only",
          "velocity_limits": "caller_reported_unverified"
        },
        "execution_advisory": "Human review required before signing: spending history, policy authority, and current sanctions status are unverified."
      }
    }
  },
  "m2m_escrow_arbiter": {
    "kind": "precomputed_synthetic_fixture",
    "tool": "m2m_escrow_arbitration_ruling",
    "request": {
      "request": {
        "escrow_id": "escrow-m2m-sample-001",
        "dispute_claim": {
          "claimant": "buyer",
          "reason": "Contract deliverable dispute"
        },
        "deal_terms": {
          "buyer_id": "did:agent:0x1111111111111111111111111111111111111111",
          "seller_id": "did:agent:0x2222222222222222222222222222222222222222",
          "amount_usd": 500,
          "currency": "USDC",
          "deadline_utc": "2026-09-17T18:00:00Z",
          "arbitration_policy": "pro_rata",
          "arbitration_fee_pct": 1
        },
        "specification": {
          "deliverable_type": "json_data",
          "min_valid_records_pct": 95
        },
        "delivery_submission": {
          "submitted_at": "2026-09-17T12:00:00Z",
          "telemetry": {
            "total_items": 1000,
            "valid_items": 1000,
            "response_time_ms": 320
          }
        }
      }
    },
    "response": {
      "contract_version": "1.1.0",
      "profile": "m2m_escrow_arbiter",
      "arbitration_ruling": {
        "status": "not_decision_ready",
        "ruling": "ESCALATE_HUMAN",
        "score": 0,
        "escrow_id": "escrow-m2m-sample-001",
        "payout_breakdown": {
          "total_escrow_usd": 500,
          "seller_payout_usd": 0,
          "buyer_refund_usd": 0,
          "arbiter_fee_usd": 0
        },
        "checks": {
          "deadline_honored": true,
          "hash_verified": false,
          "schema_verified": false,
          "slo_verified": false
        },
        "check_status": {
          "deadline": "passed",
          "hash": "not_evaluated",
          "schema": "not_evaluated",
          "slo": "not_evaluated"
        },
        "evaluation_scope": "supplied_artifact_only",
        "settlement_authorized": false,
        "violations": [],
        "evidence_gaps": [
          "A valid expected artifact SHA-256 is required.",
          "No expected schema was supplied; schema validation was not performed.",
          "SLO telemetry and submission time are caller-reported; independent delivery evidence requires human review."
        ],
        "vizier_status": "attestation_unavailable",
        "vizier_clearance_receipt": null,
        "human_review_required": true,
        "not_advice_notice": "Evaluation of supplied evidence only; this response does not execute or authorize settlement.",
        "execution_advisory": "Required evidence could not be verified. Hold escrow pending human review; no payout is authorized."
      }
    }
  }
};
