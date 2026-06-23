from __future__ import annotations

import json
import os
from pathlib import Path

from paho.mqtt import client as mqtt


TOPIC = os.getenv("MQTT_TOPIC", "oxyguard/telemetry")
HOST = os.getenv("MQTT_HOST", "127.0.0.1")
PORT = int(os.getenv("MQTT_PORT", "1883"))
PAYLOAD_PATH = Path(__file__).with_name("approved-telemetry-payload.json")


def main() -> None:
    payload = json.loads(PAYLOAD_PATH.read_text(encoding="utf-8"))
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="oxyguard-simulated-publisher")
    client.connect(HOST, PORT, keepalive=60)
    result = client.publish(TOPIC, json.dumps(payload), qos=1)
    result.wait_for_publish(timeout=10)
    client.disconnect()
    print(f"published {TOPIC}: {json.dumps(payload)}")


if __name__ == "__main__":
    main()
