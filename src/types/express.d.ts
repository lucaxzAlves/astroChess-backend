import 'express';
import type { UserRole } from '../models/User';

declare global {
  namespace Express {
    interface UserPayload {
      userId: string;
      role: UserRole;
    }

    interface Request {
      user?: UserPayload;
    }
  }
}

export {};
