CREATE TABLE IF NOT EXISTS daily_token_stats (
    date           DATE          NOT NULL,
    team_id        TEXT          NOT NULL,
    model          TEXT          NOT NULL,
    input_tokens   BIGINT        NOT NULL,
    output_tokens  BIGINT        NOT NULL,
    cache_creation BIGINT        NOT NULL,
    cache_read     BIGINT        NOT NULL,
    total_cost     NUMERIC(12,6) NOT NULL,
    PRIMARY KEY (date, team_id, model)
);
