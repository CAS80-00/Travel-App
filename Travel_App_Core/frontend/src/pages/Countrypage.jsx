import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchUnsplashPhoto } from "../api/unsplash"; // make sure this path is correct
import "../styles/CountryPage.css";
import "../styles/LandingPage.css";
import AuthCard from "../components/AuthCard";
import BackButton from "../components/BackButton";
import HomeButton from "../components/HomeButton";
import DashboardButton from "../components/DashboardButton";
import SaveButton from "../components/SaveButton";

const CountryPage = () => {
  const { country } = useParams();
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

  const customSections = [
    "Description",
    "Regions",
    "Get in",
    "Get around",
    "See",
    "Do",
    "Stay safe",
    "Connect",
    "Go next",
  ];

  // ⭐ UNSPLASH HEADER LOGIC (same rules as CityPage)
  useEffect(() => {
    async function loadImage() {
      console.log("Unsplash key:", process.env.REACT_APP_UNSPLASH_KEY);
      console.log("🔍 Searching Unsplash for country:", country);

      let photo = await fetchUnsplashPhoto(country);

      if (!photo) {
        console.log("❌ No country photo found. Using NAVY fallback.");
        photo = "NAVY_FALLBACK";
      } else {
        console.log("✅ Country photo found:", photo);
      }

      setHeaderImage(photo);
    }

    loadImage();
  }, [country]);

  // ⭐ WIKIVOYAGE FETCH
  useEffect(() => {
    fetch(`http://localhost:4000/api/wikivoyage-country/${country}`)
      .then((res) => res.json())
      .then((data) => setWiki(data));
  }, [country]);

  if (!wiki) return <div className="loading">Loading...</div>;

  const filteredSections = customSections
    .map((title) => wiki.sections.find((sec) => sec.title === title))
    .filter(Boolean);

  return (
    <div className="country-page">
      {/* ⭐ HEADER WITH UNSPLASH OR FALLBACK */}
      <div
        className="country-header landing-header"
        style={{
          backgroundImage:
            headerImage === "NAVY_FALLBACK"
              ? "linear-gradient(to bottom, #001f3f, #001a35)"
              : `url(${headerImage})`,
        }}
      >
        <h1 className="country-header-title city-header-title">Travel App by CAS</h1>
        <h1 className="country-title landing-tagline">{wiki.title}</h1>

        {/* Back + Home buttons below the country name */}
        <div className="header-back">
          <BackButton />
          <HomeButton />
          <DashboardButton />
          <SaveButton itemName={wiki.title} itemType="country" />
        </div>

        {/* Auth card in header (uses landing page wrapper for consistent behavior) */}
        <div className="landing-auth-wrapper">
          <AuthCard />
        </div>
      </div>

      {/* ⭐ MAIN CARD CONTAINER */}
      <div className="card-container">
        <div className="country-sections">
          {filteredSections.map((section, index) => {
            const isOpen = !!openSections[index];

            return (
              <div
                key={index}
                className={`country-section-card fade-in ${
                  isOpen ? "open" : ""
                }`}
              >
                <div
                  className="section-header"
                  onClick={() => toggleSection(index)}
                >
                  <h2 className="section-title">{section.title}</h2>
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

export default CountryPage;
