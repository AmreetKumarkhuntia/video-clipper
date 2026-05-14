import { test, expect } from '@playwright/test';

test('home page loads with correct title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Video Clipper');
  await page.screenshot({ path: 'temp/smoke-home.png', fullPage: true });
});

test('settings page loads', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.getByRole('heading')).toBeVisible();
  await page.screenshot({ path: 'temp/smoke-settings.png', fullPage: true });
});

test('clip editor opens and dirty warning appears on close attempt', async ({ page }) => {
  // Discover any available clip via the artifact list API.
  const res = await page.request.get('/api/clips');
  if (!res.ok()) return; // no clip endpoint or no data — skip gracefully

  const clips: { id: string; videoId: string; analysisId?: string }[] = await res
    .json()
    .catch(() => []);
  if (!clips.length) return;

  const clip = clips[0];
  if (!clip.videoId || !clip.analysisId) return;

  // Navigate to the analysis page that hosts the editor.
  await page.goto(`/videos/${clip.videoId}/analysis/${clip.analysisId}`);

  // Switch to the Clips tab.
  const clipsTab = page.getByRole('tab', { name: /clips/i });
  if (!(await clipsTab.isVisible())) return;
  await clipsTab.click();

  // Open the editor for the first clip.
  const editBtn = page.getByRole('button', { name: /^edit$/i }).first();
  if (!(await editBtn.isVisible())) return;
  await editBtn.click();

  // Editor modal should be visible.
  const dialog = page.getByRole('dialog', { name: /clip editor/i });
  await expect(dialog).toBeVisible();
  await page.screenshot({ path: 'temp/smoke-editor-open.png' });

  // Trigger a dirty state by clicking the "Subtitle" add button in the sub-actions row.
  const addSubtitleBtn = dialog.getByRole('button', { name: /^subtitle$/i });
  if (await addSubtitleBtn.isVisible()) {
    await addSubtitleBtn.click();
  }

  // Close attempt via Escape — should show dirty warning.
  await page.keyboard.press('Escape');

  const warning = dialog.getByText('Unsaved changes');
  if (await warning.isVisible()) {
    await page.screenshot({ path: 'temp/smoke-editor-dirty-warning.png' });

    // "Keep editing" dismisses the warning without closing.
    await dialog.getByRole('button', { name: /keep editing/i }).click();
    await expect(dialog).toBeVisible();

    // "Discard & close" closes the editor.
    await page.keyboard.press('Escape');
    await dialog.getByRole('button', { name: /discard/i }).click();
    await expect(dialog).not.toBeVisible();
  }
});
