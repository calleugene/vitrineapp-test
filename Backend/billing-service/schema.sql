CREATE TABLE IF NOT EXISTS billing_orders (
    id uuid PRIMARY KEY,
    museum_id text NOT NULL,
    user_id text NOT NULL,
    plan_id text NOT NULL,
    months integer NOT NULL CHECK (months IN (1, 12)),
    amount_kopecks bigint NOT NULL CHECK (amount_kopecks > 0),
    request_id uuid NOT NULL,
    terms_version text NOT NULL,
    merchant_id text NOT NULL,
    customer_code text NOT NULL,
    status text NOT NULL CHECK (status IN ('creating', 'pending', 'paid', 'expired', 'failed', 'refunded')),
    bank_status text NOT NULL DEFAULT '',
    operation_id text UNIQUE,
    checkout_url text NOT NULL DEFAULT '',
    issue text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    next_check_at timestamptz NOT NULL DEFAULT now(),
    paid_at timestamptz,
    UNIQUE (museum_id, request_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS billing_one_open_order_per_museum
    ON billing_orders (museum_id) WHERE status IN ('creating', 'pending');
CREATE INDEX IF NOT EXISTS billing_orders_museum_history ON billing_orders (museum_id, created_at DESC);
CREATE INDEX IF NOT EXISTS billing_orders_checks ON billing_orders (next_check_at)
    WHERE status IN ('pending', 'paid') AND operation_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS billing_checkout_requests (
    museum_id text NOT NULL,
    request_id uuid NOT NULL,
    order_id uuid NOT NULL REFERENCES billing_orders(id),
    PRIMARY KEY (museum_id, request_id)
);

CREATE TABLE IF NOT EXISTS billing_subscriptions (
    museum_id text PRIMARY KEY,
    ends_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS billing_grants (
    order_id uuid PRIMARY KEY REFERENCES billing_orders(id),
    museum_id text NOT NULL,
    starts_at timestamptz NOT NULL,
    ends_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS billing_audit (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id uuid NOT NULL REFERENCES billing_orders(id),
    actor_id text NOT NULL,
    action text NOT NULL,
    note text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS billing_audit_order_history ON billing_audit (order_id, id DESC);
