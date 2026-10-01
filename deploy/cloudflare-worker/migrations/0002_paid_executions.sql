-- One exact signed request per payment; responses are recoverable for 24 hours.
CREATE TABLE IF NOT EXISTS paid_executions (
  tx_hash TEXT PRIMARY KEY REFERENCES payment_claims(tx_hash),
  request_hash TEXT NOT NULL,
  payer TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('ready', 'running', 'completed')),
  lease_nonce TEXT,
  lease_until_ms INTEGER NOT NULL DEFAULT 0,
  response_ciphertext TEXT,
  response_expires_ms INTEGER,
  created_ms INTEGER NOT NULL
);
