-- Add 'type' column to mg_escalation_log for two-stage escalation tracking
-- type = 'operational' (Stage 1: MG team) or 'escalation' (Stage 2: GAGL)

ALTER TABLE mg_escalation_log
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'escalation'
  CHECK (type IN ('operational', 'escalation'));

CREATE INDEX idx_escalation_log_lead_type ON mg_escalation_log(lead_id, type, created_at DESC);
