-- Reservations are independent of payments. Never store request text or raw IPs.
CREATE TABLE IF NOT EXISTS output_verification_trials (
  reservation_id TEXT PRIMARY KEY,
  client_hash TEXT NOT NULL,
  reserved_day TEXT NOT NULL,
  reserved_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS output_verification_trials_client
  ON output_verification_trials(client_hash);
CREATE INDEX IF NOT EXISTS output_verification_trials_day
  ON output_verification_trials(reserved_day);
