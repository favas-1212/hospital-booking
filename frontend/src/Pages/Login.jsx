import React, { useState } from "react";
import { Container, Form, Button, InputGroup } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { loginPatient, loginDoctor } from "../services/allApi";
import ForgotPasswordModal from "../Components/ForgotPasswordModal";

function Login() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("patient");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!username || !password) {
      toast.error("Please enter username and password");
      return;
    }

    try {
      let res;

      if (activeTab === "patient") {
        res = await loginPatient({ username, password });

        sessionStorage.setItem("token", res.data.token);
        sessionStorage.setItem("role", "patient");
        sessionStorage.setItem("username", username);

        toast.success("Patient Login Successful");
        navigate("/");
      } else {
        res = await loginDoctor({ username, password });

        sessionStorage.setItem("token", res.data.token);
        sessionStorage.setItem("role", "doctor");
        sessionStorage.setItem("username", username);

        toast.success("Doctor Login Successful");
        navigate("/doctordashboard");
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "Login failed");
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
      {/* Decorative circles */}
      <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", background: "rgba(255,255,255,0.04)", top: -80, right: -80, pointerEvents: "none" }} />
      <div style={{ position: "absolute", width: 250, height: 250, borderRadius: "50%", background: "rgba(255,255,255,0.04)", bottom: 40, left: -60, pointerEvents: "none" }} />

      <Container className="d-flex justify-content-center" style={{ position: "relative", zIndex: 1 }}>
        <div
          style={{
            width: "100%",
            maxWidth: "440px",
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
              Welcome Back
            </h4>
            <p style={{ color: "#bae6fd", fontSize: 14, margin: 0 }}>
              Manage your healthcare journey seamlessly
            </p>
          </div>

          {/* Body */}
          <div style={{ padding: "28px 36px 32px" }}>

            {/* Tab switcher */}
            <div
              style={{
                display: "flex",
                background: "#f1f5f9",
                borderRadius: 12,
                padding: 4,
                marginBottom: 28,
                gap: 4,
              }}
            >
              {["patient", "doctor"].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab);
                    setUsername("");
                    setPassword("");
                    setShowPassword(false);
                  }}
                  style={{
                    flex: 1,
                    padding: "9px 0",
                    borderRadius: 9,
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: 13,
                    fontFamily: "'DM Sans', sans-serif",
                    transition: "all 0.2s ease",
                    background: activeTab === tab ? "linear-gradient(90deg, #0f4c75, #118a7e)" : "transparent",
                    color: activeTab === tab ? "#fff" : "#64748b",
                    boxShadow: activeTab === tab ? "0 2px 12px rgba(15,76,117,0.3)" : "none",
                  }}
                >
                  {tab === "patient" ? "Patient" : "Doctor"}
                </button>
              ))}
            </div>

            {/* Form */}
            <Form onSubmit={handleLogin}>
              <Form.Group className="mb-3">
                <Form.Label style={{ color: "#0f172a", fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
                  Username
                </Form.Label>
                <Form.Control
                  type="text"
                  placeholder={`Enter ${activeTab} username`}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  style={{
                    borderRadius: 10,
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    color: "#0f172a",
                    padding: "11px 14px",
                    fontSize: 14,
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                  className="login-input"
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label style={{ color: "#0f172a", fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
                  Password
                </Form.Label>
                <InputGroup>
                  <Form.Control
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={{
                      borderRadius: "10px 0 0 10px",
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRight: "none",
                      color: "#0f172a",
                      padding: "11px 14px",
                      fontSize: 14,
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                    className="login-input"
                  />
                  <InputGroup.Text
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      cursor: "pointer",
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderLeft: "none",
                      borderRadius: "0 10px 10px 0",
                    }}
                  >
                    {showPassword ? (
                      <VisibilityOff style={{ color: "#1b6ca8", fontSize: 18 }} />
                    ) : (
                      <Visibility style={{ color: "#1b6ca8", fontSize: 18 }} />
                    )}
                  </InputGroup.Text>
                </InputGroup>

                {/* Forgot Password — original functionality preserved */}
                <div className="mt-2">
                  <button
                    type="button"
                    className="btn btn-link p-0 text-decoration-none"
                    style={{ color: "#1b6ca8", fontSize: "14px" }}
                    onClick={() => setShowForgotPassword(true)}
                  >
                    Forgot Password?
                  </button>
                </div>
              </Form.Group>

              <Button
                type="submit"
                style={{
                  background: "linear-gradient(90deg, #0f4c75, #118a7e)",
                  border: "none",
                  width: "100%",
                  padding: "12px",
                  borderRadius: 12,
                  fontWeight: 700,
                  fontSize: 15,
                  color: "#fff",
                  fontFamily: "'DM Sans', sans-serif",
                  boxShadow: "0 4px 20px rgba(15,76,117,0.35)",
                  cursor: "pointer",
                }}
              >
                Sign In →
              </Button>
            </Form>

            <p style={{ textAlign: "center", marginTop: 22, color: "#64748b", fontSize: 13 }}>
              Don't have an account?{" "}
              <span
                style={{ color: "#0f4c75", cursor: "pointer", fontWeight: 700 }}
                onClick={() =>
                  navigate(activeTab === "patient" ? "/patientregister" : "/doctorregister")
                }
              >
                Create Account
              </span>
            </p>
          </div>
        </div>
      </Container>

      {/* ForgotPasswordModal — original functionality preserved */}
      <ForgotPasswordModal
        show={showForgotPassword}
        onHide={() => setShowForgotPassword(false)}
        userType={activeTab === "patient" ? "patient" : "doctor"}
      />

      <style>{`
        .login-input::placeholder { color: #94a3b8 !important; }
        .login-input:focus {
          background: #fff !important;
          border-color: #1b6ca8 !important;
          box-shadow: 0 0 0 3px rgba(27,108,168,0.15) !important;
          color: #0f172a !important;
          outline: none;
        }
        .login-input { caret-color: #0f4c75; }
      `}</style>
    </div>
  );
}

export default Login;