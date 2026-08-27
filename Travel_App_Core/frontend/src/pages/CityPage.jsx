import React, { useEffect, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import { fetchUnsplashPhoto } from "../api/unsplash";
import "../styles/CityPage.css";
import "../styles/LandingPage.css";
import AuthCard from "../components/AuthCard";
import BackButton from "../components/BackButton";
import HomeButton from "../components/HomeButton";
import DashboardButton from "../components/DashboardButton";
import SaveButton from "../components/SaveButton";

const CityPage = () => {
  console.log("Unsplash key:", process.env.REACT_APP_UNSPLASH_KEY);
  const { city } = useParams();
  const location = useLocation();

  // Country passed from LandingPage (Geoapify)
  const { country } = location.state || {};

  const [wiki, setWiki] = useState(null);
  const [headerImage, setHeaderImage] = useState(null);

  // Track expanded/collapsed state for each section index
  const [openSections, setOpenSections] = useState({});

  const toggleSection = (index) => {
    setOpenSections((prev) => ({
      ...prev,
      [index]: !prev[index], // Toggle true/false
    }));
  };

  // ⭐ Fetch Wikivoyage content
  const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

  useEffect(() => {
    fetch(`${API_BASE}/api/wikivoyage/${city}`)
      .then((res) => res.json())
      .then((data) => setWiki(data))
      .catch((err) => console.error("Fetch error:", err));
  }, [city]);

  // ⭐ Fetch Unsplash image (city → country → navy fallback)
  useEffect(() => {
    async function loadImage() {
      console.log("🔍 Searching Unsplash for city:", city);
      let photo = await fetchUnsplashPhoto(city);

      if (!photo) {
        console.log("❌ No city photo found. Trying country:", country);
        photo = await fetchUnsplashPhoto(country);
      } else {
        console.log("✅ City photo found:", photo);
      }

      if (!photo) {
        console.log("❌ No country photo found. Using NAVY fallback.");
        photo = "NAVY_FALLBACK";
      } else {
        console.log("✅ Country photo found:", photo);
      }

      setHeaderImage(photo);
    }

    loadImage();
  }, [city, country]);

  if (!wiki) return <div>Loading...</div>;

  return (
    <div className="city-page slide-up">
      {/* ⭐ HEADER */}
      <div
        className="city-header landing-header"
        style={{
          background:
            headerImage === "NAVY_FALLBACK"
              ? "navy"
              : `url(${headerImage}) center/cover no-repeat`,
        }}
      >
        <h1 className="city-header-title">Travel App by CAS</h1>
        <h2 className="city-header-name landing-tagline">
          {wiki.title} {country ? `— ${country}` : ""}
        </h2>

        {/* Back + Home buttons below the city name */}
        <div className="header-back">
          <BackButton />
          <HomeButton />
          <DashboardButton />
          <SaveButton itemName={wiki.title} itemType="city" />
        </div>

        {/* Auth card placed in header - uses landing page auth wrapper for consistent behavior */}
        <div className="landing-auth-wrapper">
          <AuthCard />
        </div>
      </div>

      {/* WIKIVOYAGE CONTENT CARD */}
      <div className="card-container">
        <div className="sections">
          {wiki.sections.map((section, index) => {
            const isOpen = !!openSections[index];

            return (
              <div key={index} className={`section ${isOpen ? "open" : ""}`}>
                <div
                  className="section-header"
                  onClick={() => toggleSection(index)}
                >
                  <h2>{section.title}</h2>
                  <span className="accordion-icon">{isOpen ? "▲" : "▼"}</span>
                </div>

                {isOpen && (
                  <div
                    className="section-content"
                    dangerouslySetInnerHTML={{ __html: section.content }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <footer className="landing-footer">
        <p>© 2026 Travel App by CAS — Explore the world</p>
      </footer>
    </div>
  );
};

export default CityPage;
