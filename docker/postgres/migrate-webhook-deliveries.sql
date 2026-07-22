-- Delivery tracking for existing databases.
-- success: NULL = pending, true = succeeded, false = failed after all retries

CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id BIGSERIAL PRIMARY KEY,
    webhook_id BIGINT REFERENCES webhooks (id) ON DELETE SET NULL,
    event TEXT NOT NULL,
    method http_method NOT NULL,
    target_url TEXT NOT NULL,
    success BOOLEAN,
    http_status INTEGER,
    error_message TEXT,
    attempt INTEGER NOT NULL DEFAULT 0,
    bullmq_job_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE webhook_deliveries
    ALTER COLUMN success DROP NOT NULL;

ALTER TABLE webhook_deliveries
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS webhook_deliveries_webhook_id_idx
    ON webhook_deliveries (webhook_id);

CREATE INDEX IF NOT EXISTS webhook_deliveries_created_at_idx
    ON webhook_deliveries (created_at DESC);
