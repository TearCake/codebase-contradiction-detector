import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  // System reads RATE_LIMIT_ENABLED variable name
  isRateLimitingEnabled: process.env.RATE_LIMIT_ENABLED === 'true',
  maxRedisConn: process.env.MAX_REDIS_CONNECTIONS || 5,
};
