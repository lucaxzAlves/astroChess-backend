import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';

import { env } from '../../config/env';
import { User, UserDocument } from '../../models/User';
import { AppError } from '../../utils/AppError';
import {
  AuthResponse,
  AuthUserResponse,
  JwtPayload,
  LoginInput,
  RegisterInput,
} from './auth.types';

const SALT_ROUNDS = 12;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (email: string): string => {
  return email.trim().toLowerCase();
};

const ensureJwtSecret = (): string => {
  if (!env.jwtSecret) {
    throw new AppError('JWT_SECRET is not defined', 500);
  }

  return env.jwtSecret;
};

const signToken = (user: UserDocument): string => {
  const payload: JwtPayload = {
    sub: user._id.toString(),
    role: user.role,
  };
  const options: SignOptions = {
    expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'],
  };

  return jwt.sign(payload, ensureJwtSecret(), options);
};

const toAuthUser = (user: UserDocument): AuthUserResponse => {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
  };
};

const assertRegisterInput = (input: Partial<RegisterInput>): RegisterInput => {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const email = typeof input.email === 'string' ? normalizeEmail(input.email) : '';
  const password = typeof input.password === 'string' ? input.password : '';

  if (!name) {
    throw new AppError('Name is required', 400);
  }

  if (!email) {
    throw new AppError('Email is required', 400);
  }

  if (!EMAIL_REGEX.test(email)) {
    throw new AppError('Email is invalid', 400);
  }

  if (!password) {
    throw new AppError('Password is required', 400);
  }

  if (password.length < 6) {
    throw new AppError('Password must be at least 6 characters long', 400);
  }

  return {
    name,
    email,
    password,
  };
};

const assertLoginInput = (input: Partial<LoginInput>): LoginInput => {
  const email = typeof input.email === 'string' ? normalizeEmail(input.email) : '';
  const password = typeof input.password === 'string' ? input.password : '';

  if (!email) {
    throw new AppError('Email is required', 400);
  }

  if (!password) {
    throw new AppError('Password is required', 400);
  }

  return {
    email,
    password,
  };
};

export const register = async (input: Partial<RegisterInput>): Promise<AuthResponse> => {
  const { name, email, password } = assertRegisterInput(input);
  const existingUser = await User.findOne({ email });

  if (existingUser) {
    throw new AppError('Email is already registered', 409);
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await User.create({
    name,
    email,
    passwordHash,
  });

  return {
    token: signToken(user),
    user: toAuthUser(user),
  };
};

export const login = async (input: Partial<LoginInput>): Promise<AuthResponse> => {
  const { email, password } = assertLoginInput(input);
  const user = await User.findOne({ email }).select('+passwordHash');

  if (!user) {
    throw new AppError('Invalid email or password', 401);
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

  if (!isPasswordValid) {
    throw new AppError('Invalid email or password', 401);
  }

  return {
    token: signToken(user),
    user: toAuthUser(user),
  };
};
