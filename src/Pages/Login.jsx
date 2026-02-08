import React from "react";
import { Container, Card } from "react-bootstrap";
import { Link } from "react-router-dom";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import MedicalServicesOutlinedIcon from "@mui/icons-material/MedicalServicesOutlined";
import AppNavbar from "../Components/AppNavbar";
import Footer from "../Components/Footer";

function Login() {
  return (
    <>
     <AppNavbar/>
    <Container
   
      
      className="flex-grow-1 d-flex flex-column align-items-center justify-content-start px-3 pt-5 my-5 vh-100"
    >
      {/* App Title */}
      
      
      {/* Welcome Text */}
      <h4 className="fw-bold text-center m-5">Welcome to <span className="text-primary">MEDQUEUE</span></h4>
      <p className="text-muted text-center mb-4">
        Securely access your OPD queue <br />
        management system.
      </p>

      {/* Login as Patient */}
      <Card
        className="w-100 shadow-sm mb-3"
        style={{ maxWidth: "360px", borderRadius: "16px" }}
      >
        <Card.Body className="d-flex align-items-center gap-3 p-3">
          <PersonOutlineIcon color="primary" fontSize="large" />
          <div>
            <h6 className="fw-bold mb-1 text-primary">Login as Patient</h6>
            <small className="text-muted">
              View token status and bookings
            </small>
          </div>
        </Card.Body>
        <Link to="/PatientLogin" className="stretched-link" />
      </Card>

      {/* Login as Doctor */}
      <Card
        className="w-100 shadow-sm "
        style={{ maxWidth: "360px", borderRadius: "16px" }}
      >
        <Card.Body className="d-flex align-items-center gap-3 p-3">
          <MedicalServicesOutlinedIcon color="primary" fontSize="large" />
          <div>
            <h6 className="fw-bold mb-1 text-primary">Login as Doctor</h6>
            <small className="text-muted">
              Authorized hospital staff only
            </small>
          </div>
        </Card.Body>
        <Link to="/DoctorLogin" className="stretched-link" />
      </Card>
       
      </Container>
       <Footer/>
</>
  );
}


export default Login;

