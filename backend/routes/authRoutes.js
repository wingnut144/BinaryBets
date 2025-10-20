import express from 'express';
import crypto from 'crypto';
import { sendVerificationEmail } from '../services/emailService.js';

const router = express.Router();

export default function authRoutes(pool) {
  // Register
  router.post('/register', async (req, res) => {
    try {
      const { username, name, email, password } = req.body;
      
      if (!username || !name || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
      }
      
      const verificationToken = crypto.randomBytes(32).toString('hex');
      
      const result = await pool.query(
        `INSERT INTO users (username, name, email, password, verification_token, email_verified) 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [username, name, email, password, verificationToken, false]
      );
      
      const user = result.rows[0];
      
      sendVerificationEmail(user, verificationToken).catch(err => 
        console.error('Failed to send verification email:', err)
      );
      
      res.json({ 
        user: { ...user, password: undefined },
        message: 'Account created! Please check your email to verify your account.'
      });
    } catch (error) {
      if (error.code === '23505') {
        if (error.constraint === 'users_username_key') {
          return res.status(400).json({ error: 'Username already taken' });
        } else if (error.constraint === 'users_email_key') {
          return res.status(400).json({ error: 'Email already registered' });
        }
      }
      console.error('Register error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  });

  // Login
  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      const result = await pool.query(
        'SELECT * FROM users WHERE email = $1 AND password = $2',
        [email, password]
      );
      
      if (result.rows.length > 0) {
        const user = result.rows[0];
        
        if (!user.email_verified) {
          return res.status(403).json({ 
            error: 'Please verify your email before logging in. Check your inbox.',
            needsVerification: true
          });
        }
        
        res.json({ user: { ...user, password: undefined } });
      } else {
        res.status(401).json({ error: 'Invalid credentials' });
      }
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  // Verify email
  router.get('/verify/:token', async (req, res) => {
    try {
      const { token } = req.params;
      
      const result = await pool.query(
        'UPDATE users SET email_verified = TRUE, verification_token = NULL WHERE verification_token = $1 RETURNING *',
        [token]
      );
      
      if (result.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid or expired verification token' });
      }
      
      res.json({ 
        success: true, 
        message: 'Email verified successfully! You can now log in.',
        user: { ...result.rows[0], password: undefined }
      });
    } catch (error) {
      console.error('Verification error:', error);
      res.status(500).json({ error: 'Verification failed' });
    }
  });

  // Resend verification email
  router.post('/resend-verification', async (req, res) => {
    try {
      const { email } = req.body;
      
      const result = await pool.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const user = result.rows[0];
      
      if (user.email_verified) {
        return res.status(400).json({ error: 'Email already verified' });
      }
      
      const verificationToken = crypto.randomBytes(32).toString('hex');
      
      await pool.query(
        'UPDATE users SET verification_token = $1 WHERE id = $2',
        [verificationToken, user.id]
      );
      
      await sendVerificationEmail(user, verificationToken);
      
      res.json({ 
        success: true, 
        message: 'Verification email sent! Please check your inbox.' 
      });
    } catch (error) {
      console.error('Resend verification error:', error);
      res.status(500).json({ error: 'Failed to resend verification email' });
    }
  });

  return router;
}
