import React, { useState } from "react";
import { Form, Button } from "react-bootstrap";
import { toast } from "react-toastify";
import { useNavigate, Link } from "react-router-dom";
import { loginPatient} from "../services/allApi";

function PatientLogin() {
  const navigate = useNavigate();

  const [user, setUser] = useState({
    email: "",
    password: "",
  });

  const handleChange = (e) => {
    setUser({ ...user, [e.target.name]: e.target.value });
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!user.email || !user.password) {
      toast.error("Please fill all fields");
      return;
    }

    try {
      const res = await loginPatient(user);

      toast.success("Login Successful");

      // store token if backend sends it
      if (res.data.token) {
        localStorage.setItem("patientToken", res.data.token);
      }

      navigate("/booking"); // redirect after login
    } catch (err) {
      toast.error(err.response?.data?.error || "Login failed");
    }
  };

  return (
    <>
      <h4 className="text-center mb-4" style={{ color: "#0E7490" }}>
        Patient Login
      </h4>

      <Form onSubmit={handleLogin}>
        <Form.Group className="mb-3">
          <Form.Label>Email</Form.Label>
          <Form.Control
            type="email"
            name="email"
            value={user.email}
            onChange={handleChange}
            required
            style={{ borderRadius: "8px", padding: "10px" }}
          />
        </Form.Group>

        <Form.Group className="mb-4">
          <Form.Label>Password</Form.Label>
          <Form.Control
            type="password"
            name="password"
            value={user.password}
            onChange={handleChange}
            required
            style={{ borderRadius: "8px", padding: "10px" }}
          />
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
          Login
        </Button>
      </Form>

      <p className="text-center mt-3">
        Don’t have an account?{" "}
        <Link to="/patientregister" style={{ color: "#0E7490" }}>
          Register
        </Link>
      </p>
    </>
  );
}

export default PatientLogin;