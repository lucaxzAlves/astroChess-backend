import mongoose from 'mongoose';

import { env } from './env';

let connectionPromise: Promise<void> | null = null;

export const connectDatabase = async (): Promise<void> => {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  if (!env.mongoUri) {
    const error = new Error('MongoDB connection string (MONGO_URI) is not defined');
    console.error('MongoDB connection failed', error.message);
    throw error;
  }

  console.log('Mongo connecting...');

  connectionPromise = mongoose
    .connect(env.mongoUri)
    .then(() => {
      console.log('MongoDB connected successfully');
    })
    .catch((error) => {
      console.error('MongoDB connection failed', error);
      throw error;
    })
    .finally(() => {
      connectionPromise = null;
    });

  return connectionPromise;
};

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected successfully');
});
