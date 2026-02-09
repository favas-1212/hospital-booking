import React, { useState } from "react";
import { Container, Form, Button, Card } from "react-bootstrap";
import { useNavigate, Link } from "react-router-dom";
import { registerPatient } from "../services/allApi";

function PatientRegister() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    full_name: "",
    phone: "",
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // ✅ Register ONLY (no OTP)
  const handleRegister = async (e) => {
    e.preventDefault();

    try {
      const res = await registerPatient(formData);
      alert(res.data.message || "Registration successful");
      navigate("/patientotp");
    } catch (err) {
      alert(err.response?.data?.error || "Registration failed");
    }
  };

  return (
    <Container className="d-flex justify-content-center align-items-center my-5">
      <Card style={{ maxWidth: "500px", width: "100%" }} className="shadow-sm p-4">
        <h3 className="text-center mb-4 text-primary">
          Patient Registration
        </h3>

        <Form onSubmit={handleRegister}>
          {/* Username */}
          <Form.Group className="mb-3">
            <Form.Label>Username</Form.Label>
            <Form.Control
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
            />
          </Form.Group>

          {/* Email */}
          <Form.Group className="mb-3">
            <Form.Label>Email</Form.Label>
            <Form.Control
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </Form.Group>

          {/* Password */}
          <Form.Group className="mb-3">
            <Form.Label>Password</Form.Label>
            <Form.Control
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </Form.Group>

          {/* Full Name */}
          <Form.Group className="mb-3">
            <Form.Label>Full Name</Form.Label>
            <Form.Control
              name="full_name"
              value={formData.full_name}
              onChange={handleChange}
              required
            />
          </Form.Group>

          {/* Phone (+91) */}
          <Form.Group className="mb-4">
            <Form.Label>Phone Number</Form.Label>
            <Form.Control
              type="tel"
              placeholder="+91XXXXXXXXXX"
              value={formData.phone}
              onChange={(e) => {
                let value = e.target.value;

                // allow only + and numbers
                if (!/^[+\d]*$/.test(value)) return;

                // enforce +91
                if (!value.startsWith("+91")) {
                  value = "+91" + value.replace(/^\+?91?/, "");
                }

                // limit length
                if (value.length > 13) return;

                setFormData({
                  ...formData,
                  phone: value,
                });
              }}
              required
            />
          </Form.Group>

          <Button type="submit" className="w-100">
            Register
          </Button>
        </Form>

        <p className="text-center mt-3">
          Already have an account? <Link to="/patientlogin">Login</Link>
        </p>
      </Card>
    </Container>
  );
}

export default PatientRegister;
