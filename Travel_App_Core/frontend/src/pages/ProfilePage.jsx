import React, { useState } from "react";
import { Link } from "react-router-dom";
import "../styles/ProfilePage.css";

const userProfile = {
  firstName: "Maria",
  lastName: "Lopez",
  email: "maria.lopez@travelglobal.com",
  savedCities: [
    "Search for a new city",
    "Paris",
    "Tokyo",
    "New York",
    "Rome",
    "Cape Town",
  ],
  savedCountries: [
    "Search for a new country",
    "Italy",
    "Japan",
    "France",
    "Canada",
    "Australia",
  ],
  savedMaps: [
    "Europe Itinerary Map",
    "Asia Adventure Map",
    "Weekend Getaway Map",
    "Historic City Trail",
  ],
  savedItineraries: [
    "Paris 5-Day Escape",
    "Tokyo Food & Culture Tour",
    "Rome Weekend Guide",
    "Iceland Road Trip",
  ],
};

const formatMaskedEmail = (email) => {
  const [localPart, domain] = email.split("@");

  if (!domain) return email;

  const visibleSuffix = localPart.slice(-5);
  const maskedPrefix = "*".repeat(Math.max(localPart.length - 5, 0));

  return `${maskedPrefix}${visibleSuffix}@${domain}`;
};

const ProfilePage = () => {
  const [openSections, setOpenSections] = useState({
    profile: true,
    cities: false,
    countries: false,
    maps: false,
    itineraries: false,
  });

  const toggleSection = (section) => {
    setOpenSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  return (
    <div className="profile-page">
      <header className="profile-header">
        <div className="profile-header-copy">
          <h1>Travel App by CAS</h1>
          <p>Search, Plan and Save you next Global Adventure</p>
        </div>

        <div className="profile-header-user">
          <span>Welcome,</span>
          <strong>{userProfile.firstName}</strong>
        </div>
      </header>

      <main className="profile-content">
        <aside className="profile-sidebar">
          <div className="search-placeholder-box">
            <label className="search-placeholder-label">Search</label>
            <div className="search-placeholder-row">
              <input type="text" placeholder="Search destinations..." />
              <button type="button">Go</button>
            </div>
          </div>

          <div className="map-placeholder">
            <div className="map-placeholder-header">
              <span>Map Preview</span>
            </div>
            <div className="world-map-shell">
              <div className="map-continent continent-1" />
              <div className="map-continent continent-2" />
              <div className="map-continent continent-3" />
              <div className="map-continent continent-4" />
              <div className="map-pin pin-1" />
              <div className="map-pin pin-2" />
              <div className="map-pin pin-3" />
            </div>
          </div>
        </aside>

        <section className="profile-accordion">
          <div className="accordion-item">
            <button
              type="button"
              className="accordion-header"
              onClick={() => toggleSection("profile")}
            >
              <span>Profile</span>
              <span>{openSections.profile ? "−" : "+"}</span>
            </button>

            {openSections.profile && (
              <div className="accordion-content profile-content-block">
                <div className="profile-field">
                  <label>Name</label>
                  <input type="text" value={userProfile.firstName} readOnly />
                </div>

                <div className="profile-field">
                  <label>Last Name</label>
                  <input type="text" value={userProfile.lastName} readOnly />
                </div>

                <div className="profile-field">
                  <label>Email</label>
                  <input
                    type="text"
                    value={formatMaskedEmail(userProfile.email)}
                    readOnly
                  />
                </div>

                <button type="button" className="password-button">
                  Change Password
                </button>
              </div>
            )}
          </div>

          <div className="accordion-item">
            <button
              type="button"
              className="accordion-header"
              onClick={() => toggleSection("cities")}
            >
              <span>Saved Cities</span>
              <span>{openSections.cities ? "−" : "+"}</span>
            </button>

            {openSections.cities && (
              <div className="accordion-content list-content">
                <Link to="/" className="list-link primary-link">
                  Search for a new city
                </Link>
                {userProfile.savedCities
                  .filter((city) => city !== "Search for a new city")
                  .map((city) => (
                    <button type="button" key={city} className="list-item">
                      {city}
                    </button>
                  ))}
              </div>
            )}
          </div>

          <div className="accordion-item">
            <button
              type="button"
              className="accordion-header"
              onClick={() => toggleSection("countries")}
            >
              <span>Saved Countries</span>
              <span>{openSections.countries ? "−" : "+"}</span>
            </button>

            {openSections.countries && (
              <div className="accordion-content list-content">
                <Link to="/" className="list-link primary-link">
                  Search for a new country
                </Link>
                {userProfile.savedCountries
                  .filter((country) => country !== "Search for a new country")
                  .map((country) => (
                    <button type="button" key={country} className="list-item">
                      {country}
                    </button>
                  ))}
              </div>
            )}
          </div>

          <div className="accordion-item">
            <button
              type="button"
              className="accordion-header"
              onClick={() => toggleSection("maps")}
            >
              <span>Saved Maps</span>
              <span>{openSections.maps ? "−" : "+"}</span>
            </button>

            {openSections.maps && (
              <div className="accordion-content list-content">
                {userProfile.savedMaps.map((map) => (
                  <button type="button" key={map} className="list-item">
                    {map}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="accordion-item">
            <button
              type="button"
              className="accordion-header"
              onClick={() => toggleSection("itineraries")}
            >
              <span>Saved Itineraries</span>
              <span>{openSections.itineraries ? "−" : "+"}</span>
            </button>

            {openSections.itineraries && (
              <div className="accordion-content list-content">
                {userProfile.savedItineraries.map((itinerary) => (
                  <button type="button" key={itinerary} className="list-item">
                    {itinerary}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="profile-footer">
        <p>© 2026 Travel App by CAS — Explore the world</p>
      </footer>
    </div>
  );
};

export default ProfilePage;
