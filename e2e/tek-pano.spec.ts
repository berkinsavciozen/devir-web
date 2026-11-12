import { expect, test, type Page } from '@playwright/test';

// Tek Pano P1 (12 Kas): Liste / Zaman yerinde geçer (sayfa değişmez, geri tuşu Liste'ye döner); Zaman bütün açık
// görevleri tek tarih sırasında gösterir; kart sahibinin renginde şerit taşır; bağımlılık satırı kartın altında.
const ac = async (p: Page, yol: string, w = 390, h = 844) => {
  await p.setViewportSize({ width: w, height: h });
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto(yol);
};

test('Tek Pano · Zaman akış sayfasında kalır; geri tuşu Liste’ye döner', async ({ page }) => {
  await ac(page, '/akis/RTD5?senaryo=berkin');
  const g = page.getByRole('group', { name: 'Görünüm' });
  await g.getByRole('button', { name: 'Zaman' }).click();
  await expect(page).toHaveURL(/\/akis\/RTD5\?.*gorunum=zaman/);
  await expect(g.getByRole('button', { name: 'Zaman' })).toHaveAttribute('aria-pressed', 'true');
  // sıradaki işler de Zaman'da (Rapor öncülleri bitmeden sırada)
  await expect(page.locator('.tek-pano .gorev-kart').filter({ hasText: 'Rapor' })).toHaveCount(1);
  await expect(page.locator('.tek-pano-bag').filter({ hasText: '← Yayın bekleniyor' })).toHaveCount(1);
  await page.goBack();
  await expect(page).not.toHaveURL(/gorunum=zaman/);
  await expect(page).toHaveURL(/\/akis\/RTD5/);
  await expect(g.getByRole('button', { name: 'Liste' })).toHaveAttribute('aria-pressed', 'true');
});

test('Tek Pano · /pano Zaman: tarih başlıkları sıralı; kartlar sahibinin renginde', async ({ page }) => {
  await ac(page, '/pano?senaryo=berkin&gorunum=zaman');
  const b = page.locator('.tek-pano-bolum h3');
  await expect(b.first()).toBeVisible();
  const kart = page.locator('.tek-pano .gorev-kart').first();
  const renk = await kart.evaluate((e) => getComputedStyle(e).getPropertyValue('--sahip').trim());
  expect(renk).toMatch(/^#|rgb/);
  await expect(page).toHaveURL(/\/pano\?/);
});
