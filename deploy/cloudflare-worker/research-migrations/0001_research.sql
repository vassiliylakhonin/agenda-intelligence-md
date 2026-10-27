CREATE TABLE IF NOT EXISTS research_jobs (
  id TEXT PRIMARY KEY,
  owner_hash TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  request_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  created_ms INTEGER NOT NULL,
  updated_ms INTEGER NOT NULL,
  expires_ms INTEGER NOT NULL,
  source_expires_ms INTEGER,
  sources_json TEXT,
  retrieval_failures_json TEXT,
  result_json TEXT,
  error_code TEXT,
  model_started_ms INTEGER,
  model_output_json TEXT
);
CREATE INDEX IF NOT EXISTS research_jobs_admission ON research_jobs(created_ms, owner_hash);
CREATE INDEX IF NOT EXISTS research_jobs_expiry ON research_jobs(expires_ms);
