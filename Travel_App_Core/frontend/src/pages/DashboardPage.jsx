import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/ProfilePage.css";
import "../styles/DashboardPage.css";
import SearchBar from "../components/SearchBar";

const API_BASE = process.env.REACT_APP_BACKEND_URL || "";
const response = await fetch(`${API_BASE_URL}/api/travel-data`);

const authHeaders = () => {
  const token = localStorage.getItem("travelAppToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const DashboardPage = () => {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [savedPlaces, setSavedPlaces] = useState({
    city: [],
    country: [],
    map: [],
    itinerary: [],
  });
  const [openSections, setOpenSections] = useState({
    profile: true,
    cities: false,
    countries: false,
    maps: false,
    itineraries: false,
  });

  // Google Maps State
  const [mapLoaded, setMapLoaded] = useState(false);
  const [activePins, setActivePins] = useState([]);
  const [selectedPin, setSelectedPin] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [travelMode, setTravelMode] = useState("DRIVING");
  const [itineraries, setItineraries] = useState([]);
  const [targetItineraryName, setTargetItineraryName] = useState("");

  // Inactivity State & Timers
  const [showInactivityPrompt, setShowInactivityPrompt] = useState(false);
  const inactivityTimerRef = useRef(null);
  const graceTimerRef = useRef(null);

  // Routing State
  const [fromLocation, setFromLocation] = useState(null);
  const [toLocation, setToLocation] = useState(null);
  const [isSavedCurrentItinerary, setIsSavedCurrentItinerary] = useState(false);
  const [currentItineraryName, setCurrentItineraryName] = useState("");

  // Wikivoyage Travel Guide State
  const [wikiData, setWikiData] = useState(null);
  const [loadingWiki, setLoadingWiki] = useState(false);

  // Change Password / Delete Profile UI State
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const mapContainerRef = useRef(null);
  const fromInputRef = useRef(null);
  const toInputRef = useRef(null);
  const fromAutocompleteRef = useRef(null);
  const toAutocompleteRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const directionsRendererRef = useRef(null);

  const userProfile = {
    firstName:
      user?.firstName ||
      localStorage.getItem("travelAppUserName") ||
      "Traveler",
    lastName: user?.lastName || "User",
    email: user?.email || "your.email@example.com",
    savedCities: ["Search for a new city", ...savedPlaces.city],
    savedCountries: ["Search for a new country", ...savedPlaces.country],
    savedMaps: savedPlaces.map,
    savedItineraries: savedPlaces.itinerary,
  };

  const formatMaskedEmail = (email) => {
    const [localPart, domain] = email.split("@");

    if (!domain) return email;

    const visibleSuffix = localPart.slice(-5);
    const maskedPrefix = "*".repeat(Math.max(localPart.length - 5, 0));

    return `${maskedPrefix}${visibleSuffix}@${domain}`;
  };

  const toggleSection = (section) => {
    setOpenSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // 1. Google Maps JS SDK Script Loading
  useEffect(() => {
    const loadGoogleMaps = () => {
      if (window.google && window.google.maps) {
        setMapLoaded(true);
        return;
      }

      let script = document.getElementById("google-maps-script");
      if (!script) {
        script = document.createElement("script");
        script.id = "google-maps-script";
        const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "";
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
        script.async = true;
        script.defer = true;
        script.onload = () => setMapLoaded(true);
        script.onerror = (e) => console.error("Google Maps failed to load", e);
        document.head.appendChild(script);
      } else {
        script.addEventListener("load", () => setMapLoaded(true));
      }
    };

    loadGoogleMaps();
  }, []);

  // Inactivity Timeout Configuration
  const TWENTY_EIGHT_MINUTES = 28 * 60 * 1000;
  const TWO_MINUTES = 2 * 60 * 1000;

  const handleLogout = useCallback(
    async (skipConfirm = false) => {
      if (!skipConfirm) {
        const shouldLogout = window.confirm(
          "Are you sure you want to log out?",
        );
        if (!shouldLogout) return;
      }

      const token = localStorage.getItem("travelAppToken");

      if (token) {
        try {
          await fetch(`${API_BASE}/api/logout`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          });
        } catch (error) {
          console.error("Logout request failed:", error);
        }
      }

      localStorage.removeItem("travelAppLoggedIn");
      localStorage.removeItem("travelAppToken");
      localStorage.removeItem("travelAppUser");

      setIsLoggedIn(false);
      setUser(null);
      setShowInactivityPrompt(false);
      navigate("/");
    },
    [navigate],
  );

  const clearInactivityTimers = useCallback(() => {
    if (inactivityTimerRef.current) {
      window.clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    if (graceTimerRef.current) {
      window.clearTimeout(graceTimerRef.current);
      graceTimerRef.current = null;
    }
  }, []);

  const startInactivityTimer = useCallback(() => {
    clearInactivityTimers();
    if (!isLoggedIn) return;

    inactivityTimerRef.current = window.setTimeout(() => {
      setShowInactivityPrompt(true);
      graceTimerRef.current = window.setTimeout(() => {
        handleLogout(true);
      }, TWO_MINUTES);
    }, TWENTY_EIGHT_MINUTES);
  }, [clearInactivityTimers, handleLogout, isLoggedIn]);

  const handleInactivityChoice = useCallback(
    (keepLoggedIn) => {
      clearInactivityTimers();

      if (keepLoggedIn) {
        setShowInactivityPrompt(false);
        startInactivityTimer();
        return;
      }

      handleLogout(true);
    },
    [clearInactivityTimers, handleLogout, startInactivityTimer],
  );

  useEffect(() => {
    if (!isLoggedIn) {
      clearInactivityTimers();
      setShowInactivityPrompt(false);
      return;
    }

    startInactivityTimer();

    const events = ["mousemove", "keydown", "click", "touchstart", "scroll"];
    const reset = () => {
      if (!showInactivityPrompt) {
        startInactivityTimer();
      }
    };

    events.forEach((eventName) => window.addEventListener(eventName, reset));

    return () => {
      events.forEach((eventName) =>
        window.removeEventListener(eventName, reset),
      );
      clearInactivityTimers();
    };
  }, [
    clearInactivityTimers,
    isLoggedIn,
    startInactivityTimer,
    showInactivityPrompt,
  ]);

  // 2. Validate Session and Fetch Data from Backend
  useEffect(() => {
    const validateSession = async () => {
      const token = localStorage.getItem("travelAppToken");
      const loggedIn =
        localStorage.getItem("travelAppLoggedIn") === "true" && Boolean(token);

      if (!loggedIn) {
        setIsLoggedIn(false);
        setUser(null);
        setSavedPlaces({ city: [], country: [], map: [], itinerary: [] });
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/api/me`, {
          headers: { ...authHeaders() },
        });

        if (!response.ok) {
          localStorage.removeItem("travelAppLoggedIn");
          localStorage.removeItem("travelAppToken");
          localStorage.removeItem("travelAppUser");
          setIsLoggedIn(false);
          setUser(null);
          setSavedPlaces({ city: [], country: [], map: [], itinerary: [] });
          return;
        }

        const data = await response.json();
        setUser(data.user);
        setIsLoggedIn(true);

        // Fetch Saved Places
        const savedResponse = await fetch(`${API_BASE}/api/saved-places`, {
          headers: { ...authHeaders() },
        });

        const savedData = await savedResponse.json();
        if (savedResponse.ok && savedData.success) {
          const grouped = { city: [], country: [], map: [], itinerary: [] };

          (savedData.savedPlaces || []).forEach((entry) => {
            if (grouped[entry.type]) {
              grouped[entry.type].push(entry.name);
            }
          });

          setSavedPlaces(grouped);
        }

        // Fetch Itineraries
        const itineraryResponse = await fetch(`${API_BASE}/api/itineraries`, {
          headers: { ...authHeaders() },
        });
        const itineraryData = await itineraryResponse.json();
        if (itineraryResponse.ok && itineraryData.success) {
          setItineraries(itineraryData.itineraries);
        }
      } catch (error) {
        console.error("Dashboard validation error:", error);
        setIsLoggedIn(false);
      }
    };

    validateSession();
  }, []);

  // 3. Initialize Google Map and Places Autocomplete
  useEffect(() => {
    if (!mapLoaded || !isLoggedIn || !mapContainerRef.current) return;
    if (mapRef.current) return; // Prevent double initialization

    let center = { lat: 40.7128, lng: -74.006 }; // Default center: NYC

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userPos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setCurrentLocation(userPos);
          if (mapRef.current) {
            mapRef.current.setCenter(userPos);
          }
        },
        (error) => console.log("Geolocation error:", error),
      );
    }

    const map = new window.google.maps.Map(mapContainerRef.current, {
      center: center,
      zoom: 12,
      mapTypeControl: false,
      fullscreenControl: false,
    });
    mapRef.current = map;

    directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
      map: map,
    });

    // Add map click listener to "ping" any location
    map.addListener("click", (event) => {
      const lat = event.latLng.lat();
      const lng = event.latLng.lng();
      handleMapClickPing(lat, lng);
    });

    return () => {
      clearMarkers();
      if (directionsRendererRef.current) {
        directionsRendererRef.current.setMap(null);
      }
    };
  }, [mapLoaded, isLoggedIn]);

  // 3b. Bind Google Places Autocomplete to From & To inputs, plus accordion search inputs once rendered in DOM
  useEffect(() => {
    if (!mapLoaded || !isLoggedIn || !window.google) return;

    if (fromInputRef.current && !fromAutocompleteRef.current) {
      fromAutocompleteRef.current = new window.google.maps.places.Autocomplete(
        fromInputRef.current,
        {
          fields: ["geometry", "name", "formatted_address"],
        },
      );

      fromAutocompleteRef.current.addListener("place_changed", () => {
        const place = fromAutocompleteRef.current.getPlace();
        if (place && place.geometry && place.geometry.location) {
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          const name = place.name || place.formatted_address;
          setFromLocation({ name, lat, lng });

          if (mapRef.current) {
            mapRef.current.setCenter({ lat, lng });
            mapRef.current.setZoom(12);
          }
        }
      });
    }

    if (toInputRef.current && !toAutocompleteRef.current) {
      toAutocompleteRef.current = new window.google.maps.places.Autocomplete(
        toInputRef.current,
        {
          fields: ["geometry", "name", "formatted_address"],
        },
      );

      toAutocompleteRef.current.addListener("place_changed", () => {
        const place = toAutocompleteRef.current.getPlace();
        if (place && place.geometry && place.geometry.location) {
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          const name = place.name || place.formatted_address;
          setToLocation({ name, lat, lng });

          if (mapRef.current) {
            mapRef.current.setCenter({ lat, lng });
            mapRef.current.setZoom(12);
          }
        }
      });
    }
  }, [mapLoaded, isLoggedIn]);

  // 3c. Fetch Wikivoyage Travel Guide for Destination
  useEffect(() => {
    if (!toLocation) {
      setWikiData(null);
      return;
    }

    const fetchWiki = async () => {
      setLoadingWiki(true);
      setWikiData(null);
      try {
        const cityName = toLocation.name.split(",")[0].trim();
        let response = await fetch(
          `${API_BASE}/api/wikivoyage/${encodeURIComponent(cityName)}`,
        );
        let data = await response.json();

        if (response.ok && data.sections && data.sections.length > 0) {
          setWikiData(data);
        } else {
          response = await fetch(
            `${API_BASE}/api/wikivoyage-country/${encodeURIComponent(cityName)}`,
          );
          data = await response.json();
          if (response.ok && data.sections && data.sections.length > 0) {
            setWikiData(data);
          }
        }
      } catch (error) {
        console.error("Error fetching wikivoyage on dashboard:", error);
      } finally {
        setLoadingWiki(false);
      }
    };

    fetchWiki();
  }, [toLocation]);

  // 4. Update Markers on activePins change
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    clearMarkers();

    activePins.forEach((pin, index) => {
      const marker = new window.google.maps.Marker({
        position: { lat: pin.lat, lng: pin.lng },
        map: mapRef.current,
        title: pin.name,
        label: `${index + 1}`,
      });

      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="padding: 8px; color: #000; font-family: sans-serif;">
            <strong style="display:block; margin-bottom:6px; font-size:14px; max-width:200px;">${pin.name}</strong>
            <div style="display:flex; gap:4px;">
              <button id="infowindow-directions-${index}" style="background:#2563eb; color:white; border:none; padding:6px 10px; border-radius:6px; font-size:12px; font-weight:bold; cursor:pointer;">Get Directions</button>
              <button id="infowindow-remove-${index}" style="background:#ef4444; color:white; border:none; padding:6px 10px; border-radius:6px; font-size:12px; font-weight:bold; cursor:pointer;">Remove</button>
            </div>
          </div>
        `,
      });

      marker.addListener("click", () => {
        infoWindow.open(mapRef.current, marker);
        setSelectedPin(pin);

        setTimeout(() => {
          const dirBtn = document.getElementById(
            `infowindow-directions-${index}`,
          );
          const rmBtn = document.getElementById(`infowindow-remove-${index}`);

          if (dirBtn) {
            dirBtn.onclick = () => {
              infoWindow.close();
              handleGetDirections(pin);
            };
          }
          if (rmBtn) {
            rmBtn.onclick = () => {
              infoWindow.close();
              handleRemovePin(pin);
            };
          }
        }, 100);
      });

      markersRef.current.push(marker);
    });
  }, [activePins, mapLoaded]);

  const clearMarkers = () => {
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];
  };

  const handleMapClickPing = (lat, lng) => {
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      let name = `Pinned Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
      if (status === "OK" && results[0]) {
        name = results[0].formatted_address;
      }
      addPinToList({ name, lat, lng });
    });
  };

  const addPinToList = (newPin) => {
    setActivePins((prev) => {
      const exists = prev.some(
        (pin) =>
          Math.abs(pin.lat - newPin.lat) < 0.0001 &&
          Math.abs(pin.lng - newPin.lng) < 0.0001,
      );
      if (exists) return prev;
      return [...prev, newPin];
    });
    setSelectedPin(newPin);
  };

  const handleRemovePin = (pinToRemove) => {
    setActivePins((prev) => prev.filter((pin) => pin !== pinToRemove));
    if (selectedPin === pinToRemove) {
      setSelectedPin(null);
    }
  };

  const handleDetectFromLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const userPos = { lat, lng };

          setCurrentLocation(userPos);

          const geocoder = new window.google.maps.Geocoder();
          geocoder.geocode({ location: userPos }, (results, status) => {
            let name = "Current Location";
            if (status === "OK" && results[0]) {
              name = results[0].formatted_address;
            }
            setFromLocation({ name, lat, lng });
            if (fromInputRef.current) {
              fromInputRef.current.value = name;
            }
          });

          if (mapRef.current) {
            mapRef.current.setCenter(userPos);
            mapRef.current.setZoom(12);
          }
        },
        (error) => {
          alert(
            "Error detecting location. Please allow browser location access.",
          );
        },
      );
    } else {
      alert("Geolocation is not supported by your browser.");
    }
  };

  // 5. Get Directions from Current Geolocation
  const handleGetDirections = (destinationPin) => {
    if (!mapRef.current || !directionsRendererRef.current) return;

    if (!currentLocation) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const userPos = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            };
            setCurrentLocation(userPos);
            calculateRoute(userPos, destinationPin);
          },
          () => {
            alert(
              "Please allow location access to calculate directions from your current location.",
            );
          },
        );
      } else {
        alert("Geolocation is not supported by your browser.");
      }
    } else {
      calculateRoute(currentLocation, destinationPin);
    }
  };

  const calculateRoute = (origin, destination) => {
    const directionsService = new window.google.maps.DirectionsService();
    const mode = window.google.maps.TravelMode[travelMode];

    directionsService.route(
      {
        origin: origin,
        destination: { lat: destination.lat, lng: destination.lng },
        travelMode: mode,
      },
      (result, status) => {
        if (status === "OK" && directionsRendererRef.current) {
          directionsRendererRef.current.setDirections(result);
        } else {
          alert(`Directions request failed: ${status}`);
        }
      },
    );
  };

  // 6. Multi-point Routing
  const handleShowMultiPointRoute = () => {
    if (activePins.length < 2) {
      alert("Please pin at least 2 locations to show a multi-point route.");
      return;
    }

    const directionsService = new window.google.maps.DirectionsService();
    const mode = window.google.maps.TravelMode[travelMode];

    let origin = currentLocation;
    let waypoints = [];
    let destination = null;

    if (origin) {
      waypoints = activePins.slice(0, -1).map((pin) => ({
        location: { lat: pin.lat, lng: pin.lng },
        stopover: true,
      }));
      destination = {
        lat: activePins[activePins.length - 1].lat,
        lng: activePins[activePins.length - 1].lng,
      };
    } else {
      origin = { lat: activePins[0].lat, lng: activePins[0].lng };
      waypoints = activePins.slice(1, -1).map((pin) => ({
        location: { lat: pin.lat, lng: pin.lng },
        stopover: true,
      }));
      destination = {
        lat: activePins[activePins.length - 1].lat,
        lng: activePins[activePins.length - 1].lng,
      };
    }

    directionsService.route(
      {
        origin: origin,
        destination: destination,
        waypoints: waypoints,
        optimizeWaypoints: true,
        travelMode: mode,
      },
      (result, status) => {
        if (status === "OK" && directionsRendererRef.current) {
          directionsRendererRef.current.setDirections(result);
        } else {
          alert(
            `Multi-point routing failed: ${status}. Transit mode may not support multiple waypoints. Try Driving or Walking.`,
          );
        }
      },
    );
  };

  // 7. Save Pin One-by-One to Selected/New Itinerary
  const handleSavePinToItinerary = async (pin) => {
    if (!targetItineraryName.trim()) {
      alert("Please select or enter an itinerary name first.");
      return;
    }
    if (!pin) {
      alert("No active pin selected to save.");
      return;
    }

    const token = localStorage.getItem("travelAppToken");
    const existing = itineraries.find(
      (it) =>
        it.name.toLowerCase() === targetItineraryName.trim().toLowerCase(),
    );
    let updatedPoints = [];

    if (existing) {
      updatedPoints = JSON.parse(existing.points);
    }

    const pinExists = updatedPoints.some(
      (p) =>
        Math.abs(p.lat - pin.lat) < 0.0001 &&
        Math.abs(p.lng - pin.lng) < 0.0001,
    );
    if (pinExists) {
      alert(
        `"${pin.name}" is already saved in itinerary "${targetItineraryName.trim()}"!`,
      );
      return;
    }

    updatedPoints.push(pin);

    try {
      const response = await fetch(`${API_BASE}/api/itineraries`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          name: targetItineraryName.trim(),
          points: updatedPoints,
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setItineraries(data.itineraries);
        alert(
          `Successfully saved "${pin.name}" to itinerary "${targetItineraryName.trim()}"!`,
        );
      } else {
        alert(data.message || "Failed to save itinerary.");
      }
    } catch (err) {
      console.error("Save itinerary error:", err);
      alert("Error saving itinerary.");
    }
  };

  // Save All Active Pins to Itinerary
  const handleSaveAllToItinerary = async () => {
    if (!targetItineraryName.trim()) {
      alert("Please select or enter an itinerary name.");
      return;
    }
    if (activePins.length === 0) {
      alert("Please pin at least one location to save an itinerary.");
      return;
    }

    const token = localStorage.getItem("travelAppToken");

    try {
      const response = await fetch(`${API_BASE}/api/itineraries`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          name: targetItineraryName.trim(),
          points: activePins,
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setItineraries(data.itineraries);
        alert(
          `Successfully saved itinerary "${targetItineraryName.trim()}" with ${activePins.length} locations!`,
        );
      } else {
        alert(data.message || "Failed to save itinerary.");
      }
    } catch (err) {
      console.error("Save itinerary error:", err);
      alert("Error saving itinerary.");
    }
  };

  // 8. Select Saved Itinerary and Show on Map Preview with Route
  const handleSelectItinerary = (itinerary) => {
    try {
      const data = JSON.parse(itinerary.points);

      if (data && data.from && data.to) {
        setFromLocation(data.from);
        setToLocation(data.to);
        setTravelMode(data.travelMode || "DRIVING");
        setActivePins(data.activePins || []);
        setIsSavedCurrentItinerary(true);
        setCurrentItineraryName(itinerary.name);

        if (fromInputRef.current) fromInputRef.current.value = data.from.name;
        if (toInputRef.current) toInputRef.current.value = data.to.name;

        // Auto-calculate the route on selection
        setTimeout(() => {
          if (mapRef.current && directionsRendererRef.current) {
            const directionsService =
              new window.google.maps.DirectionsService();
            const mode =
              window.google.maps.TravelMode[data.travelMode || "DRIVING"];

            const panel = document.getElementById("directions-panel");
            if (panel) {
              directionsRendererRef.current.setPanel(panel);
            }

            const waypoints = (data.activePins || []).map((pin) => ({
              location: { lat: pin.lat, lng: pin.lng },
              stopover: true,
            }));

            directionsService.route(
              {
                origin: { lat: data.from.lat, lng: data.from.lng },
                destination: { lat: data.to.lat, lng: data.to.lng },
                waypoints: waypoints,
                optimizeWaypoints: true,
                travelMode: mode,
              },
              (result, status) => {
                if (status === "OK") {
                  directionsRendererRef.current.setDirections(result);
                }
              },
            );
          }
        }, 300);
      } else {
        // Fallback for older itineraries which were just flat pin lists
        const points = JSON.parse(itinerary.points);
        if (points && points.length > 0) {
          setFromLocation(points[0]);
          setToLocation(points[points.length - 1]);
          setActivePins(points.slice(1, -1));
          setIsSavedCurrentItinerary(true);
          setCurrentItineraryName(itinerary.name);

          if (fromInputRef.current) fromInputRef.current.value = points[0].name;
          if (toInputRef.current)
            toInputRef.current.value = points[points.length - 1].name;
        }
      }
    } catch (e) {
      console.error("Load itinerary error:", e);
    }
  };

  const handleCreateRoute = () => {
    if (!fromLocation || !toLocation) {
      alert("Please select both 'From' and 'To' locations first.");
      return;
    }

    if (!mapRef.current || !directionsRendererRef.current) return;

    const directionsService = new window.google.maps.DirectionsService();
    const mode = window.google.maps.TravelMode[travelMode];

    const panel = document.getElementById("directions-panel");
    if (panel) {
      directionsRendererRef.current.setPanel(panel);
    }

    // Google Maps transit mode does NOT support intermediate waypoints/stops.
    // If Transit is selected, we filter out waypoints to avoid INVALID_REQUEST.
    const waypoints =
      travelMode === "TRANSIT"
        ? []
        : activePins.map((pin) => ({
            location: { lat: pin.lat, lng: pin.lng },
            stopover: true,
          }));

    if (travelMode === "TRANSIT" && activePins.length > 0) {
      alert(
        "Note: Google Maps does not support intermediate custom stops (waypoints) for Public Transportation. We are calculating a direct route between your starting point and destination instead.",
      );
    }

    directionsService.route(
      {
        origin: { lat: fromLocation.lat, lng: fromLocation.lng },
        destination: { lat: toLocation.lat, lng: toLocation.lng },
        waypoints: waypoints,
        optimizeWaypoints: travelMode !== "TRANSIT",
        travelMode: mode,
      },
      (result, status) => {
        if (status === "OK") {
          directionsRendererRef.current.setDirections(result);
          checkIsCurrentItinerarySaved();
        } else {
          if (travelMode === "TRANSIT") {
            if (status === "ZERO_RESULTS") {
              alert(
                "No public transit route was found between these locations (e.g. they are across different countries or no transit data exists). Try Driving or Walking!",
              );
            } else {
              alert(
                `Could not calculate public transit route: ${status}. Try Driving or Walking!`,
              );
            }
          } else {
            alert(
              `Could not calculate route: ${status}. Try Driving or Walking.`,
            );
          }
        }
      },
    );
  };

  const handleClearMap = () => {
    setFromLocation(null);
    setToLocation(null);
    setActivePins([]);
    setSelectedPin(null);
    setIsSavedCurrentItinerary(false);
    setCurrentItineraryName("");

    if (fromInputRef.current) fromInputRef.current.value = "";
    if (toInputRef.current) toInputRef.current.value = "";

    if (directionsRendererRef.current) {
      directionsRendererRef.current.setDirections({ routes: [] });
      // Clear panel
      const panel = document.getElementById("directions-panel");
      if (panel) panel.innerHTML = "";
    }
  };

  const handleSaveItinerary = async () => {
    if (!fromLocation || !toLocation) {
      alert("Please create a route first before saving.");
      return;
    }

    const defaultName = `${fromLocation.name.split(",")[0]} to ${toLocation.name.split(",")[0]}`;
    const name = window.prompt("Enter a name for this itinerary:", defaultName);
    if (!name || !name.trim()) return;

    const token = localStorage.getItem("travelAppToken");

    const itineraryData = {
      from: fromLocation,
      to: toLocation,
      travelMode: travelMode,
      activePins: activePins,
    };

    try {
      const response = await fetch(`${API_BASE}/api/itineraries`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          name: name.trim(),
          points: JSON.stringify(itineraryData),
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setItineraries(data.itineraries);
        setIsSavedCurrentItinerary(true);
        setCurrentItineraryName(name.trim());
        alert(`Itinerary "${name.trim()}" saved successfully!`);
      } else {
        alert(data.message || "Failed to save itinerary.");
      }
    } catch (err) {
      console.error("Save itinerary error:", err);
      alert("Error saving itinerary.");
    }
  };

  const handleDeleteCurrentItinerary = async () => {
    if (!currentItineraryName) return;

    const confirmDelete = window.confirm(
      `Are you sure you want to delete the itinerary "${currentItineraryName}"?`,
    );
    if (!confirmDelete) return;

    const token = localStorage.getItem("travelAppToken");

    try {
      const response = await fetch(`${API_BASE}/api/itineraries`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ name: currentItineraryName }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setItineraries(data.itineraries);
        setIsSavedCurrentItinerary(false);
        setCurrentItineraryName("");
        alert("Itinerary deleted successfully.");
      } else {
        alert(data.message || "Failed to delete itinerary.");
      }
    } catch (err) {
      console.error("Delete itinerary error:", err);
      alert("Error deleting itinerary.");
    }
  };

  const checkIsCurrentItinerarySaved = () => {
    if (!fromLocation || !toLocation) return;
    const match = itineraries.find((it) => {
      try {
        const data = JSON.parse(it.points);
        return (
          data.from &&
          data.to &&
          Math.abs(data.from.lat - fromLocation.lat) < 0.0001 &&
          Math.abs(data.to.lat - toLocation.lat) < 0.0001
        );
      } catch (e) {
        return false;
      }
    });

    if (match) {
      setIsSavedCurrentItinerary(true);
      setCurrentItineraryName(match.name);
    } else {
      setIsSavedCurrentItinerary(false);
      setCurrentItineraryName("");
    }
  };

  // 9. Delete Saved Itinerary
  const handleDeleteItinerary = async (name) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete the itinerary "${name}"?`,
    );
    if (!confirmDelete) return;

    const token = localStorage.getItem("travelAppToken");

    try {
      const response = await fetch(`${API_BASE}/api/itineraries`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ name }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setItineraries(data.itineraries);
        if (targetItineraryName === name) {
          setTargetItineraryName("");
          setActivePins([]);
          if (directionsRendererRef.current) {
            directionsRendererRef.current.setDirections({ routes: [] });
          }
        }
        alert("Itinerary deleted successfully.");
      } else {
        alert(data.message || "Failed to delete itinerary.");
      }
    } catch (err) {
      console.error("Delete itinerary error:", err);
      alert("Error deleting itinerary.");
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="dashboard-guard">
        <div className="dashboard-guest-message-card">
          <h2>Dashboard Access Required</h2>
          <p>Please log in or register to access your Dashboard.</p>
          <button type="button" onClick={() => navigate("/")}>
            Go to Login / Register
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <header className="profile-header">
        <div className="profile-header-copy">
          <h1>Travel App by CAS</h1>
          <p>Search, Plan and Save your next Global Adventure</p>
        </div>

        <div className="header-user-container">
          <div
            style={{
              background: "rgba(255, 255, 255, 0.9)",
              border: "1px solid rgba(148, 163, 184, 0.2)",
              borderRadius: "12px",
              padding: "10px 16px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
            }}
          >
            <span
              style={{
                fontSize: "0.95rem",
                color: "#1e293b",
                fontFamily: "inherit",
              }}
            >
              Welcome,{" "}
              <strong style={{ color: "#2563eb" }}>
                {userProfile.firstName}
              </strong>
            </span>
            <button
              type="button"
              onClick={() => handleLogout(false)}
              style={{
                background: "linear-gradient(135deg, #ef4444, #dc2626)",
                color: "white",
                border: "none",
                borderRadius: "8px",
                padding: "8px 14px",
                fontSize: "0.85rem",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              Log Out
            </button>
          </div>
        </div>
      </header>

      <main className="profile-content">
        <aside className="profile-sidebar">
          {/* 1. Get Directions Card */}
          <div
            className="search-placeholder-box"
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            <label className="search-placeholder-label">Get Directions</label>

            {/* From Input */}
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                ref={fromInputRef}
                type="text"
                placeholder={
                  mapLoaded
                    ? "From (Manual or click GPS 📍)"
                    : "Loading Google Maps..."
                }
                disabled={!mapLoaded}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "10px",
                  border: "1px solid #cbd5e1",
                  boxSizing: "border-box",
                  minWidth: 0,
                  fontSize: "0.95rem",
                }}
              />
              <button
                type="button"
                onClick={handleDetectFromLocation}
                style={{
                  background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                  color: "white",
                  border: "none",
                  borderRadius: "10px",
                  padding: "0 14px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  fontSize: "1.1rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                title="Capture Actual Location"
              >
                📍
              </button>
            </div>

            {/* To Input */}
            <input
              ref={toInputRef}
              type="text"
              placeholder={
                mapLoaded
                  ? "To (Manual destination address)"
                  : "Loading Google Maps..."
              }
              disabled={!mapLoaded}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "10px",
                border: "1px solid #cbd5e1",
                boxSizing: "border-box",
                fontSize: "0.95rem",
              }}
            />

            {/* Buttons Side-By-Side: Travel Mode Dropdown & Create Route Button */}
            <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
              <div style={{ flex: 1, position: "relative" }}>
                <select
                  value={travelMode}
                  onChange={(e) => setTravelMode(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "10px",
                    border: "1px solid #cbd5e1",
                    background: "white",
                    cursor: "pointer",
                    fontWeight: "bold",
                    fontSize: "0.88rem",
                    color: "#1e293b",
                    boxSizing: "border-box",
                  }}
                >
                  <option value="DRIVING">🚗 Driving</option>
                  <option value="WALKING">🚶 Walking</option>
                  <option value="TRANSIT">🚇 Public Transit</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handleCreateRoute}
                style={{
                  flex: 1,
                  background: "linear-gradient(135deg, #10b981, #059669)",
                  color: "white",
                  border: "none",
                  borderRadius: "10px",
                  padding: "12px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  fontSize: "0.88rem",
                }}
              >
                Create Route
              </button>
            </div>
          </div>

          {/* 2. Interactive Google Map (Immediately after Search/Directions container) */}
          <div className="map-placeholder">
            <div className="map-placeholder-header">
              <span>Map Preview</span>
            </div>
            <div
              ref={mapContainerRef}
              style={{
                height: "350px",
                borderRadius: "16px",
                border: "1px solid rgba(148, 163, 184, 0.2)",
                boxShadow: "inset 0 2px 4px rgba(0,0,0,0.06)",
                background: "#e2e8f0",
              }}
            />
          </div>

          {/* 3. Turn-by-Turn Text Directions Panel */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span
              style={{
                fontSize: "0.8rem",
                fontWeight: "bold",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "#475569",
              }}
            >
              Route Directions
            </span>
            <div
              id="directions-panel"
              style={{
                background: "white",
                padding: "16px",
                borderRadius: "16px",
                border: "1px solid rgba(148, 163, 184, 0.25)",
                maxHeight: "260px",
                overflowY: "auto",
                boxShadow: "0 4px 12px rgba(15, 23, 42, 0.05)",
                fontSize: "0.9rem",
                color: "#1e293b",
              }}
            />
          </div>

          {/* 3b. Wikivoyage Destination Travel Guide */}
          {toLocation && !isSavedCurrentItinerary && (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "6px" }}
            >
              <span
                style={{
                  fontSize: "0.8rem",
                  fontWeight: "bold",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "#475569",
                }}
              >
                Travel Guide: {toLocation.name.split(",")[0]}
              </span>
              <div
                style={{
                  background: "white",
                  padding: "16px",
                  borderRadius: "16px",
                  border: "1px solid rgba(148, 163, 184, 0.25)",
                  maxHeight: "260px",
                  overflowY: "auto",
                  boxShadow: "0 4px 12px rgba(15, 23, 42, 0.05)",
                  fontSize: "0.9rem",
                  color: "#1e293b",
                }}
              >
                {loadingWiki && (
                  <p style={{ color: "#64748b", margin: 0 }}>
                    Loading Wikivoyage travel guide...
                  </p>
                )}
                {!loadingWiki && !wikiData && (
                  <p
                    style={{ color: "#64748b", margin: 0, fontStyle: "italic" }}
                  >
                    No travel guide found for this destination on Wikivoyage.
                  </p>
                )}
                {wikiData && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                    }}
                  >
                    <h4 style={{ margin: "0 0 4px 0", color: "#2563eb" }}>
                      {wikiData.title}
                    </h4>
                    {wikiData.sections.map((sec, i) => (
                      <div
                        key={i}
                        style={{
                          borderTop: i > 0 ? "1px solid #f1f5f9" : "none",
                          paddingTop: i > 0 ? "10px" : "0",
                        }}
                      >
                        <h5 style={{ margin: "0 0 6px 0", color: "#0f172a" }}>
                          {sec.title}
                        </h5>
                        <div
                          dangerouslySetInnerHTML={{ __html: sec.content }}
                          style={{
                            fontSize: "0.85rem",
                            lineHeight: "1.4",
                            color: "#475569",
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4. Action Buttons Container (Save Itinerary / Delete Itinerary & Clear Map) */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              marginTop: "4px",
            }}
          >
            {isSavedCurrentItinerary ? (
              <button
                type="button"
                onClick={handleDeleteCurrentItinerary}
                style={{
                  width: "100%",
                  background: "linear-gradient(135deg, #ef4444, #dc2626)",
                  color: "white",
                  border: "none",
                  borderRadius: "10px",
                  padding: "12px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  fontSize: "0.95rem",
                }}
              >
                Delete Itinerary
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSaveItinerary}
                disabled={!fromLocation || !toLocation}
                style={{
                  width: "100%",
                  background:
                    fromLocation && toLocation
                      ? "linear-gradient(135deg, #3b82f6, #2563eb)"
                      : "#cbd5e1",
                  color: "white",
                  border: "none",
                  borderRadius: "10px",
                  padding: "12px",
                  fontWeight: "bold",
                  cursor: fromLocation && toLocation ? "pointer" : "default",
                  fontSize: "0.95rem",
                }}
              >
                Save Itinerary
              </button>
            )}

            <button
              type="button"
              onClick={handleClearMap}
              style={{
                width: "100%",
                background: "#f1f5f9",
                color: "#475569",
                border: "1px solid #cbd5e1",
                borderRadius: "10px",
                padding: "12px",
                fontWeight: "bold",
                cursor: "pointer",
                fontSize: "0.95rem",
              }}
            >
              Clear Map & Directions
            </button>
          </div>
        </aside>

        <section className="profile-accordion">
          {/* Profile Section */}
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
                <div className="profile-field" style={{ position: "relative" }}>
                  <label>Name</label>
                  <div style={{ position: "relative" }}>
                    <span
                      style={{
                        position: "absolute",
                        left: "12px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        fontSize: "1.1rem",
                        color: "#64748b",
                      }}
                    >
                      🔒
                    </span>
                    <input
                      type="text"
                      value={userProfile.firstName}
                      readOnly
                      style={{ paddingLeft: "36px" }}
                    />
                  </div>
                </div>

                <div className="profile-field" style={{ position: "relative" }}>
                  <label>Last Name</label>
                  <div style={{ position: "relative" }}>
                    <span
                      style={{
                        position: "absolute",
                        left: "12px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        fontSize: "1.1rem",
                        color: "#64748b",
                      }}
                    >
                      🔒
                    </span>
                    <input
                      type="text"
                      value={userProfile.lastName}
                      readOnly
                      style={{ paddingLeft: "36px" }}
                    />
                  </div>
                </div>

                <div className="profile-field" style={{ position: "relative" }}>
                  <label>Email</label>
                  <div style={{ position: "relative" }}>
                    <span
                      style={{
                        position: "absolute",
                        left: "12px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        fontSize: "1.1rem",
                        color: "#64748b",
                      }}
                    >
                      🔒
                    </span>
                    <input
                      type="text"
                      value={formatMaskedEmail(userProfile.email)}
                      readOnly
                      style={{ paddingLeft: "36px" }}
                    />
                  </div>
                </div>

                <div
                  style={{ display: "flex", gap: "8px", alignItems: "center" }}
                >
                  <button
                    type="button"
                    className="password-button"
                    onClick={() => {
                      setPasswordError("");
                      setNewPassword("");
                      setConfirmPassword("");
                      setShowChangePasswordModal(true);
                    }}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "8px",
                      background: "linear-gradient(135deg, #3b82f6, #2563eb)",
                      color: "white",
                      border: "none",
                      cursor: "pointer",
                      fontWeight: "700",
                    }}
                  >
                    Change Password
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "8px",
                      background: "#fee2e2",
                      color: "#b91c1c",
                      border: "1px solid #fecaca",
                      cursor: "pointer",
                      fontWeight: "700",
                    }}
                    title="Delete profile"
                  >
                    Delete Profile
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Saved Cities Section */}
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
              <div
                className="accordion-content list-content"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                {/* Embedded City Autocomplete Search Bar */}
                <SearchBar
                  type="city"
                  placeholder="Search and navigate to a new city..."
                />

                {userProfile.savedCities
                  .filter((city) => city !== "Search for a new city")
                  .map((city) => (
                    <button
                      type="button"
                      key={city}
                      className="list-item"
                      onClick={() => navigate(`/city/${city}`)}
                    >
                      🏙️ {city}
                    </button>
                  ))}
              </div>
            )}
          </div>

          {/* Saved Countries Section */}
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
              <div
                className="accordion-content list-content"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                {/* Embedded Country Autocomplete Search Bar */}
                <SearchBar
                  type="country"
                  placeholder="Search and navigate to a new country..."
                />

                {userProfile.savedCountries
                  .filter((country) => country !== "Search for a new country")
                  .map((country) => (
                    <button
                      type="button"
                      key={country}
                      className="list-item"
                      onClick={() => navigate(`/country/${country}`)}
                    >
                      🌍 {country}
                    </button>
                  ))}
              </div>
            )}
          </div>

          {/* Saved Itineraries Section */}
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
                {itineraries.length === 0 ? (
                  <p
                    style={{
                      padding: "8px 4px",
                      color: "#64748b",
                      margin: 0,
                      fontSize: "0.95rem",
                    }}
                  >
                    No saved itineraries yet. Search and ping places to save
                    your first itinerary!
                  </p>
                ) : (
                  itineraries.map((itinerary) => (
                    <div
                      key={itinerary.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        width: "100%",
                      }}
                    >
                      <button
                        type="button"
                        className="list-item"
                        style={{
                          flex: 1,
                          cursor: "pointer",
                        }}
                        onClick={() => handleSelectItinerary(itinerary)}
                      >
                        <span style={{ fontWeight: "700" }}>
                          {itinerary.name}
                        </span>
                        <span
                          style={{
                            float: "right",
                            color: "#64748b",
                            fontSize: "0.85rem",
                          }}
                        >
                          {JSON.parse(itinerary.points).length} locations
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteItinerary(itinerary.name)}
                        style={{
                          background: "#fee2e2",
                          border: "1px solid #fca5a5",
                          borderRadius: "10px",
                          color: "#ef4444",
                          padding: "11px 14px",
                          fontWeight: "bold",
                          cursor: "pointer",
                          height: "44px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        title="Delete itinerary"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="profile-footer">
        <p>© 2026 Travel App by CAS — Explore the world</p>
      </footer>

      {/* Change Password Modal */}
      {showChangePasswordModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(15,23,42,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
          }}
        >
          <div
            style={{
              background: "white",
              padding: "20px",
              borderRadius: "12px",
              width: "92%",
              maxWidth: "420px",
              boxSizing: "border-box",
              boxShadow: "0 10px 30px rgba(2,6,23,0.2)",
            }}
          >
            <h3 style={{ marginTop: 0 }}>Change Password</h3>
            <p style={{ marginTop: 0, color: "#475569" }}>
              Enter a new password and confirm it. Passwords must match.
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                marginTop: "12px",
              }}
            >
              <input
                type="password"
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={{
                  padding: "10px",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                }}
              />
              <input
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={{
                  padding: "10px",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                }}
              />
              {passwordError && (
                <div style={{ color: "#b91c1c", fontWeight: 700 }}>
                  {passwordError}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
              <button
                type="button"
                onClick={async () => {
                  setPasswordError("");
                  if (!newPassword || !confirmPassword) {
                    setPasswordError(
                      "Please enter and confirm your new password.",
                    );
                    return;
                  }
                  if (newPassword !== confirmPassword) {
                    setPasswordError("Passwords do not match.");
                    return;
                  }
                  if (newPassword.length < 8) {
                    setPasswordError("Password must be at least 8 characters.");
                    return;
                  }

                  const token = localStorage.getItem("travelAppToken");
                  try {
                    const resp = await fetch(
                      `${API_BASE}/api/change-password`,
                      {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          ...authHeaders(),
                        },
                        body: JSON.stringify({ newPassword }),
                      },
                    );
                    const data = await resp.json();
                    if (resp.ok) {
                      alert(data.message || "Password changed successfully.");
                      setShowChangePasswordModal(false);
                      setNewPassword("");
                      setConfirmPassword("");
                      setPasswordError("");
                    } else {
                      setPasswordError(
                        data.message || "Failed to change password.",
                      );
                    }
                  } catch (err) {
                    console.error(err);
                    setPasswordError("Network error while changing password.");
                  }
                }}
                style={{
                  flex: 1,
                  background: "linear-gradient(135deg,#10b981,#059669)",
                  color: "white",
                  border: "none",
                  padding: "10px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Save New Password
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowChangePasswordModal(false);
                  setPasswordError("");
                }}
                style={{
                  flex: 1,
                  background: "#f1f5f9",
                  color: "#374151",
                  border: "1px solid #e2e8f0",
                  padding: "10px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Profile Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(15,23,42,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
          }}
        >
          <div
            style={{
              background: "white",
              padding: "20px",
              borderRadius: "12px",
              width: "92%",
              maxWidth: "420px",
              boxSizing: "border-box",
              boxShadow: "0 10px 30px rgba(2,6,23,0.2)",
            }}
          >
            <h3 style={{ marginTop: 0, color: "#b91c1c" }}>Delete Profile</h3>
            <p style={{ marginTop: 0, color: "#475569" }}>
              This action cannot be undone. Your profile and all saved data will
              be permanently deleted. Type DELETE in the field below to confirm.
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                marginTop: "12px",
              }}
            >
              <input
                type="text"
                placeholder="Type DELETE to confirm"
                onChange={(e) =>
                  setDeleteError(
                    e.target.value === "DELETE" ? "" : "Type DELETE to confirm",
                  )
                }
                style={{
                  padding: "10px",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                }}
              />
              {deleteError && (
                <div style={{ color: "#b91c1c", fontWeight: 700 }}>
                  {deleteError}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
              <button
                type="button"
                onClick={async () => {
                  // Only proceed if user typed DELETE
                  if (deleteError) {
                    alert(
                      "Please type DELETE exactly to confirm profile deletion.",
                    );
                    return;
                  }

                  const token = localStorage.getItem("travelAppToken");
                  try {
                    const resp = await fetch(`${API_BASE}/api/profile`, {
                      method: "DELETE",
                      headers: {
                        "Content-Type": "application/json",
                        ...authHeaders(),
                      },
                    });
                    const data = await resp.json();
                    if (resp.ok) {
                      // Clear session and navigate away
                      localStorage.removeItem("travelAppLoggedIn");
                      localStorage.removeItem("travelAppToken");
                      localStorage.removeItem("travelAppUser");
                      alert(
                        data.message || "Profile deleted. Redirecting to home.",
                      );
                      navigate("/");
                    } else {
                      alert(data.message || "Failed to delete profile.");
                    }
                  } catch (err) {
                    console.error(err);
                    alert("Network error while deleting profile.");
                  }
                }}
                style={{
                  flex: 1,
                  background: "linear-gradient(135deg,#ef4444,#dc2626)",
                  color: "white",
                  border: "none",
                  padding: "10px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Delete Profile
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteError("");
                }}
                style={{
                  flex: 1,
                  background: "#f1f5f9",
                  color: "#374151",
                  border: "1px solid #e2e8f0",
                  padding: "10px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showInactivityPrompt && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: "white",
              padding: "24px",
              borderRadius: "16px",
              boxShadow:
                "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              maxWidth: "400px",
              width: "90%",
              textAlign: "center",
              border: "1px solid #e2e8f0",
            }}
          >
            <h3
              style={{
                margin: "0 0 12px",
                color: "#0f172a",
                fontSize: "1.25rem",
                fontWeight: "bold",
              }}
            >
              Are you still here?
            </h3>
            <p
              style={{
                margin: "0 0 20px",
                color: "#475569",
                fontSize: "0.95rem",
                lineHeight: "1.5",
              }}
            >
              You have been inactive for 28 minutes. Would you like to stay
              logged in?
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                onClick={() => handleInactivityChoice(true)}
                style={{
                  flex: 1,
                  background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                  color: "white",
                  border: "none",
                  borderRadius: "10px",
                  padding: "12px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  fontSize: "0.95rem",
                }}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => handleInactivityChoice(false)}
                style={{
                  flex: 1,
                  background: "#f1f5f9",
                  color: "#475569",
                  border: "1px solid #cbd5e1",
                  borderRadius: "10px",
                  padding: "12px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  fontSize: "0.95rem",
                }}
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
