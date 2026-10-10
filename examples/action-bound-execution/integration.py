"""Integration recipe; the caller supplies authenticated context and report API.

Requires agenda-intelligence-md[reviews], configured Vizier signing-key registry,
an actual principal-signed grant, and an APPROVED human-review token. No demo
credential can authorize a production action.
"""

import os

from agenda_intelligence.action_gate import GuardedActionExecutor, ReplayStore, VizierPolicyClient
from agenda_intelligence.human_review import HumanReviewClient


def execute_report(request, approval, authenticated_context, report_api):
    policy = VizierPolicyClient(os.environ["VIZIER_ORIGIN"], os.environ["VIZIER_API_KEY"])
    reviews = HumanReviewClient(api_key=os.environ["VIZIER_REVIEW_API_KEY"], origin=os.environ["VIZIER_ORIGIN"])
    gate = GuardedActionExecutor(
        policy.verify,
        reviews,
        ReplayStore(os.environ["ACTION_REPLAY_DB"]),
        authenticated_context,
        audience="report-executor",
    )

    def dispatch(frozen):
        action = frozen["action"]
        if action["type"] != "send_report":
            raise ValueError("This integration supports send_report only")
        # report_api must use these exact authenticated tenant, target and
        # parameters. Never reload mutable request state after approval.
        return report_api.send(target=action["target"], **action["parameters"])

    return gate.execute(request, approval, dispatch)
