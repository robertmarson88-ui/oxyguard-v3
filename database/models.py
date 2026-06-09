"""SQLAlchemy ORM models for the OxyGuard telemetry data contract."""

from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Enum, Float, Index, PrimaryKeyConstraint, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class OperationalStatus(str, enum.Enum):
    normal = "normal"
    warning = "warning"
    critical = "critical"
    hardware_fault = "hardware_fault"


class TelemetryPayload(Base):
    __tablename__ = "telemetry_payload"

    device_id: Mapped[str] = mapped_column(Text, nullable=False)
    ward_id: Mapped[str] = mapped_column(Text, nullable=False)
    flow_rate: Mapped[float] = mapped_column(Float(precision=53), nullable=False)
    operational_status: Mapped[OperationalStatus] = mapped_column(
        Enum(
            OperationalStatus,
            name="operational_status_enum",
            values_callable=lambda enum_class: [item.value for item in enum_class],
        ),
        nullable=False,
    )
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        PrimaryKeyConstraint("device_id", "timestamp", name="telemetry_payload_pk"),
        CheckConstraint("device_id ~ '^ESP32-[A-Z0-9-]+$'", name="telemetry_payload_device_id_pattern"),
        CheckConstraint("flow_rate >= 0.0 AND flow_rate <= 100.0", name="telemetry_payload_flow_rate_range"),
        Index("telemetry_payload_ward_timestamp_idx", "ward_id", timestamp.desc()),
        Index("telemetry_payload_status_timestamp_idx", "operational_status", timestamp.desc()),
    )
