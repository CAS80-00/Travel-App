import React, { useEffect, useState } from "react";
import "../styles/SaveButton.css";

const API_BASE = "http://localhost:4000";

const SaveButton = ({ itemName = "itinerary", label = "Save", itemType = "itinerary" }) => {
  const [showGuestMessage, setShowGuestMessage] = useState(false);
  const [saved, setSaved] = useState(false);

  const syncSavedState = async () => {
    const token = localStorage.getItem("travelAppToken");
    const isLoggedIn = localStorage.getItem("travelAppLoggedIn") === "true" && Boolean(token);

    if (!isLoggedIn) {
      setSaved(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/saved-places`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      const savedItems = data.savedPlaces || [];
      setSaved(savedItems.some((entry) => entry.name === itemName && entry.type === itemType));
    } catch (error) {
      console.error("Load saved places failed:", error);
      setSaved(false);
    }
  };

  useEffect(() => {
    syncSavedState();
  }, [itemName, itemType]);

  const handleSave = async () => {
    const token = localStorage.getItem("travelAppToken");
    const isLoggedIn = localStorage.getItem("travelAppLoggedIn") === "true" && Boolean(token);

    if (!isLoggedIn) {
      setShowGuestMessage(true);
      return;
    }

    try {
      const method = saved ? "DELETE" : "POST";
      const response = await fetch(`${API_BASE}/api/save-place`, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: itemName,
          type: itemType,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to update saved item.");
      }

      const savedItems = JSON.parse(localStorage.getItem("travelAppSavedItems") || "[]");
      const nextSavedItems = savedItems.filter(
        (entry) => !(entry.name === itemName && entry.type === itemType),
      );

      if (!saved) {
        nextSavedItems.push({
          name: itemName,
          type: itemType,
          savedAt: new Date().toISOString(),
        });
      }

      localStorage.setItem("travelAppSavedItems", JSON.stringify(nextSavedItems));
      const nextSaved = !saved;
      setSaved(nextSaved);
      setShowGuestMessage(false);
    } catch (error) {
      console.error("Save/delete place failed:", error);
      setShowGuestMessage(false);
    }
  };

  return (
    <div className="save-button-wrap">
      <button className="save-card" onClick={handleSave} aria-label={saved ? "Delete saved item" : "Save itinerary"}>
        <span className="save-icon" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 4.5h12a1.5 1.5 0 0 1 1.5 1.5v13.5L12 16.5l-7.5 3V6A1.5 1.5 0 0 1 6 4.5z" stroke="#0f172a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="save-label">{saved ? "Delete" : label}</span>
      </button>

      {showGuestMessage && (
        <div className="save-guest-card">
          <button
            type="button"
            className="save-guest-close"
            aria-label="Close message"
            onClick={() => setShowGuestMessage(false)}
          >
            ×
          </button>
          <p>Please log in or register to save itinerary.</p>
        </div>
      )}
    </div>
  );
};

export default SaveButton;
