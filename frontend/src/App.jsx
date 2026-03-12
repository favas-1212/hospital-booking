import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Routes, Route, Navigate } from "react-router-dom";

// ── Public Pages ─────────────────────────────────────────
import Landing           from "./Pages/Landing";
import Instructions      from "./Pages/Instructions";
import ContactUs         from "./Pages/ContactUs";

// ── Auth Pages ───────────────────────────────────────────
import Login             from "./Pages/Login";
import PatientRegister   from "./Pages/PatientRegister";
import PatientLogin      from "./Pages/PatientLogin";
import PatientOtp        from "./Pages/PatientOtp";
import VerifyOtp         from "./Pages/Verify0tp";
import DoctorLogin       from "./Pages/DoctorLogin";
import DoctorRegister    from "./Pages/DoctorRegister";
import OpdLogin          from "./Pages/OpdLogin";

// ── Patient Pages ────────────────────────────────────────
import Booking           from "./Pages/Booking";
import { BookingDetails, OfflineBookingDetails } from "./Pages/BookingDetails";
import MyBookings        from "./Pages/MyBooking";
import PatientDashboard  from "./Pages/PatientDashboard";

// ── Doctor Pages ─────────────────────────────────────────
import DoctorDashboard   from "./Pages/DoctorDashboard";

// ── OPD Staff Pages ──────────────────────────────────────
import OPDDashboard      from "./Pages/OpDashboard";

// ── Route Guard ──────────────────────────────────────────
function PrivateRoute({ children }) {
  const token = sessionStorage.getItem("token");
  return token ? children : <Navigate to="/login" replace />;
}

function App() {
  return (
    <>
      <Routes>
        {/* ── Public ───────────────────────────────── */}
        <Route path="/"             element={<Landing />} />
        <Route path="/instructions" element={<Instructions />} />
        <Route path="/contact"      element={<ContactUs />} />

        {/* ── Auth ─────────────────────────────────── */}
        <Route path="/login"          element={<Login />} />
        <Route path="/register"       element={<PatientRegister />} />
        <Route path="/patientlogin"   element={<PatientLogin />} />
        <Route path="/patientotp"     element={<PatientOtp />} />
        <Route path="/verifyotp"      element={<VerifyOtp />} />
        <Route path="/doctorlogin"    element={<DoctorLogin />} />
        <Route path="/doctorregister" element={<DoctorRegister />} />
        <Route path="/opdlogin"       element={<OpdLogin />} />

        {/* ── Patient (protected) ──────────────────── */}
        <Route path="/booking" element={
          <PrivateRoute><Booking /></PrivateRoute>
        } />
        <Route path="/bookingdetails" element={
          <PrivateRoute><BookingDetails /></PrivateRoute>
        } />
        <Route path="/mybookings" element={
          <PrivateRoute><MyBookings /></PrivateRoute>
        } />
        <Route path="/patient/status" element={
          <PrivateRoute><PatientDashboard /></PrivateRoute>
        } />

        {/* ── Doctor (protected) ───────────────────── */}
        <Route path="/doctor/dashboard" element={
          <PrivateRoute><DoctorDashboard /></PrivateRoute>
        } />

        {/* ── OPD Staff (protected) ────────────────── */}
        <Route path="/staff/dashboard" element={
          <PrivateRoute><OPDDashboard /></PrivateRoute>
        } />
        <Route path="/offlinebookingdetails" element={
          <PrivateRoute><OfflineBookingDetails /></PrivateRoute>
        } />

        {/* ── Legacy redirects ─────────────────────── */}
        <Route path="/patientregister"   element={<Navigate to="/register"          replace />} />
        <Route path="/doctordashboard"   element={<Navigate to="/doctor/dashboard"  replace />} />
        <Route path="/opd-dashboard"     element={<Navigate to="/staff/dashboard"   replace />} />
        <Route path="/patient-dashboard" element={<Navigate to="/patient/status"    replace />} />
        <Route path="/mybooking"         element={<Navigate to="/mybookings"        replace />} />
        <Route path="/contactus"         element={<Navigate to="/contact"           replace />} />

        {/* ── 404 ──────────────────────────────────── */}
        <Route path="*" element={<NotFound />} />
      </Routes>

      <ToastContainer
        position="top-right"
        autoClose={3000}
        pauseOnHover
        draggable
        theme="colored"
      />
    </>
  );
}

function NotFound() {
  return (
    <div style={{
      minHeight:"100vh", display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center",
      background:"#f8fafc", fontFamily:"'DM Sans',sans-serif",
    }}>
      <div style={{ fontSize:72 }}>🏥</div>
      <h1 style={{ fontSize:40, fontWeight:800, color:"#0f4c75", margin:"16px 0 8px" }}>404</h1>
      <p style={{ color:"#64748b", fontSize:16, margin:"0 0 28px" }}>Page not found</p>
      <a href="/" style={{
        background:"linear-gradient(90deg,#0f4c75,#118a7e)", color:"#fff",
        textDecoration:"none", borderRadius:10, padding:"12px 28px",
        fontWeight:700, fontSize:15,
      }}>← Back to Home</a>
    </div>
  );
}

export default App;