import { query } from '../index.js';

export async function addItineraryItem(itineraryId, placeId, dayNumber, notes) {
  const sql = `INSERT INTO itinerary_items (itinerary_id, place_id, day_number, notes) VALUES ($1,$2,$3,$4) RETURNING *`;
  const { rows } = await query(sql, [itineraryId, placeId, dayNumber, notes]);
  return rows[0];
}

export async function getItemsForItinerary(itineraryId) {
  const sql = `SELECT ii.*, p.name AS place_name FROM itinerary_items ii LEFT JOIN places p ON p.id = ii.place_id WHERE ii.itinerary_id = $1 ORDER BY ii.day_number, ii.created_at`;
  const { rows } = await query(sql, [itineraryId]);
  return rows;
}

export async function deleteItineraryItem(id, itineraryId) {
  const sql = `DELETE FROM itinerary_items WHERE id = $1 AND itinerary_id = $2`;
  await query(sql, [id, itineraryId]);
}
