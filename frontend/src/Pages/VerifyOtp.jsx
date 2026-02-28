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
      setStep(3);
      navigate("/login");
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
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #E6FFFA, #CCFBF1)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Container>
        <Card
          className="shadow-lg mx-auto"
          style={{
            maxWidth: "420px",
            borderRadius: "18px",
            border: "none",
          }}
        >
          <Card.Body className="p-4">

            {/* Header */}
            <div className="text-center mb-4">
              <h3
                style={{
                  fontWeight: "700",
                  background: "linear-gradient(90deg, #0E7490, #14B8A6)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                OTP Verification
              </h3>
              <p className="text-muted small">
                Enter the OTP sent to your email
              </p>
            </div>

            <Form onSubmit={handleVerifyOtp}>
              <Form.Group className="mb-4">
                <Form.Label style={{ fontWeight: "500", color: "#0E7490" }}>
                  Enter OTP
                </Form.Label>
                <Form.Control
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required
                  style={{
                    borderRadius: "10px",
                    padding: "10px",
                    border: "1px solid #CCFBF1",
                  }}
                />
              </Form.Group>

              {/* Verify Button */}
              <Button
                type="submit"
                className="w-100 mb-3"
                style={{
                  background: "linear-gradient(90deg, #0E7490, #14B8A6)",
                  border: "none",
                  fontWeight: "600",
                  padding: "10px",
                  borderRadius: "10px",
                }}
              >
                Verify OTP
              </Button>

              {/* Resend Button */}
              <Button
                type="button"
                className="w-100"
                onClick={handleResendOtp}
                style={{
                  background: "#E6FFFA",
                  color: "#0E7490",
                  border: "1px solid #A7F3D0",
                  fontWeight: "600",
                  padding: "10px",
                  borderRadius: "10px",
                }}
              >
                Resend OTP
              </Button>
            </Form>

          </Card.Body>
        </Card>
      </Container>
    </div>
  );
}

export default VerifyOtp;