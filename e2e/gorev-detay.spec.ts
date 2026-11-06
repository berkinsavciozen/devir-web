import { expect, test, type Page } from '@playwright/test';

// W2 (el notları 23 Eki N18–N22, K4, K5): her yüzeyde tek görev detayı, sabit bölüm sırası.
const ac = async (p: Page, yol: string, w: number, h: number) => {
  await p.setViewportSize({ width: w, height: h });
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto(yol);
  await p.locator('.gd-bas').waitFor();
};
// W5 ikinci tur (Berkin 20:26): başlık kartı · eylem · (karar) · NE YAPILACAK · NEDEN · NE ZAMAN · çıktı … · geçmiş
const SIRA = ['KARAR', 'NE YAPILACAK', 'NEDEN', 'NE ZAMAN'];
const bolumler = (p: Page) => p.locator('.gd > section, .gd > details').evaluateAll((L) => L.map((e) => (e.getAttribute('aria-label') || e.querySelector('summary')?.textContent || '').replace(/ · .*$/, '')));

for (const [w, h] of [[390, 844], [1440, 900]] as const) {
  test(`görev detayı · ${w}: bölümler sabit sırada; karar adımında karar bölümü`, async ({ page }) => {
    await ac(page, '/akis/XPVZ/adim/9?senaryo=berkin&hal=karar', w, h);
    const b = await bolumler(page);
    expect(b.filter((x) => SIRA.includes(x))).toEqual(SIRA);
    expect(b[b.length - 1]).toBe('GEÇMİŞ');
    await expect(page.getByRole('region', { name: 'KARAR' }).getByRole('button', { name: 'Kararı ver' })).toBeAttached();
    // geçmiş katlı açılır
    await expect(page.locator('details.gd-gecmis')).not.toHaveAttribute('open', '');
  });
}

test('görev detayı · 390: alt sayfa ilk açılışta başlık kartı ve eylemler görünür; tutamaçla büyür (W5)', async ({ page }) => {
  await ac(page, '/akis/RTD5/adim/6?senaryo=berkin', 390, 844);
  const s = page.locator('.alt-sayfa');
  const once = (await s.boundingBox())!;
  expect(once.height).toBeLessThanOrEqual(844 - 290 + 1);
  // önceki/sonraki zinciri eklenince başlık kartı uzadı: ilk görünümde ana eylem görünür
  const m = (await page.getByRole('group', { name: 'Eylemler' }).getByRole('button').first().boundingBox())!;
  expect(m.y + m.height).toBeLessThan(844);
  const t = (await page.locator('.alt-sayfa-tutamac').boundingBox())!;
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2);
  await page.mouse.down();
  await page.mouse.move(t.x + t.width / 2, 100, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  expect((await s.boundingBox())!.height).toBeGreaterThan(once.height + 100);
});

test('görev detayı · 1440: akış panelinde açılır; eski ?tam=1 ve /karar/ aynı detaya düşer (N21, K5)', async ({ page }) => {
  await ac(page, '/akis/RTD5/adim/6?senaryo=berkin&tam=1', 1440, 900);
  await expect(page).not.toHaveURL(/tam=1/);
  await expect(page.locator('.gd-kaydir .gd-bas h2')).toHaveText('Post görselini/carousel\'i tasarla');
  await expect(page.getByRole('navigation', { name: 'Ana gezinme' })).toBeVisible();
  await page.goto('/akis/XPVZ/karar/9?senaryo=berkin&hal=karar');
  await expect(page).toHaveURL(/\/akis\/XPVZ\/adim\/9\?senaryo=berkin&hal=karar/);
  await expect(page.locator('.gd-kaydir').getByRole('region', { name: 'KARAR' })).toBeAttached();
});

test('görev detayı: zaman çizgisi başlangıç ve bitişi, bekleyenler kaç gün kaydırdığını yazar (N22)', async ({ page }) => {
  await ac(page, '/akis/RTD5/adim/6?senaryo=berkin', 390, 844);
  const z = page.getByRole('region', { name: 'NE ZAMAN' });
  await expect(z).toContainText('başladı');
  await expect(z).toContainText(/En erken bitiş|Son tarih/);
  await expect(page.getByRole('region', { name: 'NEDEN' })).toContainText(/(her gün gecikmesi onu bir gün kaydırır|\d+ güne kadar gecikirse onu kaydırmaz)/);
});

test('pay tek kaynaktan: galaksi cümlesi ile görev detayı aynı payı söyler (K4)', async ({ page }) => {
  await ac(page, '/akis/RTD5/adim/6?senaryo=berkin', 390, 844);
  const satir = (await page.getByRole('region', { name: 'NE ZAMAN' }).locator('.gd-satirlar').textContent())!;
  const akis = satir.match(/hedefe \d+ gün pay/)![0];
  await page.goto('/akis/RTD5?senaryo=berkin');
  await expect(page.locator('body')).toContainText(akis.replace('hedefe ', ''));
});
