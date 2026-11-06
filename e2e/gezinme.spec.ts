import { expect, test, type Page } from '@playwright/test';

// Harita gezinme (PR A): yakınlaşma, küme yakınlaşması, kule kartı, kişi kartı, simge hedefleri.
// Görseller karsilastirma/uygulama/<ad>.png; tasarımda karşılığı yok, kıyas önceki haliyle yapılır.
const ac = async (p: Page, yol: string, w = 390, h = 844) => {
  await p.setViewportSize({ width: w, height: h });
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto(yol);
  await p.evaluate(() => document.fonts.ready);
  await p.locator('.harita-gezinme .gezegen-hedef').first().waitFor();
};
const cek = (p: Page, ad: string) => p.screenshot({ path: `karsilastirma/uygulama/${ad}.png` });
/** dokunma hedefleri ≥ 44 px ve birbirine binmiyor */
async function hedefKontrol(p: Page) {
  const kutular = await p.locator('.harita-gezinme .gezegen-hedef').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, r: r.width / 2, w: r.width, h: r.height, ad: e.getAttribute('aria-label') }; }));
  for (const k of kutular) expect(Math.min(k.w, k.h), k.ad || '').toBeGreaterThanOrEqual(43.5);
  return kutular;
}

test.describe('dokunmatik', () => {
  test.use({ hasTouch: true });

  test('B3-yakin: tekerlekle 2.5× → etiketler, kişi adları; sığdır', async ({ page }) => {
    await ac(page, '/akis/RTD5?senaryo=berkin');
    await page.mouse.move(195, 330);
    for (let i = 0; i < 10; i++) { await page.mouse.wheel(0, -60); await page.waitForTimeout(16); }
    await page.waitForTimeout(150);
    // RTD5'te 1 ve 2 (Brif, Marka kiti) aynı dakikada bitti: 1×'te küme, en yakın görünümde ayrışırlar (plan 2 Kas; W5 sarmalı 5 ve 8'i zaten ayırır)
    await hedefKontrol(page);
    await cek(page, 'B3-yakin');
    await page.getByRole('button', { name: 'Haritayı sığdır' }).click();
    await page.waitForTimeout(300);
    await expect(page.getByRole('listitem', { name: /2 adım bir arada/ })).toHaveCount(1);
  });

  // 3 Kas: en yakında tekerlek ve dokunmatik yüzey kıstırması (ctrl + tekerlek) sayfaya geçmez; geçerse sayfa yakınlaşıp titrer
  test('B3-sinir: en yakında tekerlek ve kıstırma sayfayı yakınlaştırmaz', async ({ page }) => {
    await ac(page, '/akis/RTD5?senaryo=berkin');
    await page.evaluate(() => { (window as any).__w = []; addEventListener('wheel', (e) => (window as any).__w.push(e.defaultPrevented), { passive: true }); });
    await page.mouse.move(195, 330);
    for (let i = 0; i < 40; i++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(16); }
    await page.keyboard.down('Control');
    for (let i = 0; i < 5; i++) { await page.mouse.wheel(0, -40); await page.waitForTimeout(16); }
    await page.keyboard.up('Control');
    const w: boolean[] = await page.evaluate(() => (window as any).__w);
    expect(w.slice(-15).every(Boolean)).toBe(true);
    await page.getByRole('button', { name: 'Haritayı sığdır' }).click();
    await page.waitForTimeout(300);
    await page.evaluate(() => { (window as any).__w = []; });
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, 40);
    await page.keyboard.up('Control');
    await page.mouse.wheel(0, 40);
    expect(await page.evaluate(() => (window as any).__w)).toEqual([true, false]);
  });

  test('B3-kaydir: yakınken sürükle → harita kayar, gezegene tıklama sayılmaz', async ({ page }) => {
    await ac(page, '/akis/RTD5?senaryo=berkin');
    await page.mouse.move(195, 330);
    for (let i = 0; i < 10; i++) { await page.mouse.wheel(0, -60); await page.waitForTimeout(16); }
    const h = page.getByRole('listitem', { name: /^6\. adım/ });
    const a = (await h.boundingBox())!;
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(a.x + a.width / 2 + 40, a.y + a.height / 2 + 30, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(100);
    expect(page.url()).not.toContain('/adim/');
    const b = (await h.boundingBox())!;
    expect(Math.round(b.x - a.x)).toBeGreaterThan(20);
  });

  // plan 2 Kas: yelpaze yok; rozet kümeye yakınlaşmayı sürdürür, en çok 3 dokunuşta üyeler ayrı gezegen olur.
  // RTD5'te 1, 2, 5, 8 aynı dakikada bitti: geometri onları en yakın görünümde ayrışacak kadar aralar (W5 sarmalında 1×'te kümede kalan 1 ve 2)
  test('B3-kume: küme rozeti → en çok 3 dokunuşta ayrı gezegenler; üye → adım', async ({ page }) => {
    await ac(page, '/akis/RTD5?senaryo=berkin');
    const rozet = page.getByRole('listitem', { name: /adım bir arada/ });
    let n = 0;
    while ((await rozet.count()) && n < 5) { await rozet.first().click(); n++; await page.waitForTimeout(350); }
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThanOrEqual(3);
    await expect(rozet).toHaveCount(0);
    await expect(page.getByRole('list', { name: 'Küme' })).toHaveCount(0);
    const hedef = (no: number) => page.getByRole('listitem', { name: new RegExp(`^${no}\\. adım`) });
    const kutu = await Promise.all([1, 2].map(async (no) => (await hedef(no).boundingBox())!));
    for (let i = 0; i < kutu.length; i++) for (let j = i + 1; j < kutu.length; j++) {
      const a = kutu[i], b = kutu[j];
      expect(Math.hypot(a.x + a.width / 2 - b.x - b.width / 2, a.y + a.height / 2 - b.y - b.height / 2)).toBeGreaterThanOrEqual(44);
    }
    await cek(page, 'B3-kume');
    // W5 (K4): telefonda ilk dokunuş kutuyu açar, ikincisi görevi
    await hedef(1).click();
    await expect(page.getByRole('dialog', { name: /^1\. / })).toBeVisible();
    await hedef(1).click();
    await expect(page).toHaveURL(/\/akis\/RTD5\/adim\/1/);
  });

  test('B3-kule: kule → hedef kartı', async ({ page }) => {
    await ac(page, '/akis/RTD5?senaryo=berkin');
    await page.getByRole('listitem', { name: /^Hedef/ }).click();
    await page.waitForTimeout(100);
    await cek(page, 'B3-kule');
    await expect(page.getByRole('listitem', { name: /^Hedef/ })).toHaveAttribute('aria-pressed', 'true');
  });

  test('B3-kisi: kişi işareti → odak ve kişi kartı', async ({ page }) => {
    await ac(page, '/akis/RTD5?senaryo=berkin');
    await page.getByRole('listitem', { name: /^Berkin \(insan\)/ }).click();
    await expect(page.getByRole('listitem', { name: /^Berkin \(insan\)/ })).toHaveAttribute('aria-pressed', 'true');
    await page.waitForTimeout(100);
    await cek(page, 'B3-kisi');
  });

  test('B3-ikon: 2×+ yakınlıkta bulut ve bayrak kendi hedefleri', async ({ page }) => {
    await ac(page, '/akis/RTD5?senaryo=berkin');
    // engelli "Görsel" gezegeni (zaman ölçeğiyle konum, plan 27 Eki D)
    const g = (await page.getByRole('listitem', { name: /^6\. adım/ }).boundingBox())!;
    await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
    for (let i = 0; i < 14; i++) { await page.mouse.wheel(0, -60); await page.waitForTimeout(16); }
    await page.waitForTimeout(400);
    await hedefKontrol(page);
    await cek(page, 'B3-ikon');
    await page.getByRole('listitem', { name: /^Engel:/ }).first().click();
    await expect(page).toHaveURL(/\/adim\//);
  });
});

test('M1-yakin: masaüstünde + düğmesi, etiketler', async ({ page }) => {
  await ac(page, '/akis/RTD5?senaryo=berkin', 1440, 900);
  await page.getByRole('button', { name: 'Yakınlaştır' }).click();
  await page.getByRole('button', { name: 'Yakınlaştır' }).click();
  await page.waitForTimeout(400);
  await hedefKontrol(page);
  await cek(page, 'M1-yakin');
  await page.getByRole('button', { name: 'Haritayı sığdır' }).click();
});

test.describe('evren', () => {
  test.use({ hasTouch: true });
  test('B1-yakin: evrende yakınlaş → galaksi ayrıntılı, adımlar dokunulur; en yakında akışa girer', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?senaryo=berkin');
    await page.locator('.gorev-kart').first().waitFor();
    const g = page.getByRole('listitem', { name: /^Hasat postu/ });
    const b = (await g.boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, -60); await page.waitForTimeout(16); }
    await page.waitForTimeout(150);
    await expect(page.getByRole('listitem', { name: /^Hasat postu, \d+\. adım/ }).first()).toBeVisible();
    await hedefKontrol(page);
    await page.screenshot({ path: 'karsilastirma/uygulama/B1-yakin.png' });
    const adim = page.getByRole('listitem', { name: /^Hasat postu, \d+\. adım/ }).first();
    const no = (await adim.getAttribute('aria-label'))!.match(/, (\d+)\. adım/)![1];
    await adim.click();
    await expect(page).toHaveURL(new RegExp(`/akis/RTD5/adim/${no}`));
  });
});

// plan 27 Eki, 3.28 + plan 28 Eki, B1: en yakında daha da yaklaşmak akışa kendiliğinden girmez; akış bilgi kartı açılır
test.describe('evren geçiş onayı', () => {
  test.use({ hasTouch: true });
  test('B1-gecis: yakınlaşınca akış bilgi kartı; kapatılır, "Akışa geç" açar', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?senaryo=berkin');
    const g = page.getByRole('listitem', { name: /^Hasat postu/ });
    await g.waitFor();
    const b = (await g.boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    const kart = page.getByRole('region', { name: 'Hasat postu: akış bilgisi' });
    for (let i = 0; i < 60 && !(await kart.count()); i++) { await page.mouse.wheel(0, -80); await page.waitForTimeout(16); }
    await expect(kart).toContainText('Akışa geç');
    expect(page.url()).not.toContain('/akis/');
    await page.screenshot({ path: 'karsilastirma/uygulama/B1-gecis.png' });
    await kart.getByRole('button', { name: 'Kartı kapat' }).click();
    await expect(kart).toHaveCount(0);
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    for (let i = 0; i < 10 && !(await kart.count()); i++) { await page.mouse.wheel(0, -80); await page.waitForTimeout(16); }
    await kart.getByRole('button', { name: 'Akışa geç' }).click();
    await expect(page).toHaveURL(/\/akis\/RTD5/);
  });
});

// plan 27 Eki, 3.25: geçmişe ya da tahmine bakarken şerit ve "Bugüne dön"
test('B3-zaman: başka günde şerit görünür; Bugüne dön sürgüyü bugüne alır', async ({ page }) => {
  await ac(page, '/akis/RTD5?senaryo=berkin&an=2026-10-17T12:00');
  const s = page.getByRole('status').filter({ hasText: 'bakıyorsun' });
  await expect(s).toContainText('Tahmine bakıyorsun · 17 Eki');
  await s.getByRole('button', { name: 'Bugüne dön' }).click();
  await expect(s).toHaveCount(0);
  await expect(page.getByRole('slider', { name: 'Zaman' })).toHaveAttribute('aria-valuetext', /^Bugün/);
});
