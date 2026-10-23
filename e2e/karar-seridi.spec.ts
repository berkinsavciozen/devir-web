import { expect, test, type Page } from '@playwright/test';

// P1-A2 (M-C1, D-M3): karar şeridi beş yüzeyde ilk ekranda, lejant açmadan görünür; adlar kesilmez (şerit taşmaz).
const ac = async (p: Page, yol: string, w: number, h: number) => {
  await p.setViewportSize({ width: w, height: h });
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto(yol);
  await p.evaluate(() => document.fonts.ready);
};
const TARIH = /\d{1,2}(–\d{1,2})? (Oca|Şub|Mar|Nis|May|Haz|Tem|Ağu|Eyl|Eki|Kas|Ara)|Kapandı/;

const YUZEYLER: { ad: string; yol: string; once?: (p: Page, w: number) => Promise<void> }[] = [
  { ad: 'galaksi', yol: '/akis/RTD5?senaryo=berkin' },
  { ad: 'akışlar', yol: '/akislar?senaryo=berkin' },
  // telefonda Pano haritanın altındaki durak; masaüstünde sağ panelde
  { ad: 'pano', yol: '/?senaryo=berkin', once: async (p, w) => { if (w < 1024) { await p.getByRole('button', { name: 'Pano ve bekleyen işler' }).click(); await p.waitForTimeout(300); } } },
  { ad: 'görevler', yol: '/gorevler?senaryo=berkin' },
  { ad: 'dış bağlantı', yol: '/l/k7Q2emreTestBank00wP9?senaryo=berkin' },
];

for (const [w, h] of [[360, 780], [1440, 900]] as const) {
  for (const y of YUZEYLER) {
    test(`${y.ad} · ${w}: şerit ilk ekranda, taşmıyor`, async ({ page }) => {
      await ac(page, y.yol, w, h);
      const s = page.locator('.karar-seridi').first();
      await s.waitFor();
      if (y.once) await y.once(page, w);
      await expect(s).toBeInViewport({ ratio: 1 });
      await expect(s).toHaveText(TARIH);
      const tasan = await page.locator('.karar-seridi').evaluateAll((L) => L
        .filter((e) => e.scrollWidth > e.clientWidth + 1 || e.getBoundingClientRect().right > window.innerWidth + .5)
        .map((e) => e.textContent));
      expect(tasan).toEqual([]);
    });
  }
}

test('galaksi: "Bu tarih neden?" varsayımları ve üst ucu belirleyen adımları gösterir', async ({ page }) => {
  await ac(page, '/akis/RTD5?senaryo=berkin', 360, 780);
  await page.getByRole('button', { name: 'Bu tarih neden?' }).click();
  const panel = page.getByRole('dialog');
  await expect(panel.getByRole('heading', { name: 'Varsayımlar' })).toBeVisible();
  await expect(panel.getByText(/süre tahmin; en çok %50 uzayabilir/)).toBeVisible();
  await expect(panel.getByRole('heading', { name: 'Üst ucu belirleyen adımlar' })).toBeVisible();
  await expect(panel.locator('ol li').first()).toContainText(/gün/);
});

test('galaksi · 1440: kritik yol parçası adımı seçer', async ({ page }) => {
  await ac(page, '/akis/RTD5?senaryo=berkin', 1440, 900);
  // seçim yokken panelde adım listesi (N16); kritik yolun ilk açık adımı seçilince görev detayı açılır
  await expect(page.getByRole('list', { name: 'Adımlar' }).getByRole('button').first()).toBeVisible();
  await page.locator('.karar-seridi .ks-kritik').click();
  await expect(page).toHaveURL(/\/akis\/RTD5\/adim\/\d+/);
  await expect(page.locator('.gd-kaydir h2')).toHaveText(/TestFlight/);
});

test('dış bağlantı: şerit başka adımın adını taşımaz, "neden" paneli yok', async ({ page }) => {
  await ac(page, '/l/k7Q2emreTestBank00wP9?senaryo=berkin', 360, 780);
  const s = page.locator('.karar-seridi');
  await s.waitFor();
  await expect(s.locator('.ks-darbogaz, .ks-kritik')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Bu tarih neden?' })).toHaveCount(0);
});
