import React from "react";

const Footer = () => {
  return (
    <footer
      style={{
        background: "linear-gradient(90deg, #0E7490, #14B8A6)",
        color: "white",
        textAlign: "center",
        padding: "18px 0",
        fontSize: "14px",
        marginTop: "40px",
        letterSpacing: "0.5px",
      }}
    >
      © {new Date().getFullYear()} MEDQUEUE. All rights reserved.
    </footer>
  );
};

export default Footer;