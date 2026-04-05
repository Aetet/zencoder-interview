CREATE TABLE IF NOT EXISTS budget_config (
    id              INTEGER       PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    monthly_budget  NUMERIC(12,2) NOT NULL DEFAULT 6000,
    thresholds      INTEGER[]     NOT NULL DEFAULT '{50,75,90,100}',
    team_overrides  JSONB         NOT NULL DEFAULT '{}'
);
