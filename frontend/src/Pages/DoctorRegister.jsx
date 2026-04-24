import React, { useEffect, useState } from "react";
import { Container, Form, Button, Card, Spinner } from "react-bootstrap";
import { registerDoctor } from "../services/allApi";
import { toast } from "react-toastify";
import axios from "axios";
import { useNavigate } from "react-router-dom";

function DoctorRegister() {
 
  const navigate=useNavigate()
  const BASE_URL = "http://127.0.0.1:8000/api/booking";

  const [user, setUser] = useState({
    username: "",
    email: "",
    password: "",
    full_name: "",
    hospital: "",
    department: "",
    phone: "",
  });

  const [districts, setDistricts] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [departments, setDepartments] = useState([]);

  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState(""); // New password error
  const [loading, setLoading] = useState(false);

  // ================= LOAD DISTRICTS =================
  useEffect(() => {
    axios.get(`${BASE_URL}/districts/`)
      .then(res => setDistricts(res.data))
      .catch(() => toast.error("Failed to load districts"));
  }, []);

  // ================= LOAD HOSPITALS =================
  useEffect(() => {
    if (!selectedDistrict) return;

    axios.get(`${BASE_URL}/hospitals/?district_id=${selectedDistrict}`)
      .then(res => setHospitals(res.data))
      .catch(() => toast.error("Failed to load hospitals"));
  }, [selectedDistrict]);

  // ================= LOAD DEPARTMENTS =================
  useEffect(() => {
    if (!user.hospital) return;

    axios.get(`${BASE_URL}/departments/?hospital_id=${user.hospital}`)
      .then(res => setDepartments(res.data))
      .catch(() => toast.error("Failed to load departments"));
  }, [user.hospital]);

  // ================= HANDLE CHANGE =================
  const handleChange = (e) => {
    const { name, value } = e.target;

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
      } else setPhoneError("");

      return;
    }

    // EMAIL VALIDATION
    if (name === "email") {
      setUser({ ...user, email: value });

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
      setEmailError(emailRegex.test(value) ? "" : "Invalid email");

      return;
    }

    // PASSWORD VALIDATION
    if (name === "password") {
      setUser({ ...user, password: value });

      const passwordRegex = /^(?=.*[A-Za-z])(?=.*[^A-Za-z0-9]).{8,}$/;
      setPasswordError(
        passwordRegex.test(value)
          ? ""
          : "Password must be at least 8 characters, include 1 letter and 1 special character"
      );

      return;
    }

    // Convert FK values to number
    setUser({
      ...user,
      [name]: name === "hospital" || name === "department"
        ? Number(value)
        : value
    });
  };

  // ================= SUBMIT =================
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (phoneError || emailError || passwordError) {
      toast.error("Fix validation errors first");
      return;
    }

    if (!user.hospital || !user.department) {
      toast.error("Select hospital and department");
      return;
    }

    try {
      setLoading(true);

      await registerDoctor(user);

      toast.success("Doctor registered! Waiting for OPD approval");
      navigate('/login')

      setUser({
        username: "",
        email: "",
        password: "",
        full_name: "",
        hospital: "",
        department: "",
        phone: "",
      });

      setSelectedDistrict("");
      setHospitals([]);
      setDepartments([]);
      setPasswordError(""); // reset password error

    } catch (err) {
      toast.error(
        err.response?.data?.error ||
        err.response?.data?.detail ||
        "Registration failed"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className="d-flex justify-content-center my-5">
      <Card style={{ maxWidth: "500px", width: "100%" }} className="p-4 shadow">

       <h3 className="text-center mb-4" style={{ color: "#0E7490" }}>
  Doctor Registration
</h3>

        <Form onSubmit={handleSubmit}>

          {/* USERNAME */}
          <Form.Group className="mb-3">
            <Form.Label>Username</Form.Label>
            <Form.Control
              name="username"
              value={user.username}
              onChange={handleChange}
              required
            />
          </Form.Group>

          {/* EMAIL */}
          <Form.Group className="mb-3">
            <Form.Label>Email</Form.Label>
            <Form.Control
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

          {/* PASSWORD */}
          <Form.Group className="mb-3">
            <Form.Label>Password</Form.Label>
            <Form.Control
              type="password"
              name="password"
              value={user.password}
              onChange={handleChange}
              isInvalid={!!passwordError}
              required
            />
            <Form.Control.Feedback type="invalid">
              {passwordError}
            </Form.Control.Feedback>
          </Form.Group>

          {/* FULL NAME */}
          <Form.Group className="mb-3">
            <Form.Label>Full Name</Form.Label>
            <Form.Control
              name="full_name"
              value={user.full_name}
              onChange={handleChange}
              required
            />
          </Form.Group>

          {/* DISTRICT */}
          <Form.Group className="mb-3">
            <Form.Label>District</Form.Label>
            <Form.Select
              value={selectedDistrict}
              onChange={(e) => {
                const districtId = e.target.value;
                setSelectedDistrict(districtId);

                setHospitals([]);
                setDepartments([]);

                setUser(prev => ({
                  ...prev,
                  hospital: "",
                  department: ""
                }));
              }}
              required
            >
              <option value="">Select District</option>
              {districts.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Form.Select>
          </Form.Group>

          {/* HOSPITAL */}
          <Form.Group className="mb-3">
            <Form.Label>Hospital</Form.Label>
            <Form.Select
              name="hospital"
              value={user.hospital}
              onChange={handleChange}
              disabled={!selectedDistrict}
              required
            >
              <option value="">Select Hospital</option>
              {hospitals.map(h => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </Form.Select>
          </Form.Group>

          {/* DEPARTMENT */}
          <Form.Group className="mb-3">
            <Form.Label>Department</Form.Label>
            <Form.Select
              name="department"
              value={user.department}
              onChange={handleChange}
              disabled={!user.hospital}
              required
            >
              <option value="">Select Department</option>
              {departments.map(dep => (
                <option key={dep.id} value={dep.id}>{dep.name}</option>
              ))}
            </Form.Select>
          </Form.Group>

          {/* PHONE */}
          <Form.Group className="mb-4">
            <Form.Label>Phone</Form.Label>
            <Form.Control
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
  className="w-100"
  disabled={loading}
  style={{ background: "linear-gradient(90deg, #0E7490, #14B8A6)", border: "none" }}
>
  {loading ? <Spinner size="sm" animation="border" /> : "Register"}
</Button>
        </Form>
      </Card>
    </Container>
  );
}

export default DoctorRegister;