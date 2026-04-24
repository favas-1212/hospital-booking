import React, { useState } from "react";
import { Container, Card, Form, Button } from "react-bootstrap";
import { useNavigate, Link } from "react-router-dom";
import { loginPatient } from "../services/allApi";
import ForgotPasswordModal from "../Components/ForgotPasswordModal";

function PatientLogin() {
  const navigate = useNavigate();
  const [data, setData] = useState({ username: "", password: "" });
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await loginPatient(data);

      // Save token and username in sessionStorage (per tab)
      sessionStorage.setItem("token", res.data.token);
      sessionStorage.setItem("username", data.username);

      alert("Login successful");

      // Redirect to landing page without full reload
      navigate("/", { replace: true });
    } catch (err) {
      alert(err.response?.data?.error || "Login failed");
    }
  };

  return (
    <Container className="d-flex justify-content-center align-items-center my-5">
      <Card style={{ maxWidth: "400px", width: "100%" }} className="shadow-sm p-4">
        <h3 className="text-center mb-4 text-primary">Patient Login</h3>

        <Form onSubmit={handleLogin}>
          <Form.Group className="mb-3">
            <Form.Label>Username</Form.Label>
            <Form.Control
              value={data.username}
              onChange={(e) => setData({ ...data, username: e.target.value })}
              required
            />
          </Form.Group>

          <Form.Group className="mb-4">
            <Form.Label>Password</Form.Label>
            <Form.Control
              type="password"
              value={data.password}
              onChange={(e) => setData({ ...data, password: e.target.value })}
              required
            />
            <div className="mt-2">
              <button
                type="button"
                className="btn btn-link p-0 text-decoration-none"
                onClick={() => setShowForgotPassword(true)}
              >
                Forgot Password?
              </button>
            </div>
          </Form.Group>

          <Button type="submit" className="w-100">
            Login
          </Button>
        </Form>

        <p className="text-center mt-3">
          New user? <Link to="/patientregister">Register</Link>
        </p>
      </Card>

      <ForgotPasswordModal
        show={showForgotPassword}
        onHide={() => setShowForgotPassword(false)}
        userType="patient"
      />
    </Container>
  );
}

export default PatientLogin;