import { useEffect, useState } from "react";
import axios from "axios";
import { MdSkipNext } from "react-icons/md";
import { toast } from "react-toastify";

const BASE_URL = "http://127.0.0.1:8000/api/booking";

const DoctorDashboard = () => {
  const [currentToken, setCurrentToken] = useState(null);
  const [queue, setQueue] = useState([]);
  const [allTokens, setAllTokens] = useState([]);

  const token = localStorage.getItem("token");
  const today = new Date().toISOString().split("T")[0];

  // ==============================
  // Fetch Dashboard Data
  // ==============================
  const fetchDashboard = async () => {
    try {
      const res = await axios.get(
        `${BASE_URL}/doctor/dashboard/?date=${today}`,
        {
          headers: { Authorization: `Token ${token}` },
        }
      );

      const tokens = res.data.tokens;

      // Determine current token (consulting)
      const current = tokens.find((t) => t.status === "consulting");

      // Next 3 tokens in waiting
      const waiting = tokens.filter((t) => t.status === "waiting").slice(0, 3);

      setCurrentToken(current ? current.token : null);
      setQueue(waiting.map((t) => t.token));
      setAllTokens(tokens);
    } catch (err) {
      console.error("Dashboard error:", err.response || err);
      toast.error("Failed to fetch dashboard data");
    }
  };

  // ==============================
  // Handle Next Token
  // ==============================
  const handleNext = async () => {
    try {
      const res = await axios.post(
        `${BASE_URL}/doctor/next-token/?date=${today}`,
        {},
        {
          headers: { Authorization: `Token ${token}` },
        }
      );

      toast.success(res.data.message || "Moved to next token");
      fetchDashboard();
    } catch (err) {
      console.error("Next token error:", err.response || err);
      toast.error(err.response?.data?.error || "Failed to advance token");
    }
  };

  useEffect(() => {
    fetchDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-vh-100 bg-light">

      {/* Navbar */}
      <nav className="navbar navbar-dark bg-primary px-4 py-2">
        <div className="container-fluid d-flex justify-content-between text-white">
          <span>Doctor OPD Dashboard</span>
          <span>{today}</span>
        </div>
      </nav>

      <div className="container-fluid mt-4">
        <div className="row">

          {/* LEFT SIDE: Current + Queue */}
          <div className="col-md-8 text-center">

            {/* Current Token */}
            <div className="card shadow-sm mb-4 p-3">
              <h5 className="text-muted">Now Consulting</h5>
              <h1 className="display-3 fw-bold">
                {currentToken ? currentToken : "Not Started"}
              </h1>
            </div>

            {/* Next Up */}
            <h5 className="mb-3">Next Up</h5>
            <div className="d-flex justify-content-center gap-3 mb-4 flex-wrap">
              {queue.length > 0 ? (
                queue.map((tokenNumber, index) => (
                  <div key={index} className="card px-4 py-3 shadow-sm">
                    <h5 className="fw-semibold text-primary mb-0">{tokenNumber}</h5>
                  </div>
                ))
              ) : (
                <p className="text-muted">No waiting tokens</p>
              )}
            </div>

            {/* NEXT Button */}
            <button onClick={handleNext} className="btn btn-primary btn-lg px-5">
              <MdSkipNext className="fs-2 mb-1" /> NEXT
            </button>

          </div>

          {/* RIGHT SIDE: All Tokens */}
          <div className="col-md-4">
            <div className="card shadow-sm">
              <div className="card-header bg-dark text-white">
                All Tokens Today
              </div>
              <ul className="list-group list-group-flush">

                {allTokens.length === 0 && (
                  <li className="list-group-item text-muted text-center">
                    No tokens booked
                  </li>
                )}

                {allTokens.map((item, index) => (
                  <li
                    key={index}
                    className={`list-group-item d-flex justify-content-between align-items-center
                      ${item.status === "consulting" ? "list-group-item-success" : ""}
                    `}
                  >
                    <div>
                      <strong>Token {item.token}</strong>
                      <br />
                      <small className="text-muted">
                        {item.patient || item.walkin_name || "Unknown"}
                      </small>
                    </div>

                    <div>
                      {item.status === "consulting" && (
                        <span className="badge bg-success me-1">Consulting</span>
                      )}
                      {!item.patient && item.walkin_name && (
                        <span className="badge bg-warning text-dark">Walk-in</span>
                      )}
                    </div>
                  </li>
                ))}

              </ul>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default DoctorDashboard;