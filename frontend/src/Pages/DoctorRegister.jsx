import React, { useState } from "react";
import { Container, Form, Button, Card } from "react-bootstrap";
import { registerDoctor } from "../services/allApi"; // adjust path if needed
import { toast } from "react-toastify";

function DoctorRegister() {
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

    // Default change
    setUser({ ...user, [name]: value });
  };

  // ---------------- Register Doctor ----------------
  const handleSubmit = async (e) => {
    e.preventDefault();

    // final phone/email validation
    if (!/^\+91[6789]\d{9}$/.test(user.phone)) {
      setPhoneError("Enter valid number like +91XXXXXXXXXX");
      toast.error("Invalid phone number");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(user.email)) {
      setEmailError("Enter a valid email address");
      toast.error("Invalid email address");
      return;
    }

    try {
      const res = await registerDoctor(user);
      toast.success(res.data.message || "Doctor registered successfully!");

      // reset form
      setUser({
        username: "",
        email: "",
        password: "",
        full_name: "",
        department: "",
        phone: "",
      });
      setPhoneError("");
      setEmailError("");
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Registration failed");
    }
  };

  return (
    <Container className="d-flex justify-content-center align-items-center my-5">
      <Card
        className="shadow-sm"
        style={{ maxWidth: "500px", width: "100%", padding: "30px" }}
      >
        <h3 className="text-center mb-4 text-primary">👨‍⚕️ Doctor Registration</h3>

        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>Username</Form.Label>
            <Form.Control
              type="text"
              placeholder="Enter username"
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
              placeholder="Enter email"
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
              placeholder="Enter password"
              name="password"
              value={user.password}
              onChange={handleChange}
              required
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Full Name</Form.Label>
            <Form.Control
              type="text"
              placeholder="Enter full name"
              name="full_name"
              value={user.full_name}
              onChange={handleChange}
              required
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Department</Form.Label>
            <Form.Control
              type="text"
              placeholder="Enter department"
              name="department"
              value={user.department}
              onChange={handleChange}
              required
            />
          </Form.Group>

          <Form.Group className="mb-4">
            <Form.Label>Phone</Form.Label>
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

          <Button variant="primary" type="submit" className="w-100">
            Register
          </Button>
        </Form>
      </Card>
    </Container>
  );
}

export default DoctorRegister;
