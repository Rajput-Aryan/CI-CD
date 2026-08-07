// These two endpoints are called directly by EMQX (see emqx/emqx.conf).
// They are the actual "handshake gate" - a device is only allowed to
// connect/publish if it's in our whitelist table.

const express = require("express");
const db = require("../db");

const router = express.Router();

// Called by EMQX on every CONNECT attempt.
// Body: { clientid, username, password }
// Sandbox devices connect with clientid = username = their MAC address.
router.post("/mqtt/auth", async (req, res) => {
  const { clientid, username } = req.body;
  console.log("[mqttAuth] POST /mqtt/auth body:", req.body);

  if (
    (clientid && clientid.startsWith("backend-subscriber")) ||
    (username && username.startsWith("backend-subscriber"))
  ) {
    return res.json({ result: "allow", is_superuser: true });
  }

  try {
    const result = await db.query(
      "SELECT 1 FROM devices WHERE UPPER(mac_address) = UPPER($1)",
      [clientid]
    );

    if (result.rowCount > 0) {
      // MAC is whitelisted -> allow the connection
      return res.json({ result: "allow", is_superuser: false });
    } else {
      // MAC not in whitelist -> reject the connection entirely
      return res.json({ result: "deny" });
    }
  } catch (err) {
    console.error("[mqttAuth] error checking whitelist:", err.message);
    return res.json({ result: "deny" });
  }
});

// Called by EMQX on every PUBLISH / SUBSCRIBE attempt.
// Body: { clientid, topic, action }  (action is "publish" or "subscribe")
// Rule: a device can only publish to its OWN topic, e.g.
// devices/AA:BB:CC:00:00:01/... - it can never touch another
// device's topic (stops one sandbox device spoofing another).
router.post("/mqtt/acl", (req, res) => {
  const { clientid, username, topic } = req.body;

  if (
    (clientid && clientid.startsWith("backend-subscriber")) ||
    (username && username.startsWith("backend-subscriber"))
  ) {
    return res.json({ result: "allow" });
  }

  if (!clientid || !topic) {
    return res.json({ result: "deny" });
  }

  const topicParts = topic.split("/");
  if (topicParts.length >= 3 && topicParts[0] === "devices") {
    if (topicParts[1].toUpperCase() === clientid.toUpperCase()) {
      return res.json({ result: "allow" });
    }
  }

  return res.json({ result: "deny" });
});

module.exports = router;
