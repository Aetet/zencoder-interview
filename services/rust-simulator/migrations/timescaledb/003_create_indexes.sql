CREATE INDEX IF NOT EXISTS idx_events_session ON agent_events (session_id, seq);
CREATE INDEX IF NOT EXISTS idx_events_type    ON agent_events (event_type, ts DESC);
