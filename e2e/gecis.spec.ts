import { expect, test, type Page } from '@playwright/test';

// Geçişler ve cila (PR D): tek geçiş dili (≤ 560 ms), azaltılmış harekette döngü yok, lejant, tanıtım, 404 ve hata dili.
const ac = async (p: Page, yol: string, o: { w?: number; h?: number; azalt?: boolean } = {}) => {
  await p.setViewportSize({ width: o.w ?? 390, height: o.h ?? 844 });
  await p.emulateMedia({ reducedMotion: o.azalt === false ? 'no-preference' : 'reduce' });
  await p.goto(yol);
  await p.evaluate(() => document.fonts.ready);
};
const cek = (p: Page, ad: string) => p.screenshot({ path: `karsilastirma/uygulama/${ad}.png` });
/** sonlu animasyonların en uzun bitişi (ms); döngüler ayrı sayılır */
const animasyonlar = (p: Page) => p.evaluate(() => {
  const L = document.getAnimations().map((a) => a.effect!.getComputedTiming());
  return { enUzun: Math.max(0, ...L.filter((t) => t.iterations !== Infinity).map((t) => Number(t.endTime))), dongu: L.filter((t) => t.iterations === Infinity).length };
});

test('gecis-ileri-geri: sayfa geçişi 280 ms, geri dönüşte ters yön', async ({ page }) => {
  await ac(page, '/?senaryo=berkin', { azalt: false });
  await page.getByRole('navigation', { name: 'Ana gezinme' }).waitFor();
  await page.evaluate(() => { (window as any).__yon = []; new MutationObserver(() => { const g = document.documentElement.dataset.gecis; if (g) (window as any).__yon.push(g); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-gecis'] }); });
  await page.getByRole('navigation', { name: 'Ana gezinme' }).getByRole('button', { name: 'Akışlar' }).click();
  const a = await animasyonlar(page);
  expect(a.enUzun).toBeLessThanOrEqual(560);
  await expect(page).toHaveURL(/\/akislar/);
  await page.waitForTimeout(400);
  await page.goBack();
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => (window as any).__yon)).toEqual(['ileri', 'geri']);
});

test('gecis-z1: evrenden akışa ≤ 560 ms', async ({ page }) => {
  await ac(page, '/?senaryo=berkin', { azalt: false });
  const g = page.getByRole('listitem', { name: /^Hasat postu/ });
  await g.waitFor();
  // süre sayfanın içinde ölçülür (dokunuştan adres değişimine); Playwright'ın tıklama ve adres yoklaması gecikmesi sayılmaz
  await page.evaluate(() => {
    const w = window as any;
    addEventListener('pointerdown', () => { w.__t0 = performance.now(); }, { capture: true, once: true });
    const it = history.pushState.bind(history);
    history.pushState = (...a: Parameters<History['pushState']>) => { it(...a); if (/\/akis\/RTD5$/.test(location.pathname)) w.__t1 ??= performance.now(); };
  });
  await g.click();
  await expect(page).toHaveURL(/\/akis\/RTD5$/);
  const gecen = Math.round(await page.evaluate(() => (window as any).__t1 - (window as any).__t0));
  const a = await animasyonlar(page);
  expect(gecen + a.enUzun, `adres ${gecen} ms + geliş ${a.enUzun} ms`).toBeLessThanOrEqual(560 + 150);
  expect(a.enUzun).toBeLessThanOrEqual(280);
});

test('azalt: harita ve evrende hiçbir döngü dönmez', async ({ page }) => {
  for (const yol of ['/?senaryo=berkin', '/akis/RTD5?senaryo=berkin', '/akis/RTD5/adim/6?senaryo=berkin']) {
    await ac(page, yol, { azalt: true });
    await page.waitForTimeout(500);
    expect((await animasyonlar(page)).dongu, yol).toBe(0);
  }
});

test('ayar-azalt: Görünüm · Azalt sistem tercihi olmadan da döngüleri durdurur', async ({ page }) => {
  await ac(page, '/ayarlar?senaryo=berkin&sekme=gorunum', { azalt: false });
  await page.getByRole('tab', { name: 'Azalt' }).click();
  await page.goto('/akis/RTD5?senaryo=berkin');
  await page.locator('.harita-gezinme .gezegen-hedef').first().waitFor();
  await page.waitForTimeout(500);
  expect((await animasyonlar(page)).dongu).toBe(0);
});

test('B3-lejant: "?" harita dilini açar', async ({ page }) => {
  await ac(page, '/akis/RTD5?senaryo=berkin');
  await page.getByRole('button', { name: 'Harita dili' }).click();
  const L = page.getByRole('list', { name: 'Harita işaretleri' });
  await expect(L.getByRole('listitem')).toHaveCount(14);
  await page.waitForTimeout(150);
  await cek(page, 'B3-lejant');
  await page.keyboard.press('Escape');
  await expect(L).toHaveCount(0);
});

test('A0-tanitim: üç kart, Başla ile kapanır', async ({ page }) => {
  await ac(page, '/?senaryo=berkin&tanitim=1');
  const d = page.getByRole('dialog', { name: 'Her iş bir harita' });
  await d.waitFor();
  await page.waitForTimeout(150);
  await cek(page, 'A0-tanitim');
  await page.getByRole('button', { name: 'İleri' }).click();
  await expect(page.getByRole('heading', { name: 'Kimde, ne zaman' })).toBeVisible();
  await page.getByRole('button', { name: 'İleri' }).click();
  await page.getByRole('button', { name: 'Başla' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('X2-bulunamadi: bilinmeyen adres kullanıcı dilinde; evrene döner', async ({ page }) => {
  await ac(page, '/boyle-bir-yer-yok?senaryo=berkin');
  await expect(page.getByRole('heading', { name: 'Bu sayfa yok' })).toBeVisible();
  await cek(page, 'X2-bulunamadi');
  await page.getByRole('button', { name: 'Evrene dön' }).click();
  await expect(page).toHaveURL(/\/(\?|$)/);
});

test('X3-akis-yok: olmayan akış teknik cümle göstermez', async ({ page }) => {
  await ac(page, '/akis/ZZZZ?senaryo=berkin');
  await expect(page.getByRole('alert')).toContainText('Bu akış bulunamadı');
  await expect(page.getByRole('alert')).not.toContainText('devir_');
  await cek(page, 'X3-akis-yok');
});
