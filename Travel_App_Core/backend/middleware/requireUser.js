import jwt from 'jsonwebtoken';
import { getSessionByToken } from '../db/queries/sessions.js';

const JWT_SECRET = process.env.JWT_SECRET || 'development-secret';

export async function requireUser(req, res, next) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ success: false, message: 'Authentication required.' });

  try {
    jwt.verify(token, JWT_SECRET);

    const s = await getSessionByToken(token);
    if (!s) return res.status(401).json({ success: false, message: 'Invalid or expired session.' });

    // update last_activity (fire-and-forget)
    // reuse query helper by importing pool if needed; keep minimal here
    await import('../db/index.js').then(({ default: pool }) => pool.query('UPDATE sessions SET last_activity = $1 WHERE token = $2', [new Date().toISOString(), token]));

    req.user = {
      id: s.user_id,
      firstName: s.first_name,
      lastName: s.last_name,
      email: s.email,
      token,
    };

    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
}
