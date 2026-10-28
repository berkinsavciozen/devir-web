import { expect, test, type Page } from '@playwright/test';

// Q2 (plan 28 Eki): akış bilgi kartı (B1), uydu sarmalına yakınlaşma (B4), seçimde harita yerinde kalır ve kayar (B9),
// merkez ışığı yakınlaşmada büyümez (K6).
const ac = async (p: Page, yol: string, w = 390, h = 844) => {
  await p.setViewportSize({ width: w, height: h });
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto(yol);
  await p.evaluate(() => document.fonts.ready);
  await p.locator('.harita-gezinme .gezegen-hedef').first().waitFor();
};
const cek = (p: Page, ad: string) => p.screenshot({ path: `karsilastirma/uygulama/${ad}.png` });
const kutu = async (p: Page, sec: string) => (await p.locator(sec).first().boundingBox())!;
const kesisir = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

for (const [w, h] of [[360, 740], [375, 667], [390, 844], [1440, 900]] as const) {
  test(`B1 · ${w}: dokununca akış bilgi kartı; alt menüye ve üst düğmelere binmez; ikinci dokunuş akışa girer`, async ({ page }) => {
    await ac(page, '/?senaryo=berkin', w, h);
    const g = page.getByRole('listitem', { name: /^Hasat postu/ });
    await g.click();
    const kart = page.getByRole('region', { name: 'Hasat postu: akış bilgisi' });
    await expect(kart).toBeVisible();
    await expect(kart).toContainText('%');
    await expect(kart).toContainText('Hedef');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const k = (await kart.boundingBox())!;
    expect(k.y + k.height).toBeLessThanOrEqual(h);
    for (const sec of ['.alt-gezinme', '.yuzen-gezinme', '.bolum-ipucu', '.harita-ciplar', '.harita-yakin', '.ust-dugmeler']) {
      const el = page.locator(sec).first();
      if (await el.count() && await el.isVisible()) expect(kesisir(k, (await el.boundingBox())!), sec).toBe(false);
    }
    await cek(page, `Q2-kart-${w}`);
    await g.click();
    await expect(page).toHaveURL(/\/akis\/RTD5/);
  });
}

test('B4 · 1440: alt görevi olan gezegen seçilince harita Z3\'e kayar, uydular dokunulur; uydu seçince harita yerinde', async ({ page }) => {
  await ac(page, '/akis/RTD5?senaryo=berkin&hal=alt', 1440, 900);
  const svg = await page.evaluateHandle(() => document.querySelector('main svg'));
  const once = await kutu(page, '.harita-gezinme [aria-label^="10. adım"]');
  await page.getByRole('listitem', { name: /^10\. adım/ }).click();
  await expect(page).toHaveURL(/\/akis\/RTD5\/adim\/10/);
  const uydu = page.getByRole('listitem', { name: /alt görev \(10\. görevin\)/ });
  await expect(uydu).toHaveCount(3);
  // B9: sayfa geçişi yok, harita aynı düğüm
  expect(await page.evaluate((s) => s === document.querySelector('main svg') && (s as Element).isConnected, svg)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.dataset.gecis)).toBeUndefined();
  const sonra = await kutu(page, '.harita-gezinme [aria-label^="10. adım"]');
  expect(sonra.width).toBeGreaterThanOrEqual(once.width);
  await cek(page, 'Q2-uydu-1440');
  const yer = await kutu(page, '.harita-gezinme [aria-label^="10. adım"]');
  await uydu.first().click();
  await expect(page).toHaveURL(/\/akis\/RTD5\/adim\/1[1-3]/);
  await page.waitForTimeout(300);
  expect(await kutu(page, '.harita-gezinme [aria-label^="10. adım"]')).toEqual(yer);
});

test('B4 · 390: alt görevi olan gezegene ilk dokunuş uydu sarmalına yakınlaşır, sayfa değişmez', async ({ page }) => {
  await ac(page, '/akis/RTD5?senaryo=berkin&hal=alt');
  await page.getByRole('listitem', { name: /^10\. adım/ }).click();
  await expect(page.getByRole('listitem', { name: /alt görev \(10\. görevin\)/ })).toHaveCount(3);
  expect(new URL(page.url()).pathname).toBe('/akis/RTD5');
  for (const e of await page.locator('.harita-gezinme .gezegen-hedef').all()) if (await e.isVisible()) expect((await e.boundingBox())!.width).toBeGreaterThanOrEqual(43.5);
  await cek(page, 'Q2-uydu-390');
  await page.getByRole('listitem', { name: /alt görev \(10\. görevin\)/ }).first().click();
  await expect(page).toHaveURL(/\/akis\/RTD5\/adim\/1[1-3]/);
});

test('B9 · 1440: başka gezegen seçilince harita kayar, yeniden çizilmez', async ({ page }) => {
  await ac(page, '/akis/RTD5/adim/3?senaryo=berkin', 1440, 900);
  const svg = await page.evaluateHandle(() => document.querySelector('main svg'));
  const g = page.getByRole('listitem', { name: /^(?!3\.)\d+\. adım/ }).last();
  const no = (await g.getAttribute('aria-label'))!.match(/^(\d+)\./)![1];
  await g.click();
  await expect(page).toHaveURL(new RegExp(`/akis/RTD5/adim/${no}`));
  await page.waitForTimeout(300);
  const b = (await page.getByRole('listitem', { name: new RegExp(`^${no}\\. adım`) }).boundingBox())!, H = (await kutu(page, '.harita-gezinme'));
  // seçilen gezegen haritanın ortasına yakın
  expect(Math.abs(b.x + b.width / 2 - (H.x + H.width / 2))).toBeLessThan(H.width * .25);
  expect(await page.evaluate((s) => s === document.querySelector('main svg'), svg)).toBe(true);
});

test('K6 · 390: evrende merkeze yakınlaşınca merkez ışığı büyümez', async ({ page }) => {
  await ac(page, '/?senaryo=berkin');
  const m = page.getByRole('listitem', { name: /akış bitti/ });
  const b = (await m.boundingBox())!;
  const r0 = await page.evaluate(() => { const c = [...document.querySelectorAll('main svg circle[r="8"]')].find((e) => e.getAttribute('fill') === '#FFF1DC'); return c ? c.getBoundingClientRect().width : 0; });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  for (let i = 0; i < 16; i++) { await page.mouse.wheel(0, -60); await page.waitForTimeout(16); }
  await page.waitForTimeout(200);
  const r1 = await page.evaluate(() => { const c = [...document.querySelectorAll('main svg circle[r="8"]')].find((e) => e.getAttribute('fill') === '#FFF1DC'); return c ? c.getBoundingClientRect().width : 0; });
  expect(r0).toBeGreaterThan(0);
  expect(r1).toBeLessThanOrEqual(r0 * 1.05);
});
