import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/HomeButton.css";

const HomeButton = ({ label = "Home" }) => {
  const navigate = useNavigate();

  const goHome = (e) => {
    e.preventDefault();
    navigate('/');
  };

  return (
    <button className="home-card" onClick={goHome} aria-label="Go home">
      <span className="home-icon" aria-hidden>
        {/* house SVG */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10.5z" stroke="#0f172a" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="rgba(15,23,42,0.04)" />
        </svg>
      </span>
      <span className="home-label">{label}</span>
    </button>
  );
};

export default HomeButton;
