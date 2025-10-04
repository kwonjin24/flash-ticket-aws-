-- Creates database role and database for Flash Tickets service
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'flash_tickets_app') THEN
        CREATE ROLE flash_tickets_app LOGIN PASSWORD 'flash_tickets_app';
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_database WHERE datname = 'flash_tickets') THEN
        CREATE DATABASE flash_tickets OWNER flash_tickets_app;
    END IF;
END
$$;

GRANT ALL PRIVILEGES ON DATABASE flash_tickets TO flash_tickets_app;
