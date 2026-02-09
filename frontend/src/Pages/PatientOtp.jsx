import React, { useState } from "react";
import { Container, Card, Form, Button } from "react-bootstrap";
import { useNavigate, Link } from "react-router-dom";

function PatientOtp() {
  const navigate = useNavigate();

  // OTP state (6 digits)
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);

  const handleOtpChange = (value, index) => {
    // allow only one digit
    if (!/^\d?$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // auto focus next
    if (value && index < 5) {
      document.getElementById(`otp-${index + 1}`)?.focus();
    }
  };

  const handleKeyDown = (e, index) => {
    // move focus back on backspace
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`)?.focus();
    }
  };

  const otpValue = otp.join("");

  const handleVerify = async () => {
    if (otpValue.length !== 6) {
      return alert("Please enter 6 digit OTP");
    }

    try {
      setLoading(true);

      // 🔁 CALL YOUR VERIFY OTP API HERE
      // await verifyOtp({ otp: otpValue });

      alert("OTP verified successfully");

      // ✅ NAVIGATE TO booking.jsx
      navigate("/patientlogin");

    } catch (err) {
      alert("Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      // 🔁 CALL YOUR RESEND OTP API HERE
      alert("OTP resent successfully");
    } catch {
      alert("Failed to resend OTP");
    }
  };

  return (
    <Container className="d-flex justify-content-center align-items-center my-5">
      <Card className="shadow-sm p-4" style={{ maxWidth: "400px", width: "100%" }}>
        <h4 className="text-center mb-3 text-primary">
          OTP Verification
        </h4>

        <p className="text-center text-muted">
          Enter the 6-digit OTP sent to your phone
        </p>

        {/* OTP Inputs */}
        <div className="d-flex justify-content-between mb-4">
          {otp.map((digit, index) => (
            <Form.Control
              key={index}
              id={`otp-${index}`}
              type="text"
              value={digit}
              maxLength={1}
              className="text-center mx-1"
              style={{ width: "45px", fontSize: "20px" }}
              onChange={(e) => handleOtpChange(e.target.value, index)}
              onKeyDown={(e) => handleKeyDown(e, index)}
            />
          ))}
        </div>

        <Button
          className="w-100 mb-2"
          onClick={handleVerify}
          disabled={loading}
        >
          {loading ? "Verifying..." : "Verify OTP"}
        </Button>

        <Button
          variant="secondary"
          className="w-100"
          onClick={handleResend}
        >
          Resend OTP
        </Button>

        <p className="text-center mt-3">
          Back to <Link to="/login">Login</Link>
        </p>
      </Card>
    </Container>
  );
}

export default PatientOtp;
