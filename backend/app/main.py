from __future__ import annotations

import json
import os
from decimal import Decimal

from fastapi import Depends, FastAPI, HTTPException, Query, status
from paho.mqtt import client as mqtt
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from .database import engine, get_db
from .models import Alert, Base, Device, TelemetryLog, Ward
from .schemas import HealthResponse, TelemetryCreateResponse, TelemetryIn, TelemetryOut


app = FastAPI(
    title="OxyGuard FastAPI Backend",
    version="1.1.0",
    description="FastAPI implementation of the OxyGuard API Specification.",
)

mqtt_client: mqtt.Client | None = None


@app.on_event("startup")
def startup() -> None:
    Base.metadata.create_all(bind=engine)
    with Session(engine) as db:
        seed_reference_data(db)
    start_mqtt_subscriber()


@app.on_event("shutdown")
def shutdown() -> None:
    if mqtt_client is not None:
        mqtt_client.loop_stop()
        mqtt_client.disconnect()


@app.get("/health", response_model=HealthResponse)
@app.get("/api/v1/health", response_model=HealthResponse)
def health() -> dict[str, str]:
    return {"status": "healthy"}


@app.post("/telemetry", response_model=TelemetryCreateResponse, status_code=status.HTTP_201_CREATED)
@app.post("/api/v1/telemetry", response_model=TelemetryCreateResponse, status_code=status.HTTP_201_CREATED)
def create_telemetry(payload: TelemetryIn, db: Session = Depends(get_db)) -> dict:
    return process_telemetry(payload, db)


def process_telemetry(payload: TelemetryIn, db: Session) -> dict:
    device = db.get(Device, payload.device_id)
    ward = db.get(Ward, payload.ward_id)

    if ward is None:
        raise HTTPException(status_code=400, detail=f"Unknown ward_id: {payload.ward_id}")

    if device is None:
        device = Device(device_id=payload.device_id, ward_id=payload.ward_id)
        db.add(device)
    elif device.ward_id != payload.ward_id:
        raise HTTPException(
            status_code=400,
            detail=f"device_id {payload.device_id} belongs to ward_id {device.ward_id}, not {payload.ward_id}",
        )

    telemetry_log = TelemetryLog(
        device_id=payload.device_id,
        ward_id=payload.ward_id,
        flow_rate=payload.flow_rate,
        operational_status=payload.operational_status,
        device_timestamp=payload.timestamp,
    )
    db.add(telemetry_log)
    db.flush()

    alert = build_alert(payload)
    if alert:
        db_alert = Alert(
            device_id=payload.device_id,
            alert_type=alert["alert_type"],
            severity=alert["severity"],
        )
        db.add(db_alert)
        db.flush()
        alert["alert_id"] = db_alert.alert_id

    db.commit()
    db.refresh(telemetry_log)

    return {
        "ok": True,
        "status": "success",
        "message": "Telemetry logged successfully.",
        "telemetry_log": telemetry_log,
        "alert_created": alert is not None,
        "alert": alert,
    }


@app.get("/telemetry", response_model=list[TelemetryOut])
@app.get("/api/v1/telemetry", response_model=list[TelemetryOut])
def get_telemetry(
    device_id: str | None = Query(default=None, pattern=r"^([A-Z]{2}[0-9]{3}|ESP32-[A-Z0-9-]+)$"),
    ward_id: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
) -> list[TelemetryLog]:
    query = select(TelemetryLog).order_by(TelemetryLog.device_timestamp.desc(), TelemetryLog.log_id.desc())
    if device_id:
        query = query.where(TelemetryLog.device_id == device_id)
    if ward_id:
        query = query.where(TelemetryLog.ward_id == ward_id)
    return list(db.scalars(query.limit(limit)))


def build_alert(payload: TelemetryIn) -> dict | None:
    if payload.operational_status == "critical":
        return {"alert_type": "Critical Telemetry", "severity": "High"}
    if payload.operational_status == "hardware_fault":
        return {"alert_type": "Hardware Fault", "severity": "High"}
    if payload.flow_rate >= Decimal("80.00"):
        return {"alert_type": "High Flow", "severity": "Medium"}
    if payload.operational_status == "warning":
        return {"alert_type": "Warning Telemetry", "severity": "Medium"}
    return None


def seed_reference_data(db: Session) -> None:
    wards = [
        Ward(ward_id="ICU-A", ward_name="ICU", location="Ward 1 ICU"),
        Ward(ward_id="X001", ward_name="Labour", location="7a East Wing"),
        Ward(ward_id="X002", ward_name="A&E", location="12c North Wing"),
        Ward(ward_id="X003", ward_name="Maternity", location="3a South Wing"),
        Ward(ward_id="X004", ward_name="Nurse Station", location="11b West Wing"),
        Ward(ward_id="X005", ward_name="Paediatric Ward", location="11c West Wing"),
    ]
    devices = [
        Device(device_id="ESP32-WARD1-ICU", ward_id="ICU-A"),
        Device(device_id="TK001", ward_id="X001"),
        Device(device_id="TK002", ward_id="X001"),
        Device(device_id="TK003", ward_id="X001"),
        Device(device_id="TK004", ward_id="X003"),
        Device(device_id="TK005", ward_id="X003"),
        Device(device_id="TK006", ward_id="X003"),
        Device(device_id="TK007", ward_id="X002"),
        Device(device_id="TK008", ward_id="X002"),
    ]

    for ward in wards:
        if db.get(Ward, ward.ward_id) is None:
            db.add(ward)

    for device in devices:
        if db.get(Device, device.device_id) is None:
            db.add(device)

    db.commit()


def start_mqtt_subscriber() -> None:
    global mqtt_client
    host = os.getenv("MQTT_HOST", "127.0.0.1")
    port = int(os.getenv("MQTT_PORT", "1883"))
    topic = os.getenv("MQTT_TOPIC", "oxyguard/telemetry")

    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="oxyguard-fastapi")

    def on_connect(client: mqtt.Client, _userdata: object, _flags: mqtt.ConnectFlags, reason_code: mqtt.ReasonCode, _properties: mqtt.Properties | None = None) -> None:
        if not reason_code.is_failure:
            client.subscribe(topic)
            print(f"MQTT subscribed to {topic} on {host}:{port}")
        else:
            print(f"MQTT connection failed: {reason_code}")

    def on_message(_client: mqtt.Client, _userdata: object, message: mqtt.MQTTMessage) -> None:
        try:
            payload = TelemetryIn.model_validate_json(message.payload.decode("utf-8"))
            with Session(engine) as db:
                result = process_telemetry(payload, db)
            print(f"MQTT processed {message.topic}: log_id={result['telemetry_log'].log_id}")
        except ValidationError as exc:
            print(f"MQTT validation failed on {message.topic}: {exc}")
        except Exception as exc:
            print(f"MQTT processing failed on {message.topic}: {exc}")

    client.on_connect = on_connect
    client.on_message = on_message

    try:
        client.connect(host, port, keepalive=60)
        client.loop_start()
        mqtt_client = client
    except Exception as exc:
        print(f"MQTT subscriber not started: {exc}")
