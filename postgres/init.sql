-- One table is enough for this project since we don't need history,
-- just the current whitelist + the latest known status/data per device.

CREATE TABLE IF NOT EXISTS devices (
  mac_address     VARCHAR(17) PRIMARY KEY,   -- e.g. AA:BB:CC:00:00:01
  dongle_id       VARCHAR(64) NOT NULL UNIQUE,
  product_type    VARCHAR(64) NOT NULL,
  serial_number   VARCHAR(64) NOT NULL,

  status          VARCHAR(16) NOT NULL DEFAULT 'offline', -- 'connected' | 'offline'
  last_handshake  TIMESTAMP,                              -- when it last did MQTT handshake
  last_heartbeat  TIMESTAMP,                               -- when it last sent a heartbeat
  latest_data     JSONB,                                   -- most recent dummy sensor reading

  feed_interval_seconds INT DEFAULT 5,                      -- interval in seconds requested by user
  uploaded_at     TIMESTAMP DEFAULT now()      -- when this row was (re)created from a CSV
);

-- Seed initial whitelist device
INSERT INTO devices (mac_address, dongle_id, product_type, serial_number)
VALUES ('74:4D:BD:AA:C0:F0', 'DG-744D', 'Tilt-Sensor', 'SN-TILT744D')
ON CONFLICT (mac_address) DO NOTHING;


