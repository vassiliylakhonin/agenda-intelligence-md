# Factual verification is a post-v1 layer

Agenda Intelligence MD deliberately keeps factual verification outside the shipped v1.0 contract: current tools validate structure, source discipline, claim traceability, quote presence, and score gates, but they do not decide whether a claim is true in the world. If stronger claim assessment is added after v1.0, it should be modeled as a separate factual verification layer with a future Claim Verdict contract, not by overloading `support_status`, `support_level`, `score`, `bench`, or `verify-quotes`.
