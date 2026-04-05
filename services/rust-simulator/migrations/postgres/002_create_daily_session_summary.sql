CREATE TABLE IF NOT EXISTS daily_session_summary (
    date           DATE          NOT NULL,
    team_id        TEXT          NOT NULL,
    model          TEXT          NOT NULL,
    total_sessions INTEGER       NOT NULL,
    completed      INTEGER       NOT NULL,
    errored        INTEGER       NOT NULL,
    cancelled      INTEGER       NOT NULL,
    total_cost     NUMERIC(12,6) NOT NULL,
    active_users   INTEGER       NOT NULL,
    PRIMARY KEY (date, team_id, model)
);
