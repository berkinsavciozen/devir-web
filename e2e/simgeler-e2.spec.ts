import { expect, test, type Page } from '@playwright/test';

// E2 (14 Kas): harita dışındaki kalan simgeler haritanın araç ve gezegeniyle çizilir.
const ac = async (p: Page, yol: string, w = 390, h = 844) => {
  await p.setViewportSize({ width: w, height: h });
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto(yol);
  await p.evaluate(() => document.fonts.ready);
};

test('E2: Görevler zaman haritasında gezegenler numaralı; ekip üyesi dış katılımcı diski olarak çizilmez', async ({ page }) => {
  await ac(page, '/gorevler?senaryo=berkin&tanitim=0&kisi=hepsi', 1440, 900);
  const sol = page.locator('.ky-simge').first();
  await expect(sol).toBeAttached({ timeout: 15000 });
  // gezegenler haritadaki çizim: numara yazısı var
  expect(await page.locator('.ky-simge .gz text.no').count()).toBeGreaterThanOrEqual(8);
  // yalnız gerçekten dış olan iki kişi disk (Emre, Mali müşavir); Berkin bir akışta dış olsa da roket
  expect(await page.locator('.ky-simge path.kabuk[data-tip="dis"]').count()).toBe(2);
  expect(await page.locator('.ky-simge path.kabuk[data-tip="insan"]').count()).toBeGreaterThanOrEqual(3);
});

test('E2: Akışlar boncukları beş durum renginde', async ({ page }) => {
  await ac(page, '/akislar?senaryo=berkin&tanitim=0');
  await expect(page.locator('.mini-yorunge').first()).toBeAttached({ timeout: 15000 });
  const renkler = await page.locator('svg circle').evaluateAll((c) => [...new Set(c.map((x) => (x.getAttribute('fill') || '').toUpperCase()))]);
  for (const r of ['#6EE39A', '#FFB547']) expect(renkler).toContain(r);
  expect(renkler).not.toContain('#7BF0A0');
});

test('E2: Bildirimler tür süzgeci ve Ayarlar satırları haritanın simgeleriyle', async ({ page }) => {
  await ac(page, '/bildirimler?senaryo=berkin&tanitim=0');
  await page.getByRole('button', { name: /tür/i }).first().click();
  await expect(page.locator('.ky-simge .gz').first()).toBeVisible();
  await ac(page, '/ayarlar?senaryo=berkin&tanitim=0');
  await expect(page.getByText('Üyeler ve davetler')).toBeVisible();
  expect(await page.locator('.ky-simge').count()).toBeGreaterThanOrEqual(3);
});

test('E2: Tüm harita dili yörünge haritasının işaretlerini gösterir', async ({ page }) => {
  await ac(page, '/ayarlar?senaryo=berkin&tanitim=0');
  await page.getByRole('button', { name: /harita dili/i }).first().click();
  const dil = page.getByRole('heading', { name: 'Tüm harita dili' });
  await expect(dil).toBeVisible();
  for (const ad of ['Takıldı', 'Sırası geldi', 'Son tarih (söz)', 'Ortak görev']) await expect(page.getByText(ad, { exact: true }).first()).toBeAttached();
  expect(await page.locator('.lejant .ky-simge .gz').count()).toBeGreaterThanOrEqual(6);
});
