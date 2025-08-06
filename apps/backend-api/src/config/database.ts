import { Pool, PoolClient } from 'pg';
import Redis from 'ioredis';

// PostgreSQL connection pool
let pool: Pool;
let redis: Redis;

export const connectDatabase = async (): Promise<void> => {
  try {
    // PostgreSQL connection
    pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'portfolio_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      max: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Test PostgreSQL connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('✅ PostgreSQL connected successfully');

    // Redis connection (optional - for caching and sessions)
    if (process.env.REDIS_URL || process.env.REDIS_HOST) {
      redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      await redis.connect();
      console.log('✅ Redis connected successfully');
    }
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
};

export const getDatabase = (): Pool => {
  if (!pool) {
    throw new Error('Database not initialized. Call connectDatabase() first.');
  }
  return pool;
};

export const getRedis = (): Redis | null => {
  return redis || null;
};

export const query = async (text: string, params?: any[]): Promise<any> => {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
};

export const transaction = async <T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Graceful shutdown
export const closeDatabase = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    console.log('PostgreSQL pool closed');
  }
  if (redis) {
    redis.disconnect();
    console.log('Redis connection closed');
  }
};