from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4

from fastapi import FastAPI, Query
from pydantic import BaseModel, Field


app = FastAPI(
    title="OxyGuard FastAPI Backend",
    version="1.0.0",
    description="Priority FastAPI endpoints for OxyGuard telemetry ingestion and health checks.",
)


class TelemetryCreate(BaseModel):
    device_id: str = Field(..., examples=["ESP32-A01"])
    ward_id: str = Field(..., examples=["ae"])
    flow_rate: float | None = Field(None, ge=0, examples=[4.2])
    flow_lpm: float | None = Field(None, ge=0, examples=[4.2])
    pressure_psi: float | None = Field(None, ge=0, examples=[48])
    volume_remaining_litres: float | None = Field(None, ge=0, examples=[960])
    operational_status: Literal["normal", "warning", "critical", "hardware_fault"] = "normal"
    timestamp: datetime | None = None


class TelemetryReading(BaseModel):
    id: str
    device_id: str
    ward_id: str
    flow_lpm: float
    pressure_psi: float | None
    volume_remaining_litres: float | None
    operational_status: str
    observed_at: datetime
    received_at: datetime


telemetry_store: list[TelemetryReading] = []


@app.get("/api/v1/health")
def health() -> dict[str, str]:
    return {"status": "healthy"}


@app.post("/api/v1/telemetry", status_code=201)
@app.post("/api/v1/telemetry/readings", status_code=201)
def create_telemetry(payload: TelemetryCreate) -> dict[str, object]:
    now = datetime.now(timezone.utc)
    flow_lpm = payload.flow_lpm if payload.flow_lpm is not None else payload.flow_rate
    reading = TelemetryReading(
        id=str(uuid4()),
        device_id=payload.device_id,
        ward_id=payload.ward_id,
        flow_lpm=float(flow_lpm or 0),
        pressure_psi=payload.pressure_psi,
        volume_remaining_litres=payload.volume_remaining_litres,
        operational_status=payload.operational_status,
        observed_at=payload.timestamp or now,
        received_at=now,
    )
    telemetry_store.append(reading)
    return {
        "ok": True,
        "status": "success",
        "message": "Telemetry logged successfully.",
        "telemetry": reading,
    }


@app.get("/api/v1/telemetry")
def get_telemetry(
    device_id: str | None = None,
    ward_id: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
) -> list[TelemetryReading]:
    rows = telemetry_store
    if device_id:
        rows = [row for row in rows if row.device_id == device_id]
    if ward_id:
        rows = [row for row in rows if row.ward_id == ward_id]
    return list(reversed(rows[-limit:]))
