import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  getDistricts,
  getHospitals,
  getDepartments,
  getAvailableTokens,
  bookToken
} from "../services/allApi";

function Booking() {
  const navigate = useNavigate();

  const [districts, setDistricts] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [districtId, setDistrictId] = useState("");
  const [hospitalId, setHospitalId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [opdSession, setOpdSession] = useState("");
  const [selectedToken, setSelectedToken] = useState("");
  const [tokens, setTokens] = useState([]);

  // Load districts
  useEffect(() => {
    getDistricts()
      .then(res => setDistricts(res.data))
      .catch(err => console.log(err));
  }, []);

  // Load hospitals when district changes
  useEffect(() => {
    if (!districtId) return;
    getHospitals(districtId)
      .then(res => setHospitals(res.data))
      .catch(err => console.log(err));
    setHospitalId("");
    setDepartmentId("");
    setDepartments([]);
  }, [districtId]);

  // Load departments when hospital changes
  useEffect(() => {
    if (!hospitalId) return;
    getDepartments(hospitalId)
      .then(res => setDepartments(res.data))
      .catch(err => console.log(err));
    setDepartmentId("");
  }, [hospitalId]);

  // Load tokens when department or session changes
  useEffect(() => {
    if (!departmentId || !opdSession) {
      setTokens([]);
      setSelectedToken("");
      return;
    }

    getAvailableTokens(departmentId, opdSession)
      .then(res => {
        setTokens(res.data.available_tokens);
        setSelectedToken(""); // reset selected token whenever list changes
      })
      .catch(err => console.log(err));
  }, [departmentId, opdSession]);

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
const handleBooking = async () => {
  if (!departmentId || !opdSession || !selectedToken) {
    alert("Please select department, session, and token.");
    return;
  }

  const payload = {
    department_id: Number(departmentId),
    session: opdSession,
    token_number: Number(selectedToken),
  };

  console.log("Booking payload:", payload);

  try {
    const response = await bookToken(payload); // ✅ fixed

    navigate("/bookingdetails", {
      state: {
        district: districts.find(d => d.id == districtId)?.name,
        hospital: hospitals.find(h => h.id == hospitalId)?.name,
        department: departments.find(dep => dep.id == departmentId)?.name,
        session: opdSession,
        token: selectedToken,
        date: response.data.booking_date, // make sure API returns this
      },
    });
  } catch (err) {
    console.error("Booking failed:", err);
    alert(err.response?.data?.error || err.message || "Booking failed. Please try again.");
  }
};




  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-md-6 col-lg-5">
          <div className="card shadow border-0">
            <div className="card-body p-4">
              <h4 className="text-center mb-3 text-primary">Online OPD Booking</h4>

              {/* District */}
              <div className="mb-3">
                <label className="form-label">District</label>
                <select
                  className="form-select"
                  value={districtId}
                  onChange={(e) => setDistrictId(e.target.value)}
                >
                  <option value="">Select District</option>
                  {districts.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              {/* Hospital */}
              <div className="mb-3">
                <label className="form-label">Hospital</label>
                <select
                  className="form-select"
                  value={hospitalId}
                  onChange={(e) => setHospitalId(e.target.value)}
                  disabled={!districtId}
                >
                  <option value="">Select Hospital</option>
                  {hospitals.map(h => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>

              {/* Department */}
              <div className="mb-3">
                <label className="form-label">Department / OPD</label>
                <select
                  className="form-select"
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  disabled={!hospitalId}
                >
                  <option value="">Select Department</option>
                  {departments.map(dep => (
                    <option key={dep.id} value={dep.id}>{dep.name}</option>
                  ))}
                </select>
              </div>

              {/* OPD Session */}
              <div className="mb-4">
                <label className="form-label">OPD Session</label>
                <div className="row g-2">
                  <div className="col-6">
                    <div
                      className={sessionCard("MORNING")}
                      style={{ cursor: "pointer" }}
                      onClick={() => setOpdSession("MORNING")}
                    >
                      <strong>Morning</strong>
                      <div className="text-muted small">10AM–12PM</div>
                    </div>
                  </div>
                  <div className="col-6">
                    <div
                      className={sessionCard("EVENING")}
                      style={{ cursor: "pointer" }}
                      onClick={() => setOpdSession("EVENING")}
                    >
                      <strong>Evening</strong>
                      <div className="text-muted small">2PM–5PM</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tokens */}
              {opdSession && departmentId && (
                <div className="mb-4">
                  <label className="form-label">Select Token</label>
                  <div className="d-flex flex-wrap gap-2">
                    {tokens.length > 0 ? (
                      tokens.map(token => (
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
                            fontWeight: 600,
                          }}
                          onClick={() => setSelectedToken(token)}
                        >
                          {token}
                        </div>
                      ))
                    ) : (
                      <small className="text-muted">No tokens available for this session</small>
                    )}
                  </div>
                </div>
              )}

              <button
                className="btn btn-primary w-100"
                disabled={!selectedToken}
                onClick={handleBooking}
              >
                Book Token
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Booking;
