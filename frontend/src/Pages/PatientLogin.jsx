import React, { useState } from "react";
import { Container, Form, Button } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import { Link } from "react-router-dom";
function PatientLogin() {
  const navigate = useNavigate();
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  const sendOtp = () => {
    if (mobile.length === 10) {
      setOtpSent(true);
      alert("OTP sent (demo)");
    } else {
      alert("Enter valid 10-digit mobile number");
    }
  };

  const verifyOtp = () => {
    if (otp.length >= 4) {
      alert("OTP verified (demo)");
      // navigate("/dashboard");
    } else {
      alert("Enter valid OTP");
    }
  };

  return (
    <Container
      fluid
      className="min-vh-100 bg-white d-flex flex-column"
      style={{ maxWidth: "420px" }}
    >
      {/* HEADER */}
      <div className="d-flex align-items-center py-3 border-bottom">
        <ArrowBackIosNewIcon
          style={{ cursor: "pointer" }}
          onClick={() => navigate(-1)}
        />
        <h6 className="fw-bold mx-auto mb-0">Patient Login</h6>
      </div>

      {/* CONTENT */}
      <div className="flex-grow-1 d-flex flex-column align-items-center justify-content-start px-3 pt-5 my-5">
        <h4 className="fw-bold mb-4">Login as Patient</h4>

        {/* Mobile Number */}
        <Form.Control
          type="tel"
          placeholder="Enter your mobile number"
          className="mb-3 p-3"
          value={mobile}
          maxLength={10}
          onChange={(e) => setMobile(e.target.value)}
        />

        {/* Send OTP */}
        <Button
          className="w-100 mb-3 py-2"
          style={{
            backgroundColor: "#38bdf8",
            border: "none",
            borderRadius: "10px",
          }}
          onClick={sendOtp}
        >
          Send OTP
        </Button>

        <p className="text-muted text-center small mb-4">
          An OTP will be sent to your registered mobile number
        </p>

        {/* OTP Input */}
        <Form.Control
          type="number"
          placeholder="Enter OTP (4-6 digits)"
          className="mb-3 p-3"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          disabled={!otpSent}
        />

        {/* Verify OTP */}
        <Button
          className="w-100 py-2"
          style={{
            backgroundColor: "#38bdf8",
            border: "none",
            borderRadius: "10px",
          }}
          disabled={!otpSent}
          onClick={verifyOtp}
        >
          Verify OTP
        </Button>


          <p className="mt-4 text-center">
  Don't have an account?{" "}
  <Link to="/PatientRegister" className="text-primary fw-semibold">
    Register now
  </Link>
</p>
      </div>

      
    </Container>
  );
}

export default PatientLogin;
