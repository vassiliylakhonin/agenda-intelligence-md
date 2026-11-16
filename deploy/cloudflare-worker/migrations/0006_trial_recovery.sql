-- Bounded technical refunds only; retained campaign counters prevent reset abuse.
CREATE TABLE IF NOT EXISTS trial_technical_refunds (
  attempt_id TEXT PRIMARY KEY,
  client_hash TEXT NOT NULL,
  refunded_day TEXT NOT NULL,
  refunded_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS trial_refunds_client ON trial_technical_refunds(client_hash);
CREATE INDEX IF NOT EXISTS trial_refunds_day ON trial_technical_refunds(refunded_day);
-- No plaintext inputs/results or raw IPs. The caller's high-entropy key encrypts
-- the result; the database stores only its hash. Completed keys are tombstones.
CREATE TABLE IF NOT EXISTS trial_result_recovery (
  client_hash TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  attempt_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  response_ciphertext TEXT,
  PRIMARY KEY(client_hash,key_hash)
);
