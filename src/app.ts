import cors from 'cors';
import express from 'express';

import { corsOptions } from './config/cors';
import { errorMiddleware } from './middlewares/error.middleware';
import { routes } from './routes/index.routes';

export const app = express();

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '2mb' }));

app.use(routes);

app.use(errorMiddleware);
