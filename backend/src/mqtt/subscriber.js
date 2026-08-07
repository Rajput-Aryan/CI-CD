// Backend connects to MQTT broker and subscribes to:
//   1. DEVICE_reg: Handshake & registration endpoint from physical ESP32 devices
//   2. device_scd/+/telemetry: Fast telemetry data topics
//   3. mqtt-sandbox-app/devices/+/#: Legacy sandbox compatibility

const mqtt = require("mqtt");
const db = require("../db");

const TOPIC_NAMESPACE = "mqtt-sandbox-app";
const REGISTRATION_TOPIC = "DEVICE_reg";
const REGISTRATION_OK_TOPIC = "DEVICE_regok";
let mqttClient = null;

function startSubscriber() {
  const brokerUrl = process.env.MQTT_BROKER_URL || "mqtt://broker.emqx.io:1883";

  const client = mqtt.connect(brokerUrl, {
    clientId: "backend-subscriber-" + Math.random().toString(16).substring(2, 8),
    reconnectPeriod: 5000,
  });

  client.on("connect", () => {
    console.log(`[mqtt] backend connected to MQTT broker (${brokerUrl})`);

    // Subscribe to Registration Topic
    client.subscribe(REGISTRATION_TOPIC, (err) => {
      if (err) console.error(`[mqtt] subscribe failed for ${REGISTRATION_TOPIC}:`, err.message);
      else console.log(`[mqtt] subscribed to ${REGISTRATION_TOPIC}`);
    });

    // Subscribe to Telemetry Topics (accepting wildcard #)
    client.subscribe("device_scd/#", (err) => {
      if (err) console.error("[mqtt] subscribe failed for device_scd/#:", err.message);
      else console.log("[mqtt] subscribed to device_scd/#");
    });

    // Subscribe to legacy sandbox topics
    client.subscribe(`${TOPIC_NAMESPACE}/devices/+/#`, (err) => {
      if (err) console.error("[mqtt] subscribe failed for sandbox:", err.message);
    });
  });

  client.on("message", async (topic, payload) => {
    let data;
    try {
      data = JSON.parse(payload.toString());
    } catch {
      data = null;
    }

    // --- CASE 1: Device Registration Request (`DEVICE_reg`) ---
    if (topic === REGISTRATION_TOPIC) {
      if (!data || !data.mac) {
        console.warn("[mqtt] Received malformed DEVICE_reg message:", payload.toString());
        return;
      }

      const mac = data.mac.trim();

      try {
        // Exact string match check against database whitelist
        const checkResult = await db.query(
          "SELECT mac_address, dongle_id, product_type, serial_number FROM devices WHERE mac_address = $1",
          [mac]
        );

        if (checkResult.rows.length === 0) {
          console.warn(`[mqtt] REJECTED registration: MAC '${mac}' not found in database whitelist.`);
          return;
        }

        const device = checkResult.rows[0];

        // Update device connection status
        await db.query(
          `UPDATE devices SET status = 'connected', last_handshake = now(), last_heartbeat = now()
           WHERE mac_address = $1`,
          [mac]
        );

        // Prepare response payload
        const regOkPayload = {
          mac: device.mac_address,
          serial_number: device.serial_number,
          dongleID: device.dongle_id,
          product_type: device.product_type,
        };

        // Publish registration confirmation to DEVICE_regok
        client.publish(REGISTRATION_OK_TOPIC, JSON.stringify(regOkPayload));
        console.log(`[mqtt] APPROVED registration for MAC '${mac}' -> Sending details on ${REGISTRATION_OK_TOPIC}:`, regOkPayload);
      } catch (err) {
        console.error(`[mqtt] Error handling registration for MAC '${mac}':`, err.message);
      }
      return;
    }

    // --- CASE 2: Telemetry & Status Topic Handling (`device_scd/<DONGLE_ID>/<subtopic>`) ---
    const topicParts = topic.split("/");
    if (topicParts.length >= 2 && topicParts[0] === "device_scd") {
      const dongleId = topicParts[1].trim();
      const subTopic = topicParts[2] ? topicParts[2].trim().toLowerCase() : "";

      try {
        // Validate Dongle ID against whitelisted devices in database
        const checkResult = await db.query(
          "SELECT mac_address, dongle_id FROM devices WHERE dongle_id = $1",
          [dongleId]
        );

        const isAuthorized = checkResult.rows.length > 0;

        if (!isAuthorized) {
          console.warn(`[mqtt] REJECTED message: Dongle ID '${dongleId}' on topic '${topic}' is not authorized.`);
          return;
        }

        const device = checkResult.rows[0];

        if (subTopic === "status") {
          // Status Topic Handling
          const deviceStatus = (data && data.status) ? data.status : "connected";
          await db.query(
            `UPDATE devices 
             SET status = $2, 
                 last_heartbeat = now()
             WHERE dongle_id = $1`,
            [dongleId, deviceStatus]
          );

          console.log(`[mqtt] ACCEPTED status for Dongle ID '${dongleId}' (Status: ${deviceStatus}) on '${topic}'`);
        } else {
          // High-speed Telemetry Topic Handling (e.g. telemetry)
          await db.query(
            `UPDATE devices 
             SET status = 'connected', 
                 latest_data = $2, 
                 last_heartbeat = now()
             WHERE dongle_id = $1`,
            [dongleId, data]
          );

          console.log(`[mqtt] FAST telemetry ingested for Dongle ID '${dongleId}' (MAC: ${device.mac_address})`);
        }
      } catch (err) {
        console.error(`[mqtt] Error handling message for Dongle ID '${dongleId}' on '${topic}':`, err.message);
      }
      return;
    }

    // --- CASE 3: Legacy Sandbox Topic Handling ---
    if (topic.startsWith(`${TOPIC_NAMESPACE}/devices/`)) {
      const parts = topic.split("/");
      if (parts.length < 4) return;
      const mac = parts[2];
      const messageType = parts[3];

      try {
        const checkResult = await db.query(
          "SELECT mac_address FROM devices WHERE mac_address = $1",
          [mac]
        );
        if (checkResult.rows.length === 0) return;

        if (messageType === "handshake") {
          await db.query(
            "UPDATE devices SET status = 'connected', last_handshake = now(), last_heartbeat = now() WHERE mac_address = $1",
            [mac]
          );
        } else if (messageType === "heartbeat") {
          await db.query(
            "UPDATE devices SET status = 'connected', last_handshake = COALESCE(last_handshake, now()), last_heartbeat = now() WHERE mac_address = $1",
            [mac]
          );
        } else if (messageType === "data") {
          await db.query(
            "UPDATE devices SET status = 'connected', last_handshake = COALESCE(last_handshake, now()), latest_data = $2, last_heartbeat = now() WHERE mac_address = $1",
            [mac, data]
          );
        }
      } catch (err) {
        console.error(`[mqtt] Error handling legacy topic ${topic}:`, err.message);
      }
    }
  });

  client.on("error", (err) => {
    console.error("[mqtt] Connection error:", err.message);
  });

  mqttClient = client;
}

module.exports = { startSubscriber };



