import React, { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import OfflineBooking from "./OfflineBooking";

function OpDashboard() {
  const [doctors, setDoctors] = useState([]);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [loading, setLoading] = useState(false);
  const [showOffline, setShowOffline] = useState(false);
  const [currentDoctor, setCurrentDoctor] = useState(null);
  const [currentSession, setCurrentSession] = useState("");

  // ==============================
  // Fetch OPD Dashboard
  // ==============================
  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem("token");

      const res = await axios.get(
        "http://127.0.0.1:8000/api/booking/opd/dashboard/",
        {
          headers: { Authorization: `Token ${token}` },
          params: { date: selectedDate },
        }
      );

      setDoctors(res.data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load OPD dashboard");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDashboard();
  }, [selectedDate]);

  // ==============================
  // Start OPD (CORRECTED)
  // ==============================
  const startOPD = async (doctor) => {
    try {
      const token = sessionStorage.getItem("token");

      const res = await axios.post(
        "http://127.0.0.1:8000/api/booking/doctor/start-opd/",
        {
          doctor_id: doctor.doctor_id,   // ✅ send doctor_id
          date: selectedDate             // ✅ send date
        },
        {
          headers: { Authorization: `Token ${token}` },
        }
      );

      toast.success(res.data.message);
      fetchDashboard();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to start OPD");
    }
  };

  // ==============================
  // Approve Token
  // ==============================
  const approveToken = async (bookingId) => {
    try {
      const token = sessionStorage.getItem("token");

      await axios.post(
        `http://127.0.0.1:8000/api/booking/approve_booking/${bookingId}/`,
        {},
        { headers: { Authorization: `Token ${token}` } }
      );

      toast.success("Token approved");
      fetchDashboard();
    } catch (err) {
      console.error(err);
      toast.error("Failed to approve token");
    }
  };

  // ==============================
  // Reject Token
  // ==============================
  const rejectToken = async (bookingId) => {
    try {
      const token = sessionStorage.getItem("token");

      await axios.post(
        `http://127.0.0.1:8000/api/booking/reject_booking/${bookingId}/`,
        {},
        { headers: { Authorization: `Token ${token}` } }
      );

      toast.warning("Token rejected");
      fetchDashboard();
    } catch (err) {
      console.error(err);
      toast.error("Failed to reject token");
    }
  };

  // ==============================
  // Open Offline Booking Modal
  // ==============================
  const handleOfflineBookingClick = (doctor, session) => {
    setCurrentDoctor(doctor);
    setCurrentSession(session);
    setShowOffline(true);
  };

  return (
    <div className="container py-5">
      <h2 className="mb-4 text-center">OPD Dashboard</h2>

      {/* Date Selector */}
      <div className="mb-4 d-flex justify-content-center align-items-center">
        <label className="me-2 fw-bold">Select Date:</label>
        <input
          type="date"
          className="form-control w-auto"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="text-center fs-5">Loading...</p>
      ) : doctors.length === 0 ? (
        <p className="text-center fs-5">
          No doctors scheduled for this date.
        </p>
      ) : (
        doctors.map((doc) => (
          <div key={doc.doctor_id} className="card mb-4 shadow-sm">
            <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
              <div>
                <strong>{doc.doctor_name}</strong>{" "}
                <span className="badge bg-success">
                  {doc.is_approved ? "Approved" : "Pending"}
                </span>
                <br />
                <small>
                  {doc.hospital} / {doc.department}
                </small>
              </div>

              <div className="d-flex align-items-center">
                <span className="badge bg-info me-2">
                  Total Tokens: {doc.total_tokens}
                </span>

                <button
                  className="btn btn-sm btn-light"
                  onClick={() => startOPD(doc)}
                  disabled={doc.opd_started}
                >
                  {doc.opd_started ? "OPD Started" : "Start OPD"}
                </button>
              </div>
            </div>

            <div className="card-body">
              {Object.keys(doc.sessions).length === 0 ? (
                <p>No tokens for this date.</p>
              ) : (
                Object.entries(doc.sessions).map(([session, tokens]) => (
                  <div
                    key={session}
                    className="mb-4 p-3 border rounded position-relative"
                  >
                    <h5 className="mb-3">
                      {session.charAt(0).toUpperCase() + session.slice(1)} Session
                    </h5>

                    <button
                      className="btn btn-sm btn-success mb-2"
                      onClick={() =>
                        handleOfflineBookingClick(doc, session)
                      }
                    >
                      Add Walk-in Token
                    </button>

                    {Array.isArray(tokens) && tokens.length > 0 ? (
                      <ul className="list-group mt-2">
                        {tokens.map((t) => {
                          const isOnline =
                            t.token >= 16 && t.token <= 35;

                          const statusClass =
                            t.status === "consulting"
                              ? "list-group-item-warning"
                              : t.status === "done"
                              ? "list-group-item-success"
                              : "";

                          return (
                            <li
                              key={t.id}
                              className={`list-group-item d-flex justify-content-between align-items-center ${statusClass}`}
                            >
                              <span>
                                Token #{t.token}{" "}
                                {isOnline ? (
                                  <span className="badge bg-primary">
                                    Online
                                  </span>
                                ) : (
                                  <span className="badge bg-secondary">
                                    Walk-in
                                  </span>
                                )}
                              </span>

                              <span>
                                {t.patient_name ||
                                  t.walkin_name ||
                                  "Unknown"}
                              </span>

                              {t.status === "waiting" && isOnline && (
                                <span>
                                  <button
                                    className="btn btn-sm btn-success me-1"
                                    disabled={!doc.opd_started}
                                    onClick={() =>
                                      approveToken(t.id)
                                    }
                                  >
                                    Approve
                                  </button>
                                  <button
                                    className="btn btn-sm btn-danger"
                                    disabled={!doc.opd_started}
                                    onClick={() =>
                                      rejectToken(t.id)
                                    }
                                  >
                                    Reject
                                  </button>
                                </span>
                              )}

                              <span>
                                <span className="badge bg-dark">
                                  {t.status}
                                </span>
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p>No tokens for this session.</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        ))
      )}

      {/* Offline Modal */}
      {showOffline && currentDoctor && (
        <div className="modal d-block" tabIndex="-1">
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  Offline Booking - {currentDoctor.doctor_name} (
                  {currentSession})
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowOffline(false)}
                ></button>
              </div>
              <div className="modal-body">
                <OfflineBooking
                  doctor={currentDoctor}
                  session={currentSession}
                  date={selectedDate}
                  onClose={() => setShowOffline(false)}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OpDashboard;