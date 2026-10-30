import { test, expect } from '@playwright/test';
import { SENTENCES } from '../model.js';
import AxeBuilder from '@axe-core/playwright';

const type = async (page, text) => {
  await page.locator('#typing').focus();
  await page.locator('#typing').pressSequentially(text, { delay: 15 });
};
test.beforeEach(async ({ page }) => { await page.goto('/'); });

test('clicking away pauses and resumes without including time away', async ({ page }) => {
  await type(page, SENTENCES[0].slice(0, 8));
  await page.locator('h1').click();
  await expect(page.locator('#live')).toHaveText('Paused');
  await expect(page.locator('#typing')).toBeEditable();
  await page.waitForTimeout(3200);
  await type(page, 'x');
  await page.keyboard.press('Backspace');
  await type(page, SENTENCES[0].slice(8));
  await expect(page.locator('#save')).toBeEnabled();
  await expect(page.locator('#metrics-status')).toContainText('Complete sample measured');
  expect(parseFloat(await page.locator('#interval').textContent())).toBeLessThan(200);
});

test('missing key release on blur is recoverable and completed samples survive blur', async ({ page }) => {
  await type(page, 'the ');
  await page.keyboard.down('r');
  await page.locator('h1').click();
  await page.keyboard.up('r');
  await expect(page.locator('#typing')).toHaveValue('the ');
  await type(page, SENTENCES[0].slice(4));
  await page.locator('#name').fill('Alex');
  await expect(page.locator('#save')).toBeEnabled();
  await page.locator('#save').click();
  await expect(page.locator('#step')).toHaveText('Sentence 2 of 5');
  await expect(page.locator('#typing')).toBeFocused();
});

test('enrollment, persistence, comparison, re-enrollment and deletion', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await expect(page.locator('#verify-tab')).toBeDisabled();
  await page.locator('#name').fill('Alex');
  for (let i = 0; i < SENTENCES.length; i++) {
    expect(await page.evaluate(() => localStorage.getItem('cadence-profile-v3'))).toBeNull();
    await type(page, SENTENCES[i]);
    await expect(page.locator('#save')).toBeEnabled();
    if (i === 4) await expect(page.locator('#save')).toHaveText('Save profile');
    await page.locator('#save').click();
  }
  await expect(page.locator('#verify-tab')).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.locator('#profile')).toContainText('Alex');
  await type(page, SENTENCES[0]);
  await page.locator('#save').click();
  await expect(page.locator('#result')).toBeVisible();
  await expect(page.locator('#save')).toBeDisabled();
  await page.locator('#typing').click();
  await page.keyboard.press('Backspace');
  await expect(page.locator('#typing')).toHaveValue(SENTENCES[0]);
  await page.locator('#restart').click();
  await expect(page.locator('#typing')).toBeEditable();
  await expect(page.locator('#result')).toBeHidden();
  await page.locator('#enroll-tab').click();
  await page.locator('#name').fill('Replacement');
  await type(page, SENTENCES[0]); await page.locator('#save').click();
  await page.locator('#verify-tab').click();
  await expect(page.locator('#profile')).toContainText('Alex');
  await page.locator('#enroll-tab').click();
  await expect(page.locator('#step')).toHaveText('Sentence 2 of 5');
  page.once('dialog', dialog => dialog.dismiss());
  await page.locator('#delete').click();
  await expect(page.locator('#profile')).toContainText('Alex');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#delete').click();
  await expect(page.locator('#verify-tab')).toBeDisabled();
  expect(await page.evaluate(() => localStorage.getItem('cadence-profile-v3'))).toBeNull();
  expect(errors).toEqual([]);
});

test('typos, keyboard navigation, clear-all, paste and missing name', async ({ page }) => {
  await type(page, 'tx');
  await expect(page.locator('#feedback')).toContainText('Backspace');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('ArrowLeft');
  await type(page, 'he');
  await expect(page.locator('#typing')).toHaveValue('the');
  await page.keyboard.press('Control+a'); await page.keyboard.press('Backspace');
  await expect(page.locator('#typing')).toHaveValue('');
  await page.locator('#typing').dispatchEvent('paste');
  await expect(page.locator('#typing')).toBeEditable();
  await type(page, SENTENCES[0]); await page.locator('#save').click();
  await expect(page.locator('#name')).toBeFocused();
  await page.locator('#name').fill('Alex');
  await page.locator('#save').click();
  await expect(page.locator('#step')).toHaveText('Sentence 2 of 5');
  await page.keyboard.press('Tab');
  await expect(page.locator('#restart')).toBeFocused();
});

test('storage failure keeps the fifth sample available for retry', async ({ page }) => {
  await page.locator('#name').fill('Alex');
  for (const sentence of SENTENCES.slice(0, 4)) { await type(page, sentence); await page.locator('#save').click(); }
  await page.evaluate(() => { window.originalSetItem = Storage.prototype.setItem; Storage.prototype.setItem = () => { throw new Error('Storage unavailable'); }; });
  await type(page, SENTENCES[4]); await page.locator('#save').click();
  await expect(page.locator('#feedback')).toContainText('storage is unavailable');
  await expect(page.locator('#save')).toBeEnabled();
  await page.evaluate(() => { Storage.prototype.setItem = window.originalSetItem; });
  await page.locator('#save').click();
  await expect(page.locator('#verify-tab')).toHaveAttribute('aria-pressed', 'true');
});

test('long pauses fail before save and restart restores input', async ({ page }) => {
  await type(page, 'the'); await page.waitForTimeout(3200);
  await type(page, SENTENCES[0].slice(3));
  await expect(page.locator('#save')).toBeDisabled();
  await expect(page.locator('#feedback')).toContainText('long pause');
  await page.locator('#restart').click();
  await type(page, 'the'); await expect(page.locator('#typing')).toHaveValue('the');
});

for (const width of [360, 768, 1280]) {
  test(`layout and metrics table at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({width, height:900});
    await page.locator('.metrics-panel summary').click();
    await expect(page.locator('#metric-rows tr')).toHaveCount(20);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const accessibility = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    expect(accessibility.violations).toEqual([]);
    await page.screenshot({path:`test-results/layout-${testInfo.project.name}-${width}.png`, fullPage:true});
  });
}

test('tab visibility pauses capture and a corrupt profile gives recovery guidance', async ({ page }) => {
  await type(page, 'the ');
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', {value:true, configurable:true}); document.dispatchEvent(new Event('visibilitychange')); });
  await expect(page.locator('#live')).toHaveText('Paused');
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await type(page, SENTENCES[0].slice(4));
  await expect(page.locator('#save')).toBeEnabled();
  await page.evaluate(() => localStorage.setItem('cadence-profile-v3', '{broken'));
  await page.reload();
  await expect(page.locator('#feedback')).toContainText('could not be read');
  await expect(page.locator('#verify-tab')).toBeDisabled();
});

test('server serves only application files', async ({ request }) => {
  for (const path of ['/', '/app.js', '/model.js', '/style.css']) expect((await request.get(path)).status()).toBe(200);
  for (const path of ['/package.json', '/README.md', '/__proto__', '/missing']) expect((await request.get(path)).status()).toBe(404);
});

test('refresh restores completed onboarding and allows a fresh current sentence', async ({ page }) => {
  await page.locator('#name').fill('Draft user');
  for (const sentence of SENTENCES.slice(0, 2)) { await type(page, sentence); await page.locator('#save').click(); }
  await type(page, SENTENCES[2].slice(0, 6));
  await page.reload();
  await expect(page.locator('#name')).toHaveValue('Draft user');
  await expect(page.locator('#step')).toHaveText('Sentence 3 of 5');
  await expect(page.locator('#typing')).toHaveValue('');
  await expect(page.locator('#draft-status')).toContainText('Onboarding restored');
  await expect(page.locator('#verify-tab')).toBeDisabled();
  for (const sentence of SENTENCES.slice(2)) { await type(page, sentence); await page.locator('#save').click(); }
  expect(await page.evaluate(() => sessionStorage.getItem('cadence-onboarding-v3'))).toBeNull();
  await page.reload();
  await expect(page.locator('#verify-tab')).toHaveAttribute('aria-pressed','true');
});

test('onboarding can be discarded and unavailable draft storage does not block typing', async ({ page }) => {
  await page.locator('#name').fill('Draft user');
  await type(page, SENTENCES[0]); await page.locator('#save').click();
  page.once('dialog', dialog => dialog.dismiss()); await page.locator('#discard-draft').click();
  await expect(page.locator('#step')).toHaveText('Sentence 2 of 5');
  page.once('dialog', dialog => dialog.accept()); await page.locator('#discard-draft').click();
  await expect(page.locator('#step')).toHaveText('Sentence 1 of 5');
  await expect(page.locator('#name')).toHaveValue('');
  await page.reload(); await expect(page.locator('#step')).toHaveText('Sentence 1 of 5');
  await page.evaluate(() => { Storage.prototype.setItem = function() { throw new Error('blocked'); }; });
  await page.locator('#name').fill('No draft');
  await expect(page.locator('#draft-status')).toContainText('Draft storage is unavailable');
  await type(page, SENTENCES[0]); await page.locator('#save').click();
  await expect(page.locator('#step')).toHaveText('Sentence 2 of 5');
});

test('corrupt or obsolete drafts cannot overwrite a saved profile', async ({ page }) => {
  await page.evaluate(() => sessionStorage.setItem('cadence-onboarding-v3', JSON.stringify({ version:3, profile:'obsolete', name:'Wrong user', samples:[] })));
  await page.reload(); await expect(page.locator('#name')).toHaveValue('');
  await page.evaluate(() => sessionStorage.setItem('cadence-onboarding-v3', '{invalid'));
  await page.reload(); await expect(page.locator('#typing')).toBeEditable();
});
