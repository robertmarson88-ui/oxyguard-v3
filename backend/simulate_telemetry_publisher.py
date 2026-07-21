from __future__ import annotations

import argparse
import json
import os
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


DEFAULT_API_URL = os.getenv("OXYGUARD_API_URL", "http://127.0.0.1:4180/api/v1/telemetry")
TOPIC = os.getenv("MQTT_TOPIC", "oxyguard/telemetry")
MQTT_HOST = os.getenv("MQTT_HOST", "127.0.0.1")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
EXPECTED_ALERTS = {
    "normal": set(),
    "residual_gas": {"residual_gas_waste"},
    "ghost_flow": {"ghost_flow"},
    "unauthorized_bed": {"unauthorized_bed_usage"},
}


def iso_timestamp(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def telemetry(
    device_id: str,
    ward_id: str,
    timestamp: datetime,
    *,
    flow_rate: float,
    breathing_variance: float,
    emr_status: str,
    cylinder_capacity: float = 1200,
    consumed_volume: float = 300,
    cylinder_status: str = "IN_USE",
) -> dict[str, Any]:
    return {
        "device_id": device_id,
        "ward_id": ward_id,
        "flow_rate": flow_rate,
        "operational_status": "normal",
        "timestamp": iso_timestamp(timestamp),
        "cylinder_capacity": cylinder_capacity,
        "consumed_volume": consumed_volume,
        "cylinder_status": cylinder_status,
        "breathing_variance": breathing_variance,
        "emr_status": emr_status,
    }


def build_scenarios(suffix: int) -> dict[str, list[dict[str, Any]]]:
    now = datetime.now(timezone.utc).replace(microsecond=0)
    sequence_start = now - timedelta(minutes=11)
    offsets = (0, 5, 10, 11)

    return {
        "normal": [telemetry(
            f"NO{suffix:03d}", "X001", now,
            flow_rate=0.5,
            breathing_variance=0.01,
            emr_status="OCCUPIED",
        )],
        "residual_gas": [telemetry(
            f"RG{suffix:03d}", "X002", now,
            flow_rate=0.2,
            breathing_variance=0.03,
            emr_status="OCCUPIED",
            cylinder_capacity=1200,
            consumed_volume=960,
            cylinder_status="REPLACED",
        )],
        "ghost_flow": [
            telemetry(
                f"GF{suffix:03d}", "X003", sequence_start + timedelta(minutes=offset),
                flow_rate=1.2,
                breathing_variance=0.005,
                emr_status="OCCUPIED",
            )
            for offset in offsets
        ],
        "unauthorized_bed": [
            telemetry(
                f"UB{suffix:03d}", "X004", sequence_start + timedelta(minutes=offset),
                flow_rate=2.0,
                breathing_variance=0.05,
                emr_status="EMPTY",
            )
            for offset in offsets
        ],
    }


def post_http(api_url: str, payload: dict[str, Any]) -> dict[str, Any]:
    request = Request(
        api_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=10) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {error.code} from {api_url}: {detail}") from error
    except URLError as error:
        raise RuntimeError(f"Cannot reach {api_url}: {error.reason}") from error


def alert_types(response: dict[str, Any]) -> set[str]:
    alerts = response.get("alerts")
    if isinstance(alerts, list):
        return {str(alert.get("alert_type")) for alert in alerts if isinstance(alert, dict)}
    alert = response.get("alert")
    return {str(alert.get("alert_type"))} if isinstance(alert, dict) else set()


def run_http(
    api_url: str,
    selected: list[str],
    scenarios: dict[str, list[dict[str, Any]]],
    pause: float,
) -> None:
    failures: list[str] = []
    for scenario_name in selected:
        observed: set[str] = set()
        payloads = scenarios[scenario_name]
        print(f"\n{scenario_name}: {len(payloads)} reading(s)")
        for index, payload in enumerate(payloads, start=1):
            response = post_http(api_url, payload)
            reading_alerts = alert_types(response)
            observed.update(reading_alerts)
            label = ", ".join(sorted(reading_alerts)) or "none"
            print(
                f"  {index}/{len(payloads)} {payload['timestamp']} "
                f"flow={payload['flow_rate']} alerts={label}"
            )
            if pause:
                time.sleep(pause)

        expected = EXPECTED_ALERTS[scenario_name]
        missing = expected - observed
        unexpected = observed - expected
        if missing or unexpected:
            failures.append(
                f"{scenario_name}: expected {sorted(expected)}, observed {sorted(observed)}"
            )
        else:
            print(f"  PASS expected alerts: {sorted(expected) or ['none']}")

    if failures:
        raise RuntimeError("Simulator verification failed:\n- " + "\n- ".join(failures))


def run_mqtt(
    selected: list[str],
    scenarios: dict[str, list[dict[str, Any]]],
    pause: float,
) -> None:
    from paho.mqtt import client as mqtt

    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="oxyguard-simulated-publisher")
    client.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
    for scenario_name in selected:
        print(f"\n{scenario_name}: publishing to {TOPIC}")
        for payload in scenarios[scenario_name]:
            result = client.publish(TOPIC, json.dumps(payload), qos=1)
            result.wait_for_publish(timeout=10)
            print(f"  published {payload['timestamp']} flow={payload['flow_rate']}")
            if pause:
                time.sleep(pause)
    client.disconnect()
    print("\nMQTT messages published; alert responses cannot be verified over the publish-only transport.")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Simulate and verify OxyGuard residual gas, ghost flow, and unauthorized bed rules."
    )
    parser.add_argument(
        "--scenario",
        choices=["all", *EXPECTED_ALERTS],
        default="all",
        help="Scenario to run (default: all).",
    )
    parser.add_argument(
        "--transport",
        choices=["http", "mqtt"],
        default="http",
        help="HTTP verifies alerts; MQTT only publishes telemetry (default: http).",
    )
    parser.add_argument("--api-url", default=DEFAULT_API_URL, help="Telemetry API URL for HTTP mode.")
    parser.add_argument("--pause", type=float, default=0, help="Optional real-time pause between readings.")
    parser.add_argument(
        "--device-suffix",
        type=int,
        choices=range(1000),
        default=None,
        metavar="000-999",
        help="Optional deterministic three-digit suffix; a random suffix is used by default.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    suffix = args.device_suffix if args.device_suffix is not None else secrets.randbelow(1000)
    scenarios = build_scenarios(suffix)
    selected = list(EXPECTED_ALERTS) if args.scenario == "all" else [args.scenario]
    print(f"OxyGuard simulator transport={args.transport} device_suffix={suffix:03d}")

    if args.transport == "http":
        run_http(args.api_url, selected, scenarios, max(0, args.pause))
    else:
        run_mqtt(selected, scenarios, max(0, args.pause))


if __name__ == "__main__":
    main()
