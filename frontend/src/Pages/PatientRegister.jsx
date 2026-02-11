import React, { useState } from "react";
import { Container, Card, Form, Button } from "react-bootstrap";
import { toast } from "react-toastify";
import { registerPatient } from "../services/allApi";
import VerifyOtp from "./VerifyOtp";
import { Link } from "react-router-dom";

function PatientRegister() {
  const [user, setUser] = useState({
    username: "",
    email: "",
    password: "",
    full_name: "",
    phone: "",
  });

  const [phoneError, setPhoneError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [step, setStep] = useState(1); // 1 = Register | 2 = OTP Verify
  const [otpSent, setOtpSent] = useState(false);

  // ---------------- Handle Change ----------------
  const handleChange = (e) => {
    const { name, value } = e.target;

    // Phone validation
    if (name === "phone") {
      let phoneValue = value;

      // allow only + and numbers
      if (!/^[+\d]*$/.test(phoneValue)) return;

      // enforce +91
      if (!phoneValue.startsWith("+91")) {
        phoneValue = "+91" + phoneValue.replace(/^\+?91?/, "");
      }

      // limit length
      if (phoneValue.length > 13) return;

      setUser({ ...user, phone: phoneValue });

      if (!/^\+91[6789]\d{9}$/.test(phoneValue)) {
        setPhoneError("Enter valid number like +919876543210");
      } else {
        setPhoneError("");
      }
      return;
    }

    // Email validation
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

  // ---------------- Handle Registration ----------------
  const handleRegister = async (e) => {
    e.preventDefault();

    // phone validation check
    if (!/^\+91[6789]\d{9}$/.test(user.phone)) {
      setPhoneError("Enter valid number like +91XXXXXXXXXX");
      toast.error("Invalid phone number");
      return;
    }

    // email validation check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(user.email)) {
      setEmailError("Enter a valid email address");
      toast.error("Invalid email address");
      return;
    }

    try {
      const res = await registerPatient(user);
      toast.success(res.data.message || "OTP sent to your email");
      setOtpSent(true);
      setStep(2);
    } catch (err) {
      toast.error(err.response?.data?.error || "Registration failed");
    }
  };

  if (step === 2) return <VerifyOtp email={user.email} setStep={setStep} user={user} />;

  return (
    <Container className="d-flex justify-content-center align-items-center my-5">
      <Card style={{ maxWidth: "400px", width: "100%" }} className="shadow-sm p-4">
        <h3 className="text-center mb-4 text-primary">Patient Registration</h3>

        <Form onSubmit={handleRegister}>
          <Form.Group className="mb-3">
            <Form.Label>Username</Form.Label>
            <Form.Control
              name="username"
              value={user.username}
              onChange={handleChange}
              required
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Email</Form.Label>
            <Form.Control
              type="email"
              name="email"
              value={user.email}
              onChange={handleChange}
              isInvalid={!!emailError}
              required
            />
            <Form.Control.Feedback type="invalid">{emailError}</Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Password</Form.Label>
            <Form.Control
              type="password"
              name="password"
              value={user.password}
              onChange={handleChange}
              required
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Full Name</Form.Label>
            <Form.Control
              name="full_name"
              value={user.full_name}
              onChange={handleChange}
              required
            />
          </Form.Group>

          <Form.Group className="mb-4">
            <Form.Label>Phone (+91)</Form.Label>
            <Form.Control
              type="tel"
              placeholder="+91XXXXXXXXXX"
              name="phone"
              value={user.phone}
              onChange={handleChange}
              isInvalid={!!phoneError}
              required
            />
            <Form.Control.Feedback type="invalid">{phoneError}</Form.Control.Feedback>
          </Form.Group>

          <Button type="submit" className="w-100">
            Register & Send OTP
          </Button>
        </Form>

        <p className="text-center mt-3">
          Already have an account? <Link to="/patientlogin">Login</Link>
          Already have an account? <Link to="/patientlogin">Login</Link>
        </p>
      </Card>
    </Container>
  );
}

export default PatientRegister;
