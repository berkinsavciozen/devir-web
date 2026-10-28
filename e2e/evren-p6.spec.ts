import { expect, test, type Page } from '@playwright/test';

// P6 (plan 27 Eki, Epic 3 I grubu): merkez = bitti, akış süzgeci (en riskli 10), Akışlar ızgarası yakınlaşmasız.
const ac = async (p: Page, yol: string, w = 390, h = 844) => {
  await p.setViewportSize({ width: w, height: h });
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto(yol);
  await p.evaluate(() => document.fonts.ready);
  await p.locator('.harita-gezinme .gezegen-hedef').first().waitFor();
};
const cek = (p: Page, ad: string) => p.screenshot({ path: `karsilastirma/uygulama/${ad}.png` });

test('3.J: 10\'dan çok akışta ilk açılış en riskli 10, usturlap; Hepsi seçilince kalabalık düzen', async ({ page }) => {
  await ac(page, '/?senaryo=berkin&hal=olcek');
  const hap = page.getByRole('button', { name: /^Haritada 10 \/ \d+ akış/ });
  await expect(hap).toBeVisible();
  await cek(page, 'P6-suzgec');
  await hap.click();
  const sayfa = page.getByRole('dialog', { name: 'Haritadaki akışlar' });
  await expect(sayfa.getByRole('list', { name: 'Akışlar' }).getByRole('button', { pressed: true })).toHaveCount(10);
  await sayfa.getByRole('button', { name: 'Hepsi' }).click();
  // seçim Uygula ile geçer (plan 28 Eki, Q1)
  await sayfa.getByRole('button', { name: 'Uygula' }).click();
  await expect(page.getByRole('button', { name: /^Haritada (\d+) \/ \1 akış/ })).toBeVisible();
});

test('3.I: merkez = bitti; kapanan akış halkada değil, merkeze dokununca arşiv', async ({ page }) => {
  await ac(page, '/?senaryo=berkin');
  const merkez = page.getByRole('listitem', { name: /akış bitti\. Biten akışları aç\./ });
  await expect(merkez).toHaveCount(1);
  await expect(page.getByRole('listitem', { name: /Kapandı\./ })).toHaveCount(0);
  await merkez.click();
  await expect(page).toHaveURL(/\/akislar\/arsiv/);
});

test('3.31: Akışlar haritası ızgara, yakınlaşma yok', async ({ page }) => {
  await ac(page, '/akislar?senaryo=berkin&hal=olcek', 1440, 900);
  await expect(page.getByRole('button', { name: 'Yakınlaştır' })).toHaveCount(0);
  const g = page.locator('.harita-gezinme').first(), b = (await g.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  const once = await page.locator('.harita-gezinme .gezegen-hedef').first().boundingBox();
  for (let i = 0; i < 5; i++) await page.mouse.wheel(0, -120);
  await page.waitForTimeout(200);
  expect(await page.locator('.harita-gezinme .gezegen-hedef').first().boundingBox()).toEqual(once);
  await cek(page, 'P6-akislar');
});
