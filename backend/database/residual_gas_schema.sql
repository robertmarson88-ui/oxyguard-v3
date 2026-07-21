-- Additive Supabase/PostgreSQL schema patch for OxyGuard Residual Gas Detection.
-- Safe to run more than once. Existing telemetry and alerts remain valid.

ALTER TABLE IF EXISTS public.telemetry_logs
  ADD COLUMN IF NOT EXISTS cylinder_capacity NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS consumed_volume NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS cylinder_status VARCHAR(20);

ALTER TABLE IF EXISTS public.alerts
  ADD COLUMN IF NOT EXISTS remaining_volume NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS unused_percentage NUMERIC(7,6),
  ADD COLUMN IF NOT EXISTS estimated_oxygen_waste NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS estimated_financial_loss NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS potential_savings NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS recommended_action VARCHAR(255);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'telemetry_logs_cylinder_status_check'
      AND conrelid = 'public.telemetry_logs'::regclass
  ) THEN
    ALTER TABLE public.telemetry_logs
      ADD CONSTRAINT telemetry_logs_cylinder_status_check
      CHECK (cylinder_status IS NULL OR cylinder_status IN ('IN_USE', 'REPLACED'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'telemetry_logs_cylinder_volume_check'
      AND conrelid = 'public.telemetry_logs'::regclass
  ) THEN
    ALTER TABLE public.telemetry_logs
      ADD CONSTRAINT telemetry_logs_cylinder_volume_check
      CHECK (
        (cylinder_capacity IS NULL AND consumed_volume IS NULL AND cylinder_status IS NULL)
        OR
        (cylinder_capacity > 0 AND consumed_volume >= 0 AND consumed_volume <= cylinder_capacity AND cylinder_status IS NOT NULL)
      );
  END IF;
END $$;
