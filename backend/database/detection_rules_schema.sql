-- Additive Supabase/PostgreSQL patch for Ghost Flow and Unauthorized Bed Detection.
-- Safe to run more than once. Existing telemetry and alerts remain valid.

ALTER TABLE IF EXISTS public.telemetry_logs
  ADD COLUMN IF NOT EXISTS breathing_variance NUMERIC(12,6),
  ADD COLUMN IF NOT EXISTS emr_status VARCHAR(50);

ALTER TABLE IF EXISTS public.alerts
  ADD COLUMN IF NOT EXISTS recommended_action VARCHAR(255);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'telemetry_logs_breathing_variance_check'
      AND conrelid = 'public.telemetry_logs'::regclass
  ) THEN
    ALTER TABLE public.telemetry_logs
      ADD CONSTRAINT telemetry_logs_breathing_variance_check
      CHECK (breathing_variance IS NULL OR breathing_variance >= 0);
  END IF;
END $$;

-- Align the documented schema with the lowercase severities emitted by the API.
ALTER TABLE IF EXISTS public.alerts
  DROP CONSTRAINT IF EXISTS alerts_severity_check;

ALTER TABLE IF EXISTS public.alerts
  ADD CONSTRAINT alerts_severity_check
  CHECK (severity IN ('high', 'medium', 'low', 'critical', 'High', 'Medium', 'Low', 'Critical'));
