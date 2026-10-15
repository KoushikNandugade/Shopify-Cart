import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { parseEnv } from 'node:util';
import { readFileSync } from 'node:fs';

const requireBackend = createRequire(new URL('../../backend/package.json', import.meta.url));
const mongoose = requireBackend('mongoose');

test('real browser: register, duplicate error, login, protected home, refresh and logout', async ({ page, context }) => {
  const email = `browser-${Date.now()}@example.com`;
  const password = 'labpass123';
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto('/home');
    await expect(page).toHaveURL(/\/login$/);
    await page.getByRole('link', { name: 'Create an account' }).click();
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
    await expect(page.getByText('Enter your full name.')).toBeVisible();
    await page.getByLabel('Full name', { exact: true }).fill('Avery Morgan');
    await page.getByLabel('Email address', { exact: true }).fill(email);
    await page.getByLabel('Phone number', { exact: true }).fill('9876543210');
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Show password' }).click();
    await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('status')).toContainText('Account created');
    await page.goto('/register');
    await page.getByLabel('Full name', { exact: true }).fill('Avery Morgan');
    await page.getByLabel('Email address', { exact: true }).fill(email);
    await page.getByLabel('Phone number', { exact: true }).fill('9876543210');
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText('Email already exists');
    await page.goto('/login');
    await page.getByLabel('Email address', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill('wrong-password');
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText('Invalid Credentials');
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByRole('heading', { name: /Welcome home/ })).toBeVisible();
    await expect(page.getByRole('definition').filter({ hasText: email })).toBeVisible();
    const cookie = (await context.cookies()).find(item => item.name === 'shopkart_token');
    expect(cookie.httpOnly).toBe(true);
    expect(await page.evaluate(() => document.cookie)).not.toContain('shopkart_token');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Avery Morgan', exact: true })).toBeVisible();
    await page.screenshot({ path: '/tmp/shopkart-home-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: '/tmp/shopkart-home-mobile.png', fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect((await context.cookies()).find(item => item.name === 'shopkart_token')).toBeUndefined();
    await page.goto('/home');
    await expect(page).toHaveURL(/\/login$/);
    await page.screenshot({ path: '/tmp/shopkart-login-mobile.png', fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: '/tmp/shopkart-login-desktop.png', fullPage: true });
    expect(errors).toEqual([]);
  } finally {
    // Clean up only this test's account, never the database or real customer records.
    const env = parseEnv(readFileSync(new URL('../../backend/.env', import.meta.url), 'utf8'));
    const connection = await mongoose.createConnection(env.MONGODB_URI).asPromise();
    try { await connection.collection('customers').deleteOne({ email }); }
    finally { await connection.close(); }
  }
});

test('profile service failure shows retry instead of exposing protected data', async ({ page }) => {
  await page.route('**/customers/me', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Temporarily unavailable' }) }));
  await page.goto('/home');
  await expect(page.getByRole('alert')).toHaveText('Temporarily unavailable');
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  await page.unroute('**/customers/me');
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page).toHaveURL(/\/login$/);
});
