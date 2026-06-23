from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, Numeric, String, text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


id_bigint = BigInteger().with_variant(Integer, "sqlite")


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
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    ward: Mapped[Ward] = relationship(back_populates="devices")
    telemetry_logs: Mapped[list["TelemetryLog"]] = relationship(back_populates="device")
    alerts: Mapped[list["Alert"]] = relationship(back_populates="device")


class TelemetryLog(Base):
    __tablename__ = "telemetry_logs"

    log_id: Mapped[int] = mapped_column(id_bigint, primary_key=True, autoincrement=True)
    device_id: Mapped[str] = mapped_column(ForeignKey("devices.device_id"), nullable=False)
    ward_id: Mapped[str] = mapped_column(ForeignKey("wards.ward_id"), nullable=False)
    flow_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    operational_status: Mapped[str] = mapped_column(String(20), nullable=False)
    device_timestamp: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    received_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    device: Mapped[Device] = relationship(back_populates="telemetry_logs")
    ward: Mapped[Ward] = relationship(back_populates="telemetry_logs")


class Alert(Base):
    __tablename__ = "alerts"

    alert_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    device_id: Mapped[str] = mapped_column(ForeignKey("devices.device_id"), nullable=False)
    alert_type: Mapped[str] = mapped_column(String(50), nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=False)
    is_resolved: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    device: Mapped[Device] = relationship(back_populates="alerts")
