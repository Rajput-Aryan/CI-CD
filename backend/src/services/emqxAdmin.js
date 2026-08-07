// Small helper that talks to EMQX's own REST API (not the MQTT
// protocol). We use this for exactly one thing: force-disconnecting
// a device the moment it's removed from the whitelist, instead of
// waiting for it to naturally drop off.

const EMQX_API_URL = process.env.EMQX_API_URL;
const EMQX_API_USER = process.env.EMQX_API_USER;
const EMQX_API_PASS = process.env.EMQX_API_PASS;

function basicAuthHeader() {
  const token = Buffer.from(`${EMQX_API_USER}:${EMQX_API_PASS}`).toString("base64");
  return `Basic ${token}`;
}

// clientId here is the device's MAC address, since sandbox devices
// connect using their MAC as the MQTT client id.
async function kickClient(mac) {
  if (!EMQX_API_URL || EMQX_API_URL === "undefined" || EMQX_API_URL.trim() === "") return;
  try {
    const res = await fetch(`${EMQX_API_URL}/clients/${encodeURIComponent(mac)}`, {
      method: "DELETE",
      headers: { Authorization: basicAuthHeader() },
    });
    // 404 just means the device wasn't connected anyway - that's fine.
    if (!res.ok && res.status !== 404) {
      console.warn(`[emqxAdmin] Failed to kick ${mac}: HTTP ${res.status}`);
    } else {
      console.log(`[emqxAdmin] Kicked ${mac} from EMQX (if it was connected)`);
    }
  } catch (err) {
    console.warn(`[emqxAdmin] Error kicking ${mac}:`, err.message);
  }
}

module.exports = { kickClient };
