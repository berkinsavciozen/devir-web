import { expect, test, type Page } from '@playwright/test';

// Q1 (plan 28 Eki): üst üste sayfa yok. Masaüstünde seçimler ortada açılır kutu (Uygula/Vazgeç), AI panelin içeriği;
// haritada üç nokta yerine Kişiler süzgeci ve seçili süzgeç çipleri.
const ac = async (p: Page, yol: string, w = 390, h = 844) => {
  await p.setViewportSize({ width: w, height: h });
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto(yol);
  await p.evaluate(() => document.fonts.ready);
};
const cek = (p: Page, ad: string) => p.screenshot({ path: `karsilastirma/uygulama/${ad}.png` });

test('Q1 · 1440: Kişiler ortada açılır kutu; tek pencere, ikinci sağ panel yok; Uygula çip bırakır', async ({ page }) => {
  await ac(page, '/akis/RTD5?senaryo=berkin', 1440, 900);
  await expect(page.getByRole('button', { name: 'Akış menüsü' })).toHaveCount(0);
  await page.getByRole('button', { name: /^Kişiler/ }).click();
  const kutu = page.getByRole('dialog', { name: 'Kişiler' });
  await expect(kutu).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  const b = (await kutu.boundingBox())!;
  // ortada: sağ kenara yapışık panel değil
  expect(Math.abs(b.x + b.width / 2 - 720)).toBeLessThan(4);
  await page.waitForTimeout(250);
  await cek(page, 'Q1-kisiler-1440');
  await kutu.getByRole('radio', { name: /^Berkin/ }).click();
  await kutu.getByRole('button', { name: 'Vazgeç' }).click();
  await expect(page.getByRole('button', { name: /^Kişi: / })).toHaveCount(0);
  await page.getByRole('button', { name: /^Kişiler/ }).click();
  await kutu.getByRole('radio', { name: /^Berkin/ }).click();
  await kutu.getByRole('button', { name: 'Uygula' }).click();
  const cip = page.getByRole('button', { name: /^Kişi: Berkin/ });
  await expect(cip).toBeVisible();
  await cip.click();
  await expect(cip).toHaveCount(0);
});

test('Q1 · 1440: harita dili açılır kutu; AI açıkken ikinci pencere yok', async ({ page }) => {
  await ac(page, '/akis/RTD5?senaryo=berkin', 1440, 900);
  await page.getByRole('button', { name: 'Harita dili' }).click();
  const L = page.getByRole('dialog', { name: 'Harita dili' });
  await expect(L.getByRole('button', { name: 'Uygula' })).toBeVisible();
  await L.getByRole('button', { name: 'Kapat' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.locator('.panel-ust').getByRole('button', { name: 'Devir AI' }).click();
  await expect(page.getByRole('region', { name: 'Devir AI' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('Q1 · 390: süzgeç satırı haritanın üstünde; hedefler 44 px', async ({ page }) => {
  await ac(page, '/akis/RTD5?senaryo=berkin');
  const satir = page.getByRole('toolbar', { name: 'Harita süzgeçleri' });
  await expect(satir).toBeVisible();
  for (const e of await satir.getByRole('button').all()) expect((await e.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await cek(page, 'Q1-cipler-390');
});

test('Q1 · evren: akış seçimi Uygula ile geçer, Vazgeç bırakır', async ({ page }) => {
  await ac(page, '/?senaryo=berkin&hal=olcek', 1440, 900);
  const hap = page.getByRole('button', { name: /^Haritada 10 \/ \d+ akış/ });
  await hap.click();
  const kutu = page.getByRole('dialog', { name: 'Haritadaki akışlar' });
  await kutu.getByRole('button', { name: 'Hepsi' }).click();
  await kutu.getByRole('button', { name: 'Vazgeç' }).click();
  await expect(hap).toBeVisible();
  await cek(page, 'Q1-evren-1440');
});

test('K1: kendi görevinde "sen" yazar; K3: masaüstü ayarlarda tek geri', async ({ page }) => {
  await ac(page, '/akis/RTD5/adim/3?senaryo=berkin');
  await expect(page.locator('.gd-bas, body').getByText(/^sen(\s·|$)/).first()).toBeVisible();
  await ac(page, '/ayarlar?senaryo=berkin', 1440, 900);
  await expect(page.locator('.baslik .geri')).toHaveCount(0);
  await expect(page.locator('.panel-ust').getByRole('button', { name: /^Geri/ })).toHaveCount(1);
});
