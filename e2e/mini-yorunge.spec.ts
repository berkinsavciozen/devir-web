import { expect, test, type Page } from '@playwright/test';

// E1 (14 Kas): Evren, Akışlar ve Pano'daki küçük akış resmi haritanın küçültülmüşü: kişi halkaları, durum renginde adımlar, bakanın aracı.
const ac = async (p: Page, yol: string, w = 390, h = 844) => {
  await p.setViewportSize({ width: w, height: h });
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto(yol);
  await p.evaluate(() => document.fonts.ready);
};

for (const [yol, ad] of [['/?senaryo=berkin&tanitim=0', 'Evren'], ['/akislar?senaryo=berkin&tanitim=0', 'Akışlar']] as const) {
  test(`E1: ${ad} küçük resmi yörünge dilinde`, async ({ page }) => {
    await ac(page, yol);
    const mini = page.locator('.mini-yorunge');
    await expect(mini.first()).toBeAttached({ timeout: 15000 });
    expect(await mini.count()).toBeGreaterThanOrEqual(5);
    const ilk = mini.first();
    // halka(lar), iğne, durum renginde adımlar ve bakanın aracı
    expect(await ilk.locator('circle[fill="none"]').count()).toBeGreaterThanOrEqual(1);
    expect(await ilk.locator('line').count()).toBeGreaterThanOrEqual(1);
    const renkler = await ilk.locator('circle').evaluateAll((c) => c.map((x) => x.getAttribute('fill')));
    expect(renkler.some((r) => ['#6EE39A', '#5AB8FF', '#FFB547', '#FF5A5A', '#A9C3D6'].includes(r || ''))).toBe(true);
    expect(await ilk.locator('.ky-simge').count()).toBeGreaterThanOrEqual(1);
  });
}
