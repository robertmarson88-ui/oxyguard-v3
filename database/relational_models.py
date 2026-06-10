"""SQLAlchemy ORM models for the OxyGuard relational database schema."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    PrimaryKeyConstraint,
    String,
    text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Role(Base):
    __tablename__ = "roles"

    role_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    role_name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)

    users: Mapped[list["User"]] = relationship(back_populates="role")
    permissions: Mapped[list["RolePermission"]] = relationship(back_populates="role")


class Permission(Base):
    __tablename__ = "permissions"

    permission_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    permission_name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)

    roles: Mapped[list["RolePermission"]] = relationship(back_populates="permission")


class RolePermission(Base):
    __tablename__ = "role_permissions"

    role_id: Mapped[int] = mapped_column(ForeignKey("roles.role_id"), nullable=False)
    permission_id: Mapped[int] = mapped_column(ForeignKey("permissions.permission_id"), nullable=False)

    role: Mapped["Role"] = relationship(back_populates="permissions")
    permission: Mapped["Permission"] = relationship(back_populates="roles")

    __table_args__ = (PrimaryKeyConstraint("role_id", "permission_id"),)


class User(Base):
    __tablename__ = "users"

    user_id: Mapped[str] = mapped_column(String(10), primary_key=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    email_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.role_id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP"))

    role: Mapped["Role"] = relationship(back_populates="users")
    resolved_alerts: Mapped[list["Alert"]] = relationship(back_populates="resolver")
    audit_logs: Mapped[list["AuditLog"]] = relationship(back_populates="user")

    __table_args__ = (Index("users_role_id_idx", "role_id"),)


class Ward(Base):
    __tablename__ = "wards"

    ward_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    ward_name: Mapped[str] = mapped_column(String(100), nullable=False)
    location: Mapped[str | None] = mapped_column(String(100))

    devices: Mapped[list["Device"]] = relationship(back_populates="ward")
    telemetry_logs: Mapped[list["TelemetryLog"]] = relationship(back_populates="ward")


class Device(Base):
    __tablename__ = "devices"

    device_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    ward_id: Mapped[str] = mapped_column(ForeignKey("wards.ward_id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP"))

    ward: Mapped["Ward"] = relationship(back_populates="devices")
    telemetry_logs: Mapped[list["TelemetryLog"]] = relationship(back_populates="device")
    alerts: Mapped[list["Alert"]] = relationship(back_populates="device")

    __table_args__ = (
        CheckConstraint("device_id ~ '^[A-Z]{2}[0-9]{3}$'", name="devices_device_id_pattern"),
        Index("devices_ward_id_idx", "ward_id"),
    )


class TelemetryLog(Base):
    __tablename__ = "telemetry_logs"

    log_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    device_id: Mapped[str] = mapped_column(ForeignKey("devices.device_id"), nullable=False)
    ward_id: Mapped[str] = mapped_column(ForeignKey("wards.ward_id"), nullable=False)
    flow_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    operational_status: Mapped[str] = mapped_column(String(20), nullable=False)
    device_timestamp: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    received_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP"))

    device: Mapped["Device"] = relationship(back_populates="telemetry_logs")
    ward: Mapped["Ward"] = relationship(back_populates="telemetry_logs")

    __table_args__ = (
        CheckConstraint("flow_rate >= 0.0 AND flow_rate <= 100.0", name="telemetry_logs_flow_rate_range"),
        CheckConstraint(
            "operational_status IN ('normal', 'warning', 'critical', 'hardware_fault')",
            name="telemetry_logs_operational_status_check",
        ),
        Index("telemetry_logs_device_timestamp_idx", "device_id", "device_timestamp"),
        Index("telemetry_logs_ward_timestamp_idx", "ward_id", "device_timestamp"),
        Index("telemetry_logs_status_timestamp_idx", "operational_status", "device_timestamp"),
    )


class Alert(Base):
    __tablename__ = "alerts"

    alert_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    device_id: Mapped[str] = mapped_column(ForeignKey("devices.device_id"), nullable=False)
    alert_type: Mapped[str] = mapped_column(String(50), nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=False)
    is_resolved: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    resolved_by: Mapped[str | None] = mapped_column(ForeignKey("users.user_id"))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP"))

    device: Mapped["Device"] = relationship(back_populates="alerts")
    resolver: Mapped["User"] = relationship(back_populates="resolved_alerts")

    __table_args__ = (
        CheckConstraint("severity IN ('High', 'Medium', 'Low')", name="alerts_severity_check"),
        Index("alerts_device_id_idx", "device_id"),
        Index("alerts_unresolved_idx", "is_resolved", "severity"),
    )


class AuditLog(Base):
    __tablename__ = "audit_logs"

    audit_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.user_id"), nullable=False)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    target: Mapped[str] = mapped_column(String(100), nullable=False)
    performed_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP"))

    user: Mapped["User"] = relationship(back_populates="audit_logs")

    __table_args__ = (Index("audit_logs_user_performed_idx", "user_id", "performed_at"),)
