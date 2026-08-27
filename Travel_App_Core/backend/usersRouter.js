import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from './db/index.js';
import { createUser, findUserByEmail } from './db/queries/users.js';
import { createSession } from './db/queries/sessions.js';

const JWT_SECRET = process.env.JWT_SECRET || 'development-secret';
const router = express.Router();

// POST /users/register
router.post('/register', async (req, res, next) => {
  const { firstName, lastName, email, password, confirmPassword } = req.body || {};

  if (!firstName || !lastName || !email || !password || !confirmPassword) {
    return res.status(400).json({ success: false, message: 'Please complete all registration fields.' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ success: false, message: 'Passwords do not match.' });
  }

  try {
    const existing = await findUserByEmail(email.trim().toLowerCase());
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await createUser(firstName.trim(), lastName.trim(), email.trim().toLowerCase(), passwordHash);

    // create JWT and session
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '28m' });
    const expiresAt = new Date(Date.now() + 28 * 60 * 1000).toISOString();
    await createSession(user.id, token, expiresAt);

    return res.status(201).json({ success: true, token, user: { id: user.id, firstName: user.first_name, lastName: user.last_name, email: user.email } });
  } catch (error) {
    next(error);
  }
});

// POST /users/login
router.post('/login', async (req, res, next) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  try {
    const user = await findUserByEmail(email.trim().toLowerCase());

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '28m' });
    const expiresAt = new Date(Date.now() + 28 * 60 * 1000).toISOString();

    await createSession(user.id, token, expiresAt);

    const sessionUser = {
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
    };

    return res.json({ success: true, token, user: sessionUser });
  } catch (error) {
    next(error);
  }
});

export default router;
