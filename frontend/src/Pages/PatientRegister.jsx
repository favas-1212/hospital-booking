import React, { useState } from "react";
import { Container, Form, Button, Card } from "react-bootstrap";
import { useNavigate, Link } from "react-router-dom";
import { registerPatient, verifyOtp, resendOtp } from "../services/allApi";

function PatientRegister() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [otp, setOtp] = useState("");

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

  // Register
  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const res = await registerPatient(formData);
      alert(res.data.message || "OTP sent");
      setStep(2);
    } catch (err) {
      alert(err.response?.data?.error || "Registration failed");
    }
  };

  // Verify OTP
  const handleVerifyOtp = async () => {
    if (!otp) return alert("Enter OTP");
    try {
      const res = await verifyOtp({
        phone: formData.phone,
        otp,
      });
      localStorage.setItem("token", res.data.token);
      navigate("/patient/dashboard");
    } catch (err) {
      alert(err.response?.data?.error || "Invalid OTP");
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    try {
      await resendOtp({ phone: formData.phone });
      alert("OTP resent");
    } catch {
      alert("Failed to resend OTP");
    }
  };

  return (
    <Container className="d-flex justify-content-center align-items-center my-5">
      <Card style={{ maxWidth: "500px", width: "100%" }} className="shadow-sm p-4">
        <h3 className="text-center mb-4 text-primary">
          Patient {step === 1 ? "Registration" : "OTP Verification"}
        </h3>

        {step === 1 ? (
          <Form onSubmit={handleRegister}>

            {/* 1. Username */}
            <Form.Group className="mb-3">
              <Form.Label>Username</Form.Label>
              <Form.Control
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
              />
            </Form.Group>

            {/* 2. Email */}
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

            {/* 3. Password */}
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

            {/* 4. Full Name */}
            <Form.Group className="mb-3">
              <Form.Label>Full Name</Form.Label>
              <Form.Control
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                required
              />
            </Form.Group>

            {/* 5. Phone (+91) */}
            <Form.Group className="mb-4">
              <Form.Label>Phone Number</Form.Label>
              <div className="input-group">
               
                <Form.Control
                  type="tel"
                  placeholder="+91XXXXXXXXXX"
                  maxLength={10}
                  value={formData.phone.replace("+91", "")}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "");
                    setFormData({
                      ...formData,
                      phone: "+91" + value,
                    });
                  }}
                  required
                />
              </div>
            </Form.Group>

            <Button type="submit" className="w-100">
              Register & Send OTP
            </Button>
          </Form>
        ) : (
          <>
            <Form.Control
              className="mb-3"
              placeholder="Enter OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
            />
            <Button className="w-100 mb-2" onClick={handleVerifyOtp}>
              Verify OTP
            </Button>
            <Button variant="secondary" className="w-100" onClick={handleResendOtp}>
              Resend OTP
            </Button>
          </>
        )}

        <p className="text-center mt-3">
          Already have an account? <Link to="/PatientLogin">Login</Link>
        </p>
      </Card>
    </Container>
  );
}

export default PatientRegister;
