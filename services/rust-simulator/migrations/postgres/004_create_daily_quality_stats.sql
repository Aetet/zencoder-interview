CREATE TABLE IF NOT EXISTS daily_quality_stats (
    date              DATE    NOT NULL,
    team_id           TEXT    NOT NULL,
    model             TEXT    NOT NULL,
    total_sessions    INTEGER NOT NULL,
    completed         INTEGER NOT NULL,
    tool_calls        INTEGER NOT NULL,
    tool_errors       INTEGER NOT NULL,
    errors_api        INTEGER NOT NULL,
    errors_tool       INTEGER NOT NULL,
    errors_permission INTEGER NOT NULL,
    errors_runtime    INTEGER NOT NULL,
    PRIMARY KEY (date, team_id, model)
);
