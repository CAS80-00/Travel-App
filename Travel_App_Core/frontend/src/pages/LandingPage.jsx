import React, { useState, useEffect } from "react";

import "../styles/LandingPage.css";
import AuthCard from "../components/AuthCard";
import SearchBar from "../components/SearchBar";

const backgrounds = [
  "/images/rio.jpg",
  "/images/easter-island.jpg",
  "/images/new-york.jpg",
  "/images/paris.jpg",
  "/images/moscow.jpg",
  "/images/tokyo.jpg",
  "/images/cape-town.jpg",
  "/images/maldives.jpg",
  "/images/athens.jpg",
  "/images/nairobi.jpg",
  "/images/london.jpg",
  "/images/rome.jpg",
  "/images/sydney.jpg",
  "/images/thailand.jpg",
];

const LandingPage = () => {
  const [bgIndex, setBgIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(
      () => setBgIndex((prev) => (prev + 1) % backgrounds.length),
      20000,
    );
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="landing-page"
      style={{ backgroundImage: `url(${backgrounds[bgIndex]})` }}
    >
      {/* HEADER: Centers Title & Tagline Perfectly */}
      <header className="landing-header">
        <h1>Travel App by CAS</h1>
        <p className="landing-tagline">
          <span className="tagline-plane">✈️</span>
          <span className="tagline-text">
            Let’s begin your next global adventure
          </span>
        </p>
      </header>

      {/* SEARCH BAR CONTAINER */}
      <div className="landing-body">
        <SearchBar placeholder="Search a city or country..." />
      </div>

      {/* AUTH CARD: Positioned absolute top-right on desktop, normal block below search on mobile */}
      <div className="landing-auth-wrapper">
        <AuthCard />
      </div>

      {/* FOOTER */}
      <footer className="landing-footer">
        <p>© 2026 Travel App by CAS — Explore the world</p>
      </footer>
    </div>
  );
};

export default LandingPage;
