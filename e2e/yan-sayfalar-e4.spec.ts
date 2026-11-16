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

test('E5: kalem listesinde arka haritanın küçüğü; kalemli iş öne çıkar, kalemler durum renginde uydu', async ({ page }) => {
  await ac(page, '/akis/XPVZ/tekrar/7?senaryo=berkin&hal=uydu');
  await page.getByText('Hemşin Koop').waitFor();
  await expect(page.locator('.mini-yorunge')).toHaveCount(1);
  const u = page.locator('.kalem-uydulari');
  await expect(u).toHaveCount(1);
  // beş kalem: ikisi tamam (yeşil), biri engelli (kırmızı)
  expect(await u.locator('circle[fill="#6EE39A"]').count()).toBe(2);
  expect(await u.locator('circle[fill="#FF5A5A"][stroke]').count()).toBe(1);
  // satırdaki aşama izi de aynı renklerde
  expect(await page.locator('.kalem-iz circle[fill="#FF5A5A"]').count()).toBeGreaterThanOrEqual(1);
});

test('E5: açık soru sayfasında dallar haritanın küçüğünde yan yana ikiz, seçili kol bekleyen', async ({ page }) => {
  await ac(page, '/akis/XPVZ/soru/fatura?senaryo=berkin&hal=dal');
  await page.getByText('Henüz bilmiyorum').waitFor();
  await expect(page.locator('.mini-yorunge')).toHaveCount(1);
  // iki kol ikizi haritanın gezegeniyle; biri seçili (bekleyen)
  const ikiz = page.locator('svg .ky-simge .gz:not(.mini-yorunge *)');
  await expect(ikiz).toHaveCount(2);
  await expect(page.locator('svg .ky-simge .gz.g-wait:not(.mini-yorunge *)')).toHaveCount(1);
});
