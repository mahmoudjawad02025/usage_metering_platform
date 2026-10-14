CREATE TABLE plans (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        UUID,
  scope             TEXT NOT NULL CHECK (scope IN ('account', 'user')),
  name              TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
  monthly_allowance INTEGER NOT NULL CHECK (monthly_allowance BETWEEN 0 AND 1000000000),
  max_per_request   INTEGER NOT NULL CHECK (max_per_request BETWEEN 1 AND 1000000000),
  is_predefined     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT plans_owner_matches_predefined CHECK (
    (is_predefined AND account_id IS NULL) OR (NOT is_predefined AND account_id IS NOT NULL)
  ),
  CONSTRAINT plans_unique_name_per_owner_and_scope
    UNIQUE NULLS NOT DISTINCT (account_id, scope, name)
);

CREATE TABLE accounts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 200),
  api_key_hash TEXT NOT NULL UNIQUE,
  plan_id      UUID NOT NULL REFERENCES plans (id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE plans
  ADD CONSTRAINT plans_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES accounts (id);

CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID NOT NULL REFERENCES accounts (id),
  external_id TEXT NOT NULL CHECK (char_length(external_id) BETWEEN 1 AND 255),
  plan_id     UUID NOT NULL REFERENCES plans (id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_unique_external_id_per_account UNIQUE (account_id, external_id),
  CONSTRAINT users_id_account_id_unique UNIQUE (id, account_id) -- this foreign key constraint for usage table
);

CREATE INDEX plans_account_id_idx ON plans (account_id);