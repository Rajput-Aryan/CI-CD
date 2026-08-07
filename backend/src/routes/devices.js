const express = require("express");
const db = require("../db");

const router = express.Router();

// GET /api/devices - Read-only endpoint for active devices that have completed handshake
router.get("/api/devices", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT mac_address, dongle_id, product_type, serial_number,
              status, last_handshake, last_heartbeat, latest_data
       FROM devices
       WHERE last_handshake IS NOT NULL
       ORDER BY mac_address`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("[devices] error fetching devices:", err.message);
    res.status(500).json({ error: "Server error fetching devices" });
  }
});

module.exports = router;

