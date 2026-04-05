CREATE TABLE IF NOT EXISTS agent_events (
    session_id  TEXT        NOT NULL,
    seq         INTEGER     NOT NULL,
    event_type  TEXT        NOT NULL,
    payload     JSONB       NOT NULL,
    ts          TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (session_id, seq, ts)
);

SELECT create_hypertable('agent_events', 'ts', if_not_exists => TRUE);
