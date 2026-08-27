import { query } from '../index.js';

export async function createSession(userId, token, expiresAt) {
  const sql = `INSERT INTO sessions (user_id, token, expires_at, last_activity) VALUES ($1, $2, $3, $4) RETURNING *`;
  const { rows } = await query(sql, [userId, token, expiresAt, new Date().toISOString()]);
  return rows[0];
}

export async function getSessionByToken(token) {
  const sql = `SELECT s.*, u.first_name, u.last_name, u.email, u.id as user_id FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = $1 AND s.expires_at > $2`;
  const { rows } = await query(sql, [token, new Date().toISOString()]);
  return rows[0] || null;
}

export async function deleteSessionByToken(token) {
  const sql = `DELETE FROM sessions WHERE token = $1`;
  await query(sql, [token]);
}

export async function invalidateOtherSessions(userId, keepToken) {
  const sql = `DELETE FROM sessions WHERE user_id = $1 AND token IS DISTINCT FROM $2`;
  await query(sql, [userId, keepToken]);
}
