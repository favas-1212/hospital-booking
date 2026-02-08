import React, { useState } from "react";
import { Container, Form, Button, Card } from "react-bootstrap";
import { registerDoctor } from "../services/allApi";
import { Link } from "react-router";
import { useNavigate } from "react-router";

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

  // ---------------- Handle Change ----------------
  const handleChange = (e) => {
    const { name, value } = e.target;

    // ONLY phone validation added
    if (name === "phone") {
      // allow only + and numbers
      if (!/^[+\d]*$/.test(value)) return;

      setUser({
        ...user,
        phone: value,
      });

      if (!/^\+91[6789]\d{9}$/.test(value)) {
        setPhoneError("Enter valid number like +919876543210");
      } else {
        setPhoneError("");
      }
      return;
    }

    setUser({
      ...user,
      [name]: value,
    });
  };

  // ---------------- Register Doctor ----------------
  const handleSubmit = async (e) => {
    e.preventDefault();

    // phone validation check
    if (!/^\+91[6789]\d{9}$/.test(user.phone)) {
      setPhoneError("Enter valid number like +919876543210");
      return;
    }

    try {
      const res = await registerDoctor(user);
      alert(res.data.message || "Doctor registered successfully!");
      navigate("/doctorlogin");

      // reset form
      setUser({
        username: "",
        email: "",
        password: "",
        full_name: "",
        department: "",
        phone: "",
      });
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Registration failed");
    }
  };

  return (
    <Container className="d-flex justify-content-center align-items-center my-5">
      <Card
        className="shadow-sm"
        style={{ maxWidth: "500px", width: "100%", padding: "30px" }}
      >
        <h3 className="text-center mb-4 text-primary">
          👨‍⚕️ Doctor Registration
        </h3>

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
              required
            />
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
            <Form.Control.Feedback type="invalid">
              {phoneError}
            </Form.Control.Feedback>
          </Form.Group>

          <Button variant="primary" type="submit" className="w-100">
            <Link to={"/doctorlogin"}></Link>
            Register
          </Button>
        </Form>
      </Card>
    </Container>
  );
}

export default DoctorRegister;
