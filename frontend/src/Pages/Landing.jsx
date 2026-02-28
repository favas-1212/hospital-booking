import React from "react";
import { Container, Row, Col, Card } from "react-bootstrap";
import Button from "@mui/material/Button";
import { Link } from "react-router";
import AppNavbar from "../Components/AppNavbar";
import Footer from "../Components/Footer";

function Landing() {
  return (
    <>
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
                Smart Hospital Queue
                <br />
                <span style={{ color: "#0E7490" }}>
                  Management System
                </span>
              </h1>

              <p className="text-muted mt-3 fs-5">
                Book tokens online, understand hospital rules,
                and track your visit in real-time.
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
                    How to Book
                  </Link>
                </Button>

                <Button
                  variant="outlined"
                  style={{
                    borderColor: "#0E7490",
                    color: "#0E7490",
                    padding: "8px 20px",
                  }}
                >
                  <Link
                    to={"/login"}
                    style={{ textDecoration: "none", color: "#0E7490" }}
                  >
                    Track My Token
                  </Link>
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

      {/* FEATURES SECTION */}
      <section className="py-5 bg-white">
        <Container>
          <h2 className="text-center fw-bold mb-5">
            Why Choose <span style={{ color: "#0E7490" }}>MEDQUEUE?</span>
          </h2>

          <Row className="g-4">
            {[
              {
                title: "Online Token Booking",
                desc: "Reserve your hospital visit easily from anywhere.",
                img: "https://uxwing.com/wp-content/themes/uxwing/download/e-commerce-currency-shopping/mobile-online-booking-icon.png",
              },
              {
                title: "Transparent Rules",
                desc: "Clear booking guidelines with fair priority system.",
                img: "https://cdn-icons-png.flaticon.com/512/942/942799.png",
              },
              {
                title: "Live Queue Tracking",
                desc: "Track your token number and waiting time instantly.",
                img: "https://cdn-icons-png.flaticon.com/512/747/747310.png",
              },
            ].map((feature, index) => (
              <Col md={4} key={index}>
                <Card className="border-0 shadow-sm h-100 text-center p-4 rounded-4">
                  <img
                    src={feature.img}
                    alt={feature.title}
                    style={{ height: "80px" }}
                    className="mx-auto mb-3"
                  />
                  <h5
                    className="fw-bold"
                    style={{ color: "#0E7490" }}
                  >
                    {feature.title}
                  </h5>
                  <p className="text-muted">{feature.desc}</p>
                </Card>
              </Col>
            ))}
          </Row>
        </Container>
      </section>

      {/* PROCESS SECTION */}
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
            {[
              {
                title: "Priority Handling",
                desc: "Senior citizens and emergencies handled with care.",
                img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSHtWwEeE72bFbKjfQOeVPRxdZVeVLzSm6l5Q&s",
              },
              {
                title: "Time-Slot Booking",
                desc: "Arrive at your exact appointment time.",
                img: "https://cdn-icons-png.flaticon.com/512/2921/2921222.png",
              },
              {
                title: "Limited Daily Tokens",
                desc: "Ensures less crowd and better hospital experience.",
                img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRNjXAHlWFENTKKmr4F_8C9CL2rg49uveMfhg&s",
              },
            ].map((item, index) => (
              <Col md={4} key={index}>
                <Card className="border-0 shadow-sm h-100 text-center p-4 rounded-4">
                  <img
                    src={item.img}
                    alt={item.title}
                    style={{ height: "80px" }}
                    className="mx-auto mb-3"
                  />
                  <h6
                    className="fw-bold"
                    style={{ color: "#0E7490" }}
                  >
                    {item.title}
                  </h6>
                  <p className="text-muted">{item.desc}</p>
                </Card>
              </Col>
            ))}
          </Row>
        </Container>
      </section>

      {/* CTA SECTION */}
      <section
        className="py-5 text-center"
        style={{
          background: "linear-gradient(90deg, #0E7490, #14B8A6)",
          color: "white",
        }}
      >
        <Container>
          <h3 className="fw-bold">Ready to Book Your Visit?</h3>
          <p className="mb-4">
            Experience a smarter way to manage hospital appointments.
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
              Get Started
            </Link>
          </Button>
        </Container>
      </section>

      <Footer />
    </>
  );
}

export default Landing;