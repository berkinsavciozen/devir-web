import { expect, test, type Page } from '@playwright/test';

// E4 (14 Kas): dış katılımcının bağlantı sayfası ve kapanmış akış haritanın dilinde.
const ac = async (p: Page, yol: string) => {
  await p.setViewportSize({ width: 390, height: 844 });
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto(yol);
  await p.evaluate(() => document.fonts.ready);
};

test('E4: dış bağlantı sayfasında kendi yörüngesi belirgin, diğerleri sisli; kart gezegeni ve düğme aracı haritadan', async ({ page }) => {
  await ac(page, '/l/k7Q2emreTestBank00wP9?senaryo=berkin');
  await page.getByText('Başladım').waitFor();
  const m = page.locator('.mini-yorunge');
  await expect(m).toHaveCount(1);
  // bakanın (dış) aracı iğnede; başka kişinin aracı çizilmez
  expect(await m.locator('path.kabuk').count()).toBe(1);
  expect(await m.locator('path.kabuk[data-tip="dis"]').count()).toBe(1);
  // numaralı gezegenler yalnız kendi işleri; sisli noktalar var
  expect(await m.locator('.gz text.no').count()).toBeGreaterThanOrEqual(2);
  expect(await m.locator('circle[opacity=".3"]').count()).toBeGreaterThanOrEqual(3);
  expect(await page.locator('.ky-simge .gz').count()).toBeGreaterThanOrEqual(4);
});

test('E4: kapanmış akış yörünge diliyle; sürgü geri alınınca bitmemiş işler ileri yanda', async ({ page }) => {
  await ac(page, '/akis/GKX8?senaryo=berkin');
  await page.getByText('Dersleri gör').waitFor();
  const m = page.locator('.mini-yorunge');
  await expect(m).toHaveCount(1);
  const lit = () => m.locator('.gz.g-lit').count();
  const n0 = await lit();
  expect(n0).toBeGreaterThanOrEqual(10);
  const ray = page.getByRole('slider', { name: 'Zaman' });
  const b = (await ray.boundingBox())!;
  await page.mouse.click(b.x + b.width * .05, b.y + b.height / 2);
  await expect.poll(lit).toBeLessThan(n0);
});
