import React, { useState, useEffect } from "react";
import { Container, Card, Form, Button } from "react-bootstrap";
import { toast } from "react-toastify";
import { verifyOtp, resendOtp } from "../services/allApi";
import { useNavigate } from "react-router-dom";

function VerifyOtp({ email, setStep }) {
  const [otp, setOtp] = useState("");
  const [countdown, setCountdown] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp) return toast.warning("Please enter OTP");
    try {
      await verifyOtp({ email, otp });
      toast.success("OTP verified! Please login.");
      setStep(3);
      navigate("/login");
    } catch (err) {
      toast.error(err.response?.data?.error || "Invalid OTP");
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0) return;
    try {
      const res = await resendOtp({ email });
      toast.info(res.data.message || "OTP resent successfully");
      setCountdown(30);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to resend OTP");
    }
  };

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #0f4c75 0%, #1b6ca8 50%, #118a7e 100%)",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <Container className="d-flex justify-content-center">
        <Card
          style={{ width: "100%", maxWidth: "400px", borderRadius: 24, border: "none", overflow: "hidden" }}
          className="shadow"
        >
          {/* Coloured header strip */}
          <div
            style={{
              background: "linear-gradient(135deg, #0f4c75 0%, #1b6ca8 60%, #118a7e 100%)",
              padding: "24px 32px",
              textAlign: "center",
            }}
          >
            <h5 style={{ color: "#fff", fontWeight: 800, fontSize: 22, margin: "0 0 4px" }}>
              Email Verification
            </h5>
            <p style={{ color: "#bae6fd", fontSize: 13, margin: 0 }}>
              Code sent to <strong style={{ color: "#fff" }}>{email}</strong>
            </p>
          </div>

          {/* Body */}
          <div style={{ padding: "28px 32px 28px" }}>
            <Form onSubmit={handleVerifyOtp}>
              <Form.Group className="mb-3">
                <Form.Label style={{ fontWeight: 600, fontSize: 13, color: "#0f172a" }}>
                  Enter OTP
                </Form.Label>
                <Form.Control
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="——————"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  className="otp-input"
                  style={{
                    textAlign: "center",
                    letterSpacing: "0.3em",
                    fontSize: 22,
                    borderRadius: 10,
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    padding: "12px",
                  }}
                  required
                />
              </Form.Group>

              <Button
                type="submit"
                className="w-100 mb-2"
                style={{
                  background: "linear-gradient(90deg, #0f4c75, #118a7e)",
                  border: "none",
                  borderRadius: 12,
                  fontWeight: 700,
                  fontSize: 15,
                  padding: "11px",
                  boxShadow: "0 4px 20px rgba(15,76,117,0.35)",
                }}
              >
                Verify →
              </Button>
            </Form>

            <Button
              variant="outline-secondary"
              className="w-100"
              onClick={handleResendOtp}
              disabled={countdown > 0}
              style={{ borderRadius: 12, fontWeight: 600, fontSize: 14, padding: "10px" }}
            >
              {countdown > 0 ? `Resend in ${countdown}s` : "Resend OTP"}
            </Button>

            <p className="text-center mt-3 mb-0" style={{ fontSize: 13 }}>
              <span
                style={{ color: "#0f4c75", cursor: "pointer", fontWeight: 700 }}
                onClick={() => setStep(1)}
              >
                ← Go back
              </span>
            </p>
          </div>
        </Card>
      </Container>

      <style>{`
        .otp-input:focus {
          background: #fff !important;
          border-color: #1b6ca8 !important;
          box-shadow: 0 0 0 3px rgba(27,108,168,0.15) !important;
          outline: none;
        }
      `}</style>
    </div>
  );
}

export default VerifyOtp;