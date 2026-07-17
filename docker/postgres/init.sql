CREATE TABLE IF NOT EXISTS urls (
    id BIGSERIAL PRIMARY KEY,
    long_url TEXT NOT NULL,
    short_url VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT urls_short_url_unique UNIQUE (short_url)
);

CREATE INDEX IF NOT EXISTS urls_short_url_idx ON urls (short_url);
