import { expect, test, type Page } from '@playwright/test';

// W3 (23 Eki test bulguları): galaksi çerçevesi ve adı (N1, N3), cümle alanı (N7), sayılı ve tıklanabilir lejant (N2, N6),
// bildirimlerde tür süzgeci (K9), haritada üzerine gelince ad ve durum (K10), şerit ve görev haritası eksenleri (K3, K6).
const ac = async (p: Page, yol: string, w = 390, h = 844) => {
  await p.setViewportSize({ width: w, height: h });
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto(yol);
  await p.evaluate(() => document.fonts.ready);
};
const cek = (p: Page, ad: string) => p.screenshot({ path: `karsilastirma/uygulama/${ad}.png` });
const kutular = (p: Page, sec: string) => p.locator(sec).evaluateAll((L) => L.map((e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, t: e.textContent || '' }; }));
const binmez = (B: { x: number; w: number }[]) => B.every((b, i) => !i || b.x >= B[i - 1].x + B[i - 1].w - 1);

test('N2: lejant işaretleri sayılı; işarete dokununca o türün bildirimleri açılır', async ({ page }) => {
  await ac(page, '/akis/RTD5?senaryo=berkin');
  await page.getByRole('button', { name: 'Harita dili' }).click();
  const engel = page.getByRole('button', { name: /^Engelli: \d+\./ });
  await expect(engel).toBeVisible();
  await expect(page.locator('.lejant-sayi').first()).toBeVisible();
  await cek(page, 'W3-lejant');
  await engel.click();
  await expect(page).toHaveURL(/\/bildirimler\?sekme=tum&akis=RTD5&tur=engel/);
  await expect(page.getByRole('button', { name: 'Tür: Engeller' })).toHaveAttribute('aria-pressed', 'true');
});

test('K9: bildirimlerde tür süzgeci; seçilen tür adreste', async ({ page }) => {
  await ac(page, '/bildirimler?sekme=tum&senaryo=berkin');
  await page.getByRole('button', { name: 'Tür: Hepsi' }).click();
  await page.getByRole('button', { name: /^Sırası gelenler/ }).click();
  await expect(page).toHaveURL(/tur=sira/);
  const L = page.getByRole('list', { name: 'Bildirimler' });
  await expect(L.getByText(/sırası geldi/i).first()).toBeVisible();
  await expect(L.getByText(/çıktı ekledi/)).toHaveCount(0);
});

test('N1, N3: evrende galaksi adı kendi çerçevesine takılı (1440 ve 360)', async ({ page }) => {
  for (const [w, h] of [[1440, 900], [360, 780]]) {
    await ac(page, '/?senaryo=berkin', w, h);
    const hedef = page.getByRole('list', { name: 'Akışlar' }).getByRole('listitem');
    await expect(hedef.first()).toBeVisible();
    const G = await hedef.evaluateAll((L) => L.map((e) => { const r = e.getBoundingClientRect(); return { ad: (e.getAttribute('aria-label') || '').split('.')[0], x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 }; }));
    const ad = (await page.locator('svg text').evaluateAll((L) => L.map((e) => { const r = e.getBoundingClientRect(); return { t: e.textContent || '', x: r.left + r.width / 2, y: r.top + r.height / 2 }; })));
    for (const g of G.filter((x) => ['İzmir', 'Offsite', 'Karadeniz', 'Test Bank'].includes(x.ad))) {
      const e = ad.find((a) => a.t === g.ad);
      expect(e, g.ad).toBeTruthy();
      // hap ortası galaksinin çerçeve çizgisinde: merkezden uzaklık yarıçap kadar (± hap yarı yüksekliği)
      const d = Math.hypot(e!.x - g.x, e!.y - g.y);
      expect(d, `${g.ad} ${w}`).toBeLessThan(g.r * 1.25 + 14);
    }
  }
});

test('N7: masaüstünde cümleler evren halkasına binmez (1280×720)', async ({ page }) => {
  await ac(page, '/?senaryo=berkin', 1280, 720);
  const cumle = page.locator('p', { hasText: 'Test Bank’te Selin’in sızma testi' });
  const c = await cumle.boundingBox();
  const ay = await kutular(page, 'svg text');
  const aylar = ay.filter((a) => /^(Eki|Kas|Ara)$/.test(a.t));
  expect(aylar.length).toBeGreaterThan(0);
  for (const a of aylar) expect(a.y, a.t).toBeGreaterThan(c!.y + c!.height);
  await cek(page, 'W3-evren-1280');
});

test('K10: masaüstünde galaksi ve gezegenin üzerine gelince ad ve durum', async ({ page }) => {
  await ac(page, '/?senaryo=berkin', 1440, 900);
  const g = page.getByRole('list', { name: 'Akışlar' }).getByRole('listitem', { name: /^Hasat postu/ });
  await expect(g).toHaveAttribute('data-ipucu', /^Hasat postu · \d+\/\d+ adım · hedef/);
  await g.hover();
  const ipucu = await g.evaluate((e) => getComputedStyle(e, '::after').content);
  expect(ipucu).toContain('Hasat postu');
  await ac(page, '/akis/RTD5?senaryo=berkin', 1440, 900);
  await expect(page.getByRole('list', { name: 'Harita' }).locator('[data-ipucu]').first()).toHaveAttribute('data-ipucu', /^\d+\. .+ · .+ · .+/);
});

test('K3: şerit ekseninde tarih etiketleri üst üste binmez ve kesilmez', async ({ page }) => {
  for (const [w, h] of [[1440, 900], [360, 780]]) {
    await ac(page, '/akis/RTD5?senaryo=berkin', w, h);
    const S = (await kutular(page, 'svg text')).filter((t) => /^\d{1,2} (Oca|Şub|Mar|Nis|May|Haz|Tem|Ağu|Eyl|Eki|Kas|Ara)$/.test(t.t)).sort((a, b) => a.y - b.y || a.x - b.x);
    // aynı satırdakiler (şerit ekseni) birbirine binmez
    const satir = new Map<number, typeof S>();
    for (const t of S) { const k = Math.round(t.y / 4); satir.set(k, [...(satir.get(k) || []), t]); }
    for (const [, T] of satir) expect(binmez(T.sort((a, b) => a.x - b.x)), JSON.stringify(T.map((t) => t.t))).toBe(true);
    for (const t of S) expect(t.x + t.w, t.t).toBeLessThanOrEqual(w);
  }
});

test('K6: telefonda görev haritası ekseninde tarihler var ve bugüne binmez', async ({ page }) => {
  await ac(page, '/gorevler?senaryo=berkin', 360, 780);
  const bugun = page.getByText('bugün', { exact: true });
  await expect(bugun).toBeVisible();
  const T = (await kutular(page, '.tek-satir')).filter((t) => /^\d{1,2} (Eki|Kas|Ara)$/.test(t.t.trim()));
  expect(T.length).toBeGreaterThan(1);
  expect(binmez(T.sort((a, b) => a.x - b.x))).toBe(true);
  const b = await bugun.boundingBox();
  for (const t of T) expect(t.y + t.h).toBeLessThanOrEqual(b!.y + 1);
  await cek(page, 'W3-gorevler-360');
});
