-- Run this after connecting to the flash_tickets database
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE user_role AS ENUM ('USER', 'ADMIN');
CREATE TYPE event_status AS ENUM ('DRAFT', 'ONSALE', 'CLOSED');
CREATE TYPE order_status AS ENUM ('HOLD', 'PAID', 'CANCELLED', 'EXPIRED');

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'USER',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    total_qty INTEGER NOT NULL,
    sold_qty INTEGER NOT NULL DEFAULT 0,
    max_per_user INTEGER NOT NULL,
    price INTEGER NOT NULL,
    status event_status NOT NULL DEFAULT 'DRAFT',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    qty INTEGER NOT NULL CHECK (qty > 0),
    status order_status NOT NULL,
    amount INTEGER NOT NULL,
    idem_key TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_event_status ON orders(event_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_user_event ON orders(user_id, event_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idem_key_unique ON orders(idem_key) WHERE idem_key IS NOT NULL;

GRANT USAGE ON SCHEMA public TO flash_tickets_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO flash_tickets_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO flash_tickets_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO flash_tickets_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO flash_tickets_app;
