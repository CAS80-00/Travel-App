import express from "express";
import axios from "axios";
import cors from "cors";
import * as cheerio from "cheerio";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import pg from "pg";

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const JWT_SECRET = process.env.JWT_SECRET || "development-secret";

function cleanHTML(html) {
  return html
    .replace(/<a[^>]*>/g, "")
    .replace(/<\/a>/g, "")
    .replace(/<span class="mw-editsection[^>]*>.*?<\/span>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();
}

const app = express();
app.use(cors());
app.use(express.json());

const bindParams = (sql, params = []) => {
  let index = 1;
  const sqlWithBindings = sql.replace(/\?/g, () => `$${index++}`);
  return { text: sqlWithBindings, values: params };
};

const initializeDatabase = async () => {
  try {
    await pool.query(`
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

      CREATE TABLE IF NOT EXISTS itineraries (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        points TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id, name)
      );
    `);

    console.log("PostgreSQL database initialized");
  } catch (error) {
    console.error("PostgreSQL initialization failed:", error);
  }
};

initializeDatabase();

const runDb = async (sql, params = []) => {
  const query = bindParams(sql, params);
  const result = await pool.query(query.text, query.values);
  return { id: result.rows[0]?.id ?? null, rows: result.rows, changes: result.rowCount };
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

    await runDb(
      `UPDATE sessions SET last_activity = ? WHERE token = ?`,
      [new Date().toISOString(), token],
    );

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

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/register", async (req, res) => {
  const { firstName, lastName, email, password, confirmPassword } = req.body || {};

  if (!firstName || !lastName || !email || !password || !confirmPassword) {
    return res.status(400).json({
      success: false,
      message: "Please complete all registration fields.",
    });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({
      success: false,
      message: "Passwords do not match.",
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: "Password must be at least 6 characters long.",
    });
  }

  const existingUser = await getDb("SELECT id FROM users WHERE email = ?", [email.trim().toLowerCase()]);
  if (existingUser) {
    return res.status(409).json({
      success: false,
      message: "An account with this email already exists.",
    });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const inserted = await runDb(
      `INSERT INTO users (first_name, last_name, email, password_hash)
       VALUES (?, ?, ?, ?)
       RETURNING id`,
      [firstName.trim(), lastName.trim(), email.trim().toLowerCase(), passwordHash],
    );

    return res.status(201).json({
      success: true,
      message: "Successfully Registration. Log in and start building itineraries",
      user: {
        id: inserted.id,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({
      success: false,
      message: "Registration failed. Please try again.",
    });
  }
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Email and password are required.",
    });
  }

  const user = await getDb("SELECT * FROM users WHERE email = ?", [email.trim().toLowerCase()]);
  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Invalid email or password.",
    });
  }

  const validPassword = await bcrypt.compare(password, user.password_hash);
  if (!validPassword) {
    return res.status(401).json({
      success: false,
      message: "Invalid email or password.",
    });
  }

  const token = jwt.sign(
    { userId: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: "28m" },
  );
  const expiresAt = new Date(Date.now() + 28 * 60 * 1000).toISOString();

  await runDb(
    `INSERT INTO sessions (user_id, token, expires_at, last_activity)
     VALUES (?, ?, ?, ?)`,
    [user.id, token, expiresAt, new Date().toISOString()],
  );

  const sessionUser = {
    id: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
    email: user.email,
  };

  return res.json({
    success: true,
    message: "Login successful.",
    token,
    user: sessionUser,
  });
});

app.post("/api/logout", async (req, res) => {
  const token = getToken(req);

  if (token) {
    await runDb("DELETE FROM sessions WHERE token = ?", [token]);
  }

  return res.json({ success: true, message: "Logged out successfully." });
});

app.get("/api/me", async (req, res) => {
  const token = getToken(req);
  const user = await getUserFromToken(token);

  if (!user) {
    return res.status(401).json({ success: false, message: "Not authenticated." });
  }

  return res.json({ success: true, user });
});

// Change password endpoint
app.post("/api/change-password", async (req, res) => {
  const token = getToken(req);
  const { newPassword } = req.body || {};

  if (!token) {
    return res.status(401).json({ success: false, message: "Authentication required." });
  }

  const authenticatedUser = await getUserFromToken(token);
  if (!authenticatedUser) {
    return res.status(401).json({ success: false, message: "Session expired or invalid." });
  }

  if (!newPassword || typeof newPassword !== "string") {
    return res.status(400).json({ success: false, message: "New password is required." });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ success: false, message: "Password must be at least 8 characters long." });
  }

  try {
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await runDb(
      `UPDATE users SET password_hash = ? WHERE id = ?`,
      [passwordHash, authenticatedUser.id],
    );

    // Invalidate other sessions for this user (keep current session token valid)
    await runDb(
      `DELETE FROM sessions WHERE user_id = ? AND token != ?`,
      [authenticatedUser.id, token],
    );

    return res.json({ success: true, message: "Password changed successfully." });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({ success: false, message: "Failed to change password." });
  }
});

// Delete profile endpoint
app.delete("/api/profile", async (req, res) => {
  const token = getToken(req);

  if (!token) {
    return res.status(401).json({ success: false, message: "Authentication required." });
  }

  const authenticatedUser = await getUserFromToken(token);
  if (!authenticatedUser) {
    return res.status(401).json({ success: false, message: "Session expired or invalid." });
  }

  try {
    // Delete user; ON DELETE CASCADE will remove sessions, saved_places, itineraries
    await runDb(`DELETE FROM users WHERE id = ?`, [authenticatedUser.id]);

    return res.json({ success: true, message: "Profile deleted successfully." });
  } catch (error) {
    console.error("Delete profile error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete profile." });
  }
});

app.post("/api/save-place", async (req, res) => {
  const token = getToken(req);
  const { type, name } = req.body || {};

  if (!token) {
    return res.status(401).json({ success: false, message: "Login required to save places." });
  }

  const authenticatedUser = await getUserFromToken(token);
  if (!authenticatedUser) {
    return res.status(401).json({ success: false, message: "Session expired." });
  }

  if (!type || !name) {
    return res.status(400).json({ success: false, message: "Place details are required." });
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
    return res.status(500).json({ success: false, message: "Unable to save place." });
  }
});

app.delete("/api/save-place", async (req, res) => {
  const token = getToken(req);
  const { type, name } = req.body || {};

  if (!token) {
    return res.status(401).json({ success: false, message: "Login required to delete saved places." });
  }

  const authenticatedUser = await getUserFromToken(token);
  if (!authenticatedUser) {
    return res.status(401).json({ success: false, message: "Session expired." });
  }

  if (!type || !name) {
    return res.status(400).json({ success: false, message: "Place details are required." });
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
    return res.status(500).json({ success: false, message: "Unable to remove place." });
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

// Itineraries Endpoints
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
    return res.status(500).json({ success: false, message: "Unable to fetch itineraries." });
  }
});

app.post("/api/itineraries", async (req, res) => {
  const token = getToken(req);
  const { name, points } = req.body || {};

  if (!token) {
    return res.status(401).json({ success: false, message: "Login required to save itineraries." });
  }

  const authenticatedUser = await getUserFromToken(token);
  if (!authenticatedUser) {
    return res.status(401).json({ success: false, message: "Session expired." });
  }

  if (!name || !points) {
    return res.status(400).json({ success: false, message: "Itinerary name and points are required." });
  }

  try {
    await runDb(
      `INSERT INTO itineraries (user_id, name, points)
       VALUES (?, ?, ?)
       ON CONFLICT (user_id, name) DO UPDATE SET points = EXCLUDED.points`,
      [authenticatedUser.id, name, typeof points === "string" ? points : JSON.stringify(points)],
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
    return res.status(500).json({ success: false, message: "Unable to save itinerary." });
  }
});

app.delete("/api/itineraries", async (req, res) => {
  const token = getToken(req);
  const { name } = req.body || {};

  if (!token) {
    return res.status(401).json({ success: false, message: "Login required to delete itineraries." });
  }

  const authenticatedUser = await getUserFromToken(token);
  if (!authenticatedUser) {
    return res.status(401).json({ success: false, message: "Session expired." });
  }

  if (!name) {
    return res.status(400).json({ success: false, message: "Itinerary name is required." });
  }

  try {
    await runDb(
      `DELETE FROM itineraries WHERE user_id = ? AND name = ?`,
      [authenticatedUser.id, name],
    );

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
    return res.status(500).json({ success: false, message: "Unable to delete itinerary." });
  }
});

//City Page
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

//CountryPage
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

app.listen(4000, () => console.log("Backend running on port 4000"));
