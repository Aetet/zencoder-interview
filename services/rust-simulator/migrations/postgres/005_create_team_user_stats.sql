CREATE TABLE IF NOT EXISTS team_user_stats (
    user_id     TEXT          NOT NULL,
    team_id     TEXT          NOT NULL,
    date        DATE          NOT NULL,
    sessions    INTEGER       NOT NULL,
    cost        NUMERIC(12,6) NOT NULL,
    completed   INTEGER       NOT NULL,
    last_active TIMESTAMPTZ   NOT NULL,
    PRIMARY KEY (user_id, date)
);
