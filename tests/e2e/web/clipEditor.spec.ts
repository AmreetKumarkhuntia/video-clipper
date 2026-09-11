import { expect, test } from '@playwright/test';

const WEB_ORIGIN = 'http://127.0.0.1:5012';

test.describe('authenticated web workflow', () => {
  test.beforeEach(async ({ context }): Promise<void> => {
    await context.addCookies([
      {
        name: 'vc_session',
        value: 'e2e-session',
        url: WEB_ORIGIN,
      },
    ]);
  });

  test('renders the seeded library', async ({ page }): Promise<void> => {
    const response = await page.goto('/');

    expect(response?.ok()).toBe(true);
    await expect(page).toHaveTitle('My videos · Video Clipper');
    await expect(page.getByRole('heading', { name: 'No videos yet' })).toBeVisible();
  });

  test('renders settings returned by the backend', async ({ page }): Promise<void> => {
    const response = await page.goto('/settings');

    expect(response?.ok()).toBe(true);
    await expect(page).toHaveTitle('Settings — Video Clipper Workbench');
    await expect(page.getByRole('heading', { name: 'Segment Selection' })).toBeVisible();
    await expect(page.getByLabel('Score Threshold')).toHaveValue('7');
  });

  test('warns before discarding dirty clip edits', async ({ page }): Promise<void> => {
    const response = await page.goto('/videos/video-e2e/analysis/analysis-e2e');

    expect(response?.ok()).toBe(true);
    await expect(page.getByRole('heading', { name: 'Fixture clip plan' })).toBeVisible();
    await expect(page.getByText('fixture-clip.mp4')).toBeVisible();

    await page.getByRole('button', { name: 'Edit', exact: true }).click();

    const editor = page.getByRole('dialog', { name: 'Clip Editor' });
    await expect(editor).toBeVisible();
    await expect(editor.getByText('Loading…')).not.toBeVisible();
    await editor.getByRole('button', { name: 'Subtitle', exact: true }).click();

    await page.keyboard.press('Escape');
    await expect(editor.getByText('Unsaved changes')).toBeVisible();

    await editor.getByRole('button', { name: 'Keep editing' }).click();
    await expect(editor).toBeVisible();
    await expect(editor.getByText('Unsaved changes')).not.toBeVisible();

    await page.keyboard.press('Escape');
    await editor.getByRole('button', { name: 'Discard & close' }).click();
    await expect(editor).not.toBeVisible();
  });
});
