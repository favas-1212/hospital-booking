import React, { useState } from "react";
import { Container, Form, InputGroup } from "react-bootstrap";
import { toast } from "react-toastify";
import { registerPatient } from "../services/allApi";
import VerifyOtp from "./Verify0tp";
import { Link } from "react-router-dom";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

function PatientRegister() {
  const [user, setUser] = useState({
    username: "",
    email: "",
    password: "",
    full_name: "",
    phone: "",
  });

  const [phoneError,    setPhoneError]    = useState("");
  const [emailError,    setEmailError]    = useState("");
  const [nameError,     setNameError]     = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showPassword,  setShowPassword]  = useState(false);
  const [step,          setStep]          = useState(1);

  // ---------------- HANDLE CHANGE ----------------
  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "full_name") {
      setUser({ ...user, full_name: value });
      if (!/^[A-Za-z.\s]*$/.test(value)) {
        setNameError("Only letters, spaces and dots allowed");
      } else if (value.length < 3) {
        setNameError("Full name must be at least 3 characters");
      } else {
        setNameError("");
      }
      return;
    }

    if (name === "password") {
      setUser({ ...user, password: value });
      const passwordRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*])[A-Za-z0-9!@#$%^&*]{8,}$/;
      if (!passwordRegex.test(value)) {
        setPasswordError("Min 8 chars, include 1 number & 1 special character");
      } else {
        setPasswordError("");
      }
      return;
    }

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
      } else {
        setPhoneError("");
      }
      return;
    }

    if (name === "email") {
      setUser({ ...user, email: value });
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
      if (!emailRegex.test(value)) {
        setEmailError("Enter a valid email address");
      } else {
        setEmailError("");
      }
      return;
    }

    setUser({ ...user, [name]: value });
  };

  // ---------------- HANDLE REGISTER ----------------
  const handleRegister = async (e) => {
    e.preventDefault();
    if (phoneError || emailError || nameError || passwordError) {
      toast.error("Please fix errors before submitting");
      return;
    }
    try {
      const res = await registerPatient(user);
      toast.success(res.data.message || "OTP sent to your email");
      setStep(2);
    } catch (err) {
      toast.error(err.response?.data?.error || "Registration failed");
    }
  };

  if (step === 2)
    return <VerifyOtp email={user.email} setStep={setStep} user={user} />;

  return (
    <div style={{
      background: "linear-gradient(135deg, #0f4c75 0%, #1b6ca8 50%, #118a7e 100%)",
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'DM Sans', sans-serif",
      position: "relative",
      overflow: "hidden",
      padding: "32px 16px",
    }}>
      {/* Decorative orbs */}
      <div style={{ position:"absolute", width:400, height:400, borderRadius:"50%", background:"rgba(255,255,255,0.04)", top:-80, right:-80, pointerEvents:"none" }} />
      <div style={{ position:"absolute", width:250, height:250, borderRadius:"50%", background:"rgba(255,255,255,0.04)", bottom:40, left:-60, pointerEvents:"none" }} />

      <Container className="d-flex justify-content-center" style={{ position:"relative", zIndex:1 }}>
        <div style={{
          width: "100%",
          maxWidth: "440px",
          background: "#ffffff",
          borderRadius: "24px",
          boxShadow: "0 8px 40px rgba(0,0,0,0.25)",
          overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{
            background: "linear-gradient(135deg, #0f4c75 0%, #1b6ca8 60%, #118a7e 100%)",
            padding: "28px 36px 24px",
            textAlign: "center",
          }}>
            <div style={{ display:"flex", justifyContent:"center", marginBottom:16 }}>
              <div style={{
                display:"inline-flex", alignItems:"center", gap:8,
                background:"rgba(255,255,255,0.12)", borderRadius:30, padding:"6px 16px",
              }}>
                <span style={{ width:8, height:8, borderRadius:"50%", background:"#4ade80", display:"inline-block" }} />
                <span style={{ color:"#e0f2fe", fontSize:13, fontWeight:500 }}>MedQueue Portal</span>
              </div>
            </div>
            <h4 style={{ fontWeight:800, fontSize:26, color:"#fff", margin:"0 0 6px" }}>
              Create Account
            </h4>
            <p style={{ color:"#bae6fd", fontSize:14, margin:0 }}>
              Start your healthcare journey with us
            </p>
          </div>

          {/* Body */}
          <div style={{ padding:"28px 36px 32px" }}>
            <Form onSubmit={handleRegister}>

              {/* Username */}
              <Form.Group className="mb-3">
                <Form.Label style={S.label}>Username</Form.Label>
                <Form.Control
                  name="username"
                  value={user.username}
                  onChange={handleChange}
                  placeholder="Choose a username"
                  required
                  style={S.input}
                  className="reg-input"
                />
              </Form.Group>

              {/* Email */}
              <Form.Group className="mb-3">
                <Form.Label style={S.label}>Email</Form.Label>
                <Form.Control
                  type="email"
                  name="email"
                  value={user.email}
                  onChange={handleChange}
                  placeholder="Enter your email"
                  isInvalid={!!emailError}
                  required
                  style={S.input}
                  className="reg-input"
                />
                <Form.Control.Feedback type="invalid">{emailError}</Form.Control.Feedback>
              </Form.Group>

              {/* Password */}
              <Form.Group className="mb-3">
                <Form.Label style={S.label}>Password</Form.Label>
                <InputGroup>
                  <Form.Control
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={user.password}
                    onChange={handleChange}
                    placeholder="Create a password"
                    isInvalid={!!passwordError}
                    required
                    style={{ ...S.input, borderRadius:"10px 0 0 10px", borderRight:"none" }}
                    className="reg-input"
                  />
                  <InputGroup.Text
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      cursor:"pointer", background:"#f8fafc",
                      border:"1px solid #e2e8f0", borderLeft:"none",
                      borderRadius:"0 10px 10px 0",
                    }}
                  >
                    {showPassword
                      ? <VisibilityOff style={{ color:"#1b6ca8", fontSize:18 }} />
                      : <Visibility   style={{ color:"#1b6ca8", fontSize:18 }} />}
                  </InputGroup.Text>
                  <Form.Control.Feedback type="invalid">{passwordError}</Form.Control.Feedback>
                </InputGroup>
              </Form.Group>

              {/* Full Name */}
              <Form.Group className="mb-3">
                <Form.Label style={S.label}>Full Name</Form.Label>
                <Form.Control
                  name="full_name"
                  value={user.full_name}
                  onChange={handleChange}
                  placeholder="Enter your full name"
                  isInvalid={!!nameError}
                  required
                  style={S.input}
                  className="reg-input"
                />
                <Form.Control.Feedback type="invalid">{nameError}</Form.Control.Feedback>
              </Form.Group>

              {/* Phone */}
              <Form.Group className="mb-4">
                <Form.Label style={S.label}>Phone (+91)</Form.Label>
                <Form.Control
                  type="tel"
                  placeholder="+91XXXXXXXXXX"
                  name="phone"
                  value={user.phone}
                  onChange={handleChange}
                  isInvalid={!!phoneError}
                  required
                  style={S.input}
                  className="reg-input"
                />
                <Form.Control.Feedback type="invalid">{phoneError}</Form.Control.Feedback>
              </Form.Group>

              <button type="submit" style={S.submitBtn}>
                Register & Send OTP →
              </button>
            </Form>

            <p style={{ textAlign:"center", marginTop:22, color:"#64748b", fontSize:13 }}>
              Already have an account?{" "}
              <Link to="/login" style={{ color:"#0f4c75", fontWeight:700, textDecoration:"none" }}>
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </Container>

      <style>{`
        .reg-input::placeholder { color: #94a3b8 !important; }
        .reg-input:focus {
          background: #fff !important;
          border-color: #1b6ca8 !important;
          box-shadow: 0 0 0 3px rgba(27,108,168,0.15) !important;
          color: #0f172a !important;
          outline: none;
        }
        .reg-input { caret-color: #0f4c75; }
      `}</style>
    </div>
  );
}

const S = {
  label: {
    color:"#0f172a", fontWeight:600, fontSize:13, marginBottom:6,
  },
  input: {
    borderRadius:10, background:"#f8fafc",
    border:"1px solid #e2e8f0", color:"#0f172a",
    padding:"11px 14px", fontSize:14,
    fontFamily:"'DM Sans', sans-serif",
  },
  submitBtn: {
    background:"linear-gradient(90deg, #0f4c75, #118a7e)",
    border:"none", width:"100%", padding:"12px",
    borderRadius:12, fontWeight:700, fontSize:15,
    color:"#fff", fontFamily:"'DM Sans', sans-serif",
    boxShadow:"0 4px 20px rgba(15,76,117,0.35)",
    cursor:"pointer",
  },
};

export default PatientRegister;