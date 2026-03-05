import React from "react";
import { Navbar, Nav, Container } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";

function AppNavbar() {
  const navigate = useNavigate();

  const token = sessionStorage.getItem("token");
  const username =sessionStorage.getItem("username");

  const handleLogout = () => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("username");
    navigate("/");
    window.location.reload();
  };

  return (
    <Navbar
      expand="lg"
      style={{
        background: "linear-gradient(90deg, #0E7490, #14B8A6)",
      }}
      className="shadow-sm py-3"
    >
      <Container>
        {/* BRAND */}
        <Navbar.Brand
          as={Link}
          to="/"
          className="fw-bold fs-4 text-white"
          style={{ letterSpacing: "1px" }}
        >
          MEDQUEUE
        </Navbar.Brand>

        <Navbar.Toggle
          aria-controls="basic-navbar-nav"
          className="bg-white"
        />

        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="ms-auto align-items-lg-center gap-4">

            <Nav.Link
              as={Link}
              to="/"
              className="text-white fw-semibold"
            >
              Home
            </Nav.Link>

            <Nav.Link
              as={Link}
              to="/instructions"
              className="text-white fw-semibold"
            >
              How it Works
            </Nav.Link>

            <Nav.Link
              as={Link}
              to="/contactus"
              className="text-white fw-semibold"
            >
              Contact Us
            </Nav.Link>

            {token ? (
              <>
                <span className="text-white fw-bold">
                  Hello, {username}
                </span>

                <button
                  onClick={handleLogout}
                  style={{
                    backgroundColor: "white",
                    border: "none",
                    padding: "6px 14px",
                    borderRadius: "8px",
                    color: "#0E7490",
                    fontWeight: "600",
                  }}
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                to="/login"
                style={{
                  backgroundColor: "white",
                  padding: "6px 14px",
                  borderRadius: "8px",
                  color: "#0E7490",
                  fontWeight: "600",
                  textDecoration: "none",
                }}
              >
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