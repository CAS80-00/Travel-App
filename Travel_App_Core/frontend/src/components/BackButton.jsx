import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/BackButton.css";

const BackButton = ({ label = "Back" }) => {
  const navigate = useNavigate();

  const goBack = (e) => {
    e.preventDefault();
    try {
      // Prefer router navigation
      navigate(-1);
    } catch (err) {
      // Fallback to browser history
      window.history.back();
    }
  };

  return (
    <button className="back-card" onClick={goBack} aria-label="Go back">
      <span className="back-icon" aria-hidden>
        {/* left arrow SVG */}
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M15 18L9 12L15 6"
            stroke="#0f172a"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="back-label">{label}</span>
    </button>
  );
};

export default BackButton;
