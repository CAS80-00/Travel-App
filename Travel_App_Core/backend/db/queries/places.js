import { query } from '../index.js';

export async function createPlace(data) {
  const sql = `INSERT INTO places (google_place_id, name, address, latitude, longitude, types, rating, photo_refs) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`;
  const { rows } = await query(sql, [
    data.google_place_id || null,
    data.name,
    data.address || null,
    data.latitude || null,
    data.longitude || null,
    data.types || null,
    data.rating || null,
    data.photo_refs || null,
  ]);
  return rows[0];
}

export async function getPlaceById(id) {
  const sql = `SELECT * FROM places WHERE id = $1`;
  const { rows } = await query(sql, [id]);
  return rows[0] || null;
}

export async function searchPlacesByName(q, limit = 10) {
  const sql = `SELECT * FROM places WHERE lower(name) LIKE $1 ORDER BY name LIMIT $2`;
  const { rows } = await query(sql, [`%${q.toLowerCase()}%`, limit]);
  return rows;
}
