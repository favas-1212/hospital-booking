import React, { useState } from "react";
import { Container, Form, Button, Card } from "react-bootstrap";
import { registerDoctor } from "../services/allApi"; // adjust path if needed

function DoctorRegister() {
  const [user, setUser] = useState({
    username: "",
    email: "",
    password: "",
    full_name: "",
    department: "",
    phone: "",
  });

  // ---------------- Handle Change ----------------
  const handleChange = (e) => {
    setUser({
      ...user,
      [e.target.name]: e.target.value,
    });
  };

  // ---------------- Register Doctor ----------------
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await registerDoctor(user);
      alert(res.data.message || "Doctor registered successfully!");

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
              placeholder="Enter phone number"
              name="phone"
              value={user.phone}
              onChange={handleChange}
              required
            />
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
