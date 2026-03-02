import { useState } from 'react';
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import './App.css';
import { Route, Routes } from 'react-router-dom';
import Landing from './Pages/Landing';
import Login from './Pages/Login';
import PatientLogin from './Pages/PatientLogin';
import Instructions from './Pages/Instructions';
import PatientRegister from './Pages/PatientRegister';
import VerifyOtp from './Pages/VerifyOtp';
import DoctorLogin from './Pages/DoctorLogin';
import DoctorRegister from './Pages/DoctorRegister';
import Booking from './Pages/Booking';
import ContactUs from './Pages/ContactUs';
import DoctorDashboard from './Pages/DoctorDashboard';
import BookingDetails from './Pages/BookingDetails';
import PatientOtp from './Pages/PatientOtp';
import OpdLogin from './Pages/OpdLogin';
import OpDashboard from './Pages/OpDashboard';
import OfflineBooking from './Pages/OfflineBooking';
import OfflineBookingDetails from './Pages/OfflineBookingDetails'; // Add this
import PatientDashboard from './Pages/PatientDashboard';

function App() {
  const [count, setCount] = useState(0);

  return (
    <>
      <Routes>
        <Route path='/' element={<Landing />} />
        <Route path='/login' element={<Login />} />
        <Route path='/instructions' element={<Instructions />} />
        <Route path='/patientregister' element={<PatientRegister />} />
        <Route path='/verifyotp' element={<VerifyOtp />} />
        <Route path='/patientlogin' element={<PatientLogin />} />
        <Route path='/patientotp' element={<PatientOtp />} />
        <Route path='/doctorlogin' element={<DoctorLogin />} />
        <Route path='/doctorregister' element={<DoctorRegister />} />
        <Route path='/doctordashboard' element={<DoctorDashboard />} />
        <Route path='/booking' element={<Booking />} />
        <Route path='/contactus' element={<ContactUs />} />
        <Route path='/bookingdetails' element={<BookingDetails />} />
        <Route path='/opdlogin' element={<OpdLogin />} /> {/* OPD login */}
        <Route path='/opd-dashboard' element={<OpDashboard />} /> {/* OPD dashboard */}
        <Route path='/opd-offline' element={<OfflineBooking />} /> {/* Offline booking page */}
        <Route path='/offlinebookingdetails' element={<OfflineBookingDetails />} /> {/* Offline booking details page */}
        <Route path='/patient-dashboard' element={<PatientDashboard />} />
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

export default App;