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

  // 🔒 Redirect if not logged in
  useEffect(() => {
    if (!token) {
      navigate("/login");
    }
  }, [token, navigate]);

  // 📡 Fetch Patient Token Status
  useEffect(() => {
    if (token) {
      fetchQueueStatus();
      const interval = setInterval(fetchQueueStatus, 10000);
      return () => clearInterval(interval);
    }
  }, [token]);

  const fetchQueueStatus = async () => {
    try {
      const res = await axios.get(
        "http://127.0.0.1:8000/api/booking/patient/token-status/",
        {
          headers: {
            Authorization: `Token ${token}`,
          },
        }
      );

      setData(res.data);
      setLoading(false);
    } catch (err) {
      console.log(err.response?.data);

      if (err.response?.status === 404) {
        setData(null);
      }

      setLoading(false);
    }
  };

  // 🔁 Redirect if completed or cancelled
  useEffect(() => {
    if (data) {
      if (data.status === "completed") {
        alert("Consultation Completed ✅");
        navigate("/");
      }

      if (data.status === "cancelled") {
        alert("Token Cancelled ❌");
        navigate("/");
      }
    }
  }, [data, navigate]);

  // ❌ Cancel Token
  const cancelToken = async () => {
    try {
      await axios.post(
        "http://127.0.0.1:8000/api/booking/cancel-booking/",
        {},
        {
          headers: { Authorization: `Token ${token}` },
        }
      );

      alert("Token Cancelled");
      navigate("/");
    } catch (err) {
      console.log(err.response?.data);
    }
  };

  if (loading) {
    return (
      <div className="text-center mt-5">
        <Spinner animation="border" />
      </div>
    );
  }

  if (!data) {
    return <h4 className="text-center mt-5">No Active Booking</h4>;
  }

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
                      : data.status === "waiting"
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

              <Card
                className="border-0 rounded-4 shadow-sm"
                style={{ backgroundColor: "#F0FDFA" }}
              >
                <Card.Body>
                  <div className="d-flex align-items-center mb-2">
                    <InfoCircle
                      style={{ color: "#0E7490" }}
                      className="me-2"
                    />
                    <h6 className="fw-bold mb-0">
                      Manage Token
                    </h6>
                  </div>

                  <div className="d-flex gap-3">
                    <Button
                      variant="outline-danger"
                      className="w-100 rounded-3"
                      onClick={cancelToken}
                    >
                      Cancel Token
                    </Button>
                  </div>
                </Card.Body>
              </Card>
            </Col>

            <Col lg={4}>
              <Card className="border-0 shadow-sm rounded-4 mb-4">
                <Card.Body>
                  <h6 className="fw-bold mb-3" style={{ color: "#0E7490" }}>
                    Live Queue Tracker
                  </h6>

                  <ProgressBar now={progress} />

                  <div className="d-flex justify-content-between text-muted small mt-2">
                    <span>Current: #{data.current_token}</span>
                    <span>Target: #{data.my_token}</span>
                  </div>
                </Card.Body>
              </Card>

              <Card className="border-0 shadow-sm rounded-4">
                <Card.Body>
                  <h6 className="fw-bold mb-3" style={{ color: "#0E7490" }}>
                    Notifications
                  </h6>

                  <div className="p-3 rounded-3 bg-light">
                    <CheckCircle
                      className="me-2"
                      style={{ color: "#14B8A6" }}
                    />
                    <strong>Token Active</strong>
                    <p className="mb-0 text-muted small">
                      Your token #{data.my_token} is active.
                    </p>
                  </div>
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