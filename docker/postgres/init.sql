CREATE TABLE IF NOT EXISTS urls (
    id BIGSERIAL PRIMARY KEY,
    long_url TEXT NOT NULL,
    short_url VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT urls_long_url_unique UNIQUE (long_url),
    CONSTRAINT urls_short_url_unique UNIQUE (short_url)
);

CREATE INDEX IF NOT EXISTS urls_short_url_idx ON urls (short_url);

DO $$ BEGIN
    ALTER TABLE urls ADD CONSTRAINT urls_long_url_unique UNIQUE (long_url);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE urls ALTER COLUMN short_url DROP NOT NULL;

CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(32) NOT NULL
);

DO $$ BEGIN
    CREATE TYPE http_method AS ENUM ('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS webhooks (
    id BIGSERIAL PRIMARY KEY,
    url TEXT NOT NULL,
    methods http_method[] NOT NULL
);

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

CREATE INDEX IF NOT EXISTS webhook_deliveries_webhook_id_idx
    ON webhook_deliveries (webhook_id);

CREATE INDEX IF NOT EXISTS webhook_deliveries_created_at_idx
    ON webhook_deliveries (created_at DESC);
