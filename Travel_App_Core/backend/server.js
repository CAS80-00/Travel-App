import express from "express";
import axios from "axios";
import cors from "cors";
import * as cheerio from "cheerio";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import pool from "./db/index.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// Import newly added query helpers
import { createCity, getCityById, searchCities } from "./db/queries/cities.js";
import {
  createPlace,
  getPlaceById,
  searchPlacesByName,
} from "./db/queries/places.js";
import {
  createRoute,
  getRoutesByUser,
  deleteRoute,
} from "./db/queries/routes.js";
import {
  addItineraryItem,
  getItemsForItinerary,
  deleteItineraryItem,
} from "./db/queries/itinerary_items.js";
import { createPin, getPinsByUser, deletePin } from "./db/queries/pins.js";

// Compute __dirname in ES module context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "development-secret";

function cleanHTML(html) {
  return html
    .replace(/<a[^>]*>/g, "")
    .replace(/<\/a>/g, "")
    .replace(/<span class="mw-editsection[^>]*>.*?<\/span>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();
}

//**express middlewares **//
const app = express();
app.use(cors());
app.use(express.json());

// Mount users router (JWT-based auth endpoints) at /api
const { default: usersRouter } = await import("./usersRouter.js");
app.use("/api", usersRouter);

const bindParams = (sql, params = []) => {
  let index = 1;
  const sqlWithBindings = sql.replace(/\?/g, () => `$${index++}`);
  return { text: sqlWithBindings, values: params };
};

//**run core tables */
const initializeDatabase = async () => {
  try {
    await pool.query(`
      -- Core
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS saved_places (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id, type, name)
      );

      -- Itineraries as JSONB
      CREATE TABLE IF NOT EXISTS itineraries (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        points JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id, name)
      );

      -- Cities
      CREATE TABLE IF NOT EXISTS cities (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        country VARCHAR(255),
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Places
      CREATE TABLE IF NOT EXISTS places (
        id SERIAL PRIMARY KEY,
        google_place_id VARCHAR(255),
        name VARCHAR(255) NOT NULL,
        address TEXT,
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        types TEXT[],
        rating NUMERIC,
        photo_refs TEXT[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Routes
      CREATE TABLE IF NOT EXISTS routes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        start_place_id INTEGER REFERENCES places(id) ON DELETE SET NULL,
        end_place_id INTEGER REFERENCES places(id) ON DELETE SET NULL,
        distance_meters INTEGER,
        duration_seconds INTEGER,
        polyline TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Pins
      CREATE TABLE IF NOT EXISTS pins (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        place_id INTEGER REFERENCES places(id) ON DELETE SET NULL,
        note TEXT,
        lat DOUBLE PRECISION,
        lng DOUBLE PRECISION,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Itinerary items
      CREATE TABLE IF NOT EXISTS itinerary_items (
        id SERIAL PRIMARY KEY,
        itinerary_id INTEGER NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,
        place_id INTEGER REFERENCES places(id) ON DELETE SET NULL,
        day_number INTEGER,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("PostgreSQL database initialized");
  } catch (error) {
    console.error("PostgreSQL initialization failed:", error);
  }
};

initializeDatabase();

//**Database wrapper helpers */

const runDb = async (sql, params = []) => {
  const query = bindParams(sql, params);
  const result = await pool.query(query.text, query.values);
  return {
    id: result.rows[0]?.id ?? null,
    rows: result.rows,
    changes: result.rowCount,
  };
};

const getDb = async (sql, params = []) => {
  const query = bindParams(sql, params);
  const result = await pool.query(query.text, query.values);
  return result.rows[0] || null;
};

const allDb = async (sql, params = []) => {
  const query = bindParams(sql, params);
  const result = await pool.query(query.text, query.values);
  return result.rows;
};

//**token extractor helper */

const getToken = (req) => {
  const authHeader = req.headers.authorization || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.replace("Bearer ", "").trim();
  }

  if (req.body && req.body.token) {
    return req.body.token;
  }

  if (req.query && req.query.token) {
    return req.query.token;
  }

  return null;
};

//**user auth & session validator */

const getUserFromToken = async (token) => {
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const session = await getDb(
      `SELECT s.*, u.first_name, u.last_name, u.email, u.id AS user_id
       FROM sessions s
       INNER JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ?`,
      [token, new Date().toISOString()],
    );

    if (!session) return null;

    await runDb(`UPDATE sessions SET last_activity = ? WHERE token = ?`, [
      new Date().toISOString(),
      token,
    ]);

    return {
      id: session.user_id,
      firstName: session.first_name,
      lastName: session.last_name,
      email: session.email,
      token,
      jwtIssuedAt: decoded.iat,
      jwtExpiresAt: decoded.exp,
    };
  } catch (error) {
    return null;
  }
};

//**health check endpoint */

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

//**user logout endpoint */

app.post("/api/logout", async (req, res) => {
  const token = getToken(req);

  if (token) {
    await runDb("DELETE FROM sessions WHERE token = ?", [token]);
  }

  return res.json({ success: true, message: "Logged out successfully." });
});

//**get current user endpoint//profile */

app.get("/api/me", async (req, res) => {
  const token = getToken(req);
  const user = await getUserFromToken(token);

  if (!user) {
    return res
      .status(401)
      .json({ success: false, message: "Not authenticated." });
  }

  return res.json({ success: true, user });
});

// Change password endpoint
app.post("/api/change-password", async (req, res) => {
  const token = getToken(req);
  const { newPassword } = req.body || {};

  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "Authentication required." });
  }

  const authenticatedUser = await getUserFromToken(token);
  if (!authenticatedUser) {
    return res
      .status(401)
      .json({ success: false, message: "Session expired or invalid." });
  }

  if (!newPassword || typeof newPassword !== "string") {
    return res
      .status(400)
      .json({ success: false, message: "New password is required." });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({
      success: false,
      message: "Password must be at least 8 characters long.",
    });
  }

  try {
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await runDb(`UPDATE users SET password_hash = ? WHERE id = ?`, [
      passwordHash,
      authenticatedUser.id,
    ]);

    await runDb(`DELETE FROM sessions WHERE user_id = ? AND token != ?`, [
      authenticatedUser.id,
      token,
    ]);

    return res.json({
      success: true,
      message: "Password changed successfully.",
    });
  } catch (error) {
    console.error("Change password error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to change password." });
  }
});

// Delete profile endpoint
app.delete("/api/profile", async (req, res) => {
  const token = getToken(req);

  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "Authentication required." });
  }

  const authenticatedUser = await getUserFromToken(token);
  if (!authenticatedUser) {
    return res
      .status(401)
      .json({ success: false, message: "Session expired or invalid." });
  }

  try {
    await runDb(`DELETE FROM users WHERE id = ?`, [authenticatedUser.id]);

    return res.json({
      success: true,
      message: "Profile deleted successfully.",
    });
  } catch (error) {
    console.error("Delete profile error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete profile." });
  }
});

//**save place endpoints POST, DELETE AND GET */
app.post("/api/save-place", async (req, res) => {
  const token = getToken(req);
  const { type, name } = req.body || {};

  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "Login required to save places." });
  }

  const authenticatedUser = await getUserFromToken(token);
  if (!authenticatedUser) {
    return res
      .status(401)
      .json({ success: false, message: "Session expired." });
  }

  if (!type || !name) {
    return res
      .status(400)
      .json({ success: false, message: "Place details are required." });
  }

  try {
    await runDb(
      `INSERT INTO saved_places (user_id, type, name)
       VALUES (?, ?, ?)
       ON CONFLICT (user_id, type, name) DO NOTHING`,
      [authenticatedUser.id, type, name],
    );

    const savedPlaces = await allDb(
      `SELECT * FROM saved_places WHERE user_id = ? ORDER BY created_at DESC`,
      [authenticatedUser.id],
    );

    return res.json({
      success: true,
      message: "Place saved successfully.",
      savedPlaces,
    });
  } catch (error) {
    console.error("Save place error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to save place." });
  }
});

app.delete("/api/save-place", async (req, res) => {
  const token = getToken(req);
  const { type, name } = req.body || {};

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Login required to delete saved places.",
    });
  }

  const authenticatedUser = await getUserFromToken(token);
  if (!authenticatedUser) {
    return res
      .status(401)
      .json({ success: false, message: "Session expired." });
  }

  if (!type || !name) {
    return res
      .status(400)
      .json({ success: false, message: "Place details are required." });
  }

  try {
    await runDb(
      `DELETE FROM saved_places WHERE user_id = ? AND type = ? AND name = ?`,
      [authenticatedUser.id, type, name],
    );

    const savedPlaces = await allDb(
      `SELECT * FROM saved_places WHERE user_id = ? ORDER BY created_at DESC`,
      [authenticatedUser.id],
    );

    return res.json({
      success: true,
      message: "Place removed successfully.",
      savedPlaces,
    });
  } catch (error) {
    console.error("Delete save error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to remove place." });
  }
});

app.get("/api/saved-places", async (req, res) => {
  const token = getToken(req);
  const authenticatedUser = await getUserFromToken(token);

  if (!authenticatedUser) {
    return res.status(401).json({ success: false, message: "Login required." });
  }

  const savedPlaces = await allDb(
    `SELECT * FROM saved_places WHERE user_id = ? ORDER BY created_at DESC`,
    [authenticatedUser.id],
  );

  return res.json({ success: true, savedPlaces });
});

// Itineraries Endpoints GET, POST AND DELETE//
app.get("/api/itineraries", async (req, res) => {
  const token = getToken(req);
  const authenticatedUser = await getUserFromToken(token);

  if (!authenticatedUser) {
    return res.status(401).json({ success: false, message: "Login required." });
  }

  try {
    const itineraries = await allDb(
      `SELECT * FROM itineraries WHERE user_id = ? ORDER BY created_at DESC`,
      [authenticatedUser.id],
    );
    return res.json({ success: true, itineraries });
  } catch (error) {
    console.error("Get itineraries error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to fetch itineraries." });
  }
});

app.post("/api/itineraries", async (req, res) => {
  const token = getToken(req);
  const { name, points } = req.body || {};

  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "Login required to save itineraries." });
  }

  const authenticatedUser = await getUserFromToken(token);
  if (!authenticatedUser) {
    return res
      .status(401)
      .json({ success: false, message: "Session expired." });
  }

  if (!name || !points) {
    return res.status(400).json({
      success: false,
      message: "Itinerary name and points are required.",
    });
  }

  try {
    await runDb(
      `INSERT INTO itineraries (user_id, name, points)
       VALUES (?, ?, ?)
       ON CONFLICT (user_id, name) DO UPDATE SET points = EXCLUDED.points`,
      [
        authenticatedUser.id,
        name,
        typeof points === "string" ? points : JSON.stringify(points),
      ],
    );

    const itineraries = await allDb(
      `SELECT * FROM itineraries WHERE user_id = ? ORDER BY created_at DESC`,
      [authenticatedUser.id],
    );

    return res.json({
      success: true,
      message: "Itinerary saved successfully.",
      itineraries,
    });
  } catch (error) {
    console.error("Save itinerary error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to save itinerary." });
  }
});

app.delete("/api/itineraries", async (req, res) => {
  const token = getToken(req);
  const { name } = req.body || {};

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Login required to delete itineraries.",
    });
  }

  const authenticatedUser = await getUserFromToken(token);
  if (!authenticatedUser) {
    return res
      .status(401)
      .json({ success: false, message: "Session expired." });
  }

  if (!name) {
    return res
      .status(400)
      .json({ success: false, message: "Itinerary name is required." });
  }

  try {
    await runDb(`DELETE FROM itineraries WHERE user_id = ? AND name = ?`, [
      authenticatedUser.id,
      name,
    ]);

    const itineraries = await allDb(
      `SELECT * FROM itineraries WHERE user_id = ? ORDER BY created_at DESC`,
      [authenticatedUser.id],
    );

    return res.json({
      success: true,
      message: "Itinerary deleted successfully.",
      itineraries,
    });
  } catch (error) {
    console.error("Delete itinerary error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to delete itinerary." });
  }
});

// New CRUD endpoints for cities, places, routes, pins and itinerary items

// Cities
app.get("/api/cities", async (req, res) => {
  const q = req.query.q || "";
  try {
    if (!q) return res.json({ success: true, cities: [] });
    const cities = await searchCities(q, 20);
    return res.json({ success: true, cities });
  } catch (err) {
    console.error("Cities search error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to search cities." });
  }
});

app.get("/api/cities/:id", async (req, res) => {
  try {
    const c = await getCityById(req.params.id);
    if (!c)
      return res
        .status(404)
        .json({ success: false, message: "City not found." });
    return res.json({ success: true, city: c });
  } catch (err) {
    console.error("Get city error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch city." });
  }
});

app.post("/api/cities", async (req, res) => {
  const token = getToken(req);
  const user = await getUserFromToken(token);
  if (!user)
    return res
      .status(401)
      .json({ success: false, message: "Authentication required." });

  const { name, country, latitude, longitude } = req.body || {};
  if (!name)
    return res
      .status(400)
      .json({ success: false, message: "City name required." });
  try {
    const city = await createCity(
      name,
      country || null,
      latitude || null,
      longitude || null,
    );
    return res.status(201).json({ success: true, city });
  } catch (err) {
    console.error("Create city error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create city." });
  }
});

// Places
app.get("/api/places", async (req, res) => {
  const q = req.query.q || "";
  try {
    if (!q) return res.json({ success: true, places: [] });
    const places = await searchPlacesByName(q, 20);
    return res.json({ success: true, places });
  } catch (err) {
    console.error("Places search error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to search places." });
  }
});

app.get("/api/places/:id", async (req, res) => {
  try {
    const p = await getPlaceById(req.params.id);
    if (!p)
      return res
        .status(404)
        .json({ success: false, message: "Place not found." });
    return res.json({ success: true, place: p });
  } catch (err) {
    console.error("Get place error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch place." });
  }
});

app.post("/api/places", async (req, res) => {
  const token = getToken(req);
  const user = await getUserFromToken(token);
  if (!user)
    return res
      .status(401)
      .json({ success: false, message: "Authentication required." });

  const data = req.body || {};
  if (!data.name)
    return res
      .status(400)
      .json({ success: false, message: "Place name required." });

  try {
    const place = await createPlace(data);
    return res.status(201).json({ success: true, place });
  } catch (err) {
    console.error("Create place error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create place." });
  }
});

// Pins
app.post("/api/pins", async (req, res) => {
  const token = getToken(req);
  const user = await getUserFromToken(token);
  if (!user)
    return res
      .status(401)
      .json({ success: false, message: "Authentication required." });

  const { place_id, note, lat, lng, metadata } = req.body || {};
  try {
    const pin = await createPin(
      user.id,
      place_id || null,
      note || null,
      lat || null,
      lng || null,
      metadata || {},
    );
    return res.status(201).json({ success: true, pin });
  } catch (err) {
    console.error("Create pin error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create pin." });
  }
});

app.get("/api/pins", async (req, res) => {
  const token = getToken(req);
  const user = await getUserFromToken(token);
  if (!user)
    return res
      .status(401)
      .json({ success: false, message: "Authentication required." });

  try {
    const pins = await getPinsByUser(user.id);
    return res.json({ success: true, pins });
  } catch (err) {
    console.error("Get pins error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch pins." });
  }
});

app.delete("/api/pins/:id", async (req, res) => {
  const token = getToken(req);
  const user = await getUserFromToken(token);
  if (!user)
    return res
      .status(401)
      .json({ success: false, message: "Authentication required." });

  try {
    await deletePin(req.params.id, user.id);
    return res.json({ success: true, message: "Pin deleted." });
  } catch (err) {
    console.error("Delete pin error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete pin." });
  }
});

// Routes (user-created routes)
app.post("/api/routes", async (req, res) => {
  const token = getToken(req);
  const user = await getUserFromToken(token);
  if (!user)
    return res
      .status(401)
      .json({ success: false, message: "Authentication required." });

  const {
    start_place_id,
    end_place_id,
    distance_meters,
    duration_seconds,
    polyline,
  } = req.body || {};
  try {
    const route = await createRoute(
      user.id,
      start_place_id || null,
      end_place_id || null,
      distance_meters || null,
      duration_seconds || null,
      polyline || null,
    );
    return res.status(201).json({ success: true, route });
  } catch (err) {
    console.error("Create route error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create route." });
  }
});

app.get("/api/routes", async (req, res) => {
  const token = getToken(req);
  const user = await getUserFromToken(token);
  if (!user)
    return res
      .status(401)
      .json({ success: false, message: "Authentication required." });

  try {
    const routes = await getRoutesByUser(user.id);
    return res.json({ success: true, routes });
  } catch (err) {
    console.error("Get routes error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch routes." });
  }
});

app.delete("/api/routes/:id", async (req, res) => {
  const token = getToken(req);
  const user = await getUserFromToken(token);
  if (!user)
    return res
      .status(401)
      .json({ success: false, message: "Authentication required." });

  try {
    await deleteRoute(req.params.id, user.id);
    return res.json({ success: true, message: "Route deleted." });
  } catch (err) {
    console.error("Delete route error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete route." });
  }
});

// Itinerary items
app.post("/api/itineraries/:itineraryId/items", async (req, res) => {
  const token = getToken(req);
  const user = await getUserFromToken(token);
  if (!user)
    return res
      .status(401)
      .json({ success: false, message: "Authentication required." });

  const itineraryId = req.params.itineraryId;
  const owner = await getDb(`SELECT user_id FROM itineraries WHERE id = ?`, [
    itineraryId,
  ]);
  if (!owner || owner.user_id !== user.id)
    return res.status(403).json({ success: false, message: "Forbidden" });

  const { place_id, day_number, notes } = req.body || {};
  try {
    const item = await addItineraryItem(
      itineraryId,
      place_id || null,
      day_number || null,
      notes || null,
    );
    return res.status(201).json({ success: true, item });
  } catch (err) {
    console.error("Add itinerary item error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to add itinerary item." });
  }
});

app.get("/api/itineraries/:itineraryId/items", async (req, res) => {
  const token = getToken(req);
  const user = await getUserFromToken(token);
  if (!user)
    return res
      .status(401)
      .json({ success: false, message: "Authentication required." });

  const itineraryId = req.params.itineraryId;
  const owner = await getDb(`SELECT user_id FROM itineraries WHERE id = ?`, [
    itineraryId,
  ]);
  if (!owner || owner.user_id !== user.id)
    return res.status(403).json({ success: false, message: "Forbidden" });

  try {
    const items = await getItemsForItinerary(itineraryId);
    return res.json({ success: true, items });
  } catch (err) {
    console.error("Get itinerary items error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch itinerary items." });
  }
});

app.delete("/api/itineraries/:itineraryId/items/:id", async (req, res) => {
  const token = getToken(req);
  const user = await getUserFromToken(token);
  if (!user)
    return res
      .status(401)
      .json({ success: false, message: "Authentication required." });

  const itineraryId = req.params.itineraryId;
  const owner = await getDb(`SELECT user_id FROM itineraries WHERE id = ?`, [
    itineraryId,
  ]);
  if (!owner || owner.user_id !== user.id)
    return res.status(403).json({ success: false, message: "Forbidden" });

  try {
    await deleteItineraryItem(req.params.id, itineraryId);
    return res.json({ success: true, message: "Item deleted." });
  } catch (err) {
    console.error("Delete itinerary item error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete itinerary item." });
  }
});

//City Page GET from Wikivoyage API//

app.get("/api/wikivoyage/:city", async (req, res) => {
  const city = req.params.city;

  try {
    const response = await axios.get("https://en.wikivoyage.org/w/api.php", {
      params: {
        action: "parse",
        page: city,
        format: "json",
        prop: "text",
        disableeditsection: 1,
        origin: "*",
      },
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    const html = response.data.parse.text["*"];
    const $ = cheerio.load(html);

    const wantedIds = {
      Understand: "Description",
      Get_in: "Get in",
      Get_around: "Get around",
      See: "See",
      Do: "Do",
      Stay_safe: "Stay safe",
      Cope: "Cope",
      Go_next: "Go next",
    };

    const sections = [];

    Object.entries(wantedIds).forEach(([id, finalName]) => {
      const heading = $(`h2#${id}`).parent();
      if (!heading.length) return;

      const blocks = heading.nextUntil("h2");
      let content = "";
      blocks.each((_, block) => {
        content += cleanHTML($.html(block));
      });

      sections.push({ title: finalName, content });
    });

    res.json({
      title: response.data.parse.title,
      sections,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch Wikivoyage data" });
  }
});

//CountryPage GET from Wikivoyage API//

app.get("/api/wikivoyage-country/:country", async (req, res) => {
  const country = req.params.country;

  try {
    const response = await axios.get("https://en.wikivoyage.org/w/api.php", {
      params: {
        action: "parse",
        page: country,
        format: "json",
        prop: "text",
        disableeditsection: 1,
        origin: "*",
      },
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    const html = response.data.parse.text["*"];
    const $ = cheerio.load(html);

    const wantedIds = {
      Understand: "Description",
      Regions: "Regions",
      Get_in: "Get in",
      Get_around: "Get around",
      See: "See",
      Do: "Do",
      Stay_safe: "Stay safe",
      Connect: "Connect",
      Go_next: "Go next",
    };

    const sections = [];

    Object.entries(wantedIds).forEach(([id, finalName]) => {
      const heading = $(`h2#${id}`).parent();
      if (!heading.length) return;

      const blocks = heading.nextUntil("h2");

      let content = "";
      blocks.each((_, block) => {
        content += cleanHTML($.html(block));
      });

      sections.push({
        title: finalName,
        content,
      });
    });

    res.json({
      title: response.data.parse.title,
      sections,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch country data" });
  }
});

// ✅ FIX: Fixed static path resolution for Render deployment
const buildPath = path.join(__dirname, "../frontend/build");
if (fs.existsSync(buildPath)) {
  app.use(express.static(buildPath));
  // Return index.html for any unknown route (SPA fallback)
  app.get("*", (_req, res) => {
    res.sendFile(path.join(buildPath, "index.html"));
  });
} else {
  console.log("Frontend build not found at", buildPath);
}

//**server start using environment PORT (for hosting) or 4000 locally */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
