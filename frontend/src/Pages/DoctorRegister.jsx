import React, { useEffect, useState } from "react";
import { Container } from "react-bootstrap";
import { registerDoctor } from "../services/allApi";
import { toast } from "react-toastify";
import axios from "axios";
import { useNavigate } from "react-router-dom";

function DoctorRegister() {
  const navigate = useNavigate();
  const BASE_URL = "http://127.0.0.1:8000/api/booking";

  const [user, setUser] = useState({
    username: "",
    email: "",
    password: "",
    full_name: "",
    hospital: "",
    department: "",
    phone: "",
  });

  const [districts, setDistricts] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [departments, setDepartments] = useState([]);

  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axios.get(`${BASE_URL}/districts/`)
      .then(res => setDistricts(res.data))
      .catch(() => toast.error("Failed to load districts"));
  }, []);

  useEffect(() => {
    if (!selectedDistrict) return;
    axios.get(`${BASE_URL}/hospitals/?district_id=${selectedDistrict}`)
      .then(res => setHospitals(res.data))
      .catch(() => toast.error("Failed to load hospitals"));
  }, [selectedDistrict]);

  useEffect(() => {
    if (!user.hospital) return;
    axios.get(`${BASE_URL}/departments/?hospital_id=${user.hospital}`)
      .then(res => setDepartments(res.data))
      .catch(() => toast.error("Failed to load departments"));
  }, [user.hospital]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "phone") {
      let phoneValue = value;
      if (!/^[+\d]*$/.test(phoneValue)) return;
      if (!phoneValue.startsWith("+91")) {
        phoneValue = "+91" + phoneValue.replace(/^\+?91?/, "");
      }
      if (phoneValue.length > 13) return;
      setUser({ ...user, phone: phoneValue });
      if (!/^\+91[6789]\d{9}$/.test(phoneValue)) {
        setPhoneError("Enter valid number like +919876543210");
      } else setPhoneError("");
      return;
    }

    if (name === "email") {
      setUser({ ...user, email: value });
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
      setEmailError(emailRegex.test(value) ? "" : "Invalid email");
      return;
    }

    if (name === "password") {
      setUser({ ...user, password: value });
      const passwordRegex = /^(?=.*[A-Za-z])(?=.*[^A-Za-z0-9]).{8,}$/;
      setPasswordError(
        passwordRegex.test(value)
          ? ""
          : "Password must be at least 8 characters, include 1 letter and 1 special character"
      );
      return;
    }

    setUser({
      ...user,
      [name]: name === "hospital" || name === "department" ? Number(value) : value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (phoneError || emailError || passwordError) {
      toast.error("Fix validation errors first");
      return;
    }

    if (!user.hospital || !user.department) {
      toast.error("Select hospital and department");
      return;
    }

    try {
      setLoading(true);
      await registerDoctor(user);
      toast.success("Doctor registered! Waiting for OPD approval");
      navigate("/login");
      setUser({ username: "", email: "", password: "", full_name: "", hospital: "", department: "", phone: "" });
      setSelectedDistrict("");
      setHospitals([]);
      setDepartments([]);
      setPasswordError("");
    } catch (err) {
      toast.error(
        err.response?.data?.error ||
        err.response?.data?.detail ||
        "Registration failed"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #0f4c75 0%, #1b6ca8 50%, #118a7e 100%)",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'DM Sans', sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background decorative circles */}
      <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", background: "rgba(255,255,255,0.04)", top: -80, right: -80, pointerEvents: "none" }} />
      <div style={{ position: "absolute", width: 250, height: 250, borderRadius: "50%", background: "rgba(255,255,255,0.04)", bottom: 40, left: -60, pointerEvents: "none" }} />

      <Container className="d-flex justify-content-center" style={{ position: "relative", zIndex: 1, padding: "32px 24px" }}>
        <div
          style={{
            width: "100%",
            maxWidth: "520px",
            background: "#ffffff",
            borderRadius: "24px",
            boxShadow: "0 8px 40px rgba(0,0,0,0.25)",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              background: "linear-gradient(135deg, #0f4c75 0%, #1b6ca8 60%, #118a7e 100%)",
              padding: "28px 36px 24px",
              textAlign: "center",
            }}
          >
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: "rgba(255,255,255,0.12)",
                  borderRadius: 30,
                  padding: "6px 16px",
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80", display: "inline-block" }} />
                <span style={{ color: "#e0f2fe", fontSize: 13, fontWeight: 500 }}>MedQueue Portal</span>
              </div>
            </div>
            <h4 style={{ fontWeight: 800, fontSize: 26, color: "#fff", margin: "0 0 6px" }}>
              Doctor Registration
            </h4>
            <p style={{ color: "#bae6fd", fontSize: 14, margin: 0 }}>
              Create your account and join the MedQueue network
            </p>
          </div>

          {/* Body */}
          <div style={{ padding: "28px 36px 32px" }}>
            <form onSubmit={handleSubmit}>

              {/* Username + Full Name */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={S.label}>Username</label>
                  <input
                    name="username"
                    value={user.username}
                    onChange={handleChange}
                    required
                    placeholder="Enter username"
                    style={S.input}
                    className="dreg-input"
                  />
                </div>
                <div>
                  <label style={S.label}>Full Name</label>
                  <input
                    name="full_name"
                    value={user.full_name}
                    onChange={handleChange}
                    required
                    placeholder="Dr. Full Name"
                    style={S.input}
                    className="dreg-input"
                  />
                </div>
              </div>

              {/* Email */}
              <div style={{ marginBottom: 16 }}>
                <label style={S.label}>Email</label>
                <input
                  name="email"
                  value={user.email}
                  onChange={handleChange}
                  required
                  placeholder="doctor@email.com"
                  style={{ ...S.input, borderColor: emailError ? "#ef4444" : "#e2e8f0" }}
                  className="dreg-input"
                />
                {emailError && <p style={S.errorText}>{emailError}</p>}
              </div>

              {/* Password */}
              <div style={{ marginBottom: 16 }}>
                <label style={S.label}>Password</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={user.password}
                    onChange={handleChange}
                    required
                    placeholder="Min 8 chars with letter & special char"
                    style={{ ...S.input, paddingRight: 44, borderColor: passwordError ? "#ef4444" : "#e2e8f0" }}
                    className="dreg-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    style={{
                      position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", cursor: "pointer", padding: 0,
                      color: "#1b6ca8", display: "flex", alignItems: "center",
                    }}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
                {passwordError && <p style={S.errorText}>{passwordError}</p>}
              </div>

              {/* District */}
              <div style={{ marginBottom: 16 }}>
                <label style={S.label}>District</label>
                <select
                  value={selectedDistrict}
                  onChange={(e) => {
                    const districtId = e.target.value;
                    setSelectedDistrict(districtId);
                    setHospitals([]);
                    setDepartments([]);
                    setUser(prev => ({ ...prev, hospital: "", department: "" }));
                  }}
                  required
                  style={S.select}
                  className="dreg-input"
                >
                  <option value="">Select District</option>
                  {districts.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              {/* Hospital + Department */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={S.label}>Hospital</label>
                  <select
                    name="hospital"
                    value={user.hospital}
                    onChange={handleChange}
                    disabled={!selectedDistrict}
                    required
                    style={{ ...S.select, opacity: !selectedDistrict ? 0.5 : 1 }}
                    className="dreg-input"
                  >
                    <option value="">Select Hospital</option>
                    {hospitals.map(h => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Department</label>
                  <select
                    name="department"
                    value={user.department}
                    onChange={handleChange}
                    disabled={!user.hospital}
                    required
                    style={{ ...S.select, opacity: !user.hospital ? 0.5 : 1 }}
                    className="dreg-input"
                  >
                    <option value="">Select Department</option>
                    {departments.map(dep => (
                      <option key={dep.id} value={dep.id}>{dep.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Phone */}
              <div style={{ marginBottom: 28 }}>
                <label style={S.label}>Phone (+91)</label>
                <input
                  name="phone"
                  value={user.phone}
                  onChange={handleChange}
                  required
                  placeholder="+91XXXXXXXXXX"
                  style={{ ...S.input, borderColor: phoneError ? "#ef4444" : "#e2e8f0" }}
                  className="dreg-input"
                />
                {phoneError && <p style={S.errorText}>{phoneError}</p>}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  background: loading
                    ? "#94a3b8"
                    : "linear-gradient(90deg, #0f4c75, #118a7e)",
                  border: "none",
                  width: "100%",
                  padding: "12px",
                  borderRadius: 12,
                  fontWeight: 700,
                  fontSize: 15,
                  color: "#fff",
                  fontFamily: "'DM Sans', sans-serif",
                  boxShadow: loading ? "none" : "0 4px 20px rgba(15,76,117,0.35)",
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                {loading ? "Registering..." : "Register →"}
              </button>
            </form>

            <p style={{ textAlign: "center", marginTop: 22, color: "#64748b", fontSize: 13 }}>
              Already have an account?{" "}
              <span
                style={{ color: "#0f4c75", cursor: "pointer", fontWeight: 700 }}
                onClick={() => navigate("/login")}
              >
                Sign In
              </span>
            </p>
          </div>
        </div>
      </Container>

      <style>{`
        .dreg-input::placeholder { color: #94a3b8 !important; }
        .dreg-input:focus {
          background: #fff !important;
          border-color: #1b6ca8 !important;
          box-shadow: 0 0 0 3px rgba(27,108,168,0.15) !important;
          color: #0f172a !important;
          outline: none;
        }
        .dreg-input { caret-color: #0f4c75; }
        select option { color: #0f172a; }
      `}</style>
    </div>
  );
}

const S = {
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "#0f172a",
    marginBottom: 6,
  },
  input: {
    width: "100%",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    padding: "11px 14px",
    fontSize: 14,
    background: "#f8fafc",
    fontFamily: "'DM Sans', sans-serif",
    color: "#0f172a",
    boxSizing: "border-box",
    transition: "border-color 0.2s",
  },
  select: {
    width: "100%",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    padding: "11px 14px",
    fontSize: 14,
    background: "#f8fafc",
    fontFamily: "'DM Sans', sans-serif",
    color: "#0f172a",
    boxSizing: "border-box",
    cursor: "pointer",
    appearance: "auto",
    transition: "border-color 0.2s",
  },
  errorText: {
    margin: "5px 0 0",
    fontSize: 12,
    color: "#ef4444",
    fontWeight: 500,
  },
};

export default DoctorRegister;