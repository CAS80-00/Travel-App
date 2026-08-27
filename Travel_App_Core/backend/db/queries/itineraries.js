import { query } from '../index.js';

export async function upsertItinerary(userId, name, points) {
  const sql = `INSERT INTO itineraries (user_id, name, points) VALUES ($1, $2, $3) ON CONFLICT (user_id, name) DO UPDATE SET points = EXCLUDED.points RETURNING *`;
  const { rows } = await query(sql, [userId, name, typeof points === 'string' ? points : JSON.stringify(points)]);
  return rows[0];
}

export async function getItineraries(userId) {
  const sql = `SELECT * FROM itineraries WHERE user_id = $1 ORDER BY created_at DESC`;
  const { rows } = await query(sql, [userId]);
  return rows;
}

export async function deleteItinerary(userId, name) {
  const sql = `DELETE FROM itineraries WHERE user_id = $1 AND name = $2`;
  await query(sql, [userId, name]);
}
