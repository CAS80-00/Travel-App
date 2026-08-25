import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/DashboardButton.css";

const DashboardButton = ({ label = "Dashboard" }) => {
  const navigate = useNavigate();
  const [showGuestMessage, setShowGuestMessage] = useState(false);

  const handleClick = () => {
    const isLoggedIn = localStorage.getItem("travelAppLoggedIn") === "true";

    if (isLoggedIn) {
      setShowGuestMessage(false);
      navigate("/dashboard");
      return;
    }

    setShowGuestMessage(true);
  };

  return (
    <div className="dashboard-button-wrap">
      <button
        className="dashboard-card"
        onClick={handleClick}
        aria-label="Go to Dashboard"
      >
        <span className="dashboard-icon" aria-hidden>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 3.75a8.25 8.25 0 110 16.5 8.25 8.25 0 010-16.5zm0 1.5A6.75 6.75 0 1018.75 12 6.76 6.76 0 0012 5.25zm-1.5 2.25h3v3h3v3h-3v3h-3v-3H7.5v-3h3v-3z"
              fill="#0f172a"
              opacity="0.9"
            />
          </svg>
        </span>
        <span className="dashboard-label">{label}</span>
      </button>

      {showGuestMessage && (
        <div className="dashboard-guest-card">
          <button
            type="button"
            className="dashboard-guest-close"
            aria-label="Close message"
            onClick={() => setShowGuestMessage(false)}
          >
            ×
          </button>
          <p>Please log in or register to access your Dashboard.</p>
        </div>
      )}
    </div>
  );
};

export default DashboardButton;
