from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import os
import secrets
from typing import Literal
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Query
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
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
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


class MfaChallengeCreate(BaseModel):
    username: str = Field(..., min_length=2, examples=["robertm"])
    channel: Literal["email", "sms", "authenticator"] = "email"
    destination: str | None = Field(None, examples=["r******@example.com"])
    purpose: Literal["login", "step_up", "password_reset"] = "login"


class MfaChallengeResponse(BaseModel):
    ok: bool
    status: Literal["pending"]
    challenge_id: str
    username: str
    channel: str
    masked_destination: str
    expires_at: datetime
    attempts_remaining: int
    demo_code: str | None = None


class MfaVerifyRequest(BaseModel):
    challenge_id: str = Field(..., examples=["5f9d1c47-1f3f-46a0-bfd1-0b61bbd7b650"])
    code: str = Field(..., min_length=4, max_length=12, examples=["123456"])


class MfaVerifyResponse(BaseModel):
    ok: bool
    verified: bool
    status: Literal["verified"]
    mfa_token: str
    username: str
    expires_at: datetime


telemetry_store: list[TelemetryReading] = []
mfa_challenges: dict[str, dict[str, object]] = {}
mfa_tokens: dict[str, dict[str, object]] = {}

MFA_CODE_TTL_MINUTES = int(os.getenv("MFA_CODE_TTL_MINUTES", "5"))
MFA_TOKEN_TTL_MINUTES = int(os.getenv("MFA_TOKEN_TTL_MINUTES", "15"))
MFA_MAX_ATTEMPTS = int(os.getenv("MFA_MAX_ATTEMPTS", "5"))


def database_url() -> str | None:
    return os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DATABASE_URL")


def database_ready() -> bool:
    return bool(database_url() and psycopg and dict_row)


def connect_db():
    if not database_ready():
        return None
    return psycopg.connect(database_url(), row_factory=dict_row, autocommit=True)


def expose_demo_mfa_code() -> bool:
    return os.getenv("MFA_EXPOSE_DEMO_CODE", "true").lower() in {"1", "true", "yes", "on"}


def hash_mfa_code(code: str) -> str:
    secret = os.getenv("MFA_SECRET", "oxyguard-local-mfa-secret")
    return hmac.new(secret.encode("utf-8"), code.encode("utf-8"), hashlib.sha256).hexdigest()


def generate_mfa_code() -> str:
    return f"{secrets.randbelow(1000000):06d}"


def mask_destination(username: str, destination: str | None, channel: str) -> str:
    if destination:
        if "@" in destination:
            name, domain = destination.split("@", 1)
            return f"{name[:1]}***@{domain}"
        return f"***{destination[-4:]}"
    if channel == "sms":
        return "***-***-0188"
    if channel == "authenticator":
        return "Authenticator app"
    return f"{username[:1]}***@oxyguard.local"


def prune_mfa_state() -> None:
    now = datetime.now(timezone.utc)
    expired_challenges = [
        challenge_id
        for challenge_id, challenge in mfa_challenges.items()
        if challenge["expires_at"] < now or challenge.get("verified")
    ]
    for challenge_id in expired_challenges:
        mfa_challenges.pop(challenge_id, None)

    expired_tokens = [
        token
        for token, record in mfa_tokens.items()
        if record["expires_at"] < now
    ]
    for token in expired_tokens:
        mfa_tokens.pop(token, None)


def build_mfa_challenge(payload: MfaChallengeCreate, challenge_id: str | None = None) -> tuple[dict[str, object], str]:
    code = generate_mfa_code()
    now = datetime.now(timezone.utc)
    challenge = {
        "challenge_id": challenge_id or str(uuid4()),
        "username": payload.username.strip(),
        "channel": payload.channel,
        "purpose": payload.purpose,
        "masked_destination": mask_destination(payload.username.strip(), payload.destination, payload.channel),
        "code_hash": hash_mfa_code(code),
        "created_at": now,
        "expires_at": now + timedelta(minutes=MFA_CODE_TTL_MINUTES),
        "attempts_remaining": MFA_MAX_ATTEMPTS,
        "verified": False,
    }
    mfa_challenges[str(challenge["challenge_id"])] = challenge
    return challenge, code


def public_mfa_challenge(challenge: dict[str, object], code: str | None = None) -> MfaChallengeResponse:
    return MfaChallengeResponse(
        ok=True,
        status="pending",
        challenge_id=str(challenge["challenge_id"]),
        username=str(challenge["username"]),
        channel=str(challenge["channel"]),
        masked_destination=str(challenge["masked_destination"]),
        expires_at=challenge["expires_at"],
        attempts_remaining=int(challenge["attempts_remaining"]),
        demo_code=code if expose_demo_mfa_code() else None,
    )


@app.get("/api/v1/health")
def health() -> dict[str, object]:
    response: dict[str, object] = {
        "status": "healthy",
        "database": "not_configured",
        "database_url_configured": bool(database_url()),
        "telemetry_rows": len(telemetry_store),
        "mfa": "available",
    }

    if not database_url():
        return response

    if not database_ready():
        response.update(
            {
                "status": "degraded",
                "database": "driver_unavailable",
            }
        )
        return response

    try:
        with connect_db() as conn:
            with conn.cursor() as cur:
                cur.execute("select count(*)::int as telemetry_rows from telemetry_logs")
                row = cur.fetchone()
        response.update(
            {
                "database": "connected",
                "telemetry_rows": row["telemetry_rows"] if row else 0,
            }
        )
    except Exception as error:
        response.update(
            {
                "status": "degraded",
                "database": "connection_failed",
                "database_error": str(error),
            }
        )

    return response


@app.post("/api/v1/mfa/challenge", status_code=201, response_model=MfaChallengeResponse)
def create_mfa_challenge(payload: MfaChallengeCreate) -> MfaChallengeResponse:
    prune_mfa_state()
    challenge, code = build_mfa_challenge(payload)
    return public_mfa_challenge(challenge, code)


@app.post("/api/v1/mfa/resend", response_model=MfaChallengeResponse)
def resend_mfa_challenge(payload: MfaVerifyRequest) -> MfaChallengeResponse:
    prune_mfa_state()
    challenge = mfa_challenges.get(payload.challenge_id)
    if not challenge:
        raise HTTPException(status_code=404, detail="MFA challenge was not found or has expired.")

    replacement = MfaChallengeCreate(
        username=str(challenge["username"]),
        channel=challenge["channel"],
        purpose=challenge["purpose"],
    )
    refreshed, code = build_mfa_challenge(replacement, challenge_id=payload.challenge_id)
    return public_mfa_challenge(refreshed, code)


@app.post("/api/v1/mfa/verify", response_model=MfaVerifyResponse)
def verify_mfa_challenge(payload: MfaVerifyRequest) -> MfaVerifyResponse:
    prune_mfa_state()
    challenge = mfa_challenges.get(payload.challenge_id)
    if not challenge:
        raise HTTPException(status_code=404, detail="MFA challenge was not found or has expired.")

    now = datetime.now(timezone.utc)
    if challenge["expires_at"] < now:
        mfa_challenges.pop(payload.challenge_id, None)
        raise HTTPException(status_code=410, detail="MFA challenge has expired.")

    if int(challenge["attempts_remaining"]) <= 0:
        raise HTTPException(status_code=429, detail="MFA challenge has too many failed attempts.")

    submitted_hash = hash_mfa_code(payload.code.strip())
    if not hmac.compare_digest(str(challenge["code_hash"]), submitted_hash):
        challenge["attempts_remaining"] = int(challenge["attempts_remaining"]) - 1
        raise HTTPException(
            status_code=401,
            detail=f"Invalid MFA code. {challenge['attempts_remaining']} attempts remaining.",
        )

    token = secrets.token_urlsafe(32)
    expires_at = now + timedelta(minutes=MFA_TOKEN_TTL_MINUTES)
    mfa_tokens[token] = {
        "username": challenge["username"],
        "issued_at": now,
        "expires_at": expires_at,
    }
    challenge["verified"] = True
    mfa_challenges.pop(payload.challenge_id, None)

    return MfaVerifyResponse(
        ok=True,
        verified=True,
        status="verified",
        mfa_token=token,
        username=str(challenge["username"]),
        expires_at=expires_at,
    )


@app.get("/api/v1/mfa/status/{challenge_id}")
def get_mfa_status(challenge_id: str) -> dict[str, object]:
    prune_mfa_state()
    challenge = mfa_challenges.get(challenge_id)
    if not challenge:
        raise HTTPException(status_code=404, detail="MFA challenge was not found or has expired.")
    return {
        "ok": True,
        "challenge_id": challenge_id,
        "status": "verified" if challenge.get("verified") else "pending",
        "username": challenge["username"],
        "channel": challenge["channel"],
        "expires_at": challenge["expires_at"],
        "attempts_remaining": challenge["attempts_remaining"],
    }


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
