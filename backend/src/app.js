const express = require("express");
const cors = require("cors");

const uploadRoute = require("./routes/upload");
const devicesRoute = require("./routes/devices");
const mqttAuthRoute = require("./routes/mqttAuth");
const { startSubscriber } = require("./mqtt/subscriber");
const { startHeartbeatChecker } = require("./mqtt/heartbeatChecker");

const app = express();
app.use(cors());
app.use(express.json());

app.use(uploadRoute);
app.use(devicesRoute);
app.use(mqttAuthRoute);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`[app] backend listening on port ${PORT}`);

  // Start the MQTT subscriber (pub/sub side) and the background
  // job that flips stale devices to 'offline'.
  startSubscriber();
  startHeartbeatChecker();
});
