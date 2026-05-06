import { CorsOptions } from 'cors';

import { env } from './env';

const parseAllowedOrigins = (value: string): string[] => {
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const isLocalDevelopmentOrigin = (origin: string): boolean => {
  return /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
};

const allowedOrigins = parseAllowedOrigins(env.corsOrigin);

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    if (env.nodeEnv !== 'production' && isLocalDevelopmentOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
