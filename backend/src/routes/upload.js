// Handles CSV upload. Upload is now ADDITIVE:
//   - MACs in the CSV that are new       -> inserted
//   - MACs in the CSV that already exist -> identity fields refreshed
//   - Nothing is ever removed by an upload
//
// To remove devices, use the separate "clear whitelist" endpoint below,
// which wipes everything so you can rebuild from scratch via CSV.

const express = require("express");
const multer = require("multer");
const { parse } = require("csv-parse/sync");
const db = require("../db");
const { kickClient } = require("../services/emqxAdmin");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Expected CSV header: mac_address,dongle_id,product_type,serial_number
router.post("/api/upload-csv", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No CSV file uploaded" });
  }

  let rows;
  try {
    rows = parse(req.file.buffer.toString("utf-8"), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });
  } catch (err) {
    return res.status(400).json({ error: "Could not parse CSV: " + err.message });
  }

  if (rows.length === 0) {
    return res.status(400).json({ error: "CSV file is empty" });
  }

  // Basic validation of each row
  for (const row of rows) {
    if (!row.mac_address || !row.dongle_id || !row.product_type || !row.serial_number) {
      return res.status(400).json({
        error: "Every row needs mac_address, dongle_id, product_type, serial_number",
      });
    }
  }

  try {
    // Insert/update every device from the CSV. ON CONFLICT means: if
    // the MAC already exists, just refresh its identity fields - we
    // leave status/last_heartbeat/latest_data alone so an already
    // connected device isn't disturbed by a re-upload.
    for (const row of rows) {
      const mac = row.mac_address.trim();
      const dongleId = row.dongle_id.trim();
      const productType = row.product_type.trim();
      const serialNumber = row.serial_number.trim();

      await db.query(
        `INSERT INTO devices (mac_address, dongle_id, product_type, serial_number, uploaded_at)
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (mac_address)
         DO UPDATE SET dongle_id = $2, product_type = $3, serial_number = $4, uploaded_at = now()`,
        [mac, dongleId, productType, serialNumber]
      );
    }

    res.json({
      message: "Whitelist updated",
      added_or_updated: rows.length,
    });
  } catch (err) {
    console.error("[upload] error:", err.message);
    res.status(500).json({ error: "Server error updating whitelist" });
  }
});

// Wipes the ENTIRE whitelist. This is the only way to remove devices
// now that CSV upload is purely additive. Also force-disconnects any
// currently-connected devices from EMQX right away.
router.post("/api/clear-whitelist", async (req, res) => {
  try {
    const existing = await db.query("SELECT mac_address FROM devices");
    const macs = existing.rows.map((r) => r.mac_address);

    await db.query("DELETE FROM devices");

    for (const mac of macs) {
      await kickClient(mac);
    }

    res.json({ message: "Whitelist cleared", removed: macs.length });
  } catch (err) {
    console.error("[clear-whitelist] error:", err.message);
    res.status(500).json({ error: "Server error clearing whitelist" });
  }
});

module.exports = router;
