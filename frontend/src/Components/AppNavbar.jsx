import React from "react";
import { Navbar, Nav, Container } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";

function AppNavbar() {
  const navigate = useNavigate();

  // Check if user is logged in
  const token = localStorage.getItem("token");
  const username = localStorage.getItem("username");

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    navigate("/"); // redirect to landing page
    window.location.reload(); // refresh to update UI
  };

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

            {token ? (
              <>
                <span className="text-light fw-bold">Hello, {username}</span>
                <button
                  className="btn btn-light text-dark"
                  onClick={handleLogout}
                >
                  Logout
                </button>
              </>
            ) : (
              <Link className="btn btn-light text-dark" to="/login">
                Login
              </Link>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export default AppNavbar;
