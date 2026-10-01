-- Shared by every fleet deployment. Replay records deliberately have no TTL.
CREATE TABLE IF NOT EXISTS payment_claims (
  tx_hash TEXT PRIMARY KEY,
  details TEXT NOT NULL,
  claimed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS pro_tokens (
  token_hash TEXT PRIMARY KEY,
  tx_hash TEXT NOT NULL UNIQUE REFERENCES payment_claims(tx_hash),
  details TEXT NOT NULL,
  valid_until_ms INTEGER NOT NULL,
  quota INTEGER NOT NULL CHECK(quota > 0),
  used INTEGER NOT NULL DEFAULT 0 CHECK(used >= 0 AND used <= quota)
);
