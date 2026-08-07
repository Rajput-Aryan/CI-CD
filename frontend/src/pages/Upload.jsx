import { useRef, useState } from "react";
import { API_URL } from "../api.js";

export default function Upload() {
  const [file, setFile] = useState(null);
  const [previewRows, setPreviewRows] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const [clearing, setClearing] = useState(false);
  const [clearResult, setClearResult] = useState(null);

  const fileInputRef = useRef(null);

  function pickFile(selected) {
    setResult(null);
    setError(null);
    setPreviewRows([]);

    if (selected && !selected.name.toLowerCase().endsWith(".csv")) {
      setError("Please choose a valid .csv file.");
      setFile(null);
      return;
    }

    setFile(selected);

    if (selected) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        const lines = text.split("\n").filter((l) => l.trim().length > 0);
        if (lines.length > 0) {
          const parsed = lines.slice(0, 6).map((line) => line.split(",").map((c) => c.trim()));
          setPreviewRows(parsed);
        }
      };
      reader.readAsText(selected);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      pickFile(e.dataTransfer.files[0]);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!file) {
      setError("Please select a CSV file first.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    try {
      const res = await fetch(`${API_URL}/api/upload-csv`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Upload failed.");
      } else {
        setResult(data);
        setFile(null);
        setPreviewRows([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    } catch (err) {
      setError("Could not connect to backend server: " + err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleClear() {
    const confirmed = window.confirm(
      "⚠️ WARNING: This will delete ALL devices from the database whitelist and disconnect active instruments. Continue?"
    );
    if (!confirmed) return;

    setClearing(true);
    setClearResult(null);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/clear-whitelist`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to clear whitelist.");
      } else {
        setClearResult(data);
      }
    } catch (err) {
      setError("Could not connect to backend server: " + err.message);
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="container">
      <h2>Device Whitelist Provisioning Portal</h2>
      <p className="subtitle">
        Upload manufacturing CSV records to register authorized MAC addresses, Dongle IDs, and Product Specifications.
      </p>

      <div className="upload-box">
        <h3 style={{ margin: "0 0 8px 0", fontSize: "1.15rem" }}>📁 Add / Update Whitelisted Devices</h3>
        <p className="hint" style={{ fontSize: "0.88rem", color: "#64748b", margin: 0 }}>
          Required CSV Headers: <code>mac_address, dongle_id, product_type, serial_number</code>
        </p>

        <form onSubmit={handleSubmit} style={{ marginTop: "16px" }}>
          <div
            className={`dropzone ${dragActive ? "drag-active" : ""} ${file ? "has-file" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={(e) => pickFile(e.target.files[0])}
              hidden
            />
            {file ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "1.8rem" }}>📄</span>
                <span style={{ fontSize: "1.05rem", fontWeight: 700 }}>{file.name}</span>
                <span style={{ fontSize: "0.8rem", opacity: 0.8 }}>{(file.size / 1024).toFixed(1)} KB — Click to change</span>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "2.2rem" }}>📥</span>
                <span style={{ fontSize: "1.05rem", fontWeight: 600, color: "#334155" }}>
                  Drag & Drop CSV file here, or click to browse
                </span>
                <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Accepts standard .csv manufacturing device manifest</span>
              </div>
            )}
          </div>

          {/* File Preview Table */}
          {previewRows.length > 0 && (
            <div style={{ marginBottom: "20px" }}>
              <h4 style={{ fontSize: "0.85rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
                File Preview (First {previewRows.length - 1} records):
              </h4>
              <div className="table-card" style={{ marginTop: 0 }}>
                <table>
                  <thead>
                    <tr>
                      {previewRows[0].map((h, i) => (
                        <th key={i}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.slice(1).map((row, i) => (
                      <tr key={i}>
                        {row.map((cell, j) => (
                          <td key={j}><code>{cell}</code></td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <button type="submit" className="primary-btn" disabled={!file || uploading}>
              {uploading ? "Uploading Records..." : "🚀 Upload & Whitelist Devices"}
            </button>
            {file && (
              <button 
                type="button" 
                style={{ background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1" }}
                onClick={() => { setFile(null); setPreviewRows([]); }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        {result && (
          <div className="message success">
            ✅ Success! Processed {result.added_or_updated} device record(s) into database whitelist.
          </div>
        )}
        {error && <div className="message error">⚠️ {error}</div>}
      </div>

      <div className="upload-box danger-box">
        <h3 style={{ margin: "0 0 8px 0", color: "#991b1b", fontSize: "1.1rem" }}>⚠️ Danger Zone: Clear Whitelist</h3>
        <p className="hint" style={{ color: "#64748b", margin: "0 0 16px 0", fontSize: "0.88rem" }}>
          This action wipes all whitelisted device entries from PostgreSQL and force-disconnects active sessions.
        </p>
        <button className="danger-button" onClick={handleClear} disabled={clearing}>
          {clearing ? "Wiping Database..." : "🗑️ Clear Whitelist Database"}
        </button>

        {clearResult && (
          <div className="message success">
            ✅ Database cleared — Removed {clearResult.removed} whitelisted device record(s).
          </div>
        )}
      </div>
    </div>
  );
}
