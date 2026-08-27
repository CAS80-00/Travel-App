import { query } from '../index.js';

export async function insertSavedPlace(userId, type, name) {
  const sql = `INSERT INTO saved_places (user_id, type, name) VALUES ($1, $2, $3) ON CONFLICT (user_id, type, name) DO NOTHING`;
  await query(sql, [userId, type, name]);
}

export async function deleteSavedPlace(userId, type, name) {
  const sql = `DELETE FROM saved_places WHERE user_id = $1 AND type = $2 AND name = $3`;
  await query(sql, [userId, type, name]);
}

export async function getSavedPlaces(userId) {
  const sql = `SELECT * FROM saved_places WHERE user_id = $1 ORDER BY created_at DESC`;
  const { rows } = await query(sql, [userId]);
  return rows;
}
