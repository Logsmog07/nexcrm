const { test, expect } = require('playwright/test');

test('platform admin navigation flow', async ({ page }) => {
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push(err.message));

  await page.goto('http://127.0.0.1:5174/login');
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
  await page.getByPlaceholder(/you@company.com/i).fill('admin@crm.local');
  await page.getByPlaceholder(/enter your password/i).fill('Password123!');
  await page.getByRole('button', { name: /sign in/i }).click();

  await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
  await page.screenshot({ path: '/tmp/qa-dashboard.png', fullPage: true });

  await page.getByRole('link', { name: /companies\s*&\s*users|team/i }).click();
  await expect(page).toHaveURL(/\/(team|users)$/);
  await expect(page.getByRole('button', { name: /add company|create company/i })).toBeVisible();
  await page.screenshot({ path: '/tmp/qa-users.png', fullPage: true });

  await page.goto('http://127.0.0.1:5174/');
  await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
  await page.getByRole('button', { name: /platform admin admin user/i }).click();
  await expect(page).toHaveURL(/\/users$/);
  await expect(page.getByText(/workspace provisioning|team provisioning/i)).toBeVisible();

  expect(consoleErrors).toEqual([]);
});
