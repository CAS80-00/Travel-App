import { query } from '../index.js';

export async function createCity(name, country, lat, lng) {
  const sql = `INSERT INTO cities (name, country, latitude, longitude) VALUES ($1, $2, $3, $4) RETURNING *`;
  const { rows } = await query(sql, [name, country, lat, lng]);
  return rows[0];
}

export async function getCityById(id) {
  const sql = `SELECT * FROM cities WHERE id = $1`;
  const { rows } = await query(sql, [id]);
  return rows[0] || null;
}

export async function searchCities(q, limit = 10) {
  const sql = `SELECT * FROM cities WHERE lower(name) LIKE $1 OR lower(country) LIKE $1 ORDER BY name LIMIT $2`;
  const { rows } = await query(sql, [`%${q.toLowerCase()}%`, limit]);
  return rows;
}
