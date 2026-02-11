import { useState } from 'react'
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";


import './App.css'
import { Route,Routes } from 'react-router'
import Landing from './Pages/Landing'
import Login from './Pages/Login'
import PatientLogin from './Pages/PatientLogin'
import Instructions from './Pages/Instructions'
import PatientRegister from './Pages/PatientRegister'
import VerifyOtp from './Pages/VerifyOtp'
import DoctorLogin from './Pages/DoctorLogin'
import DoctorRegister from './Pages/DoctorRegister'
import Booking from './Pages/Booking'
import ContactUs from './Pages/ContactUs'
import DoctorDashboard from './Pages/DoctorDashboard'
import "./App.css"
import BookingDetails from './Pages/BookingDetails'
import PatientOtp from './Pages/PatientOtp'


function App() {
  const [count, setCount] = useState(0)

  return (
    <>
    
       <Routes>
        <Route path='/' element={<Landing/>}/>
        <Route path='/login' element={<Login/>}/>
        <Route path='/instructions' element={<Instructions/>}/>
        <Route path='/patientregister' element={<PatientRegister/>}/>
        <Route path='verifyotp' element={<verifyOtp/>}></Route>
        <Route path='/patientlogin' element={<PatientLogin/>}/>
        <Route path='/patientotp' element={<PatientOtp/>}/>
        <Route path='/doctorlogin' element={<DoctorLogin/>}/>
        <Route path='/doctorregister' element={<DoctorRegister/>}/>
        <Route path='/doctordashboard' element={<DoctorDashboard/>}/>
        <Route path='/booking' element={<Booking/>}/>
        <Route path='/contactus' element={<ContactUs/>}/>
        <Route path ='/bookingdetails' element={<BookingDetails/>}/>
        


       </Routes>

       <ToastContainer
        position="top-right"
        autoClose={3000}
        pauseOnHover
        draggable
        theme="colored"
      />

    </>
  )
}

export default App
