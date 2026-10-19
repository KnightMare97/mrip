import assert from 'node:assert/strict';
import test from 'node:test';
import type { NextFunction, Request, Response } from 'express';
import { personalAuthMiddleware } from '../src/server/auth';

test('personal access fails closed and supports browser and API credentials', () => {
  const previous = process.env.MUSICRIP_API_SECRET;
  const invoke = (headers: Record<string, string> = {}, query: Record<string, string> = {}) => {
    let status = 200;
    let passed = false;
    const responseHeaders: Record<string, string> = {};
    const req = { headers: { host: 'app.example', ...headers }, query } as unknown as Request;
    const res = {
      setHeader(name: string, value: string) { responseHeaders[name] = value; return this; },
      status(code: number) { status = code; return this; },
      json(_body: unknown) { return this; }
    } as unknown as Response;
    personalAuthMiddleware(req, res, (() => { passed = true; }) as NextFunction);
    return { status, passed, responseHeaders };
  };
  try {
    delete process.env.MUSICRIP_API_SECRET;
    assert.equal(invoke().status, 503);
    assert.equal(invoke({ origin: 'http://localhost' }).passed, false);

    process.env.MUSICRIP_API_SECRET = 'a-long-test-secret-not-a-real-credential';
    const secret = process.env.MUSICRIP_API_SECRET;
    assert.equal(invoke().status, 401);
    assert.match(invoke().responseHeaders['WWW-Authenticate'], /^Basic /);
    assert.equal(invoke({ origin: 'https://app.example' }).status, 401);
    assert.equal(invoke({}, { token: secret }).status, 401);
    assert.equal(invoke({ 'x-musicrip-token': 'wrong' }).status, 401);
    assert.equal(invoke({ 'x-musicrip-token': secret }).passed, true);
    assert.equal(invoke({ authorization: `Bearer ${secret}` }).passed, true);

    const basic = (user: string, password: string) =>
      `Basic ${Buffer.from(`${user}:${password}`, 'utf8').toString('base64')}`;
    assert.equal(invoke({ authorization: basic('musicrip', secret) }).passed, true);
    assert.equal(invoke({ authorization: basic('someone-else', secret) }).status, 401);
    assert.equal(invoke({ authorization: 'Basic !!!' }).status, 401);
    assert.equal(invoke({ authorization: basic('musicrip', 'wrong') }).status, 401);
    assert.equal(invoke({ 'x-musicrip-token': secret, origin: 'https://evil.example' }).status, 403);
    assert.equal(invoke({ 'x-musicrip-token': secret, origin: 'null' }).status, 403);
    assert.equal(invoke({ 'x-musicrip-token': secret, 'sec-fetch-site': 'cross-site' }).status, 403);
    assert.equal(invoke({ 'x-musicrip-token': secret, origin: 'https://app.example' }).passed, true);
    assert.equal(invoke().responseHeaders['Cache-Control'], 'no-store');

    process.env.MUSICRIP_API_SECRET = 'changed-after-module-import';
    assert.equal(invoke({ 'x-musicrip-token': secret }).status, 401);
    assert.equal(invoke({ 'x-musicrip-token': 'changed-after-module-import' }).passed, true);
  } finally {
    if (previous === undefined) delete process.env.MUSICRIP_API_SECRET;
    else process.env.MUSICRIP_API_SECRET = previous;
  }
});
