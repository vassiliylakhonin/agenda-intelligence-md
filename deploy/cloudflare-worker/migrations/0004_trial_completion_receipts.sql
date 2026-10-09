-- Completed free work is distinct from payments and from best-effort logs.
-- No inputs, outputs, caller hashes, raw IPs, wallet or client trace IDs.
CREATE TABLE IF NOT EXISTS trial_completion_receipts (
  attempt_id TEXT PRIMARY KEY,
  agent_profile TEXT NOT NULL,
  completed_day TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  origin_group TEXT NOT NULL CHECK (origin_group IN ('excluded', 'external_candidate', 'unknown_origin'))
);
CREATE INDEX IF NOT EXISTS trial_completion_receipts_day_profile
  ON trial_completion_receipts(completed_day, agent_profile, origin_group);
-- Mark coverage only after every existing Worker has the receipt writer.
CREATE TABLE IF NOT EXISTS trial_receipt_coverage (
  id TEXT PRIMARY KEY CHECK (id = 'fleet'),
  complete_from TEXT
);
INSERT OR IGNORE INTO trial_receipt_coverage(id, complete_from) VALUES ('fleet', NULL);
