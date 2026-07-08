from datetime import datetime, timezone
import os
from typing import Literal
from uuid import uuid4

from fastapi import FastAPI, Query
from pydantic import BaseModel, Field

try:
    import psycopg
    from psycopg.rows import dict_row
except ImportError:  # Keeps local in-memory mode available before dependencies install.
    psycopg = None
    dict_row = None


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


def database_url() -> str | None:
    return os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DATABASE_URL")


def database_ready() -> bool:
    return bool(database_url() and psycopg and dict_row)


def connect_db():
    if not database_ready():
        return None
    return psycopg.connect(database_url(), row_factory=dict_row, autocommit=True)


@app.get("/api/v1/health")
def health() -> dict[str, str]:
    return {"status": "healthy"}


@app.post("/api/v1/telemetry", status_code=201)
@app.post("/api/v1/telemetry/readings", status_code=201)
def create_telemetry(payload: TelemetryCreate) -> dict[str, object]:
    now = datetime.now(timezone.utc)
    flow_lpm = payload.flow_lpm if payload.flow_lpm is not None else payload.flow_rate
    observed_at = payload.timestamp or now

    if database_ready():
        with connect_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    insert into wards (ward_id, ward_name, location)
                    values (%s, %s, %s)
                    on conflict (ward_id) do nothing
                    """,
                    (payload.ward_id, payload.ward_id, "Telemetry source"),
                )
                cur.execute(
                    """
                    insert into devices (device_id, ward_id)
                    values (%s, %s)
                    on conflict (device_id) do update
                      set ward_id = excluded.ward_id
                    """,
                    (payload.device_id, payload.ward_id),
                )
                cur.execute(
                    """
                    insert into telemetry_logs (
                      device_id,
                      ward_id,
                      flow_rate,
                      operational_status,
                      device_timestamp,
                      received_at
                    )
                    values (%s, %s, %s, %s, %s, %s)
                    returning
                      log_id::text as id,
                      device_id,
                      ward_id,
                      flow_rate::float as flow_lpm,
                      null::float as pressure_psi,
                      null::float as volume_remaining_litres,
                      operational_status,
                      device_timestamp as observed_at,
                      received_at
                    """,
                    (
                        payload.device_id,
                        payload.ward_id,
                        float(flow_lpm or 0),
                        payload.operational_status,
                        observed_at,
                        now,
                    ),
                )
                reading = TelemetryReading(**cur.fetchone())
        return {
            "ok": True,
            "status": "success",
            "message": "Telemetry logged successfully.",
            "telemetry": reading,
        }

    reading = TelemetryReading(
        id=str(uuid4()),
        device_id=payload.device_id,
        ward_id=payload.ward_id,
        flow_lpm=float(flow_lpm or 0),
        pressure_psi=payload.pressure_psi,
        volume_remaining_litres=payload.volume_remaining_litres,
        operational_status=payload.operational_status,
        observed_at=observed_at,
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
    if database_ready():
        filters = []
        params: list[object] = []
        if device_id:
            filters.append("device_id = %s")
            params.append(device_id)
        if ward_id:
            filters.append("ward_id = %s")
            params.append(ward_id)
        where_clause = f"where {' and '.join(filters)}" if filters else ""
        params.append(limit)
        with connect_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"""
                    select
                      log_id::text as id,
                      device_id,
                      ward_id,
                      flow_rate::float as flow_lpm,
                      null::float as pressure_psi,
                      null::float as volume_remaining_litres,
                      operational_status,
                      device_timestamp as observed_at,
                      received_at
                    from telemetry_logs
                    {where_clause}
                    order by device_timestamp desc
                    limit %s
                    """,
                    params,
                )
                return [TelemetryReading(**row) for row in cur.fetchall()]

    rows = telemetry_store
    if device_id:
        rows = [row for row in rows if row.device_id == device_id]
    if ward_id:
        rows = [row for row in rows if row.ward_id == ward_id]
    return list(reversed(rows[-limit:]))
