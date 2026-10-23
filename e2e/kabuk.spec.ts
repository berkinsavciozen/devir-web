import { expect, test, type Page } from '@playwright/test';

// W1 (el notları 23 Eki, N9 · N13–N15 · K1 · K12): masaüstü kabuğu ve 360 telefonda sığma.
const ac = async (p: Page, yol: string, w: number, h: number) => {
  await p.setViewportSize({ width: w, height: h });
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto(yol);
  await p.evaluate(() => document.fonts.ready);
};

for (const [w, h] of [[1024, 768], [1440, 900]] as const) {
  for (const [ad, yol, sekme] of [['Evren', '/?senaryo=berkin', 'Evren'], ['Akışlar', '/akislar?senaryo=berkin', 'Akışlar'], ['Görevler', '/gorevler?senaryo=berkin', 'Görevler'], ['Bildirimler', '/bildirimler?senaryo=berkin', null]] as const) {
    test(`kabuk · ${ad} · ${w}: solda harita, sağda panel, yüzen gezinme; alt çubuk yok`, async ({ page }) => {
      await ac(page, yol, w, h);
      const nav = page.getByRole('navigation', { name: 'Ana gezinme' });
      await expect(nav).toBeInViewport({ ratio: 1 });
      await expect(page.locator('.alt-gezinme')).toHaveCount(0);
      if (sekme) await expect(nav.getByRole('button', { name: sekme })).toHaveAttribute('aria-current', 'page');
      // yüzen gezinme sol bölmede, panelin üstüne binmez
      const n = (await nav.boundingBox())!;
      expect(n.x + n.width).toBeLessThanOrEqual(w - 440);
      await expect(page.getByRole('button', { name: 'Ayarlar' }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: 'Yeni iş' }).first()).toBeVisible();
    });
  }
}

test('kabuk: paneldeki geri bir önceki yere döner (N9)', async ({ page }) => {
  await ac(page, '/akis/RTD5/adim/6?senaryo=berkin', 1440, 900);
  await page.getByRole('button', { name: /^Geri: .*›/ }).click();
  await expect(page).toHaveURL(/\/akis\/RTD5(\?|$)/);
  await ac(page, '/bildirimler?senaryo=berkin', 1440, 900);
  await page.getByRole('button', { name: 'Geri: Bildirimler' }).click();
  await expect(page).toHaveURL(/localhost:\d+\/(\?|$)/);
});

test('kabuk: Akışlar satırının üzerine gelince haritadaki diğer galaksiler söner (N15)', async ({ page }) => {
  await ac(page, '/akislar?senaryo=berkin', 1440, 900);
  const satir = page.locator('.akis-satir').first();
  await satir.hover();
  await expect(satir).toHaveClass(/vurgulu/);
  await page.mouse.move(10, 10);
  await expect(satir).not.toHaveClass(/vurgulu/);
});

test('kabuk: ölçekte (>10 akış) masaüstü düzeni korunur (K12)', async ({ page }) => {
  await ac(page, '/?senaryo=berkin&hal=olcek', 1440, 900);
  await expect(page.getByRole('navigation', { name: 'Ana gezinme' })).toBeVisible();
  await expect(page.locator('.alt-gezinme')).toHaveCount(0);
});

test.describe('360 telefon (K1)', () => {
  test.use({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true });
  for (const yol of ['/?senaryo=berkin', '/akislar?senaryo=berkin', '/gorevler?senaryo=berkin', '/akis/RTD5?senaryo=berkin', '/akis/RTD5/adim/6?senaryo=berkin', '/akis/XPVZ?senaryo=berkin&hal=uydu', '/ayarlar?senaryo=berkin']) {
    test(`${yol}: yatay taşma yok`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(yol);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(400);
      const tasan = await page.evaluate(() => {
        const W = document.documentElement.clientWidth;
        return [...document.querySelectorAll('button,a,h1,h2,p,li')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.right > W + 1 && b.left < W; }).map((e) => (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 30));
      });
      expect(tasan).toEqual([]);
    });
  }
});
