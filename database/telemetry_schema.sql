-- OxyGuard telemetry database schema
-- Generated from Data_Contract.yaml contract version 1.0.0.

CREATE TYPE operational_status_enum AS ENUM (
  'normal',
  'warning',
  'critical',
  'hardware_fault'
);

CREATE TABLE telemetry_payload (
  device_id TEXT NOT NULL,
  ward_id TEXT NOT NULL,
  flow_rate DOUBLE PRECISION NOT NULL,
  operational_status operational_status_enum NOT NULL,
  "timestamp" TIMESTAMPTZ NOT NULL,

  CONSTRAINT telemetry_payload_pk PRIMARY KEY (device_id, "timestamp"),
  CONSTRAINT telemetry_payload_device_id_pattern CHECK (device_id ~ '^ESP32-[A-Z0-9-]+$'),
  CONSTRAINT telemetry_payload_flow_rate_range CHECK (flow_rate >= 0.0 AND flow_rate <= 100.0)
);

CREATE INDEX telemetry_payload_ward_timestamp_idx
  ON telemetry_payload (ward_id, "timestamp" DESC);

CREATE INDEX telemetry_payload_status_timestamp_idx
  ON telemetry_payload (operational_status, "timestamp" DESC);
