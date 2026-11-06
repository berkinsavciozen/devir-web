import { expect, test, type Page } from '@playwright/test';

// Bildirimler (el notu 18): zil, sekmeler, gün grupları, toplu satır, okundu işareti, süzgeç adreste.
const ac = async (p: Page, yol: string, w = 390, h = 844) => {
  await p.setViewportSize({ width: w, height: h });
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto(yol);
  await p.evaluate(() => document.fonts.ready);
};
const cek = (p: Page, ad: string) => p.screenshot({ path: `karsilastirma/uygulama/${ad}.png` });

test('N2-zil → W6 Pano: Evren’deki Pano düğmesi yeni değişiklikleri sayar, Pano açılınca söner', async ({ page }) => {
  await ac(page, '/?senaryo=berkin');
  const zil = page.getByRole('button', { name: /^Pano: \d+ yeni değişiklik/ });
  await expect(zil).toBeVisible();
  const r = await zil.boundingBox();
  expect(Math.min(r!.width, r!.height)).toBeGreaterThanOrEqual(44);
  await zil.click();
  await expect(page).toHaveURL(/\/pano/);
  for (const b of ['SENDEN BEKLENEN', 'RİSKTE', 'SON DEĞİŞİKLİKLER', 'YAKINDA']) await expect(page.getByRole('region', { name: b })).toBeVisible();
  // bu açılışın yenileri işaretli kalır
  await expect(page.getByRole('region', { name: 'SON DEĞİŞİKLİKLER' }).getByLabel('Yeni').first()).toBeVisible();
  await expect(page.getByRole('region', { name: 'SON DEĞİŞİKLİKLER' })).toContainText('Selin çıktı ekledi');
  await page.waitForTimeout(300);
  await cek(page, 'W6-pano');
  await page.goBack();
  await expect(page.getByRole('button', { name: 'Pano', exact: true })).toBeVisible();
});

test('N2-tum: Tüm etkinlik güne göre; art arda olaylar tek satır, satır adıma gider', async ({ page }) => {
  await ac(page, '/bildirimler?sekme=tum&senaryo=berkin');
  await expect(page.getByRole('heading', { name: 'BUGÜN' })).toBeVisible();
  const L = page.getByRole('list', { name: 'Bildirimler' });
  const ilk = L.getByRole('listitem').first();
  await expect(ilk).toContainText('Selin çıktı ekledi');
  await expect(ilk).toContainText('2 hareket');
  await expect(L.getByText(/adımın sırası geldi/).first()).toBeVisible();
  await page.waitForTimeout(300);
  await cek(page, 'N2-bildirimler-tum');
  await ilk.getByRole('button').click();
  await expect(page).toHaveURL(/\/akis\/U422\/adim\/15/);
});

test('N2-suzgec: kişi süzgeci adrese yazılır', async ({ page }) => {
  await ac(page, '/bildirimler?sekme=tum&senaryo=berkin');
  await page.getByRole('button', { name: /^Kişi: Herkes/ }).click();
  await page.getByRole('dialog').getByText('Emre', { exact: true }).click();
  await expect(page).toHaveURL(/kisi=Emre/);
  await expect(page.getByRole('list', { name: 'Bildirimler' }).getByRole('listitem')).toHaveCount(1);
});
