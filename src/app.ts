import cors from 'cors';
import express from 'express';

import { corsOptions } from './config/cors';
import { connectDatabase } from './config/database';
import { errorMiddleware } from './middlewares/error.middleware';
import { routes } from './routes/index.routes';
import { asyncHandler } from './utils/async-handler';

export const app = express();
const isVercelMode = process.env.VERCEL === '1';
const databaseBackedPaths = ['/auth', '/player-profile', '/tournaments'];

console.log('App initialized', {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  serverless: isVercelMode,
});

if (isVercelMode) {
  console.log('Running in Vercel/serverless mode');
}

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '10mb' }));
app.get('/favicon.png', (_request, response) => response.status(204).end());
app.get('/favicon.ico', (_request, response) => response.status(204).end());
app.get('/', (_request, response) =>
  response.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV ?? 'development',
  }),
);
app.use(
  databaseBackedPaths,
  asyncHandler(async (_request, _response, next) => {
    await connectDatabase();
    next();
  }),
);

app.use(routes);

app.use(errorMiddleware);
