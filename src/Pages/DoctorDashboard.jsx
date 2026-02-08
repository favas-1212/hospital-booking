import { useState } from 'react'
import { VscDebugStart } from "react-icons/vsc";
import { FaPause } from "react-icons/fa6";
import { FaStop } from "react-icons/fa";
import { MdSkipNext } from "react-icons/md";


const DoctorDashboard = () => {
  return (
    <div className="min-vh-100 d-flex flex-column bg-light">
      {/* Top Bar */}
      <nav className="navbar navbar-dark bg-primary px-4 py-2">
  <div className="container-fluid d-flex align-items-center">

    {/* Left side: OPD + Doctor */}
    <div className="d-flex align-items-center gap-3">
      <span className="navbar-brand fw-semibold">
        General Medicine OPD
      </span>
      <span className="text-white fw-medium">
        Dr. Shreya Gopal
      </span>
    </div>

    {/* Right side: Date + Status */}
    <div className="d-flex align-items-center gap-3 ms-auto text-white">
      <span className="small">
        Wednesday, January 21, 2026
      </span>
      <span className="badge bg-success">Active</span>
    </div>

   </div>
   </nav>

      {/* Main Content */}
      <div className="container flex-grow-1 d-flex flex-column justify-content-center text-center">

        {/* Now Consulting */}
        <div className="card mx-auto shadow-sm mb-4 p-3" style={{ maxWidth: "420px" }}>
          <div className="card-body py-4 px-5">
            <h5 className="text-muted mb-3">Now Consulting</h5>
            <h1 className="fw-bold display-4 mb-0">A-047</h1>
          </div>
        </div>

        {/* Next Up */}
        <h5 className="mb-3">Next Up</h5>

        <div className="d-flex justify-content-center gap-3 mb-4">
          {["A-048", "A-049", "A-050", "A-051"].map((token) => (
            <div key={token} className="card px-4 py-3 shadow-sm">
              <h5 className="fw-semibold text-primary mb-0">
                {token}
              </h5>
            </div>
          ))}
        </div>

        {/* OPD Controls */}
        <div className="d-flex justify-content-center gap-3 mb-4 flex-wrap">
          <button className="btn btn-outline-dark btn-sm px-4">
             <VscDebugStart />   Start OPD
          </button>
          <button className="btn btn-outline-secondary btn-sm px-4">
           <FaPause />  Pause OPD
          </button>
          <button className="btn btn-danger btn-sm px-4">
           <FaStop />   End OPD
          </button>
        </div>

        {/* Primary Actions */}
        <div className="d-flex justify-content-center gap-4">
          <button className="btn btn-primary btn-lg px-5">
          <MdSkipNext className='fs-2 mb-1' />  NEXT
          </button>
          <button className="btn btn-outline-danger btn-sm px-3 py-1 align-self-center">
            Patient Not Present
          </button>
        </div>
      </div>
    </div>
  )
}

export default DoctorDashboard