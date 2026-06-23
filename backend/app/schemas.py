from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


OperationalStatus = Literal["normal", "warning", "critical", "hardware_fault"]


class HealthResponse(BaseModel):
    status: Literal["healthy"]


class TelemetryIn(BaseModel):
    device_id: str = Field(pattern=r"^([A-Z]{2}[0-9]{3}|ESP32-[A-Z0-9-]+)$", examples=["ESP32-WARD1-ICU"])
    ward_id: str = Field(pattern=r"^[A-Za-z0-9&-]+$", examples=["ICU-A"])
    flow_rate: Decimal = Field(ge=0, le=100, max_digits=5, decimal_places=2, examples=[14.75])
    operational_status: OperationalStatus = "normal"
    timestamp: datetime


class TelemetryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    log_id: int
    device_id: str
    ward_id: str
    flow_rate: Decimal
    operational_status: str
    device_timestamp: datetime
    received_at: datetime


class TelemetryCreateResponse(BaseModel):
    ok: bool
    status: Literal["success"]
    message: str
    telemetry_log: TelemetryOut
    alert_created: bool
    alert: dict | None
