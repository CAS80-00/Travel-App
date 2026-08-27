import pool, { query } from '../index.js';

export async function createUser(firstName, lastName, email, passwordHash) {
  const sql = `INSERT INTO users (first_name, last_name, email, password_hash) VALUES ($1, $2, $3, $4) RETURNING id, first_name, last_name, email`;
  const { rows } = await query(sql, [firstName, lastName, email, passwordHash]);
  return rows[0];
}

export async function findUserByEmail(email) {
  const sql = `SELECT * FROM users WHERE email = $1`;
  const { rows } = await query(sql, [email]);
  return rows[0] || null;
}

export async function getUserById(id) {
  const sql = `SELECT id, first_name, last_name, email FROM users WHERE id = $1`;
  const { rows } = await query(sql, [id]);
  return rows[0] || null;
}

export async function updatePassword(userId, passwordHash) {
  const sql = `UPDATE users SET password_hash = $1 WHERE id = $2`;
  await query(sql, [passwordHash, userId]);
}
