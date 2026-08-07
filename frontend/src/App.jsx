import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import Upload from "./pages/Upload.jsx";
import Dashboard from "./pages/Dashboard.jsx";

function NavContent() {
  const location = useLocation();
  const path = location.pathname;

  return (
    <nav>
      <div className="nav-brand">
        <div className="nav-brand-icon">📡</div>
        <span>SYSNet IoT Portal</span>
      </div>
      <div className="nav-links">
        <Link to="/dashboard" className={path === "/dashboard" || path === "/" ? "active" : ""}>
          📊 Dashboard
        </Link>
        <Link to="/upload" className={path === "/upload" ? "active" : ""}>
          📁 Whitelist CSV
        </Link>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <NavContent />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}
