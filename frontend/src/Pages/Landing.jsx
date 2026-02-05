import React from "react";
import Container from "react-bootstrap/Container";
import Nav from "react-bootstrap/Nav";
import Navbar from "react-bootstrap/Navbar";
import { Row, Col, Card } from "react-bootstrap";
import Button from "@mui/material/Button";
import { Link } from "react-router";
import AppNavbar from "../Components/AppNavbar";
import Footer from "../Components/Footer";

function Landing() {
  return (
    <>
      {/* NAVBAR */}
     

           <AppNavbar/>
           
      
      {/* HERO SECTION */}
      <Container fluid className="bg-light py-5 ">
        <Container>
 
          <Row className="align-items-center">
            <Col md={6}>
              <h1 className="fw-bold">
                Book Your Hospital Visit <br />
                <span className="text-primary">with Confidence</span>
              </h1>
              <p className="text-muted mt-3">
                {/* Live OPD Token & Waiting Time Management System */}
                Understand the Rules. Know Your Turn.
              </p>

              <div className="d-flex gap-3 mt-4">
             <Button variant="outlined"><Link className=" text-primary " style={{textDecoration:"none"}} to={'/instructions'}> How to Book Online</Link></Button>
                <Button variant="outlined"> <Link className=" text-primary " style={{textDecoration:"none"}} to={'/login'}>Check My Token Status </Link></Button>
              </div>
            </Col>

            <Col md={6} className="text-center">
              {/* Replace with actual illustration */}
              <img
                src="https://www.itrobes.com/wp-content/uploads/2024/01/Queue-Management-System-In-Hospital.jpg"
                alt="hospital"
                className="img-fluid"
                height={"400px"}
              />
            </Col>
          </Row>
        
        </Container>
       
      </Container>

      {/* FEATURES */}
      {/* FEATURES */}
<Container className="py-5">
 <h2 className="text-center fw-bold pb-2"> What <span className="text-primary ">MEDQUEUE</span> Solves  ?
 </h2>
  <Row className="g-4">
    <Col md={4}>
      <Card className="h-100 shadow-sm text-center p-3">
        <img
          src="https://uxwing.com/wp-content/themes/uxwing/download/e-commerce-currency-shopping/mobile-online-booking-icon.png"
          alt="Online Booking"
          style={{ height: "90px" }}
          className="mx-auto mb-3"
        />
        <Card.Body>
          <h5 className="fw-bold">Easy Online Token Booking</h5>
          <p className="text-muted">
            Reserve your spot from home with just a few clicks.
          </p>
        </Card.Body>
      </Card>
    </Col>

    <Col md={4}>
      <Card className="h-100 shadow-sm text-center p-3">
        <img
          src="https://cdn-icons-png.flaticon.com/512/942/942799.png"
          alt="Rules"
          style={{ height: "90px" }}
          className="mx-auto mb-3"
        />
        <Card.Body>
          <h5 className="fw-bold">Clear Booking Rules</h5>
          <p className="text-muted">
            Know the guidelines and priority rules for booking.
          </p>
        </Card.Body>
      </Card>
    </Col>

    <Col md={4}>
      <Card className="h-100 shadow-sm text-center p-3">
        <img
          src="https://cdn-icons-png.flaticon.com/512/747/747310.png"
          alt="Queue Tracking"
          style={{ height: "90px" }}
          className="mx-auto mb-3"
        />
        <Card.Body>
          <h5 className="fw-bold">Track Your Place in Queue</h5>
          <p className="text-muted">
            See live updates on when it’s your turn.
          </p>
        </Card.Body>
      </Card>
    </Col>
  </Row>
</Container>


      {/* FAIR PROCESS */}
      <Container fluid className="bg-light py-5">
        <Container>
          <h3 className="text-center fw-bold mb-2">
            Fair & Transparent Process
          </h3>
          <p className="text-center text-muted mb-4">
            Tokens are assigned based on clear and fair rules.
          </p>

          <Row className="g-4">
  <Col md={4}>
    <Card className="h-100 shadow-sm text-center p-3">
      <img
        src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSHtWwEeE72bFbKjfQOeVPRxdZVeVLzSm6l5Q&s"
        alt="Senior Priority"
        style={{ height: "90px" }}
        className="mx-auto mb-3"
      />
      <Card.Body>
        <h6 className="fw-bold">
          Priority for Seniors & Emergencies
        </h6>
        <p className="text-muted">
         Handled directly by hospital staff and reflected transparently in the live queue
        </p>
      </Card.Body>
    </Card>
  </Col>

  <Col md={4}>
    <Card className="h-100 shadow-sm text-center p-3">
      <img
        src="https://cdn-icons-png.flaticon.com/512/2921/2921222.png"
        alt="Time Slot"
        style={{ height: "90px" }}
        className="mx-auto mb-3"
      />
      <Card.Body>
        <h6 className="fw-bold">Time-Slot Appointments</h6>
        <p className="text-muted">
          Arrive exactly at your scheduled time.
        </p>
      </Card.Body>
    </Card>
  </Col>

  <Col md={4}>
    <Card className="h-100 shadow-sm text-center p-3">
      <img
        src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRNjXAHlWFENTKKmr4F_8C9CL2rg49uveMfhg&s"
        alt="Limited Tokens"
        style={{ height: "90px" }}
        className="mx-auto mb-3"
      />
      <Card.Body>
        <h6 className="fw-bold">Limited Daily Tokens</h6>
        <p className="text-muted">
          Avoid overcrowding in hospitals.
        </p>
      </Card.Body>
    </Card>
  </Col>
</Row>

        </Container>
      </Container>

      {/* CTA */}
      <Container className="py-5 text-center">
        <h3 className="fw-bold">Be Prepared. Be Informed.</h3>
        <p className="text-muted">
          Learn how to book and track your hospital visit smoothly.
        </p>
        <Button variant="contained" size="large">
          Get Started Now
        </Button>
      </Container>
      <Footer/>
    </>
  );
}

export default Landing;
