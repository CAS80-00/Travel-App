import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import pg from "pg";

dotenv.config();

const { Pool } = pg;

// SSL configuration: use SSL when running in production (managed DBs like Render/Heroku)
const useSsl = !!process.env.DATABASE_URL && process.env.NODE_ENV === 'production';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: useSsl ? { rejectUnauthorized: false } : false });

async function run() {
  try {
    const schemaPath = path.join(process.cwd(), "schema.sql");
    if (!fs.existsSync(schemaPath)) {
      console.error("schema.sql not found at", schemaPath);
      process.exit(1);
    }

    const sql = fs.readFileSync(schemaPath, "utf8");
    console.log("Running schema SQL...");
    await pool.query(sql);
    console.log("Schema applied.");

    // Create sample users with hashed passwords
    const users = [
      {
        firstName: "Alice",
        lastName: "Traveler",
        email: "alice@example.com",
        password: "Password123!",
      },
      {
        firstName: "Bob",
        lastName: "Explorer",
        email: "bob@example.com",
        password: "Password123!",
      },
    ];

    for (const u of users) {
      const hash = await bcrypt.hash(u.password, 10);
      const insertUserText = `
        INSERT INTO users (first_name, last_name, email, password_hash) 
        VALUES ($1, $2, $3, $4) 
        ON CONFLICT (email) DO NOTHING 
        RETURNING id;
      `;
      const res = await pool.query(insertUserText, [
        u.firstName,
        u.lastName,
        u.email.toLowerCase(),
        hash,
      ]);
      let userId = res.rows[0]?.id;

      if (!userId) {
        // Fetch existing user ID if user already exists
        const existing = await pool.query(
          "SELECT id FROM users WHERE email = $1",
          [u.email.toLowerCase()],
        );
        userId = existing.rows[0].id;
      }

      console.log(`Seeded user ${u.email} (id=${userId})`);

      // Seed saved_places
      const savedPlaces = [
        { type: "city", name: "Paris" },
        { type: "city", name: "Tokyo" },
        { type: "country", name: "Italy" },
      ];

      for (const sp of savedPlaces) {
        await pool.query(
          `INSERT INTO saved_places (user_id, type, name) 
           VALUES ($1, $2, $3) 
           ON CONFLICT (user_id, type, name) DO NOTHING`,
          [userId, sp.type, sp.name],
        );
      }

      // Seed a sample itinerary
      const samplePoints = JSON.stringify([
        { name: "Start", lat: 48.8566, lng: 2.3522 },
        { name: "Stop 1", lat: 48.8606, lng: 2.3376 },
      ]);

      await pool.query(
        `INSERT INTO itineraries (user_id, name, points) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (user_id, name) DO UPDATE SET points = EXCLUDED.points`,
        [userId, "Paris Highlights", samplePoints],
      );

      // Seed cities
      const cities = [
        { name: "Paris", country: "France", lat: 48.8566, lng: 2.3522 },
        { name: "Tokyo", country: "Japan", lat: 35.6895, lng: 139.6917 },
      ];

      for (const c of cities) {
        await pool.query(
          `INSERT INTO cities (name, country, latitude, longitude) 
           VALUES ($1, $2, $3, $4) 
           ON CONFLICT (name) DO NOTHING`,
          [c.name, c.country, c.lat, c.lng],
        );
      }

      // Seed places
      const places = [
        {
          name: "Louvre Museum",
          address: "Rue de Rivoli, Paris",
          latitude: 48.8606,
          longitude: 2.3376,
        },
        {
          name: "Shinjuku Gyoen",
          address: "Shinjuku, Tokyo",
          latitude: 35.6852,
          longitude: 139.7101,
        },
      ];

      for (const p of places) {
        await pool.query(
          `INSERT INTO places (name, address, latitude, longitude) 
           VALUES ($1, $2, $3, $4) 
           ON CONFLICT (name) DO NOTHING`,
          [p.name, p.address, p.latitude, p.longitude],
        );
      }

      // Seed a sample pin
      const placeRes = await pool.query("SELECT id FROM places LIMIT 1");
      const placeForPin = placeRes.rows[0]?.id;
      if (placeForPin) {
        await pool.query(
          `INSERT INTO pins (user_id, place_id, note, lat, lng, metadata) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            userId,
            placeForPin,
            "Sample pin",
            null,
            null,
            JSON.stringify({ seeded: true }),
          ],
        );
      }

      console.log(
        `Seeded saved_places, itineraries, cities, places and pins for user id=${userId}`,
      );
    }

    console.log("Seeding completed successfully.");
  } catch (err) {
    console.error("Seeding failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
