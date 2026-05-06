import { Request } from 'express';

import { UserRole } from '../../models/User';

export type RegisterInput = {
  name: string;
  email: string;
  password: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type AuthUserResponse = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

export type AuthResponse = {
  token: string;
  user: AuthUserResponse;
};

export type AuthUser = {
  userId: string;
  role: UserRole;
};

export type AuthRequest = Request & {
  user?: AuthUser;
};

export type RequiredAuthRequest = Request & {
  user: AuthUser;
};

export type JwtPayload = {
  sub: string;
  role: UserRole;
};
