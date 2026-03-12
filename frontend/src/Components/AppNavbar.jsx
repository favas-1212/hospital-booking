// AppNavbar.jsx — place in src/components/
import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";

const NAV_PATIENT = [
  { to:"/",            label:"Home" },
  { to:"/booking",     label:"Book Token" },
  { to:"/mybookings",  label:"My Bookings" },
  { to:"/patient/status", label:"Track Token" },
  { to:"/instructions",label:"How It Works" },
  { to:"/contact",     label:"Contact" },
];

const NAV_DOCTOR = [
  { to:"/doctor/dashboard", label:"Dashboard" },
  { to:"/contact",          label:"Contact" },
];

const NAV_STAFF = [
  { to:"/staff/dashboard", label:"OPD Dashboard" },
  { to:"/contact",         label:"Contact" },
];

export default function AppNavbar() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const [open, setOpen] = useState(false);

  const role  = sessionStorage.getItem("role");     // "patient" | "doctor" | "staff"
  const token = sessionStorage.getItem("token");

  const navLinks = role==="doctor" ? NAV_DOCTOR : role==="staff" ? NAV_STAFF : NAV_PATIENT;

  const handleLogout = () => {
    sessionStorage.clear();
    navigate("/login");
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav style={N.nav}>
      <div style={N.inner}>
        {/* Logo */}
        <Link to="/" style={{ textDecoration:"none", display:"flex", alignItems:"center", gap:8 }}>
          <div style={N.logo}>🏥</div>
          <span style={{ fontWeight:800, fontSize:18, color:"#0f4c75", letterSpacing:-0.5 }}>MedQueue</span>
        </Link>

        {/* Desktop links */}
        <div style={{ display:"flex", alignItems:"center", gap:4, flexWrap:"wrap" }} className="nav-links">
          {navLinks.map(l => (
            <Link key={l.to} to={l.to} style={{
              ...N.link,
              background:  isActive(l.to) ? "#f0f9ff" : "transparent",
              color:       isActive(l.to) ? "#0f4c75" : "#475569",
              fontWeight:  isActive(l.to) ? 700 : 500,
            }}>{l.label}</Link>
          ))}
        </div>

        {/* Auth buttons */}
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          {token ? (
            <>
              <span style={{ fontSize:13, color:"#94a3b8", textTransform:"capitalize" }}>{role}</span>
              <button onClick={handleLogout} style={N.logoutBtn}>Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" style={{ textDecoration:"none" }}>
                <button style={N.loginBtn}>Login</button>
              </Link>
              <Link to="/register" style={{ textDecoration:"none" }}>
                <button style={N.registerBtn}>Register</button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

const N = {
  nav:        { background:"#fff", borderBottom:"1px solid #e2e8f0", padding:"0 24px", position:"sticky", top:0, zIndex:100, boxShadow:"0 1px 8px rgba(0,0,0,0.06)" },
  inner:      { maxWidth:1200, margin:"0 auto", height:64, display:"flex", alignItems:"center", justifyContent:"space-between", gap:16 },
  logo:       { width:36, height:36, borderRadius:10, background:"linear-gradient(135deg,#0f4c75,#118a7e)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 },
  link:       { textDecoration:"none", padding:"6px 12px", borderRadius:8, fontSize:14, transition:"all 0.15s" },
  loginBtn:   { background:"transparent", border:"1.5px solid #0f4c75", color:"#0f4c75", borderRadius:8, padding:"7px 16px", fontWeight:600, fontSize:13, cursor:"pointer" },
  registerBtn:{ background:"linear-gradient(90deg,#0f4c75,#118a7e)", color:"#fff", border:"none", borderRadius:8, padding:"8px 16px", fontWeight:600, fontSize:13, cursor:"pointer" },
  logoutBtn:  { background:"#fef2f2", color:"#dc2626", border:"1px solid #fca5a5", borderRadius:8, padding:"7px 14px", fontWeight:600, fontSize:13, cursor:"pointer" },
};
