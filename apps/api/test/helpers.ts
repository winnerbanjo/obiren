import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import type { Db } from 'mongodb';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/bootstrap';

/**
 * Boots a REAL Nest application (same AppModule + production bootstrap:
 * request IDs, error envelope, idempotency, throttling) against the
 * in-memory MongoDB for genuine end-to-end tests.
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app);
  await app.init();
  return app;
}

export interface TestUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  userId?: string;
  accessToken?: string;
}

let userCounter = 0;

export function uniqueEmail(prefix = 'user'): string {
  userCounter += 1;
  return `${prefix}-${Date.now()}-${userCounter}@obiren-test.com`;
}

export async function registerUser(
  app: INestApplication,
  overrides: Partial<TestUser> = {},
): Promise<TestUser> {
  const user: TestUser = {
    email: overrides.email || uniqueEmail(),
    password: overrides.password || 'SecurePass123',
    firstName: overrides.firstName || 'Test',
    lastName: overrides.lastName || 'User',
    ...overrides,
  };

  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/register')
    .send({
      email: user.email,
      password: user.password,
      firstName: user.firstName,
      lastName: user.lastName,
      countryCode: 'NG',
    });

  if (res.status !== 201) {
    throw new Error(`Registration failed: ${JSON.stringify(res.body)}`);
  }
  user.userId = res.body?.data?.userId;
  return user;
}

export async function loginUser(
  app: INestApplication,
  email: string,
  password: string,
): Promise<{ accessToken: string; refreshToken: string; body: any }> {
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email, password, platform: 'web' });

  if (res.status !== 200) {
    throw new Error(`Login failed: ${JSON.stringify(res.body)}`);
  }

  return {
    accessToken: res.body?.data?.tokens?.accessToken,
    refreshToken: res.body?.data?.tokens?.refreshToken,
    body: res.body,
  };
}

export async function registerAndLogin(app: INestApplication, overrides: Partial<TestUser> = {}) {
  const user = await registerUser(app, overrides);
  const tokens = await loginUser(app, user.email, user.password);
  user.accessToken = tokens.accessToken;
  return { user, tokens };
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

/** Unique idempotency header for transactional test requests. */
export function idempotencyHeader(prefix = 'test') {
  return { 'Idempotency-Key': `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}` };
}

/** The Db instance used by the app under test (@nestjs/mongoose owns the connection). */
export function getDb(app: INestApplication): Db {
  return (app.get(getConnectionToken()) as any).db as Db;
}

/** Promote a user to a role directly in the database (test-only helper). */
export async function setUserRole(app: INestApplication, userId: string, role: string) {
  const mongoose = require('mongoose');
  const db = getDb(app);
  await db.collection('users').updateOne(
    { _id: new mongoose.Types.ObjectId(userId) },
    { $set: { roles: [role], status: 'active' } },
  );
}
