import React from "react";
import { Navbar, Nav, Container } from "react-bootstrap";
import { Link } from "react-router-dom";
// import IMG from "..//assets/images/logoMedQ.jpeg"

function AppNavbar() {
  return (
    <Navbar bg="primary" expand="lg" className="shadow-sm">
      <Container>
        <Navbar.Brand as={Link} to="/" className="fw-bold fs-4 text-light">
          MEDQUEUE
        </Navbar.Brand>

        <Navbar.Toggle aria-controls="basic-navbar-nav" />

        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="ms-auto align-items-lg-center gap-3">
            <Nav.Link as={Link} to="/" className="text-light">
              Home
            </Nav.Link>
            <Nav.Link as={Link} to="/instructions" className="text-light">
              How it Works
            </Nav.Link>
            <Nav.Link as={Link} to="/contactus" className="text-light">
              Contact Us
            </Nav.Link>

            <Link className="btn btn-light text-dark" to="/login">
              Login
            </Link>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export default AppNavbar;
