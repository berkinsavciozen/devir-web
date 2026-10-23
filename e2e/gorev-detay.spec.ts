import { expect, test, type Page } from '@playwright/test';

// W2 (el notları 23 Eki N18–N22, K4, K5): her yüzeyde tek görev detayı, sabit bölüm sırası.
const ac = async (p: Page, yol: string, w: number, h: number) => {
  await p.setViewportSize({ width: w, height: h });
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto(yol);
  await p.locator('.gd-bas').waitFor();
};
const SIRA = ['NE YAPILACAK', 'KİM', 'NE ZAMAN', 'ETKİLEYEN VE ETKİLEDİĞİ', 'KARAR'];
const bolumler = (p: Page) => p.locator('.gd > .gd-bolum > .gd-bolum-baslik, .gd > .gd-bolum > summary').allTextContents();

for (const [w, h] of [[390, 844], [1440, 900]] as const) {
  test(`görev detayı · ${w}: bölümler sabit sırada; karar adımında karar bölümü`, async ({ page }) => {
    await ac(page, '/akis/XPVZ/adim/9?senaryo=berkin&hal=karar', w, h);
    const b = (await bolumler(page)).map((x) => x.replace(/ · \d+$/, ''));
    expect(b.filter((x) => SIRA.includes(x))).toEqual(SIRA);
    expect(b[b.length - 1]).toBe('GEÇMİŞ');
    await expect(page.getByRole('region', { name: 'KARAR' }).getByRole('button', { name: 'Kararı ver' })).toBeAttached();
    // geçmiş katlı açılır
    await expect(page.locator('details.gd-gecmis')).not.toHaveAttribute('open', '');
  });
}

test('görev detayı · 390: alt sayfa ekranın en çok %60\'ı; tutamaçla büyümez (N20)', async ({ page }) => {
  await ac(page, '/akis/RTD5/adim/6?senaryo=berkin', 390, 844);
  const s = page.locator('.alt-sayfa');
  const once = (await s.boundingBox())!;
  expect(once.height).toBeLessThanOrEqual(844 * 0.6 + 1);
  const t = (await page.locator('.alt-sayfa-tutamac').boundingBox())!;
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2);
  await page.mouse.down();
  await page.mouse.move(t.x + t.width / 2, 120, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  expect((await s.boundingBox())!.height).toBeLessThanOrEqual(844 * 0.6 + 1);
});

test('görev detayı · 1440: akış panelinde açılır; eski ?tam=1 ve /karar/ aynı detaya düşer (N21, K5)', async ({ page }) => {
  await ac(page, '/akis/RTD5/adim/6?senaryo=berkin&tam=1', 1440, 900);
  await expect(page).not.toHaveURL(/tam=1/);
  await expect(page.locator('.gd-kaydir .gd-bas h2')).toHaveText('Post görseli');
  await expect(page.getByRole('navigation', { name: 'Ana gezinme' })).toBeVisible();
  await page.goto('/akis/XPVZ/karar/9?senaryo=berkin&hal=karar');
  await expect(page).toHaveURL(/\/akis\/XPVZ\/adim\/9\?senaryo=berkin&hal=karar/);
  await expect(page.locator('.gd-kaydir').getByRole('region', { name: 'KARAR' })).toBeAttached();
});

test('görev detayı: başlangıç, bitiş ve ardılı kaç gün kaydırdığı yazar (N22)', async ({ page }) => {
  await ac(page, '/akis/RTD5/adim/6?senaryo=berkin', 390, 844);
  const z = page.getByRole('region', { name: 'NE ZAMAN' });
  await expect(z.getByText('Başlangıç')).toBeAttached();
  await expect(z.getByText('Bitiş')).toBeAttached();
  await expect(page.getByRole('region', { name: 'ETKİLEYEN VE ETKİLEDİĞİ' })).toContainText(/bu görev bitmeden başlayamaz; (her gün gecikme onu bir gün kaydırır|\d+ güne kadar gecikme onu kaydırmaz)/);
});

test('pay tek kaynaktan: galaksi cümlesi ile görev detayı aynı payı söyler (K4)', async ({ page }) => {
  await ac(page, '/akis/RTD5/adim/6?senaryo=berkin', 390, 844);
  const akis = (await page.getByRole('region', { name: 'NE ZAMAN' }).locator('dd').last().textContent())!;
  expect(akis).toMatch(/^hedefe \d+ gün pay$/);
  await page.goto('/akis/RTD5?senaryo=berkin');
  await expect(page.locator('body')).toContainText(akis.replace('hedefe ', ''));
});
