

import React from "react";
import { Link } from "react-router-dom";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import ScheduleIcon from "@mui/icons-material/Schedule";
import RuleIcon from "@mui/icons-material/Rule";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import PaymentsIcon from "@mui/icons-material/Payments";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumber";
import { AppBar } from "@mui/material";
import AppNavbar from "../Components/AppNavbar";
import Footer from "../Components/Footer";

const Instructions= () => {
  return (
    <>
    <AppNavbar/>
    <div
      style={{
        minHeight: "100vh",
        background: "#f0f4f8",
        padding: "40px 20px",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "900px",
          background: "#fff",
          borderRadius: "16px",
          boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
          padding: "30px",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "25px" }}>
          <h2 style={{ fontSize: "24px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
            <InfoOutlinedIcon fontSize="large" />
            Online OPD Booking Guidelines
          </h2>
          <p style={{ color: "#555", fontSize: "14px", marginTop: "8px" }}>
            Please read the instructions carefully before booking your OPD token.
          </p>
        </div>

        {/* Cards Section */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          {/* Booking Availability */}
          <div style={{ background: "#eaf6f6", borderRadius: "12px", padding: "20px" }}>
            <h4 style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "600" }}>
              <AccessTimeIcon />
              Booking Availability
            </h4>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginTop: "10px" }}>
              <ScheduleIcon style={{ color: "#007bff", fontSize: "24px" }} />
              <div>
                <p style={{ margin: "0", fontSize: "14px" }}>
                  Online booking is available only on the day before consultation
                </p>
                <strong style={{ fontSize: "13px" }}>6:00 AM – 12:00 PM</strong>
              </div>
            </div>
          </div>

          {/* Token Rules */}
          <div style={{ background: "#fff", borderRadius: "12px", padding: "20px", boxShadow: "0 3px 10px rgba(0,0,0,0.05)" }}>
            <h4 style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "600" }}>
              <RuleIcon />
              Token Rules
            </h4>
            <ul style={{ paddingLeft: "18px", marginTop: "10px", fontSize: "14px", color: "#333" }}>
              <li style={{ marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                <CheckCircleOutlineIcon style={{ color: "green" }} />
                Tokens are limited and issued on first come, first served basis
              </li>
              <li style={{ marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                <CheckCircleOutlineIcon style={{ color: "green" }} />
                Only available tokens can be booked
              </li>
              <li style={{ marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                <CheckCircleOutlineIcon style={{ color: "green" }} />
                Once booked, token number is fixed unless cancelled
              </li>
              <li style={{ marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                <CheckCircleOutlineIcon style={{ color: "green" }} />
                Physical verification is not required
              </li>
            </ul>
          </div>

          {/* Arrival Policy */}
          <div style={{ background: "#fff", borderRadius: "12px", padding: "20px", boxShadow: "0 3px 10px rgba(0,0,0,0.05)" }}>
            <h4 style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "600" }}>
              <ScheduleIcon />
              Arrival & Late Policy
            </h4>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginTop: "10px" }}>
              <WarningAmberIcon style={{ color: "#ff9800", fontSize: "24px" }} />
              <p style={{ margin: "0", fontSize: "14px" }}>
                Patients must confirm arrival before OPD start time. Late arrivals without confirmation will be skipped.
              </p>
            </div>
          </div>

          {/* Payment Rules */}
          <div style={{ background: "#fff", borderRadius: "12px", padding: "20px", boxShadow: "0 3px 10px rgba(0,0,0,0.05)" }}>
            <h4 style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "600" }}>
              <PaymentsIcon />
              Payment & Usage Rules
            </h4>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginTop: "10px" }}>
              <PaymentsIcon style={{ color: "#007bff" }} />
              <p style={{ fontSize: "14px" }}>Token booking is confirmed only after successful payment</p>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginTop: "8px" }}>
              <ConfirmationNumberIcon style={{ color: "#007bff" }} />
              <p style={{ fontSize: "14px" }}>Token is valid only for selected hospital, department & date</p>
            </div>
          </div>
        </div>

        {/* Footer / Book Now Button */}
        <div style={{ textAlign: "center", marginTop: "30px" }}>
          <Link to="/Booking">
            <button
              style={{
                padding: "12px 25px",
                border: "none",
                borderRadius: "10px",
                backgroundColor: "#20b2aa",
                color: "#fff",
                fontSize: "16px",
                cursor: "pointer",
                fontWeight: "600",
              }}
            >
              Book Now
            </button>
          </Link>
            
        </div>
      </div>
    </div>
    <Footer/>
  
    </>
  );
};

export default Instructions;
