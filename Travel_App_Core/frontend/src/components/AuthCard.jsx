import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/AuthCard.css";

const API_BASE = "http://localhost:4000";
const TWENTY_EIGHT_MINUTES = 28 * 60 * 1000;
const TWO_MINUTES = 2 * 60 * 1000;

//**state & initializations */

const AuthCard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("login");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [statusMessage, setStatusMessage] = useState({
    text: "",
    type: "success",
  });
  const [showInactivityPrompt, setShowInactivityPrompt] = useState(false);

  const inactivityTimerRef = useRef(null);
  const graceTimerRef = useRef(null);

  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [registerData, setRegisterData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  //**session cleanup */
  //**removes auth token, while retaining users fisrt name, status alert clearing after 3 secs */
  const clearSessionStorage = useCallback(() => {
    const preservedName =
      user?.firstName || localStorage.getItem("travelAppUserName") || "";

    localStorage.removeItem("travelAppLoggedIn");
    localStorage.removeItem("travelAppToken");
    localStorage.removeItem("travelAppUser");

    if (preservedName) {
      localStorage.setItem("travelAppUserName", preservedName);
    }
  }, [user?.firstName]);

  const showMessage = useCallback((text, type = "success") => {
    setStatusMessage({ text, type });
    window.clearTimeout(showMessage.timeoutId);
    showMessage.timeoutId = window.setTimeout(() => {
      setStatusMessage({ text: "", type: "success" });
    }, 3000);
  }, []);

  //**Session Persistence & Logout Handlers */ */

  const persistSession = (sessionUser, token) => {
    localStorage.setItem("travelAppLoggedIn", "true");
    localStorage.setItem("travelAppToken", token);
    localStorage.setItem("travelAppUser", JSON.stringify(sessionUser));
    localStorage.setItem("travelAppUserName", sessionUser.firstName || "");
    setUser(sessionUser);
    setIsLoggedIn(true);
  };

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

      clearSessionStorage();
      setUser(null);
      setIsLoggedIn(false);
      setShowInactivityPrompt(false);
      setActiveTab("login");
      showMessage("You have been logged out.", "success");
    },
    [clearSessionStorage, showMessage],
  );

  //**Inactivity Timer Handlers */
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

  //**Lifecycle Effects (Initial Load & User Activity Listeners) */

  useEffect(() => {
    const storedUser = localStorage.getItem("travelAppUser");
    const token = localStorage.getItem("travelAppToken");
    const isAuth =
      localStorage.getItem("travelAppLoggedIn") === "true" && Boolean(token);

    if (isAuth && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
        setIsLoggedIn(true);
      } catch (error) {
        console.error("Invalid stored user:", error);
        clearSessionStorage();
      }
    }
  }, [clearSessionStorage]);

  useEffect(() => {
    if (!isLoggedIn) {
      clearInactivityTimers();
      setShowInactivityPrompt(false);
      return;
    }

    startInactivityTimer();

    const events = ["mousemove", "keydown", "click", "touchstart", "scroll"];
    const reset = () => startInactivityTimer();

    events.forEach((eventName) => window.addEventListener(eventName, reset));

    return () => {
      events.forEach((eventName) =>
        window.removeEventListener(eventName, reset),
      );
      clearInactivityTimers();
    };
  }, [clearInactivityTimers, isLoggedIn, startInactivityTimer]);

  //**Form Handlers */

  const handleLoginChange = (e) => {
    setLoginData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleRegisterChange = (e) => {
    setRegisterData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch(`${API_BASE}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginData),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        showMessage(data.message || "Unable to log in.", "error");
        return;
      }

      persistSession(data.user, data.token);
      setLoginData({ email: "", password: "" });
      showMessage("Login successful.", "success");
    } catch (error) {
      console.error("Login error:", error);
      showMessage("Unable to connect to the server.", "error");
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();

    if (registerData.password !== registerData.confirmPassword) {
      showMessage("Passwords do not match.", "error");
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registerData),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        showMessage(data.message || "Registration failed.", "error");
        return;
      }

      setActiveTab("login");
      setRegisterData({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        confirmPassword: "",
      });
      showMessage(
        "Successfully Registration. Log in and start building itineraries",
        "success",
      );
    } catch (error) {
      console.error("Registration error:", error);
      showMessage("Unable to connect to the server.", "error");
    }
  };

  //**Render Logic */
  //** */

  if (isLoggedIn && user) {
    return (
      // Renders Welcome banner, Dashboard navigation button, Logout button,
      // and optional Inactivity Prompt modal ("Are you still logged in?")
      <div className="auth-card auth-card-logged-in">
        <div className="auth-loggedin-row">
          <p className="auth-welcome">Welcome, {user.firstName}</p>
          <div className="auth-loggedin-actions">
            <button
              type="button"
              className="dashboard-btn"
              onClick={() => navigate("/dashboard")}
            >
              Dashboard
            </button>
            <button
              type="button"
              className="logout-btn"
              onClick={() => handleLogout(false)}
            >
              Log Out
            </button>
          </div>
        </div>

        {showInactivityPrompt && (
          <div className="auth-inactivity-prompt">
            <p>Are you still logged in?</p>
            <div className="auth-inactivity-actions">
              <button
                type="button"
                onClick={() => handleInactivityChoice(true)}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => handleInactivityChoice(false)}
              >
                No
              </button>
            </div>
          </div>
        )}

        {statusMessage.text && (
          <div className={`auth-status ${statusMessage.type}`}>
            {statusMessage.text}
          </div>
        )}
      </div>
    );
  }

  return (
    // Renders Tab switcher ("Log In" vs "Register"),
    // Form inputs (Login form or Registration form dependent on activeTab state),
    // and Status notification alert box
    <div className="auth-card">
      <div className="auth-tabs">
        <button
          type="button"
          className={`auth-tab ${activeTab === "login" ? "active" : ""}`}
          onClick={() => setActiveTab("login")}
        >
          Log In
        </button>
        <button
          type="button"
          className={`auth-tab ${activeTab === "register" ? "active" : ""}`}
          onClick={() => setActiveTab("register")}
        >
          Register
        </button>
      </div>

      <div className="auth-card-body">
        {activeTab === "login" ? (
          <form onSubmit={handleLoginSubmit} className="auth-form">
            <div className="inline-login-row">
              <input
                type="email"
                name="email"
                placeholder="Email"
                value={loginData.email}
                onChange={handleLoginChange}
                required
              />

              <input
                type="password"
                name="password"
                placeholder="Password"
                value={loginData.password}
                onChange={handleLoginChange}
                required
              />

              <button type="submit" className="auth-btn inline-btn">
                Log in
              </button>
            </div>

            <p className="auth-tagline">Save searches & build itineraries</p>
          </form>
        ) : (
          <form onSubmit={handleRegisterSubmit} className="auth-form">
            <div className="form-row">
              <div className="form-group">
                <input
                  type="text"
                  name="firstName"
                  placeholder="First Name"
                  value={registerData.firstName}
                  onChange={handleRegisterChange}
                  required
                />
              </div>

              <div className="form-group">
                <input
                  type="text"
                  name="lastName"
                  placeholder="Last Name"
                  value={registerData.lastName}
                  onChange={handleRegisterChange}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <input
                type="email"
                name="email"
                placeholder="Email address"
                value={registerData.email}
                onChange={handleRegisterChange}
                required
              />
            </div>

            <div className="form-group">
              <input
                type="password"
                name="password"
                placeholder="Password"
                value={registerData.password}
                onChange={handleRegisterChange}
                required
              />
            </div>

            <div className="form-group">
              <input
                type="password"
                name="confirmPassword"
                placeholder="Confirm Password"
                value={registerData.confirmPassword}
                onChange={handleRegisterChange}
                required
              />
            </div>

            <button type="submit" className="auth-btn">
              Register Now
            </button>
          </form>
        )}
      </div>

      {statusMessage.text && (
        <div className={`auth-status ${statusMessage.type}`}>
          {statusMessage.text}
        </div>
      )}
    </div>
  );
};

export default AuthCard;
