import React, { useEffect, useState } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  ProgressBar,
  Badge,
  Spinner,
} from "react-bootstrap";
import { Clock, CheckCircle, InfoCircle } from "react-bootstrap-icons";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import AppNavbar from "../Components/AppNavbar";

function PatientDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const API_BASE = "http://127.0.0.1:8000/api/booking";

  // ==========================
  // 🔒 Redirect if not logged in
  // ==========================
  useEffect(() => {
    if (!token) {
      navigate("/login");
    }
  }, [token, navigate]);

  // ==========================
  // 📡 Fetch Queue Status
  // ==========================
  useEffect(() => {
    if (token) {
      fetchQueueStatus();
      const interval = setInterval(fetchQueueStatus, 10000);
      return () => clearInterval(interval);
    }
  }, [token]);

  const authHeader = {
    headers: {
      Authorization: `Token ${token}`, // ✅ FIXED HERE
    },
  };

  const fetchQueueStatus = async () => {
    try {
      const res = await axios.get(
        `${API_BASE}/patient/token-status/`,
        authHeader
      );
      setData(res.data);
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        navigate("/login");
      } else if (err.response?.status === 404) {
        setData(null);
      } else {
        console.error(err);
      }
    } finally {
      setLoading(false);
    }
  };

  // ==========================
  // 🔁 Auto redirect if done
  // ==========================
  useEffect(() => {
    if (data?.status === "done") {
      alert("Consultation Completed ✅");
      navigate("/");
    }
  }, [data, navigate]);

  // ==========================
  // ✅ Approve Booking
  // ==========================
  const approveToken = async () => {
    try {
      await axios.post(
        `${API_BASE}/${data.booking_id}/patient-approve/`,
        {},
        authHeader
      );
      alert("Token Approved ✅");
      fetchQueueStatus();
    } catch (err) {
      alert(err.response?.data?.error || "Approval failed");
    }
  };

  // ==========================
  // ❌ Reject Booking
  // ==========================
  const rejectToken = async () => {
    try {
      await axios.post(
        `${API_BASE}/${data.booking_id}/patient-reject/`,
        {},
        authHeader
      );
      alert("Booking Rejected ❌");
      navigate("/");
    } catch (err) {
      alert(err.response?.data?.error || "Rejection failed");
    }
  };

  // ==========================
  // ❌ Cancel After Approval
  // ==========================
  const cancelToken = async () => {
    try {
      await axios.post(
        `${API_BASE}/cancel-booking/`,
        {},
        authHeader
      );
      alert("Token Cancelled ❌");
      navigate("/");
    } catch (err) {
      alert(err.response?.data?.error || "Cancellation failed");
    }
  };

  // ==========================
  // 🔄 Loading State
  // ==========================
  if (loading) {
    return (
      <div className="text-center mt-5">
        <Spinner animation="border" />
      </div>
    );
  }

  // ==========================
  // 🚫 No Active Booking
  // ==========================
  if (!data) {
    return (
      <>
        <AppNavbar />
        <h4 className="text-center mt-5">No Active Booking</h4>
      </>
    );
  }

  // ==========================
  // 📊 Queue Calculations
  // ==========================
  const tokensAhead =
    data.tokens_ahead !== undefined
      ? data.tokens_ahead
      : data.my_token > data.current_token
      ? data.my_token - data.current_token
      : 0;

  const progress =
    data.current_token >= data.my_token
      ? 100
      : (data.current_token / data.my_token) * 100;

  return (
    <>
      <AppNavbar />

      <div
        style={{
          background: "linear-gradient(135deg, #E6FFFA, #ffffff)",
          minHeight: "100vh",
          padding: "50px 0",
        }}
      >
        <Container fluid="lg">
          <Row className="g-4">
            <Col lg={8}>
              <Card className="border-0 shadow rounded-4 mb-4 position-relative">
                <Badge
                  bg={
                    data.status === "consulting"
                      ? "success"
                      : data.status === "approved"
                      ? "primary"
                      : data.status === "pending"
                      ? "warning"
                      : "secondary"
                  }
                  className="position-absolute top-0 end-0 m-3 px-3 py-2"
                >
                  {data.status?.toUpperCase()}
                </Badge>

                <Card.Body className="p-5 text-center">
                  <p className="text-uppercase text-muted small">
                    My Token Status
                  </p>

                  <h1 className="display-2 fw-bold" style={{ color: "#0E7490" }}>
                    #{data.my_token}
                  </h1>

                  <Row className="mt-4">
                    <Col md={6}>
                      <Card className="border-0 rounded-4 p-3 bg-light">
                        <p className="text-muted mb-1">Queue Position</p>
                        <h4 className="fw-bold">
                          {tokensAhead > 0
                            ? `${tokensAhead} Ahead`
                            : "Your Turn"}
                        </h4>
                      </Card>
                    </Col>

                    <Col md={6}>
                      <Card className="border-0 rounded-4 p-3 bg-light">
                        <p className="text-muted mb-1">Estimated Wait</p>
                        <h4 className="fw-bold">
                          <Clock className="me-2" />
                          {data.estimated_wait_minutes} mins
                        </h4>
                      </Card>
                    </Col>
                  </Row>

                  <Card
                    className="rounded-4 mt-4 p-4 border-0"
                    style={{
                      backgroundColor: "#E6FFFA",
                      borderLeft: "6px solid #0E7490",
                    }}
                  >
                    <p className="text-muted mb-1">
                      Current Consulting Token
                    </p>
                    <h2 className="fw-bold" style={{ color: "#0E7490" }}>
                      #{data.current_token}
                    </h2>
                    <small className="text-muted">
                      Live update every 10 sec
                    </small>
                  </Card>
                </Card.Body>
              </Card>

              <Card className="border-0 rounded-4 shadow-sm">
                <Card.Body>
                  <div className="d-flex gap-3">
                    {data.status === "pending" && (
                      <>
                        <Button
                          variant="success"
                          className="w-100"
                          onClick={approveToken}
                        >
                          Approve Token
                        </Button>

                        <Button
                          variant="outline-danger"
                          className="w-100"
                          onClick={rejectToken}
                        >
                          Reject Token
                        </Button>
                      </>
                    )}

                    {data.status === "approved" && (
                      <Button
                        variant="outline-danger"
                        className="w-100"
                        onClick={cancelToken}
                      >
                        Cancel Token
                      </Button>
                    )}

                    {data.status === "consulting" && (
                      <div className="text-success fw-bold text-center w-100">
                        You are being consulted 👨‍⚕️
                      </div>
                    )}
                  </div>
                </Card.Body>
              </Card>
            </Col>

            <Col lg={4}>
              <Card className="border-0 shadow-sm rounded-4">
                <Card.Body>
                  <h6 className="fw-bold mb-3">Live Queue Tracker</h6>
                  <ProgressBar now={progress} />
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Container>
      </div>
    </>
  );
}

export default PatientDashboard;