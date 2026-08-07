// Runs on a timer. Any device that hasn't sent a heartbeat (or data,
// which also counts as "alive") within HEARTBEAT_TIMEOUT_SECONDS gets
// flipped to 'offline'. The dashboard still shows it, just tagged
// offline with its last known reading.

const db = require("../db");

function startHeartbeatChecker() {
  const timeoutSeconds = parseInt(process.env.HEARTBEAT_TIMEOUT_SECONDS || "30", 10);

  setInterval(async () => {
    try {
      await db.query(
        `UPDATE devices
         SET status = 'offline'
         WHERE status = 'connected'
           AND last_heartbeat < now() - ($1 || ' seconds')::interval`,
        [timeoutSeconds]
      );
    } catch (err) {
      console.error("[heartbeatChecker] error:", err.message);
    }
  }, 5000); // check every 5s

  console.log(`[heartbeatChecker] running, offline after ${timeoutSeconds}s of silence`);
}

module.exports = { startHeartbeatChecker };
