import React from "react";
import { Container, Row, Col, Card, Button } from "react-bootstrap";
import { useNavigate } from "react-router-dom";

function DoctorDashboard() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/DoctorLogin");
  };

  return (
    <Container fluid className="min-vh-100 bg-light p-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="fw-bold mb-0">👨‍⚕️ Doctor Dashboard</h4>
        <Button variant="outline-danger" size="sm" onClick={handleLogout}>
          Logout
        </Button>
      </div>

      {/* Welcome Card */}
      <Card className="shadow-sm mb-4">
        <Card.Body>
          <h5 className="fw-semibold">Welcome back, Doctor 👋</h5>
          <p className="text-muted mb-0">
            Manage your appointments and patients easily.
          </p>
        </Card.Body>
      </Card>

      {/* Dashboard Cards */}
      <Row className="g-3">
        <Col md={4}>
          <Card className="shadow-sm h-100">
            <Card.Body>
              <h6 className="fw-bold">📅 Appointments</h6>
              <p className="text-muted small">
                View and manage today’s appointments.
              </p>
              <Button size="sm" variant="primary">
                View Appointments
              </Button>
            </Card.Body>
          </Card>
        </Col>

        <Col md={4}>
          <Card className="shadow-sm h-100">
            <Card.Body>
              <h6 className="fw-bold">🧑‍🤝‍🧑 Patients</h6>
              <p className="text-muted small">
                Access patient records and details.
              </p>
              <Button size="sm" variant="primary">
                View Patients
              </Button>
            </Card.Body>
          </Card>
        </Col>

        <Col md={4}>
          <Card className="shadow-sm h-100">
            <Card.Body>
              <h6 className="fw-bold">⚙️ Profile</h6>
              <p className="text-muted small">
                Update your personal and professional info.
              </p>
              <Button size="sm" variant="primary">
                Edit Profile
              </Button>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default DoctorDashboard;
