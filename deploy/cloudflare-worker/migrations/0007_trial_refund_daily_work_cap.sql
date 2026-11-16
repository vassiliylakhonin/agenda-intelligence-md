-- A refund restores the product attempt, never the fleet's hard daily work cap.
ALTER TABLE trial_technical_refunds ADD COLUMN reserved_day TEXT;
UPDATE trial_technical_refunds SET reserved_day = refunded_day WHERE reserved_day IS NULL;
CREATE INDEX IF NOT EXISTS trial_refunds_reserved_day ON trial_technical_refunds(reserved_day);
