import React from "react";
import { Link } from "react-router-dom";
import {
  InfoOutlined,
  AccessTime,
  Rule,
  WarningAmber,
  Payments,
} from "@mui/icons-material";
import AppNavbar from "../Components/AppNavbar";
import Footer from "../Components/Footer";

const Instructions = () => {
  return (
    <>
      <AppNavbar />

      <div
        style={{
          minHeight: "100vh",
          background: "#f8fafc",
          padding: "80px 20px",
        }}
      >
        <div
          style={{
            maxWidth: "800px",
            margin: "0 auto",
          }}
        >
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: "60px" }}>
            <InfoOutlined style={{ fontSize: "40px", color: "#0E7490" }} />
            <h2
              style={{
                marginTop: "15px",
                fontWeight: "700",
                color: "#0f172a",
              }}
            >
              OPD Booking Instructions
            </h2>
            <p style={{ color: "#64748b", marginTop: "10px" }}>
              Please review the following guidelines before proceeding with
              your booking.
            </p>
          </div>

          {/* Vertical Sections */}
          <div style={{ display: "flex", flexDirection: "column", gap: "40px" }}>
            
            <InstructionItem
              icon={<AccessTime />}
              title="Booking Availability"
              text="Booking is available one day prior to consultation between 6:00 AM – 12:00 PM."
            />

            <InstructionItem
              icon={<Rule />}
              title="Token Rules"
              text="Tokens are limited and issued on a first-come, first-served basis. Once booked, token numbers remain fixed unless cancelled."
            />

            <InstructionItem
              icon={<WarningAmber />}
              title="Arrival Policy"
              text="Patients must confirm arrival before OPD start time. Late arrivals without confirmation may be skipped."
            />

            <InstructionItem
              icon={<Payments />}
              title="Payment Policy"
              text="Booking is confirmed only after successful payment. Token is valid for selected hospital, department, and date."
            />
          </div>

          {/* CTA */}
          <div style={{ textAlign: "center", marginTop: "70px" }}>
            <Link to="/booking" style={{ textDecoration: "none" }}>
              <button
                style={{
                  padding: "14px 35px",
                  borderRadius: "30px",
                  border: "none",
                  background: "#0E7490",
                  color: "#fff",
                  fontSize: "16px",
                  fontWeight: "600",
                  cursor: "pointer",
                  boxShadow: "0 8px 20px rgba(14,116,144,0.25)",
                  transition: "0.3s",
                }}
              >
                Continue to Booking
              </button>
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
};

/* Clean Minimal Item */
const InstructionItem = ({ icon, title, text }) => (
  <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
    <div
      style={{
        minWidth: "45px",
        height: "45px",
        background: "#e0f2fe",
        borderRadius: "12px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#0E7490",
      }}
    >
      {icon}
    </div>

    <div>
      <h5 style={{ margin: 0, fontWeight: "600", color: "#0f172a" }}>
        {title}
      </h5>
      <p style={{ marginTop: "6px", color: "#475569", lineHeight: "1.6" }}>
        {text}
      </p>
    </div>
  </div>
);

export default Instructions;