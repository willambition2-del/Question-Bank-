import { test, expect } from '@playwright/test';

test.describe('Admin Dashboard E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login and authenticate as SUPER_ADMIN
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="email"]', 'admin@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('http://localhost:3000/');
  });

  test('Dashboard loads critical metrics', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('نظرة عامة على النظام');
    // Ensure metrics cards are visible
    await expect(page.locator('text=إجمالي المستخدمين')).toBeVisible();
    await expect(page.locator('text=الأسئلة المعتمدة')).toBeVisible();
  });

  test('Sidebar navigation works', async ({ page }) => {
    // Navigate to Questions
    await page.click('text=إدارة المحتوى');
    await page.click('a[href="/questions"]');
    await expect(page).toHaveURL('http://localhost:3000/questions');
    await expect(page.locator('h1')).toContainText('بنك الأسئلة');

    // Navigate to Users
    await page.click('text=الإدارة والمستخدمين');
    await page.click('a[href="/users"]');
    await expect(page).toHaveURL('http://localhost:3000/users');
    await expect(page.locator('h1')).toContainText('إدارة المستخدمين');
  });

  test('AI Setup loads readiness', async ({ page }) => {
    await page.click('text=الذكاء الاصطناعي');
    await page.click('a[href="/intelligent-services/setup"]');
    await expect(page).toHaveURL('http://localhost:3000/intelligent-services/setup');
    await expect(page.locator('text=إعداد منصة الخدمات الذكية')).toBeVisible();
  });
});
