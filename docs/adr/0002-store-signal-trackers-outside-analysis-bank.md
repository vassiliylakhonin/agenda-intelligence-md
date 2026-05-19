# Store signal trackers outside AnalysisBank

Signal tracker JSON files live under `signal-trackers/`, while `analysis-bank/` is reserved for reusable reasoning memories. Trackers contain dated state about specific monitored situations and can go stale; memory cards capture transferable lessons after a signal resolves, so separating the two prevents agents from treating factual state as durable reasoning guidance.
