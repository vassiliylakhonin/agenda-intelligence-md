-- Atomic strict rate limiting for the public capability-request inbox.
-- Counters retain only hashed client buckets and are cleaned on every insert.
CREATE TABLE IF NOT EXISTS capability_request_rate_counters (
  bucket_key TEXT PRIMARY KEY,
  count INTEGER NOT NULL CHECK(count > 0),
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS capability_request_rate_reservations (
  request_id TEXT PRIMARY KEY,
  client_hash TEXT NOT NULL,
  hour_bucket TEXT NOT NULL,
  day_bucket TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TRIGGER IF NOT EXISTS capability_request_rate_reserve
BEFORE INSERT ON capability_request_rate_reservations
BEGIN
  DELETE FROM capability_request_rate_counters WHERE expires_at <= NEW.created_at;
  DELETE FROM capability_request_rate_reservations WHERE created_at <= NEW.created_at - 172800000;
  INSERT INTO capability_request_rate_counters(bucket_key, count, expires_at)
    VALUES ('day:' || NEW.day_bucket, 1, NEW.created_at + 172800000)
    ON CONFLICT(bucket_key) DO UPDATE SET count = count + 1, expires_at = excluded.expires_at
    WHERE count < 100;
  SELECT RAISE(ABORT, 'daily_fleet_cap') WHERE changes() = 0;
  INSERT INTO capability_request_rate_counters(bucket_key, count, expires_at)
    VALUES ('hour:' || NEW.client_hash || ':' || NEW.hour_bucket, 1, NEW.created_at + 172800000)
    ON CONFLICT(bucket_key) DO UPDATE SET count = count + 1, expires_at = excluded.expires_at
    WHERE count < 5;
  SELECT RAISE(ABORT, 'hourly_address_limit') WHERE changes() = 0;
END;
