import { useEffect, useState, useRef } from "react";
import { API_URL } from "../api.js";

function parseNum(val) {
  if (val === undefined || val === null || isNaN(Number(val))) return null;
  return Number(val);
}

function findKeyCaseInsensitive(obj, targetKey) {
  if (!obj || typeof obj !== "object") return undefined;
  const targetLower = targetKey.toLowerCase();
  for (const key of Object.keys(obj)) {
    if (key.toLowerCase() === targetLower) {
      return obj[key];
    }
  }
  return undefined;
}

function getRawIMU(data) {
  if (!data) return null;
  const ax = parseNum(data.Ax ?? data.ax ?? data.AX ?? data.acc_x ?? findKeyCaseInsensitive(data, "ax"));
  const ay = parseNum(data.Ay ?? data.ay ?? data.AY ?? data.acc_y ?? findKeyCaseInsensitive(data, "ay"));
  const az = parseNum(data.Az ?? data.az ?? data.AZ ?? data.acc_z ?? findKeyCaseInsensitive(data, "az"));
  const gx = parseNum(data.Gx ?? data.gx ?? data.GX ?? data.gyro_x ?? findKeyCaseInsensitive(data, "gx"));
  const gy = parseNum(data.Gy ?? data.gy ?? data.GY ?? data.gyro_y ?? findKeyCaseInsensitive(data, "gy"));
  const gz = parseNum(data.Gz ?? data.gz ?? data.GZ ?? data.gyro_z ?? findKeyCaseInsensitive(data, "gz"));

  if (ax === null && ay === null && az === null) return null;
  return { ax, ay, az, gx: gx || 0, gy: gy || 0, gz: gz || 0 };
}

function checkFreefall(data) {
  const imu = getRawIMU(data);
  if (!imu) return false;
  // Calculate total acceleration magnitude
  const mag = Math.sqrt(imu.ax * imu.ax + imu.ay * imu.ay + imu.az * imu.az);
  if (mag === 0) return false;

  // Handle g-force units (~1.0g normal Earth gravity)
  if (mag < 2.0) {
    return mag < 0.25 && mag > 0.02;
  }
  // Handle raw MPU6050 LSB units (~16384 LSB normal gravity)
  if (mag >= 2.0 && mag < 4500) {
    return true;
  }
  return Boolean(data.freefall || data.drop);
}

function getTiltX(data) {
  if (!data) return 0;
  // First check if raw IMU (AX, AY, AZ) is provided
  const imu = getRawIMU(data);
  if (imu && (imu.ay !== 0 || imu.az !== 0)) {
    const rollRad = Math.atan2(imu.ay, imu.az);
    return parseFloat(((rollRad * 180) / Math.PI).toFixed(1));
  }
  const val = data.tilt_x ?? data.roll ?? data.x ?? data.TiltX ?? data.Roll;
  if (val !== undefined && val !== null && !isNaN(Number(val))) {
    return Number(val);
  }
  return 0;
}

function getTiltY(data) {
  if (!data) return 0;
  // First check if raw IMU (AX, AY, AZ) is provided
  const imu = getRawIMU(data);
  if (imu) {
    const pitchRad = Math.atan2(-imu.ax, Math.sqrt(imu.ay * imu.ay + imu.az * imu.az));
    return parseFloat(((pitchRad * 180) / Math.PI).toFixed(1));
  }
  const val = data.tilt_y ?? data.pitch ?? data.y ?? data.TiltY ?? data.Pitch;
  if (val !== undefined && val !== null && !isNaN(Number(val))) {
    return Number(val);
  }
  return 0;
}

function getDirection(data) {
  if (!data) return "LEVEL";
  if (checkFreefall(data)) return "FREEFALL 🚨";
  if (data.direction) return String(data.direction).toUpperCase();
  const tx = getTiltX(data);
  const ty = getTiltY(data);
  if (tx < -10 && ty > 10) return "FORWARD-LEFT";
  if (tx > 10 && ty > 10) return "FORWARD-RIGHT";
  if (tx < -10 && ty < -10) return "BACKWARD-LEFT";
  if (tx > 10 && ty < -10) return "BACKWARD-RIGHT";
  if (tx < -10) return "LEFT";
  if (tx > 10) return "RIGHT";
  if (ty > 10) return "FORWARD";
  if (ty < -10) return "BACKWARD";
  return "LEVEL";
}

function getSpeed(data) {
  if (!data) return 0;
  if (checkFreefall(data)) return 0;
  const ty = getTiltY(data);
  return ty > 5 ? 50 : 0;
}

// Gyroscope / Artificial Horizon Attitude Gauge
function TiltHorizonGauge({ tiltX, tiltY, direction, speed }) {
  const rollDeg = Math.max(-60, Math.min(60, tiltX));
  const pitchPx = Math.max(-40, Math.min(40, tiltY * 1.2));

  return (
    <div style={{
      background: "linear-gradient(135deg, #0f172a, #1e293b)",
      borderRadius: "14px",
      padding: "16px",
      color: "#ffffff",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyBinding: "center",
      boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.3)",
      border: "1px solid #334155",
      position: "relative",
      overflow: "hidden"
    }}>
      <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px" }}>
        🧭 Gyro Attitude & Horizon
      </div>

      {/* Artificial Horizon Sphere */}
      <div style={{
        width: "130px",
        height: "130px",
        borderRadius: "50%",
        border: "4px solid #475569",
        position: "relative",
        overflow: "hidden",
        boxShadow: "inset 0 0 15px rgba(0,0,0,0.6)",
        background: "#0f172a"
      }}>
        {/* Sky / Ground Background with Roll & Pitch Rotation */}
        <div style={{
          position: "absolute",
          width: "200%",
          height: "200%",
          top: "-50%",
          left: "-50%",
          transform: `rotate(${-rollDeg}deg) translateY(${pitchPx}px)`,
          transition: "transform 0.15s ease-out"
        }}>
          {/* Sky */}
          <div style={{ height: "50%", background: "linear-gradient(to bottom, #0284c7, #38bdf8)" }} />
          {/* Ground */}
          <div style={{ height: "50%", background: "linear-gradient(to bottom, #78350f, #451a03)", borderTop: "2px solid #f59e0b" }} />
        </div>

        {/* Aircraft / Horizon Crosshair Overlay */}
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "60px",
          height: "4px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}>
          <div style={{ width: "20px", height: "4px", background: "#f59e0b", borderRadius: "2px", boxShadow: "0 0 8px #f59e0b" }} />
          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#ef4444" }} />
          <div style={{ width: "20px", height: "4px", background: "#f59e0b", borderRadius: "2px", boxShadow: "0 0 8px #f59e0b" }} />
        </div>
      </div>

      {/* Readout Summary */}
      <div style={{ display: "flex", gap: "16px", marginTop: "12px", fontSize: "0.85rem", fontWeight: 700 }}>
        <span style={{ color: tiltX < 0 ? "#38bdf8" : tiltX > 0 ? "#f43f5e" : "#cbd5e1" }}>
          Roll: {tiltX > 0 ? `+${tiltX.toFixed(1)}` : tiltX.toFixed(1)}°
        </span>
        <span style={{ color: tiltY > 0 ? "#10b981" : tiltY < 0 ? "#f59e0b" : "#cbd5e1" }}>
          Pitch: {tiltY > 0 ? `+${tiltY.toFixed(1)}` : tiltY.toFixed(1)}°
        </span>
      </div>
    </div>
  );
}

// Interactive Real-Time 2D Open Field Vehicle Playground Visualizer
function TiltCarVisualizer({ tiltX, tiltY, direction, speed, onManualTilt }) {
  const [manualMode, setManualMode] = useState(false);

  // 2D Open Field Car State
  const [carX, setCarX] = useState(0);
  const [carY, setCarY] = useState(0);
  const [heading, setHeading] = useState(0); // 0 to 360 degrees (0 = North/Up)
  const [skidMarks, setSkidMarks] = useState([]);

  // Safely parse input telemetry values
  const safeX = isNaN(Number(tiltX)) ? 0 : Number(tiltX);
  const safeY = isNaN(Number(tiltY)) ? 0 : Number(tiltY);

  // Constant Cruising Speed (Fixed 50 km/h)
  const constantSpeed = 50;

  // Forward & Backward Motion Logic
  const isForward = safeY > 5 || (manualMode && safeY > 5);
  const isBackward = safeY < -5 || (manualMode && safeY < -5);
  const currentSpeed = isForward ? constantSpeed : isBackward ? -35 : 0;

  // Steering Deadzone (8 deg): Requires deliberate tilt to turn vehicle
  const deadzone = 8;
  const activeX = Math.abs(safeX) > deadzone ? (safeX > 0 ? safeX - deadzone : safeX + deadzone) : 0;

  // Wheel turn visual angle (-35 deg to +35 deg)
  const wheelTurnAngle = Math.max(-35, Math.min(35, (activeX / 33) * 35));

  // 360° Open Field Motion Engine Loop (Forward & Reverse)
  useEffect(() => {
    const physicsLoop = setInterval(() => {
      // 1. Steering & Heading Rotation from Tilt Sensor Input
      if (Math.abs(activeX) > 0) {
        const turnRate = (activeX / 33) * 4.2; // degrees per frame
        setHeading((prevHeading) => (prevHeading + turnRate + 360) % 360);
      }

      // 2. 2D Position Translation along current Heading angle (Forward & Reverse)
      if (currentSpeed !== 0) {
        setHeading((currentHeading) => {
          const rad = (currentHeading * Math.PI) / 180;
          const moveStep = currentSpeed * 0.04;

          setCarX((prevX) => {
            const newX = prevX + Math.sin(rad) * moveStep;
            // Boundary wrap between -320px and +320px for expanded field
            if (newX > 320) return -320;
            if (newX < -320) return 320;
            return newX;
          });

          setCarY((prevY) => {
            const newY = prevY - Math.cos(rad) * moveStep;
            // Boundary wrap between -210px and +210px for expanded field
            if (newY > 210) return -210;
            if (newY < -210) return 210;
            return newY;
          });

          return currentHeading;
        });

        // 3. Generate Skid Marks during sharp turns
        if (Math.abs(activeX) > 20) {
          setCarX((currX) => {
            setCarY((currY) => {
              setSkidMarks((prev) => [
                ...prev.slice(-30),
                { id: Date.now() + Math.random(), x: currX, y: currY }
              ]);
              return currY;
            });
            return currX;
          });
        }
      }
    }, 30);

    return () => clearInterval(physicsLoop);
  }, [activeX, currentSpeed]);

  // Handle Touchpad Interactive Mouse Control Sandbox
  const handleMouseMove = (e) => {
    if (!manualMode || !onManualTilt) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * 2 - 1; // -1 to +1
    const relY = -(((e.clientY - rect.top) / rect.height) * 2 - 1); // -1 to +1

    const simX = parseFloat((relX * 45).toFixed(1));
    const simY = parseFloat((relY * 35).toFixed(1));
    onManualTilt(simX, simY);
  };

  // Format compass cardinal direction label
  const getCompassLabel = (deg) => {
    const normalized = (deg + 360) % 360;
    if (normalized >= 337.5 || normalized < 22.5) return "NORTH (0°)";
    if (normalized >= 22.5 && normalized < 67.5) return "NORTH-EAST (45°)";
    if (normalized >= 67.5 && normalized < 112.5) return "EAST (90°)";
    if (normalized >= 112.5 && normalized < 157.5) return "SOUTH-EAST (135°)";
    if (normalized >= 157.5 && normalized < 202.5) return "SOUTH (180°) [U-TURN]";
    if (normalized >= 202.5 && normalized < 247.5) return "SOUTH-WEST (225°)";
    if (normalized >= 247.5 && normalized < 292.5) return "WEST (270°)";
    return "NORTH-WEST (315°)";
  };

  return (
    <div style={{
      background: "radial-gradient(circle at center, #1e293b 0%, #0f172a 100%)",
      borderRadius: "16px",
      padding: "20px",
      color: "#ffffff",
      boxShadow: "0 15px 30px rgba(0,0,0,0.4)",
      border: "1px solid #334155",
      position: "relative",
      overflow: "hidden"
    }}>
      {/* Top Header with Manual Simulator Toggle */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", zIndex: 10, position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "1.3rem" }}>🏟️</span>
          <div>
            <span style={{ fontWeight: 800, fontSize: "0.95rem", letterSpacing: "0.05em", color: "#f8fafc" }}>
              360° OPEN FIELD VEHICLE ARENA
            </span>
            <div style={{ fontSize: "0.75rem", color: "#38bdf8", fontWeight: 700 }}>
              🔄 Full 360° U-Turns & Steering | Pitch = Dynamic Speed
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            onClick={() => setManualMode(!manualMode)}
            style={{
              background: manualMode ? "linear-gradient(135deg, #10b981, #059669)" : "#334155",
              color: "#ffffff",
              border: "none",
              borderRadius: "20px",
              padding: "5px 14px",
              fontSize: "0.78rem",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: manualMode ? "0 0 10px rgba(16, 185, 129, 0.4)" : "none",
              transition: "all 0.2s ease"
            }}
          >
            {manualMode ? "🎮 Mouse Control ON" : "🎮 Mouse Control"}
          </button>
        </div>
      </div>

      {/* Main Open Field Ground Arena (Height: 480px) */}
      <div
        onMouseMove={handleMouseMove}
        style={{
          width: "100%",
          height: "480px",
          position: "relative",
          background: "#0f172a",
          backgroundImage: "radial-gradient(#1e293b 1.5px, transparent 1.5px)",
          backgroundSize: "24px 24px",
          borderRadius: "12px",
          overflow: "hidden",
          border: manualMode ? "2px dashed #10b981" : "1px solid #334155",
          cursor: manualMode ? "crosshair" : "default"
        }}
      >
        {/* Cardinal Direction Compass Labels on Arena Boundaries */}
        <div style={{ position: "absolute", top: "8px", left: "50%", transform: "translateX(-50%)", fontSize: "0.75rem", color: "#38bdf8", fontWeight: 800 }}>N (0°)</div>
        <div style={{ position: "absolute", bottom: "8px", left: "50%", transform: "translateX(-50%)", fontSize: "0.75rem", color: "#f59e0b", fontWeight: 800 }}>S (180° - U-TURN)</div>
        <div style={{ position: "absolute", top: "50%", left: "8px", transform: "translateY(-50%)", fontSize: "0.75rem", color: "#94a3b8", fontWeight: 800 }}>W (270°)</div>
        <div style={{ position: "absolute", top: "50%", right: "8px", transform: "translateY(-50%)", fontSize: "0.75rem", color: "#94a3b8", fontWeight: 800 }}>E (90°)</div>

        {/* Skid Marks Layer */}
        {skidMarks.map((sm) => (
          <div
            key={sm.id}
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: `translate(calc(-50% + ${sm.x}px), calc(-50% + ${sm.y}px))`,
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              background: "rgba(0,0,0,0.6)",
              boxShadow: "0 0 6px rgba(0,0,0,0.5)",
              pointerEvents: "none"
            }}
          />
        ))}

        {/* Speedometer & Steering HUD Overlay */}
        <div style={{
          position: "absolute",
          top: "14px",
          left: "14px",
          background: "rgba(15, 23, 42, 0.9)",
          backdropFilter: "blur(8px)",
          padding: "8px 14px",
          borderRadius: "10px",
          border: "1px solid rgba(255,255,255,0.15)",
          display: "flex",
          alignItems: "center",
          gap: "14px",
          zIndex: 30
        }}>
          <div>
            <div style={{ fontSize: "0.65rem", color: "#94a3b8", fontWeight: 700 }}>GEAR & SPEED</div>
            <div style={{ fontSize: "1.1rem", fontWeight: 900, color: isForward ? "#38bdf8" : isBackward ? "#f43f5e" : "#94a3b8" }}>
              {isForward ? "FORWARD 50 km/h" : isBackward ? "REVERSE 35 km/h" : "STOPPED 0 km/h"}
            </div>
          </div>
          <div style={{ width: "1px", height: "24px", background: "rgba(255,255,255,0.15)" }} />
          <div>
            <div style={{ fontSize: "0.65rem", color: "#94a3b8", fontWeight: 700 }}>COMPASS BEARING</div>
            <div style={{ fontSize: "0.88rem", fontWeight: 800, color: "#f59e0b" }}>
              {getCompassLabel(heading)}
            </div>
          </div>
        </div>

        {manualMode && (
          <div style={{
            position: "absolute",
            bottom: "10px",
            right: "14px",
            fontSize: "0.75rem",
            background: "rgba(16, 185, 129, 0.2)",
            color: "#6ee7b7",
            padding: "4px 10px",
            borderRadius: "6px",
            border: "1px solid #10b981",
            zIndex: 30
          }}>
            👈 Move cursor in open field to steer, U-turn & accelerate 👉
          </div>
        )}

        {/* 360° Rotatable Sports Car Model (Ultra Compact: 24px x 40px) */}
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: `translate(calc(-50% + ${carX}px), calc(-50% + ${carY}px)) rotate(${heading}deg)`,
          transition: "transform 0.04s linear",
          width: "24px",
          height: "40px",
          zIndex: 20
        }}>
          {/* Rotating Headlight Beam Cones */}
          <div style={{
            position: "absolute",
            top: "-22px",
            left: "1px",
            width: "8px",
            height: "25px",
            background: isBackward ? "transparent" : "linear-gradient(to top, rgba(254, 240, 138, 0.8), transparent)",
            clipPath: "polygon(20% 100%, 80% 100%, 100% 0%, 0% 0%)"
          }} />
          <div style={{
            position: "absolute",
            top: "-22px",
            right: "1px",
            width: "8px",
            height: "25px",
            background: isBackward ? "transparent" : "linear-gradient(to top, rgba(254, 240, 138, 0.8), transparent)",
            clipPath: "polygon(20% 100%, 80% 100%, 100% 0%, 0% 0%)"
          }} />

          {/* High Contrast Racing Yellow Sports Car SVG */}
          <svg viewBox="0 0 120 180" style={{ width: "100%", height: "100%", filter: "drop-shadow(0 6px 12px rgba(0,0,0,0.9))" }}>
            {/* Front & Rear Tires with Turning Wheels */}
            <rect x="5" y="22" width="16" height="32" rx="5" fill="#0f172a" stroke="#fef08a" strokeWidth="2" transform={`rotate(${wheelTurnAngle}, 13, 38)`} />
            <rect x="99" y="22" width="16" height="32" rx="5" fill="#0f172a" stroke="#fef08a" strokeWidth="2" transform={`rotate(${wheelTurnAngle}, 107, 38)`} />
            <rect x="4" y="125" width="18" height="36" rx="5" fill="#0f172a" stroke="#64748b" strokeWidth="2" />
            <rect x="98" y="125" width="18" height="36" rx="5" fill="#0f172a" stroke="#64748b" strokeWidth="2" />

            {/* Main Racing Body (Vivid Racing Yellow) */}
            <path d="M 25,40 C 25,20 40,10 60,10 C 80,10 95,20 95,40 L 98,135 C 98,155 85,165 60,165 C 35,165 22,155 22,135 Z" fill="#f59e0b" stroke="#fef08a" strokeWidth="3" />
            
            {/* Center Racing Stripe */}
            <path d="M 52,10 L 68,10 L 68,165 L 52,165 Z" fill="#1e293b" opacity="0.85" />

            {/* Front Windshield */}
            <path d="M 32,65 C 32,55 42,50 60,50 C 78,50 88,55 88,65 L 82,90 C 82,90 60,93 38,90 Z" fill="#0284c7" stroke="#ffffff" strokeWidth="2" opacity="0.95" />

            {/* Roof Top */}
            <path d="M 38,92 L 82,92 L 78,125 L 42,125 Z" fill="#d97706" />

            {/* Rear Glass Window */}
            <path d="M 42,128 L 78,128 L 74,142 L 46,142 Z" fill="#0284c7" stroke="#ffffff" strokeWidth="1.5" opacity="0.9" />

            {/* Front Xenon Headlights */}
            <ellipse cx="32" cy="22" rx="9" ry="6" fill="#ffffff" stroke="#fef08a" strokeWidth="2" />
            <ellipse cx="88" cy="22" rx="9" ry="6" fill="#ffffff" stroke="#fef08a" strokeWidth="2" />
            
            {/* Rear LED Brake / Reverse Lights */}
            <rect x="25" y="160" width="22" height="7" rx="3" fill={isBackward ? "#ffffff" : "#ef4444"} stroke="#ffffff" strokeWidth="1.5" />
            <rect x="73" y="160" width="22" height="7" rx="3" fill={isBackward ? "#ffffff" : "#ef4444"} stroke="#ffffff" strokeWidth="1.5" />
          </svg>
        </div>
      </div>
    </div>
  );
}

// Live Raw Telemetry Data Viewer (AX, AY, AZ, GX, GY, GZ, JSON)
function RawDataViewer({ data }) {
  const [showJson, setShowJson] = useState(true);
  const imu = getRawIMU(data);

  return (
    <div style={{
      marginTop: "20px",
      background: "#0f172a",
      borderRadius: "12px",
      padding: "16px",
      border: "1px solid #334155",
      color: "#f8fafc"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981" }} />
          <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "#38bdf8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            📡 LIVE SENSOR TELEMETRY PAYLOAD
          </span>
        </div>
        <button
          onClick={() => setShowJson(!showJson)}
          style={{
            background: "#1e293b",
            color: "#94a3b8",
            border: "1px solid #475569",
            borderRadius: "6px",
            padding: "4px 10px",
            fontSize: "0.75rem",
            fontWeight: 700,
            cursor: "pointer"
          }}
        >
          {showJson ? "Hide Raw JSON" : "Show Raw JSON"}
        </button>
      </div>

      {/* Key Metric Badges */}
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: showJson ? "12px" : "0" }}>
        {imu ? (
          <>
            <div style={{ background: "#1e293b", padding: "6px 12px", borderRadius: "8px", border: "1px solid #334155", fontSize: "0.8rem" }}>
              <span style={{ color: "#94a3b8" }}>ACCEL (g-force):</span> <strong style={{ color: "#38bdf8" }}>AX={imu.ax} | AY={imu.ay} | AZ={imu.az}</strong>
            </div>
            <div style={{ background: "#1e293b", padding: "6px 12px", borderRadius: "8px", border: "1px solid #334155", fontSize: "0.8rem" }}>
              <span style={{ color: "#94a3b8" }}>GYRO (deg/s):</span> <strong style={{ color: "#c026d3" }}>GX={imu.gx} | GY={imu.gy} | GZ={imu.gz}</strong>
            </div>
          </>
        ) : (
          <div style={{ background: "#1e293b", padding: "6px 12px", borderRadius: "8px", border: "1px solid #334155", fontSize: "0.8rem", color: "#f59e0b" }}>
            ⚡ Standard Sensor Telemetry Stream Active
          </div>
        )}
      </div>

      {/* Raw JSON Block */}
      {showJson && (
        <pre style={{
          margin: 0,
          background: "#090d16",
          padding: "12px",
          borderRadius: "8px",
          fontSize: "0.82rem",
          color: "#34d399",
          fontFamily: "monospace",
          overflowX: "auto",
          border: "1px solid #1e293b"
        }}>
          {JSON.stringify(data || {}, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [devices, setDevices] = useState([]);
  const [historyMap, setHistoryMap] = useState({}); // { mac: [ { time, tiltX, tiltY } ] }
  const [zeroOffsets, setZeroOffsets] = useState({}); // { mac: { rollOffset, pitchOffset } }
  const [error, setError] = useState(null);

  // Calibrate Zero Resting Baseline for a specific device
  const handleCalibrateZero = (mac, rawRoll, rawPitch) => {
    setZeroOffsets((prev) => ({
      ...prev,
      [mac]: { roll: rawRoll, pitch: rawPitch }
    }));
  };

  // Reset Zero Calibration for a specific device
  const handleResetZero = (mac) => {
    setZeroOffsets((prev) => ({
      ...prev,
      [mac]: { roll: 0, pitch: 0 }
    }));
  };

  async function fetchDevices() {
    try {
      const res = await fetch(`${API_URL}/api/devices`);
      const data = await res.json();
      setDevices(data);
      setError(null);

      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setHistoryMap((prev) => {
        const next = { ...prev };
        data.forEach((d) => {
          const mac = d.mac_address;
          const offset = zeroOffsets[mac] || { roll: 0, pitch: 0 };
          const rawX = getTiltX(d.latest_data);
          const rawY = getTiltY(d.latest_data);
          const tx = parseFloat((rawX - offset.roll).toFixed(1));
          const ty = parseFloat((rawY - offset.pitch).toFixed(1));
          if (!next[mac]) next[mac] = [];

          const lastEntry = next[mac][next[mac].length - 1];
          if (!lastEntry || lastEntry.tiltX !== tx || lastEntry.tiltY !== ty || next[mac].length === 0) {
            next[mac] = [...next[mac].slice(-30), { time: nowTime, tiltX: tx, tiltY: ty }];
          }
        });
        return next;
      });
    } catch (err) {
      setError("Could not reach backend: " + err.message);
    }
  }

  useEffect(() => {
    fetchDevices();
    // High-speed 100ms real-time telemetry polling for fast car motion
    const interval = setInterval(fetchDevices, 100);
    return () => clearInterval(interval);
  }, [zeroOffsets]);

  // Handle local simulated mouse movements from dashboard visualizer
  const handleManualTiltUpdate = (mac, simX, simY) => {
    setDevices((prevDevices) => {
      if (prevDevices.length === 0) {
        return [{
          mac_address: "74:4D:BD:AA:C0:F0",
          dongle_id: "DG-744D (Demo Playground)",
          product_type: "Tilt-Sensor",
          serial_number: "SN-TILT744D",
          status: "connected",
          last_handshake: new Date().toISOString(),
          latest_data: {
            tilt_x: simX,
            tilt_y: simY,
            speed: getSpeed({ tilt_x: simX, tilt_y: simY }),
            direction: simX < -10 ? "LEFT" : simX > 10 ? "RIGHT" : simY > 10 ? "FORWARD" : "LEVEL"
          }
        }];
      }
      return prevDevices.map((dev) => {
        if (dev.mac_address === mac || mac.includes("Demo")) {
          const updatedLatest = {
            ...(dev.latest_data || {}),
            tilt_x: simX,
            tilt_y: simY,
            speed: getSpeed({ tilt_x: simX, tilt_y: simY }),
            direction: simX < -10 ? "LEFT" : simX > 10 ? "RIGHT" : simY > 10 ? "FORWARD" : "LEVEL"
          };
          return { ...dev, latest_data: updatedLatest };
        }
        return dev;
      });
    });
  };

  const activeCount = devices.filter((d) => d.status === "connected").length;
  const tiltXValues = devices.map((d) => {
    const offset = zeroOffsets[d.mac_address] || { roll: 0, pitch: 0 };
    return getTiltX(d.latest_data) - offset.roll;
  });
  const tiltYValues = devices.map((d) => {
    const offset = zeroOffsets[d.mac_address] || { roll: 0, pitch: 0 };
    return getTiltY(d.latest_data) - offset.pitch;
  });

  const avgRoll = tiltXValues.length > 0 ? (tiltXValues.reduce((a, b) => a + b, 0) / tiltXValues.length).toFixed(1) : "0.0";
  const avgPitch = tiltYValues.length > 0 ? (tiltYValues.reduce((a, b) => a + b, 0) / tiltYValues.length).toFixed(1) : "0.0";

  return (
    <div className="container">
      <h2>Tilt Sensor & Vehicle Dashboard</h2>
      <p className="subtitle">
        High-speed real-time MQTT tilt sensor telemetry stream with live car steering physics.
      </p>

      {error && <div className="message error">{error}</div>}

      {/* Top Status Bar */}
      <div className="metrics-grid" style={{ marginBottom: "24px" }}>
        <div className="metric-card">
          <div className="metric-icon-bg" style={{ background: "#eff6ff", color: "#3b82f6" }}>⚡</div>
          <div className="metric-card-content">
            <span className="metric-label">CONNECTED DEVICES</span>
            <span className="metric-value">{activeCount} / {devices.length}</span>
          </div>
        </div>
      </div>

      {/* Device Cards Loop (Falls back to Demo Playground if no device has completed handshake yet) */}
      {(devices.length > 0 ? devices : [
        {
          mac_address: "74:4D:BD:AA:C0:F0",
          dongle_id: "DG-744D (Demo Playground)",
          product_type: "Tilt-Sensor",
          serial_number: "SN-TILT744D",
          status: "connected",
          last_handshake: new Date().toISOString(),
          latest_data: { tilt_x: 0, tilt_y: 0, speed: 0, direction: "LEVEL" }
        }
      ]).map((d) => {
        const offset = zeroOffsets[d.mac_address] || { roll: 0, pitch: 0 };
        const rawRoll = getTiltX(d.latest_data);
        const rawPitch = getTiltY(d.latest_data);

        // Apply Tare Baseline Calibration Offset
        const tiltX = parseFloat((rawRoll - offset.roll).toFixed(1));
        const tiltY = parseFloat((rawPitch - offset.pitch).toFixed(1));

        const direction = getDirection({ tilt_x: tiltX, tilt_y: tiltY });
        const speed = getSpeed({ tilt_x: tiltX, tilt_y: tiltY });
        const deviceHistory = historyMap[d.mac_address] || [];

        return (
          <div key={d.mac_address} className="device-card">
            <div className="card-header">
              <div className="device-title">
                <h3>{d.dongle_id}</h3>
                <span className="subtitle" style={{ margin: 0, fontSize: "0.85rem" }}>({d.product_type} - {d.serial_number})</span>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <span style={{ background: "#f1f5f9", color: "#334155", padding: "4px 10px", borderRadius: "6px", fontWeight: 700, fontSize: "0.78rem" }}>
                  🧭 {direction}
                </span>
                <span className={`status-tag status-${d.status}`}>{d.status}</span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
              <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
                MAC Address: <code>{d.mac_address}</code> | Last Handshake: {d.last_handshake ? new Date(d.last_handshake).toLocaleTimeString() : "—"}
              </div>

              {/* 1-Click Zero Calibration Controls */}
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                {offset.roll !== 0 || offset.pitch !== 0 ? (
                  <>
                    <span style={{ fontSize: "0.75rem", color: "#10b981", fontWeight: 700 }}>
                      🎯 Zero Offset: R:{offset.roll}° P:{offset.pitch}°
                    </span>
                    <button
                      onClick={() => handleResetZero(d.mac_address)}
                      style={{
                        background: "#334155",
                        color: "#94a3b8",
                        border: "none",
                        borderRadius: "6px",
                        padding: "4px 10px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        cursor: "pointer"
                      }}
                    >
                      🔄 Reset Baseline
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleCalibrateZero(d.mac_address, rawRoll, rawPitch)}
                    style={{
                      background: "linear-gradient(135deg, #0284c7, #0369a1)",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "6px",
                      padding: "5px 12px",
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      boxShadow: "0 2px 8px rgba(2, 132, 199, 0.4)"
                    }}
                  >
                    🎯 Calibrate Zero (Set Resting Baseline)
                  </button>
                )}
              </div>
            </div>

            {/* Top Interactive Car & Gyro Section */}
            <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginBottom: "20px" }}>
              <TiltCarVisualizer
                tiltX={tiltX}
                tiltY={tiltY}
                direction={direction}
                speed={speed}
                onManualTilt={(simX, simY) => handleManualTiltUpdate(d.mac_address, simX, simY)}
              />

              <TiltHorizonGauge
                tiltX={tiltX}
                tiltY={tiltY}
                direction={direction}
                speed={speed}
              />
            </div>

            {/* Live Raw Telemetry Data Viewer (AX, AY, AZ, GX, GY, GZ, JSON) */}
            <RawDataViewer data={d.latest_data} />
          </div>
        );
      })}
    </div>
  );
}
