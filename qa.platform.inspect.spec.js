const { test } = require('playwright/test');

test('inspect login redirect', async ({ page }) => {
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') consoleErrors.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', err => consoleErrors.push(`[pageerror] ${err.message}`));

  await page.goto('http://127.0.0.1:5174/login');
  await page.getByPlaceholder(/you@company.com/i).fill('admin@crm.local');
  await page.getByPlaceholder(/enter your password/i).fill('Password123!');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForTimeout(4000);
  console.log('URL', page.url());
  console.log('TEXT', (await page.locator('body').innerText()).slice(0, 3000));
  console.log('ERRORS', JSON.stringify(consoleErrors, null, 2));
  await page.screenshot({ path: '/tmp/qa-post-login-inspect.png', fullPage: true });
});
