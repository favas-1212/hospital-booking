import React, { useState } from "react";
import { Container, Form, Button } from "react-bootstrap";
import { useNavigate, Link } from "react-router-dom";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";

 function PatientLogin() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = () => {
    if (!username || !password) {
      alert("Please enter username and password");
      return;
    }

    // 🔁 CALL YOUR LOGIN API HERE
    // await patientLogin({ username, password });

    alert("Login successful");
    navigate("/landing"); // or /dashboard
  };

  return (
    <Container
      fluid
      className="min-vh-100 bg-white d-flex flex-column"
      style={{ maxWidth: "420px" }}
    >
      {/* HEADER */}
      <div className="d-flex align-items-center py-3 border-bottom">
        <ArrowBackIosNewIcon
          style={{ cursor: "pointer" }}
          onClick={() => navigate(-1)}
        />
        <h6 className="fw-bold mx-auto mb-0">Patient Login</h6>
      </div>

      {/* CONTENT */}
      <div className="flex-grow-1 d-flex flex-column align-items-center justify-content-start px-3 pt-5 my-5">
        <h4 className="fw-bold mb-4">Login as Patient</h4>

        {/* Username */}
        <Form.Control
          type="text"
          placeholder="Enter your username"
          className="mb-3 p-3"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        {/* Password */}
        <Form.Control
          type="password"
          placeholder="Enter your password"
          className="mb-3 p-3"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {/* Login Button */}
        <Button
          className="w-100 py-2"
          style={{
            backgroundColor: "#38bdf8",
            border: "none",
            borderRadius: "10px",
          }}
          onClick={handleLogin}
        >
          Login
        </Button>

        <p className="mt-4 text-center">
          Don't have an account?{" "}
          <Link to="/PatientRegister" className="text-primary fw-semibold">
            Register now
          </Link>
        </p>
      </div>
    </Container>
  );
}

export default PatientLogin;
