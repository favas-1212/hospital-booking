import React, { useState } from "react";
import { Container, Card, Form, Button, InputGroup } from "react-bootstrap";
import { registerDoctor } from "../services/allApi";
import { toast } from "react-toastify";
import { Link, useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";

function DoctorRegister() {
  const navigate = useNavigate();

  const [user, setUser] = useState({
    username: "",
    email: "",
    password: "",
    full_name: "",
    department: "",
    phone: "",
  });

  const [phoneError, setPhoneError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [nameError, setNameError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // ---------------- HANDLE CHANGE ----------------
  const handleChange = (e) => {
    const { name, value } = e.target;

    // FULL NAME VALIDATION
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

    // PASSWORD VALIDATION
    if (name === "password") {
      setUser({ ...user, password: value });

      const passwordRegex =
        /^(?=.*[0-9])(?=.*[!@#$%^&*])[A-Za-z0-9!@#$%^&*]{8,}$/;

      if (!passwordRegex.test(value)) {
        setPasswordError(
          "Min 8 chars, include 1 number & 1 special character"
        );
      } else {
        setPasswordError("");
      }
      return;
    }

    // PHONE VALIDATION
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

    // EMAIL VALIDATION
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
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (phoneError || emailError || nameError || passwordError) {
      toast.error("Please fix errors before submitting");
      return;
    }

    try {
      const res = await registerDoctor(user);
      toast.success(res.data.message || "Doctor registered successfully!");

      navigate("/login");
    } catch (err) {
      toast.error(err.response?.data?.error || "Registration failed");
    }
  };

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #E6FFFA, #F0FDFA)",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <Container className="d-flex justify-content-center">
        <Card
          className="shadow"
          style={{
            width: "100%",
            maxWidth: "450px",
            borderRadius: "16px",
            padding: "25px",
            border: "none",
          }}
        >
          <Card.Body>
            <h4 className="text-center fw-bold mb-2">
              👨‍⚕️ Create Doctor Account
            </h4>

            <p className="text-center text-muted mb-4">
              Join our healthcare platform
            </p>

            <Form onSubmit={handleSubmit}>
              {/* Username */}
              <Form.Group className="mb-3">
                <Form.Label>Username</Form.Label>
                <Form.Control
                  name="username"
                  value={user.username}
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
                  value={user.email}
                  onChange={handleChange}
                  isInvalid={!!emailError}
                  required
                />
                <Form.Control.Feedback type="invalid">
                  {emailError}
                </Form.Control.Feedback>
              </Form.Group>

              {/* Password */}
              <Form.Group className="mb-3">
                <Form.Label>Password</Form.Label>
                <InputGroup>
                  <Form.Control
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={user.password}
                    onChange={handleChange}
                    isInvalid={!!passwordError}
                    required
                  />
                  <Button
                    variant="outline-secondary"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </Button>
                  <Form.Control.Feedback type="invalid">
                    {passwordError}
                  </Form.Control.Feedback>
                </InputGroup>
              </Form.Group>

              {/* Full Name */}
              <Form.Group className="mb-3">
                <Form.Label>Full Name</Form.Label>
                <Form.Control
                  name="full_name"
                  value={user.full_name}
                  onChange={handleChange}
                  isInvalid={!!nameError}
                  required
                />
                <Form.Control.Feedback type="invalid">
                  {nameError}
                </Form.Control.Feedback>
              </Form.Group>

              {/* Department */}
              <Form.Group className="mb-3">
                <Form.Label>Department</Form.Label>
                <Form.Control
                  name="department"
                  value={user.department}
                  onChange={handleChange}
                  required
                />
              </Form.Group>

              {/* Phone */}
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
                <Form.Control.Feedback type="invalid">
                  {phoneError}
                </Form.Control.Feedback>
              </Form.Group>

              <Button
                type="submit"
                style={{
                  background:
                    "linear-gradient(90deg, #0E7490, #14B8A6)",
                  border: "none",
                  width: "100%",
                  padding: "10px",
                  borderRadius: "8px",
                  fontWeight: "600",
                }}
              >
                Register
              </Button>
            </Form>

            <p className="text-center mt-4 text-muted">
              Already have an account?{" "}
              <Link
                to="/login"
                style={{ color: "#0E7490", fontWeight: "500" }}
              >
                Login
              </Link>
            </p>
          </Card.Body>
        </Card>
      </Container>
    </div>
  );
}

export default DoctorRegister;