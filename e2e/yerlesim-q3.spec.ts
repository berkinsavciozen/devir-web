import { expect, test, type Page } from '@playwright/test';

// Q3 (plan 28 Eki, B3, B7, B8, K5): yerleşim ekranın gerçek boyuna göre. Telefonda zaman sürgüsü ve "Adımlar" ipucu ilk
// ekranda; Akışlar ızgarasında galaksi ≥ 72 px, adı galaksiden dar.
const ac = async (p: Page, yol: string, w: number, h: number) => {
  await p.setViewportSize({ width: w, height: h });
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto(yol);
  await p.evaluate(() => document.fonts.ready);
};
const cek = (p: Page, ad: string) => p.screenshot({ path: `karsilastirma/uygulama/${ad}.png` });

for (const [w, h] of [[375, 667], [390, 844], [1280, 720], [1440, 900]] as const) {
  test(`Q3 · ${w}×${h}: zaman sürgüsü ilk ekranda`, async ({ page }) => {
    await ac(page, '/akis/RTD5?senaryo=berkin', w, h);
    const s = (await page.getByRole('slider', { name: 'Zaman' }).boundingBox())!;
    expect(s.y + s.height).toBeLessThanOrEqual(h);
    if (w < 1024) {
      const ipucu = (await page.getByRole('button', { name: /ve ayrıntılar$/ }).boundingBox())!;
      expect(ipucu.y + ipucu.height).toBeLessThanOrEqual(h);
      expect(ipucu.y).toBeGreaterThan(s.y + s.height - 4);
    }
    await cek(page, `Q3-galaksi-${w}x${h}`);
  });
}

test('Q3 · 375×667: evrende "Pano" ipucu alt menünün üstünde, usturlap ondan önce biter', async ({ page }) => {
  await ac(page, '/?senaryo=berkin', 375, 667);
  const ipucu = (await page.getByRole('button', { name: 'Pano ve bekleyen işler' }).boundingBox())!;
  const nav = (await page.getByRole('navigation').last().boundingBox())!;
  expect(ipucu.y + ipucu.height).toBeLessThanOrEqual(nav.y);
  const gal = await page.getByRole('list', { name: 'Akışlar' }).getByRole('listitem').evaluateAll((e) => e.map((x) => x.getBoundingClientRect().bottom));
  expect(Math.max(...gal)).toBeLessThanOrEqual(ipucu.y + 2);
  await cek(page, 'Q3-evren-375x667');
});

test('Q3 · telefon: karar şeridi tek satır; ok ile tamamı açılır', async ({ page }) => {
  await ac(page, '/akis/RTD5?senaryo=berkin', 390, 844);
  const serit = page.getByRole('group', { name: /^Karar özeti/ });
  const h0 = (await serit.boundingBox())!.height;
  expect(h0).toBeLessThanOrEqual(20);
  const ok = page.getByRole('button', { name: 'Özetin tamamı' });
  await ok.click();
  await expect(page.getByRole('button', { name: 'Özeti daralt' })).toHaveAttribute('aria-expanded', 'true');
  expect((await serit.boundingBox())!.height).toBeGreaterThan(h0 + 10);
  await cek(page, 'Q3-serit-acik-390');
  await page.getByRole('button', { name: 'Özeti daralt' }).click();
  expect((await serit.boundingBox())!.height).toBeLessThanOrEqual(20);
});

for (const [w, h] of [[1280, 720], [1440, 900]] as const) {
  test(`Q3 · ${w}×${h}: Akışlar ızgarası, 16 akış; galaksi ≥ 72 px, ad galaksiden dar`, async ({ page }) => {
    await ac(page, '/akislar?senaryo=berkin&hal=olcek', w, h);
    const liste = page.getByRole('list', { name: 'Akışlar' }).first();
    await expect(liste.getByRole('listitem').first()).toBeVisible();
    const sonuc = await page.evaluate(() => {
      const g = [...document.querySelectorAll('[aria-label="Akışlar"] > [role="listitem"]')].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0);
      const yazi = [...document.querySelectorAll('.sahne-genis-cizim text')].map((t) => t.getBoundingClientRect());
      return g.map((r) => {
        const ad = yazi.find((t) => t.left >= r.left - 2 && t.right <= r.right + 40 && Math.abs((t.left + t.right) / 2 - (r.left + r.right) / 2) < 6 && t.top > r.top + r.height * .8 && t.top < r.bottom + 30);
        return { en: r.width, ad: ad ? ad.width : null };
      });
    });
    expect(sonuc.length).toBeGreaterThanOrEqual(16);
    for (const s of sonuc) {
      expect(s.en).toBeGreaterThanOrEqual(72);
      expect(s.ad).not.toBeNull();
      expect(s.ad!).toBeLessThan(s.en);
    }
    await cek(page, `Q3-akislar-${w}x${h}`);
  });
}
