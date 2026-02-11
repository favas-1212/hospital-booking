import React, { useState } from "react";
import { Container, Card, Form, Button } from "react-bootstrap";
import { toast } from "react-toastify";
import { verifyOtp, resendOtp } from "../services/allApi";
import { useNavigate } from "react-router-dom";

function VerifyOtp({ email, setStep, user }) {
  const [otp, setOtp] = useState("");
  const navigate = useNavigate();

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp) return toast.warning("Please enter OTP");

    try {
      await verifyOtp({ email, otp });
      toast.success("OTP verified successfully! Please login.");
      setStep(3); // Move to login
      navigate("/patientlogin");
    } catch (err) {
      toast.error(err.response?.data?.error || "Invalid OTP");
    }
  };

  const handleResendOtp = async () => {
    try {
      const res = await resendOtp({ email });
      toast.info(res.data.message || "OTP resent successfully");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to resend OTP");
    }
  };

  return (
    <Container className="d-flex justify-content-center align-items-center my-5">
      <Card style={{ maxWidth: "400px", width: "100%" }} className="shadow-sm p-4">
        <h3 className="text-center mb-4 text-primary">OTP Verification</h3>

        <Form onSubmit={handleVerifyOtp}>
          <Form.Group className="mb-3">
            <Form.Label>Enter OTP</Form.Label>
            <Form.Control
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              required
            />
          </Form.Group>

          <Button type="submit" className="w-100 mb-2">
            Verify OTP
          </Button>

          <Button variant="secondary" className="w-100" onClick={handleResendOtp}>
            Resend OTP
          </Button>
        </Form>
      </Card>
    </Container>
  );
}

export default VerifyOtp;
