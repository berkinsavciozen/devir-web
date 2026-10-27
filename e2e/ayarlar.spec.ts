import { expect, test, type Page } from '@playwright/test';

// Roller ve ayarlar (PR C): dört sekmeli alt gezinme, Görevler, Ayarlar sekmeleri, ekip sayıları, rol önizlemesi, akış erişimi.
const ac = async (p: Page, yol: string, w = 390, h = 844) => {
  await p.setViewportSize({ width: w, height: h });
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto(yol);
  await p.evaluate(() => document.fonts.ready);
};
const cek = (p: Page, ad: string) => p.screenshot({ path: `karsilastirma/uygulama/${ad}.png` });
/** görünen düğmeler ≥ 44 px ve birbirine binmiyor */
// sabit alt gezinme kayan içeriğin üstünde durur; onunla çakışma sayılmaz (kendi içinde ayrıca bakılır)
async function hedefler(p: Page, kok = 'body') {
  const dis = kok === 'body' ? ':not(.alt-gezinme button)' : '';
  const K = await p.locator(`${kok} button:not(.segment button)${dis}, ${kok} [role=link]`).evaluateAll((els) => els.filter((e) => (e as HTMLElement).offsetParent && !(e as HTMLButtonElement).disabled).map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, ad: e.getAttribute('aria-label') || e.textContent?.trim().slice(0, 24) }; }));
  for (const k of K) expect(Math.min(k.w, k.h), k.ad || '').toBeGreaterThanOrEqual(43.5);
  for (let i = 0; i < K.length; i++) for (let j = i + 1; j < K.length; j++) {
    const a = K[i], b = K[j], ust = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), dik = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    expect(ust > 1 && dik > 1, `${a.ad} ↔ ${b.ad}`).toBe(false);
  }
}

test('B1-gezinme: üç sekme (Evren · Akışlar · Görevler); yeni iş, zil ve ayarlar sağ üstte', async ({ page }) => {
  await ac(page, '/?senaryo=berkin');
  const nav = page.getByRole('navigation', { name: 'Ana gezinme' });
  await expect(nav.getByRole('button')).toHaveCount(3);
  await hedefler(page, '.alt-gezinme');
  // plan 27 Eki, 2.8: +, zil ve ayarlar sağ üstte
  const ust = page.locator('.ust-dugmeler');
  for (const ad of ['Yeni iş', /^Bildirimler/, 'Ayarlar']) await expect(ust.getByRole('button', { name: ad })).toBeVisible();
  await hedefler(page, '.ust-dugmeler');
  await ust.getByRole('button', { name: 'Ayarlar' }).click();
  await expect(page).toHaveURL(/\/ayarlar/);
  await page.goBack();
  await nav.getByRole('button', { name: /^Görevler/ }).click();
  await expect(page).toHaveURL(/\/gorevler/);
  await expect(nav.getByRole('button', { name: /^Görevler/ })).toHaveAttribute('aria-current', 'page');
});

test('N1-gorevler: eski /bana adresi Görevler’e döner; gruplar, harita, satır adıma açılır', async ({ page }) => {
  await ac(page, '/bana?senaryo=berkin');
  await expect(page).toHaveURL(/\/gorevler/);
  await expect(page.getByText('SIRASI GELEN')).toBeVisible();
  await expect(page.locator('.gorev-harita .gezegen-hedef').first()).toBeVisible();
  const L = page.getByRole('list', { name: 'Görevler' });
  await L.getByRole('listitem').first().waitFor();
  await page.waitForTimeout(200);
  await cek(page, 'N1-gorevler');
  await hedefler(page);
  await L.getByRole('listitem').first().click();
  await expect(page).toHaveURL(/\/akis\/[^/]+\/(adim|karar)\/\d+/);
});

test('N1-gorevler-suzgec: kişi süzgeci adrese yazılır, şeritler kişi başına olur', async ({ page }) => {
  await ac(page, '/gorevler?senaryo=berkin');
  await page.getByRole('button', { name: /^Kişi: Ben/ }).click();
  await page.getByRole('dialog').getByText('Herkes', { exact: true }).click();
  await expect(page).toHaveURL(/kisi=hepsi/);
  await expect(page.getByText('GÖREV HARİTASI · KİŞİLER')).toBeVisible();
  await page.waitForTimeout(300);
  await cek(page, 'N1-gorevler-herkes');
  await hedefler(page);
});

// tek sayfa (el notu 17): dört grup; adres grubu açar, eski ?sekme= adresleri de aynı gruba iner
for (const [s, ad, baslik] of [['ekip', 'K1-alan', 'EKİP'], ['baglantilar', 'K1-baglantilar', 'BAĞLANTILAR'], ['ben', 'K1-hesap', 'BEN'], ['gorunum', 'K1-gorunum', 'GÖRÜNÜM VE BİLDİRİMLER']] as const) {
  test(`${ad}: Ayarlar · ${s}`, async ({ page }) => {
    await ac(page, `/ayarlar?senaryo=berkin&hal=ekip&bolum=${s}`);
    const h = page.getByRole('heading', { name: baslik, exact: true });
    await expect(h).toBeInViewport();
    await page.waitForTimeout(400);
    await cek(page, ad);
    await hedefler(page);
  });
}

test('K1-tek-sayfa: dört grup tek sayfada; rol tablosu "?" arkasında; avatar Ben grubunu açar', async ({ page }) => {
  await ac(page, '/ayarlar?senaryo=berkin&hal=ekip&sekme=gorunum');
  await expect(page.getByRole('heading', { name: 'GÖRÜNÜM VE BİLDİRİMLER' })).toBeInViewport();
  for (const b of ['BEN', 'EKİP', 'BAĞLANTILAR']) await expect(page.getByRole('heading', { name: b, exact: true })).toHaveCount(1);
  await expect(page.getByText('Bağlantı denetimi')).toBeVisible();
  // son satır alt çubuğun üstüne kadar kayabilir
  await page.mouse.wheel(0, 4000);
  await page.waitForTimeout(200);
  const cikis = await page.getByRole('button', { name: 'Çıkış yap' }).boundingBox(), nav = await page.locator('.alt-gezinme').boundingBox();
  expect(cikis!.y + cikis!.height).toBeLessThanOrEqual(nav!.y);
  await page.getByRole('button', { name: 'Roller ve yetkiler' }).click();
  await expect(page.getByRole('dialog', { name: 'Roller ve yetkiler' })).toBeVisible();
  await page.goto('/?senaryo=berkin');
  await page.getByRole('button', { name: /hesap ve çalışma alanı/ }).click();
  await expect(page).toHaveURL(/\/ayarlar\?bolum=ben/);
  await expect(page.getByRole('heading', { name: 'BEN', exact: true })).toBeInViewport();
});

test('K1-sayilar: Ayarlar ekip satırı ile Ekip sayfası aynı sayıyı söyler', async ({ page }) => {
  await ac(page, '/ayarlar?senaryo=berkin&hal=ekip');
  const satir = page.getByRole('button', { name: /Üyeler ve davetler/ });
  await expect(satir).toContainText(/\d+ üye · \d+ kişide anahtar/);
  const metin = (await satir.textContent())!, uye = metin.match(/(\d+) üye/)![1], anahtar = metin.match(/(\d+) kişide anahtar/)![1];
  await satir.click();
  await expect(page.locator('.bolum-not')).toHaveText(`${uye} üye · ${anahtar} kişide anahtar`);
  await expect(page.locator('.satir-kart', { hasText: 'anahtarı var' })).toHaveCount(Number(anahtar));
});

test('K2d-onizleme: rol önce önizlenir, Kaydet ile yazılır; seçili akış erişimi', async ({ page }) => {
  await ac(page, '/ayarlar/ekip?senaryo=berkin&hal=ekip');
  await page.getByRole('button', { name: /^Selin: rol/ }).click();
  const sayfa = page.getByRole('dialog', { name: 'Selin' });
  await expect(sayfa.getByRole('button', { name: 'Kaydet' })).toBeDisabled();
  await sayfa.getByRole('tab', { name: 'Seçili akışlar' }).click();
  await expect(sayfa.getByRole('button', { name: 'Kaydet' })).toBeDisabled();
  await sayfa.getByRole('group', { name: 'Görebileceği akışlar' }).getByRole('button').first().click();
  await expect(sayfa.getByRole('status')).toContainText('yalnız seçili 1 akışı');
  await page.waitForTimeout(200);
  await cek(page, 'K2d-onizleme');
  await sayfa.getByRole('button', { name: 'Kaydet' }).click();
  await expect(page.getByRole('dialog', { name: 'Selin' })).toHaveCount(0);
  await expect(page.locator('.satir-kart', { hasText: 'Selin' })).toContainText('1 akış');
});

test('K1-hareket: Görünüm · Azalt kök öğeye yazılır ve kalır', async ({ page }) => {
  await ac(page, '/ayarlar?senaryo=berkin&sekme=gorunum');
  await page.getByRole('tab', { name: 'Azalt' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-hareket', 'az');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hareket', 'az');
});

test('M2-ayarlar: masaüstünde panel üstünden Ayarlar, yüzen gezinmeden Görevler', async ({ page }) => {
  await ac(page, '/?senaryo=berkin', 1440, 900);
  await page.getByRole('button', { name: 'Ayarlar' }).waitFor();
  await cek(page, 'M2-ayarlar');
  await page.getByRole('navigation', { name: 'Ana gezinme' }).getByRole('button', { name: 'Görevler' }).click();
  await expect(page).toHaveURL(/\/gorevler/);
  await page.goBack();
  await page.getByRole('button', { name: 'Ayarlar' }).click();
  await expect(page).toHaveURL(/\/ayarlar/);
});
