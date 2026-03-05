-- Migration: Create mg_escalation_log table for tracking WhatsApp escalation notifications
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS mg_escalation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES mg_leads(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'email', 'sms')),
  to_phone text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'delivered')),
  provider_message_id text,
  error_detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_escalation_log_lead_id ON mg_escalation_log(lead_id);
CREATE INDEX idx_escalation_log_created_at ON mg_escalation_log(created_at DESC);
CREATE INDEX idx_escalation_log_lead_status ON mg_escalation_log(lead_id, status, created_at DESC);

ALTER TABLE mg_escalation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on mg_escalation_log"
  ON mg_escalation_log
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Cron scheduling (requires pg_cron extension enabled in Supabase Dashboard > Extensions)
-- Run this AFTER deploying the edge function:
--
-- SELECT cron.schedule(
--   'escalate-leads-check',
--   '*/5 * * * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://ezmgjlycatimjyyyjwmd.supabase.co/functions/v1/escalate-leads',
--     headers := jsonb_build_object(
--       'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
--       'Content-Type', 'application/json'
--     ),
--     body := '{}'::jsonb
--   );
--   $$
-- );
