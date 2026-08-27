import { query } from '../index.js';

export async function createRoute(userId, startPlaceId, endPlaceId, distanceMeters, durationSeconds, polyline) {
  const sql = `INSERT INTO routes (user_id, start_place_id, end_place_id, distance_meters, duration_seconds, polyline) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`;
  const { rows } = await query(sql, [userId, startPlaceId, endPlaceId, distanceMeters, durationSeconds, polyline]);
  return rows[0];
}

export async function getRoutesByUser(userId) {
  const sql = `SELECT r.*, p1.name AS start_name, p2.name AS end_name FROM routes r LEFT JOIN places p1 ON p1.id = r.start_place_id LEFT JOIN places p2 ON p2.id = r.end_place_id WHERE r.user_id = $1 ORDER BY r.created_at DESC`;
  const { rows } = await query(sql, [userId]);
  return rows;
}

export async function deleteRoute(id, userId) {
  const sql = `DELETE FROM routes WHERE id = $1 AND user_id = $2`;
  await query(sql, [id, userId]);
}
