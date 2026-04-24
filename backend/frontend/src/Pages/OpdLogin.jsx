import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function OpdLogin() {
  const navigate = useNavigate();

  // ---------------- state ----------------
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // ---------------- redirect if already logged in ----------------
  useEffect(() => {
    const token = sessionStorage.getItem("token");
    if (token) {
      navigate("/opd-dashboard"); // OPD dashboard landing
    }
  }, [navigate]);

  // ---------------- login handler ----------------
  const handleLogin = async (e) => {
    e.preventDefault();

    if (!username || !password) {
      toast.error("Please enter both username and password");
      return;
    }

    setLoading(true);

    try {
      const res = await axios.post(
        "http://127.0.0.1:8000/api/opdstaff/login/",
        { username, password }
      );

      const { token, role, opd_id, hospital_id } = res.data;

      // Store token & info for authenticated requests
      sessionStorage.setItem("token", token);
      sessionStorage.setItem("role", role);
      sessionStorage.setItem("opd_id", opd_id);
      sessionStorage.setItem("hospital_id", hospital_id);

      toast.success("Login successful");

      // Navigate to OPD Dashboard
      navigate("/opd-dashboard");

    } catch (err) {
      console.error(err.response?.data || err);

      const errorMsg =
        err.response?.data?.error ||
        err.response?.data?.non_field_errors?.[0] ||
        "Login failed. Check credentials.";

      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-5">
      <ToastContainer
        position="top-right"
        autoClose={3000}
        pauseOnHover
        draggable
        theme="colored"
      />

      <div className="row justify-content-center">
        <div className="col-md-4">
          <div className="card shadow-sm p-4">
            <h3 className="text-center mb-4">OPD Staff Login</h3>

            <form onSubmit={handleLogin}>
              {/* Username */}
              <div className="mb-3">
                <label className="form-label">Username</label>
                <input
                  type="text"
                  className="form-control"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  required
                />
              </div>

              {/* Password */}
              <div className="mb-3">
                <label className="form-label">Password</label>
                <div className="input-group">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="form-control"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    required
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {/* Login button */}
              <button
                type="submit"
                className="btn btn-primary w-100"
                disabled={loading}
              >
                {loading ? "Logging in..." : "Login"}
              </button>
            </form>

            {/* Register link */}
            <div className="text-center mt-3">
              <small>
                Don't have an account?{" "}
                <button
                  className="btn btn-link p-0"
                  onClick={() => navigate("/opdstaff/register")}
                >
                  Register
                </button>
              </small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OpdLogin;