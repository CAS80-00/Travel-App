import dotenv from 'dotenv';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Loads .env in backend folder if present
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const email = process.env.USER_EMAIL;
  const firstName = process.env.USER_FIRST || 'Dilan';
  const lastName = process.env.USER_LAST || '';
  const password = process.env.USER_PASSWORD;

  if (!email || !password) {
    console.error('Environment variables USER_EMAIL and USER_PASSWORD are required.');
    console.error('Example (PowerShell):');
    console.error('$env:USER_EMAIL = "dilan@example.com"; $env:USER_PASSWORD = "Cas80"; node .\\scripts\\create_user.js');
    process.exit(1);
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    const insertText = `INSERT INTO users (first_name, last_name, email, password_hash) VALUES ($1,$2,$3,$4) ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash RETURNING id, email`;
    const res = await pool.query(insertText, [firstName, lastName, email.toLowerCase(), passwordHash]);
    const userId = res.rows[0].id;

    console.log(`User created/updated: id=${userId} email=${res.rows[0].email}`);

    // create a session/token for convenience
    const jwtSecret = process.env.JWT_SECRET || 'development-secret';
    const token = jwt.sign({ userId, email: res.rows[0].email }, jwtSecret, { expiresIn: '28m' });
    const expiresAt = new Date(Date.now() + 28 * 60 * 1000).toISOString();

    await pool.query(`INSERT INTO sessions (user_id, token, expires_at, last_activity) VALUES ($1,$2,$3,$4) ON CONFLICT (token) DO NOTHING`, [userId, token, expiresAt, new Date().toISOString()]);

    console.log('Created session and token. Save this token to authenticate requests:');
    console.log(token);

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('Failed to create user:', err);
    await pool.end();
    process.exit(1);
  }
}

run();
