import { expect, test, type Page } from '@playwright/test';

// P2 (plan 27 Eki, Epic 2): ortak harita çerçevesi, haritada sayfa kaymaz, yatay taşma yok, görev yol izi, "?" altında odak.
const ac = async (p: Page, yol: string, w = 390, h = 844) => {
  await p.setViewportSize({ width: w, height: h });
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto(yol);
  await p.evaluate(() => document.fonts.ready);
};
const cek = (p: Page, ad: string) => p.screenshot({ path: `karsilastirma/uygulama/${ad}.png` });

test('2.A: haritalarda dokunuş sayfayı kaydırmaz (touch-action: none)', async ({ page }) => {
  for (const yol of ['/?senaryo=berkin', '/akis/RTD5?senaryo=berkin']) {
    await ac(page, yol);
    const g = page.locator('.harita-gezinme').first();
    await g.waitFor();
    expect(await g.evaluate((e) => getComputedStyle(e).touchAction), yol).toBe('none');
  }
});

// gerçek telefon gibi (isMobile: viewport meta uygulanır; 390'dan dar ekranda sayfa 390'a ölçeklenir)
test.describe('telefon', () => {
  test.use({ isMobile: true, hasTouch: true });
  test('Epic 2: telefonda (360) yatay taşma yok', async ({ page }) => {
  for (const yol of ['/?senaryo=berkin', '/akislar?senaryo=berkin', '/gorevler?senaryo=berkin', '/akis/RTD5?senaryo=berkin', '/akis/RTD5/adim/6?senaryo=berkin', '/ayarlar?senaryo=berkin']) {
    await ac(page, yol, 360, 780);
    await page.waitForTimeout(300);
    const [sw, iw] = await page.evaluate(() => [document.scrollingElement!.scrollWidth, window.innerWidth]);
    expect(sw, yol).toBeLessThanOrEqual(iw);
  }
  });
});

test.describe('dokunmatik', () => {
  test.use({ hasTouch: true });
  test('2.1: yakınlaşınca harita ortak çerçeveyle (yumuşak kenar maskesi) kırpılır', async ({ page }) => {
    await ac(page, '/akis/RTD5?senaryo=berkin');
    await page.locator('.harita-gezinme .gezegen-hedef').first().waitFor();
    await page.mouse.move(195, 400);
    for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, -60); await page.waitForTimeout(16); }
    await expect(page.locator('svg mask#harita-kirp')).toHaveCount(1);
  });
});

test('2.7: görev sayfasında yol izi Akış › Üst görev › Alt görev; tam adlar, dokununca gider', async ({ page }) => {
  await ac(page, '/akis/RTD5/adim/12?senaryo=berkin&hal=alt');
  const yol = page.getByRole('navigation', { name: 'Konum' });
  await expect(yol.getByRole('button', { name: /^Akış: / })).toBeVisible();
  await expect(yol.getByRole('button', { name: /^Üst görev: 10\./ })).toBeVisible();
  await expect(yol.locator('[aria-current=page]')).toContainText('Instagram içgörüleri');
  await cek(page, 'P2-yol-izi');
  await yol.getByRole('button', { name: /^Akış: / }).click();
  await expect(page).toHaveURL(/\/akis\/RTD5(\?|$)/);
});

test('2.C: galaksi "?" → durum odağı; uymayan gezegenler söner, hap ile kalkar', async ({ page }) => {
  await ac(page, '/akis/RTD5?senaryo=berkin');
  await page.getByRole('button', { name: 'Harita dili' }).click();
  const durum = page.getByRole('group', { name: 'Durum' });
  await durum.getByRole('button', { name: /^Engelli/ }).click();
  const hap = page.getByRole('button', { name: /^Odak: Engelli/ });
  await expect(hap).toBeVisible();
  await cek(page, 'P2-odak-galaksi');
  await hap.click();
  await expect(hap).toHaveCount(0);
  // kişi odağı: "?" → kişi
  await page.getByRole('button', { name: 'Harita dili' }).click();
  await page.getByRole('group', { name: 'Kişi' }).getByRole('button', { name: 'Berkin', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Odak: Berkin/ })).toBeVisible();
});

test('2.C: evren "?" → kişi odağı; o kişinin işi olmayan akışlar söner', async ({ page }) => {
  await ac(page, '/?senaryo=berkin');
  await page.getByRole('button', { name: 'Evren dili' }).click();
  const kisi = page.getByRole('group', { name: 'Kişi' });
  await expect(kisi.getByRole('button', { name: 'Herkes' })).toHaveAttribute('aria-pressed', 'true');
  await kisi.getByRole('button').nth(1).click();
  const hap = page.getByRole('button', { name: /^Süzgeç: / });
  await expect(hap).toBeVisible();
  await cek(page, 'P2-odak-evren');
  await hap.click();
  await expect(hap).toHaveCount(0);
});
