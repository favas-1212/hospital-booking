import React, { useState } from "react";
import { Link } from "react-router";
function Booking() {
  const [opdSession, setOpdSession] = useState("");
  const [selectedToken, setSelectedToken] = useState("");

  // Token numbers
  const morningTokens = Array.from({ length: 12 }, (_, i) => i + 1);
  const eveningTokens = Array.from({ length: 10 }, (_, i) => i + 1);

  const sessionCard = (value) =>
    `card text-center p-3 h-100 ${
      opdSession === value ? "border-primary bg-light" : "border"
    }`;

  const tokenBox = (token) =>
    `px-3 py-2 border rounded small ${
      selectedToken === token
        ? "bg-primary text-white border-primary"
        : "bg-white"
    }`;

  const tokens =
    opdSession === "morning"
      ? morningTokens
      : opdSession === "evening"
      ? eveningTokens
      : [];

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-md-6 col-lg-5">
          <div className="card shadow border-0">
            <div className="card-body p-4">

              <h4 className="text-center mb-3 text-primary">
                Online OPD Booking
              </h4>

              <p className="text-muted text-center small">
                Online Booking Window: Tokens can be booked only between
                <strong> 6:00 AM – 12:00 PM</strong> on the day before consultation.
              </p>

              {/* District */}
              <div className="mb-3">
                <label className="form-label">District</label>
                <select className="form-select">
                  <option>Select District</option>
                  <option>District 1</option>
                  <option>District 2</option>
                </select>
              </div>

              {/* Hospital */}
              <div className="mb-3">
                <label className="form-label">Hospital</label>
                <select className="form-select">
                  <option>Select Hospital</option>
                  <option>Government Hospital</option>
                  <option>Community Health Center</option>
                </select>
              </div>

              {/* Department */}
              <div className="mb-3">
                <label className="form-label">Department / OPD</label>
                <select className="form-select">
                  <option>Select Department</option>
                  <option>General Medicine</option>
                  <option>ENT</option>
                  <option>Orthopedics</option>
                </select>
              </div>

              {/* OPD Session Cards */}
              <div className="mb-4">
                <label className="form-label">OPD Session</label>

                <div className="row g-2">
                  <div className="col-6">
                    <div
                      className={sessionCard("morning")}
                      style={{ cursor: "pointer" }}
                      onClick={() => {
                        setOpdSession("morning");
                        setSelectedToken("");
                      }}
                    >
                      <strong>Morning</strong>
                      <div className="text-muted small">10AM–12PM</div>
                    </div>
                  </div>

                  <div className="col-6">
                    <div
                      className={sessionCard("evening")}
                      style={{ cursor: "pointer" }}
                      onClick={() => {
                        setOpdSession("evening");
                        setSelectedToken("");
                      }}
                    >
                      <strong>Evening</strong>
                      <div className="text-muted small">2PM–5PM</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Token Numbers */}
              {opdSession && (
                <div className="mb-4">
                  <label className="form-label">Select Token</label>

                  <div className="d-flex flex-wrap gap-2">
                    {tokens.map((token) => (
                      <div
                        key={token}
                        className={tokenBox(token)}
                        style={{
                          cursor: "pointer",
                          width: "45px",
                          height: "45px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: "600",
                        }}
                        onClick={() => setSelectedToken(token)}
                      >
                        {token}
                      </div>
                    ))}
                  </div>
                </div>
              )}
               <Link to={"/bookingdetails"}>
              <button
                className="btn btn-primary w-100"
                disabled={!selectedToken}
              >
                Book Token
              </button>
              </Link>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Booking;
