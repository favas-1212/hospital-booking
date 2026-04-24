import React, { useState } from "react";
import { Container, Card, Form, Button, Nav, InputGroup } from "react-bootstrap";
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

        sessionStorage.setItem("token", res.data.token); // unified key
        sessionStorage.setItem("role", "doctor"); // store role
        sessionStorage.setItem("username", username);

        toast.success("Doctor Login Successful");
        navigate("/doctordashboard");
      }

      // optional: reload only if needed
      // window.location.reload();
    } catch (err) {
      toast.error(err.response?.data?.error || "Login failed");
    }
  };

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #E6FFFA, #f3f0fd)",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Container className="d-flex justify-content-center">
        <Card
          className="shadow"
          style={{
            width: "100%",
            maxWidth: "420px",
            borderRadius: "16px",
            padding: "20px",
            border: "none",
          }}
        >
          <Card.Body>
            <h4 className="text-center fw-bold mb-2">Welcome Back</h4>
            <p className="text-center text-muted mb-4">
              Manage your healthcare journey seamlessly
            </p>

            <Nav
              variant="tabs"
              activeKey={activeTab}
              onSelect={(k) => {
                setActiveTab(k);
                setUsername("");
                setPassword("");
                setShowPassword(false);
              }}
              className="mb-4"
            >
              <Nav.Item>
                <Nav.Link eventKey="patient">Patient Login</Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="doctor">Doctor Login</Nav.Link>
              </Nav.Item>
            </Nav>

            <Form onSubmit={handleLogin}>
              <Form.Group className="mb-3">
                <Form.Label>Username</Form.Label>
                <Form.Control
                  type="text"
                  placeholder={`Enter ${activeTab} username`}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  style={{ borderRadius: "8px" }}
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Password</Form.Label>
                <InputGroup>
                  <Form.Control
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={{ borderRadius: "8px 0 0 8px", borderRight: "none" }}
                  />
                  <InputGroup.Text
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      cursor: "pointer",
                      background: "#E6FFFA",
                      borderLeft: "none",
                      borderRadius: "0 8px 8px 0",
                    }}
                  >
                    {showPassword ? (
                      <VisibilityOff style={{ color: "#0E7490" }} />
                    ) : (
                      <Visibility style={{ color: "#0E7490" }} />
                    )}
                  </InputGroup.Text>
                </InputGroup>
                <div className="mt-2">
                  <button
                    type="button"
                    className="btn btn-link p-0 text-decoration-none"
                    style={{ color: "#0E7490", fontSize: "14px" }}
                    onClick={() => setShowForgotPassword(true)}
                  >
                    Forgot Password?
                  </button>
                </div>
              </Form.Group>

              <Button
                type="submit"
                style={{
                  background: "linear-gradient(90deg, #0E7490, #14B8A6)",
                  border: "none",
                  width: "100%",
                  padding: "10px",
                  borderRadius: "8px",
                  fontWeight: "600",
                }}
              >
                Sign In
              </Button>
            </Form>

            <p className="text-center mt-4 text-muted">
              Don’t have an account?{" "}
              <span
                style={{ color: "#0E7490", cursor: "pointer" }}
                onClick={() =>
                  navigate(
                    activeTab === "patient"
                      ? "/patientregister"
                      : "/doctorregister"
                  )
                }
              >
                Create Account
              </span>
            </p>
          </Card.Body>
        </Card>
      </Container>

      <ForgotPasswordModal
        show={showForgotPassword}
        onHide={() => setShowForgotPassword(false)}
        userType={activeTab === "patient" ? "patient" : "doctor"}
      />
    </div>
  );
}

export default Login;