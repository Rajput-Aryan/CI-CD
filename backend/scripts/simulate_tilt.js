const mqtt = require("mqtt");

const BROKER_URL = process.env.MQTT_BROKER_URL || "mqtt://broker.emqx.io:1883";
const MAC = "74:4D:BD:AA:C0:F0";
const DONGLE_ID = "DG-744D";
const REG_TOPIC = "DEVICE_reg";
const REG_OK_TOPIC = "DEVICE_regok";
const TELEMETRY_TOPIC = `device_scd/${DONGLE_ID}/telemetry`;

console.log(`[tilt-sim] Connecting to MQTT broker at ${BROKER_URL}...`);
const client = mqtt.connect(BROKER_URL);

client.on("connect", () => {
  console.log("[tilt-sim] Connected to MQTT broker.");

  // Subscribe to regok
  client.subscribe(REG_OK_TOPIC, (err) => {
    if (err) console.error("[tilt-sim] Subscription error:", err.message);
    else console.log(`[tilt-sim] Subscribed to ${REG_OK_TOPIC}`);

    // Send DEVICE_reg handshake request
    const regPayload = JSON.stringify({ mac: MAC });
    client.publish(REG_TOPIC, regPayload);
    console.log(`[tilt-sim] Published handshake request to '${REG_TOPIC}':`, regPayload);
  });
});

let step = 0;

client.on("message", (topic, payload) => {
  if (topic === REG_OK_TOPIC) {
    console.log(`[tilt-sim] Received registration OK on '${REG_TOPIC}':`, payload.toString());
    console.log("[tilt-sim] Starting smooth tilt sensor telemetry stream...");

    // Start publishing fast tilt telemetry (50ms interval = 20 packets/sec)
    setInterval(() => {
      step += 0.05;
      
      // Simulate Roll angle (-45° to +45°) with sine wave
      const tilt_x = parseFloat((Math.sin(step) * 35).toFixed(1));
      
      // Simulate Pitch angle (-30° to +30°) with cosine wave
      const tilt_y = parseFloat((Math.cos(step * 0.7) * 25).toFixed(1));

      // Calculate speed based on pitch inclination (forward pitch increases speed)
      const rawSpeed = Math.max(0, Math.min(120, Math.round(50 + tilt_y * 1.8)));

      // Determine human readable direction
      let direction = "LEVEL";
      if (tilt_x < -10 && tilt_y > 10) direction = "FORWARD-LEFT";
      else if (tilt_x > 10 && tilt_y > 10) direction = "FORWARD-RIGHT";
      else if (tilt_x < -10 && tilt_y < -10) direction = "BACKWARD-LEFT";
      else if (tilt_x > 10 && tilt_y < -10) direction = "BACKWARD-RIGHT";
      else if (tilt_x < -10) direction = "LEFT";
      else if (tilt_x > 10) direction = "RIGHT";
      else if (tilt_y > 10) direction = "FORWARD";
      else if (tilt_y < -10) direction = "BACKWARD";

      const telemetryData = {
        tilt_x: tilt_x,
        tilt_y: tilt_y,
        direction: direction,
        speed: rawSpeed,
        timestamp: Date.now()
      };

      client.publish(TELEMETRY_TOPIC, JSON.stringify(telemetryData));
    }, 50);
  }
});

client.on("error", (err) => {
  console.error("[tilt-sim] MQTT error:", err);
});
