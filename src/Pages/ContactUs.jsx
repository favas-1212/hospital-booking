import React from "react";
import { Container, Row, Col, Form, Button, Card } from "react-bootstrap";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import PhoneIcon from "@mui/icons-material/Phone";
import EmailIcon from "@mui/icons-material/Email";
import AppNavbar from "../Components/AppNavbar";
import Footer from "../Components/Footer";

function ContactUs() {
  return (
    <>
    <AppNavbar/>
    <Container className="py-5">
      <h3 className="fw-bold text-center mb-4">Contact Us</h3>

      <Row className="g-4 justify-content-center">
        {/* Contact Info */}
        <Col md={5}>
          <Card className="shadow-sm h-100">
            <Card.Body>
              <h5 className="fw-bold mb-3">Get in Touch</h5>

              <p className="d-flex align-items-center gap-2 mb-2">
                <LocationOnIcon color="primary" />
                123 Medical Street, Kerala, India
              </p>

              <p className="d-flex align-items-center gap-2 mb-2">
                <PhoneIcon color="primary" />
                +91 98765 43210
              </p>

              <p className="d-flex align-items-center gap-2">
                <EmailIcon color="primary" />
                support@medqueue.com
              </p>

              <p className="text-muted mt-3">
                Our support team is available Monday to Friday, 9:00 AM – 6:00 PM.
              </p>
            </Card.Body>
          </Card>
        </Col>

        {/* Contact Form */}
        <Col md={6}>
          <Card className="shadow-sm">
            <Card.Body>
              <h5 className="fw-bold mb-3">Send Us a Message</h5>

              <Form>
                <Form.Group className="mb-3">
                  <Form.Label>Name</Form.Label>
                  <Form.Control type="text" placeholder="Enter your name" />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Email</Form.Label>
                  <Form.Control type="email" placeholder="Enter your email" />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Message</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={4}
                    placeholder="Type your message here"
                  />
                </Form.Group>

                <Button variant="primary" className="w-100">
                  Submit
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>

    </Container>
    <Footer/>
    </>
  );
}

export default ContactUs;
