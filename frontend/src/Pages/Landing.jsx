import React from "react";
import Container from "react-bootstrap/Container";
import Nav from "react-bootstrap/Nav";
import Navbar from "react-bootstrap/Navbar";
import { Row, Col, Card } from "react-bootstrap";
import Button from "@mui/material/Button";
import { Link } from "react-router-dom";
import AppNavbar from "../Components/AppNavbar";
import Footer from "../Components/Footer";

function Landing() {
  return (
    <>
      {/* NAVBAR */}
      <AppNavbar />

      {/* HERO SECTION */}
      <section
        style={{
          background: "linear-gradient(135deg, #E6FFFA, #ffffff)",
          minHeight: "90vh",
          display: "flex",
          alignItems: "center",
        }}
      >
        <Container>
          <Row className="align-items-center">
            <Col md={6}>
              <h1 className="fw-bold display-5">
                Book Your Hospital Visit <br />
                <span style={{ color: "#0E7490" }}>
                  with Confidence
                </span>
              </h1>

              <p className="text-muted mt-3 fs-5">
                Understand the Rules. Know Your Turn.
              </p>

              <div className="d-flex gap-3 mt-4">
                <Button
                  variant="contained"
                  style={{
                    backgroundColor: "#0E7490",
                    padding: "8px 20px",
                  }}
                >
                  <Link
                    to={"/instructions"}
                    style={{ textDecoration: "none", color: "white" }}
                  >
                    How to Book Online
                  </Link>
                </Button>

                <Button
                  variant="outlined"
                  style={{
                    borderColor: "#0E7490",
                    color: "#0E7490",
                    padding: "8px 20px",
                  }}
                  component={Link}
                  to="/patient-dashboard"
                >
                  Check My Token Status
                </Button>
              </div>
            </Col>

            <Col md={6} className="text-center mt-4 mt-md-0">
              <img
                src="https://www.itrobes.com/wp-content/uploads/2024/01/Queue-Management-System-In-Hospital.jpg"
                alt="hospital"
                className="img-fluid rounded-4 shadow"
              />
            </Col>
          </Row>
        </Container>
      </section>

      {/* FEATURES */}
      <section className="py-5 bg-white">
        <Container>
          <h2 className="text-center fw-bold pb-4">
            What{" "}
            <span style={{ color: "#0E7490" }}>
              MEDQUEUE
            </span>{" "}
            Solves?
          </h2>

          <Row className="g-4">
            <Col md={4}>
              <Card className="border-0 shadow-sm text-center p-4 rounded-4 h-100">
                <img
                  src="https://uxwing.com/wp-content/themes/uxwing/download/e-commerce-currency-shopping/mobile-online-booking-icon.png"
                  alt="Online Booking"
                  style={{ height: "80px" }}
                  className="mx-auto mb-3"
                />
                <h5 className="fw-bold" style={{ color: "#0E7490" }}>
                  Easy Online Token Booking
                </h5>
                <p className="text-muted">
                  Reserve your spot from home with just a few clicks.
                </p>
              </Card>
            </Col>

            <Col md={4}>
              <Card className="border-0 shadow-sm text-center p-4 rounded-4 h-100">
                <img
                  src="https://cdn-icons-png.flaticon.com/512/942/942799.png"
                  alt="Rules"
                  style={{ height: "80px" }}
                  className="mx-auto mb-3"
                />
                <h5 className="fw-bold" style={{ color: "#0E7490" }}>
                  Clear Booking Rules
                </h5>
                <p className="text-muted">
                  Know the guidelines and priority rules for booking.
                </p>
              </Card>
            </Col>

            <Col md={4}>
              <Card className="border-0 shadow-sm text-center p-4 rounded-4 h-100">
                <img
                  src="https://cdn-icons-png.flaticon.com/512/747/747310.png"
                  alt="Queue Tracking"
                  style={{ height: "80px" }}
                  className="mx-auto mb-3"
                />
                <h5 className="fw-bold" style={{ color: "#0E7490" }}>
                  Track Your Place in Queue
                </h5>
                <p className="text-muted">
                  See live updates on when it’s your turn.
                </p>
              </Card>
            </Col>
          </Row>
        </Container>
      </section>

      {/* FAIR PROCESS */}
      <section
        className="py-5"
        style={{ backgroundColor: "#F0FDFA" }}
      >
        <Container>
          <h3
            className="text-center fw-bold mb-4"
            style={{ color: "#0E7490" }}
          >
            Fair & Transparent Process
          </h3>

          <Row className="g-4">
            <Col md={4}>
              <Card className="border-0 shadow-sm text-center p-4 rounded-4 h-100">
                <img
                  src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSHtWwEeE72bFbKjfQOeVPRxdZVeVLzSm6l5Q&s"
                  alt="Senior Priority"
                  style={{ height: "80px" }}
                  className="mx-auto mb-3"
                />
                <h6 className="fw-bold" style={{ color: "#0E7490" }}>
                  Priority for Seniors & Emergencies
                </h6>
                <p className="text-muted">
                  Handled directly by hospital staff and reflected transparently in the live queue.
                </p>
              </Card>
            </Col>

            <Col md={4}>
              <Card className="border-0 shadow-sm text-center p-4 rounded-4 h-100">
                <img
                  src="https://cdn-icons-png.flaticon.com/512/2921/2921222.png"
                  alt="Time Slot"
                  style={{ height: "80px" }}
                  className="mx-auto mb-3"
                />
                <h6 className="fw-bold" style={{ color: "#0E7490" }}>
                  Time-Slot Appointments
                </h6>
                <p className="text-muted">
                  Arrive exactly at your scheduled time.
                </p>
              </Card>
            </Col>

            <Col md={4}>
              <Card className="border-0 shadow-sm text-center p-4 rounded-4 h-100">
                <img
                  src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRNjXAHlWFENTKKmr4F_8C9CL2rg49uveMfhg&s"
                  alt="Limited Tokens"
                  style={{ height: "80px" }}
                  className="mx-auto mb-3"
                />
                <h6 className="fw-bold" style={{ color: "#0E7490" }}>
                  Limited Daily Tokens
                </h6>
                <p className="text-muted">
                  Avoid overcrowding in hospitals.
                </p>
              </Card>
            </Col>
          </Row>
        </Container>
      </section>

      {/* CTA */}
      <section
        className="py-5 text-center"
        style={{
          background: "linear-gradient(90deg, #0E7490, #14B8A6)",
          color: "white",
        }}
      >
        <Container>
          <h3 className="fw-bold">Be Prepared. Be Informed.</h3>
          <p className="mb-4">
            Learn how to book and track your hospital visit smoothly.
          </p>

          <Button
            variant="contained"
            size="large"
            style={{
              backgroundColor: "white",
              color: "#0E7490",
              fontWeight: "600",
              padding: "10px 25px",
            }}
          >
            <Link
              to={"/instructions"}
              style={{ textDecoration: "none", color: "#0E7490" }}
            >
              Get Started Now
            </Link>
          </Button>
        </Container>
      </section>

      <Footer />
    </>
  );
}

export default Landing;