import React, { useState } from "react";
import { Modal, Button, Form } from "react-bootstrap";
import { toast } from "react-toastify";
import {
  forgotPasswordPatient,
  verifyResetOtpPatient,
  forgotPasswordDoctor,
  verifyResetOtpDoctor,
  forgotPasswordOPDStaff,
  verifyResetOtpOPDStaff,
} from "../services/allApi";

function ForgotPasswordModal({ show, onHide, userType = "patient" }) {
  const [step, setStep] = useState(1); // 1: email, 2: otp + new password
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Pick the right API functions based on which role is resetting
  const getApi = () => {
    if (userType === "doctor") {
      return { request: forgotPasswordDoctor, verify: verifyResetOtpDoctor };
    }
    if (userType === "opdstaff") {
      return { request: forgotPasswordOPDStaff, verify: verifyResetOtpOPDStaff };
    }
    return { request: forgotPasswordPatient, verify: verifyResetOtpPatient };
  };

  // Step 1: Request OTP
  const handleRequestOTP = async (e) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your email");
      return;
    }

    setLoading(true);
    try {
      const { request } = getApi();
      await request({ email });
      toast.success("OTP sent to your email");
      setStep(2);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP & Reset Password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!otp || !newPassword) {
      toast.error("Please enter OTP and new password");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      const { verify } = getApi();
      await verify({
        email,
        otp,
        new_password: newPassword,
      });
      toast.success(
        "Password reset successful! Please login with your new password."
      );
      handleClose();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setEmail("");
    setOtp("");
    setNewPassword("");
    onHide();
  };

  return (
    <Modal show={show} onHide={handleClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>Reset Password</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {step === 1 && (
          <Form onSubmit={handleRequestOTP}>
            <Form.Group className="mb-3">
              <Form.Label>Email Address</Form.Label>
              <Form.Control
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Form.Group>
            <Button
              variant="primary"
              type="submit"
              className="w-100"
              disabled={loading}
            >
              {loading ? "Sending OTP..." : "Send OTP"}
            </Button>
          </Form>
        )}

        {step === 2 && (
          <Form onSubmit={handleResetPassword}>
            <Form.Group className="mb-3">
              <Form.Label>OTP</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter 6-digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                maxLength="6"
                required
              />
              <Form.Text className="text-muted">
                Check your email for the OTP
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>New Password</Form.Label>
              <Form.Control
                type="password"
                placeholder="Enter new password (min 8 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </Form.Group>

            <Button
              variant="primary"
              type="submit"
              className="w-100"
              disabled={loading}
            >
              {loading ? "Resetting..." : "Reset Password"}
            </Button>

            <Button
              variant="link"
              className="w-100 mt-2"
              onClick={() => {
                setStep(1);
                setOtp("");
                setNewPassword("");
              }}
            >
              Back to Email
            </Button>
          </Form>
        )}
      </Modal.Body>
    </Modal>
  );
}

export default ForgotPasswordModal;
