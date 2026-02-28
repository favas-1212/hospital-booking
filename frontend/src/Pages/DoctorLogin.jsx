import React, { useState } from "react";
import { Container, Form, Button } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import { loginDoctor } from "../services/allApi";

function DoctorLogin() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // ---------------- Login Doctor ----------------
  const handleLogin = async () => {
    if (!email || !password) {
      toast.error("Please enter email and password");
      return;
    }

    try {
      const res = await loginDoctor({
        username: email, // email used as username
        password: password,
      });

      if (res.data.token) {
        localStorage.setItem("doctorToken", res.data.token);
      }

      toast.success("Doctor Login Successful");
      navigate("/doctordashboard");
    } catch (err) {
      toast.error(err.response?.data?.error || "Login failed");
    }
  };

  return (
    <Container
      fluid
      className="min-vh-100 d-flex flex-column"
      style={{
        maxWidth: "420px",
        background: "linear-gradient(135deg, #E6FFFA, #F0FDFA)",
      }}
    >
      {/* HEADER */}
      <div className="d-flex align-items-center py-3 border-bottom">
        <ArrowBackIosNewIcon
          style={{ cursor: "pointer" }}
          onClick={() => navigate(-1)}
        />
        <h6 className="fw-bold mx-auto mb-0">Doctor Login</h6>
      </div>

      {/* CONTENT */}
      <div className="flex-grow-1 d-flex flex-column align-items-center justify-content-start px-3 pt-5">
        <h4 className="fw-bold mb-4" style={{ color: "#0E7490" }}>
          Login as Doctor
        </h4>

        {/* Email */}
        <Form.Control
          type="email"
          placeholder="Enter your email"
          className="mb-3 p-3"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ borderRadius: "10px" }}
        />

        {/* Password */}
        <Form.Control
          type="password"
          placeholder="Enter your password"
          className="mb-3 p-3"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ borderRadius: "10px" }}
        />

        {/* Login Button */}
        <Button
          className="w-100 py-2"
          style={{
            background: "linear-gradient(90deg, #0E7490, #14B8A6)",
            border: "none",
            borderRadius: "10px",
            fontWeight: "600",
          }}
          onClick={handleLogin}
        >
          Login
        </Button>

        <p className="mt-4 text-center">
          Don't have an account?{" "}
          <Link to="/doctorregister" className="fw-semibold" style={{ color: "#0E7490" }}>
            Register Now
          </Link>
        </p>
      </div>
    </Container>
  );
}

export default DoctorLogin;