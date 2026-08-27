// Pins storage helpers
import { query } from '../index.js';

export async function createPin(userId, placeId = null, note = null, lat = null, lng = null, metadata = {}) {
  const sql = `INSERT INTO pins (user_id, place_id, note, lat, lng, metadata) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`;
  const { rows } = await query(sql, [userId, placeId, note, lat, lng, metadata ? JSON.stringify(metadata) : null]);
  return rows[0];
}

export async function getPinsByUser(userId) {
  const sql = `SELECT * FROM pins WHERE user_id = $1 ORDER BY created_at DESC`;
  const { rows } = await query(sql, [userId]);
  return rows;
}

export async function deletePin(id, userId) {
  const sql = `DELETE FROM pins WHERE id = $1 AND user_id = $2`;
  await query(sql, [id, userId]);
}
