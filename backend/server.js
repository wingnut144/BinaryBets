import express from 'express';
import cors from 'cors';
import pkg from 'pg';
import authRoutes from './routes/authRoutes.js';
import marketRoutes from './routes/marketRoutes.js';
import betRoutes from './routes/betRoutes.js';
import userRoutes from './routes/userRoutes.js';

const { Pool } = pkg;
const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'binaryuser',
  host: process.env.POSTGRES_HOST || 'postgres',
  database: process.env.POSTGRES_DB || 'binarybets',
  password: process.env.POSTGRES_PASSWORD || 'binarypass',
  port: 5432,
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('✅ Database connected successfully');
  }
});

// Mount routes
app.use('/api/auth', authRoutes(pool));
app.use('/api/markets', marketRoutes(pool));
app.use('/api/bets', betRoutes(pool));
app.use('/api', userRoutes(pool));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    emailConfigured: !!process.env.EMAIL_HOST
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📧 Email configured: ${process.env.EMAIL_HOST ? 'YES ✅' : 'NO ❌'}`);
  console.log(`🔑 NewsAPI configured: ${process.env.NEWS_API_KEY && process.env.NEWS_API_KEY !== 'YOUR_NEWS_API_KEY_HERE' ? 'YES ✅' : 'NO ❌'}`);
});
