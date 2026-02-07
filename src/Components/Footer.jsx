import React from "react";

const Footer = () => {
  return (
    <footer
      style={{
        backgroundColor: "#007bff",
        color: "#fff",
        textAlign: "center",
        padding: "10px 0",
        fontSize: "14px",
        marginTop: "30px",
      }}
    >
      &copy; {new Date().getFullYear()} MEDQUEUE. All rights reserved.
    </footer>
  );
};

export default Footer;
