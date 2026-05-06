import { app } from './app';
import { connectDatabase } from './config/database';
import { env } from './config/env';

const bootstrap = async (): Promise<void> => {
  try {
    await connectDatabase();

    app.listen(env.port, () => {
      console.log(`Server running on port ${env.port} in ${env.nodeEnv} mode`);
    });
  } catch (error) {
    console.error('Application startup failed', error);
    process.exit(1);
  }
};

void bootstrap();
