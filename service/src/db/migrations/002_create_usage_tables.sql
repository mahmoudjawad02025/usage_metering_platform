CREATE TABLE account_usage (
  account_id UUID NOT NULL REFERENCES accounts (id),
  period     DATE NOT NULL CHECK (EXTRACT(DAY FROM period) = 1),
  consumed   INTEGER NOT NULL DEFAULT 0 CHECK (consumed >= 0),
  PRIMARY KEY (account_id, period)
);

CREATE TABLE user_usage (
  user_id  UUID NOT NULL REFERENCES users (id),
  period   DATE NOT NULL CHECK (EXTRACT(DAY FROM period) = 1),
  consumed INTEGER NOT NULL DEFAULT 0 CHECK (consumed >= 0),
  PRIMARY KEY (user_id, period)
);

CREATE TABLE usage_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID NOT NULL REFERENCES accounts (id),
  user_id         UUID NOT NULL,
  request_id      TEXT NOT NULL CHECK (char_length(request_id) BETWEEN 1 AND 128),
  units           INTEGER NOT NULL CHECK (units > 0),
  period          DATE NOT NULL CHECK (EXTRACT(DAY FROM period) = 1),
  accepted        BOOLEAN NOT NULL,
  rejected_rule   TEXT CHECK (rejected_rule IN ('max_per_request', 'monthly_allowance')),
  rejected_level  TEXT CHECK (rejected_level IN ('account', 'user')),
  account_plan_id UUID NOT NULL REFERENCES plans (id),
  user_plan_id    UUID NOT NULL REFERENCES plans (id),
  applied_limits  JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT usage_requests_unique_request_per_account UNIQUE (account_id, request_id),
  CONSTRAINT usage_requests_user_belongs_to_account
    FOREIGN KEY (user_id, account_id) REFERENCES users (id, account_id), -- user_id alone not enough, we must ensure it belong to the account
  CONSTRAINT usage_requests_rejection_is_consistent CHECK (
    (accepted AND rejected_rule IS NULL AND rejected_level IS NULL)
    OR (NOT accepted AND rejected_rule IS NOT NULL AND rejected_level IS NOT NULL)
  )
);

CREATE INDEX usage_requests_history_idx
  ON usage_requests (account_id, created_at DESC, id DESC);