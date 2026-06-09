-- OxyGuard relational database schema
-- Generated from "Relational Database Schema .md" and aligned with API Specification v1.1.0.

CREATE TABLE roles (
  role_id SERIAL PRIMARY KEY,
  role_name VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE permissions (
  permission_id SERIAL PRIMARY KEY,
  permission_name VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE role_permissions (
  role_id INTEGER NOT NULL REFERENCES roles(role_id),
  permission_id INTEGER NOT NULL REFERENCES permissions(permission_id),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE users (
  user_id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role_id INTEGER NOT NULL REFERENCES roles(role_id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE wards (
  ward_id VARCHAR(50) PRIMARY KEY,
  ward_name VARCHAR(100) NOT NULL,
  location VARCHAR(100)
);

CREATE TABLE devices (
  device_id VARCHAR(50) PRIMARY KEY,
  ward_id VARCHAR(50) NOT NULL REFERENCES wards(ward_id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT devices_device_id_pattern CHECK (device_id ~ '^ESP32-[A-Z0-9-]+$')
);

CREATE TABLE telemetry_logs (
  log_id BIGSERIAL PRIMARY KEY,
  device_id VARCHAR(50) NOT NULL REFERENCES devices(device_id),
  ward_id VARCHAR(50) NOT NULL REFERENCES wards(ward_id),
  flow_rate NUMERIC(5,2) NOT NULL,
  operational_status VARCHAR(20) NOT NULL,
  device_timestamp TIMESTAMP NOT NULL,
  received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT telemetry_logs_flow_rate_range CHECK (flow_rate >= 0.0 AND flow_rate <= 100.0),
  CONSTRAINT telemetry_logs_operational_status_check CHECK (
    operational_status IN ('normal', 'warning', 'critical', 'hardware_fault')
  )
);

CREATE TABLE alerts (
  alert_id SERIAL PRIMARY KEY,
  device_id VARCHAR(50) NOT NULL REFERENCES devices(device_id),
  alert_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  is_resolved BOOLEAN DEFAULT FALSE NOT NULL,
  resolved_by INTEGER REFERENCES users(user_id),
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT alerts_severity_check CHECK (severity IN ('High', 'Medium', 'Low'))
);

CREATE TABLE audit_logs (
  audit_id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(user_id),
  action VARCHAR(100) NOT NULL,
  target VARCHAR(100) NOT NULL,
  performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX users_role_id_idx ON users(role_id);
CREATE INDEX devices_ward_id_idx ON devices(ward_id);
CREATE INDEX telemetry_logs_device_timestamp_idx ON telemetry_logs(device_id, device_timestamp DESC);
CREATE INDEX telemetry_logs_ward_timestamp_idx ON telemetry_logs(ward_id, device_timestamp DESC);
CREATE INDEX telemetry_logs_status_timestamp_idx ON telemetry_logs(operational_status, device_timestamp DESC);
CREATE INDEX alerts_device_id_idx ON alerts(device_id);
CREATE INDEX alerts_unresolved_idx ON alerts(is_resolved, severity);
CREATE INDEX audit_logs_user_performed_idx ON audit_logs(user_id, performed_at DESC);

INSERT INTO roles (role_id, role_name) VALUES
  (1, 'Administrator'),
  (2, 'Executive / CFO'),
  (3, 'Facilities Manager'),
  (4, 'Nurse Manager'),
  (5, 'Nurse')
ON CONFLICT (role_id) DO UPDATE
  SET role_name = EXCLUDED.role_name;

SELECT setval('roles_role_id_seq', GREATEST((SELECT MAX(role_id) FROM roles), 1), true);
