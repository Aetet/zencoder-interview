CREATE TABLE IF NOT EXISTS alerts_log (
    id          TEXT PRIMARY KEY,
    type        TEXT        NOT NULL,
    severity    TEXT        NOT NULL,
    title       TEXT        NOT NULL,
    description TEXT        NOT NULL,
    team_id     TEXT,
    ts          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
