import mongoose from 'mongoose';

import { env } from './env';

export const connectDatabase = async (): Promise<void> => {
  if (!env.mongoUri) {
    throw new Error('MongoDB connection string (MONGO_URI) is not defined');
  }

  try {
    await mongoose.connect(env.mongoUri);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection failed', error);
    throw error;
  }
};

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected successfully');
});
