import { expect, test, type Page } from '@playwright/test';

// Roller ve ayarlar (PR C): dört sekmeli alt gezinme, Bana düşenler, Ayarlar sekmeleri, ekip sayıları, rol önizlemesi, akış erişimi.
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

test('B1-gezinme: dört sekme; Bana düşenler sayılı, ≤ 1 dokunuş', async ({ page }) => {
  await ac(page, '/?senaryo=berkin');
  const nav = page.getByRole('navigation', { name: 'Ana gezinme' });
  await expect(nav.getByRole('button')).toHaveCount(5);
  await hedefler(page, '.alt-gezinme');
  await nav.getByRole('button', { name: /^Bana düşenler/ }).click();
  await expect(page).toHaveURL(/\/bana/);
  await expect(nav.getByRole('button', { name: /^Bana düşenler/ })).toHaveAttribute('aria-current', 'page');
});

test('N1-bana: sırası gelen, engelli, süren; satır adıma açılır', async ({ page }) => {
  await ac(page, '/bana?senaryo=berkin');
  const L = page.getByRole('list', { name: 'Bana düşenler' });
  await L.getByRole('listitem').first().waitFor();
  await page.waitForTimeout(200);
  await cek(page, 'N1-bana');
  await hedefler(page);
  await L.getByRole('listitem').first().click();
  await expect(page).toHaveURL(/\/akis\/[^/]+\/(adim|karar)\/\d+/);
});

for (const [s, ad] of [['alan', 'K1-alan'], ['baglantilar', 'K1-baglantilar'], ['hesap', 'K1-hesap'], ['gorunum', 'K1-gorunum']] as const) {
  test(`${ad}: Ayarlar · ${s}`, async ({ page }) => {
    await ac(page, `/ayarlar?senaryo=berkin&hal=ekip&sekme=${s}`);
    await page.getByRole('tab', { selected: true }).first().waitFor();
    await page.waitForTimeout(400);
    await cek(page, ad);
    await hedefler(page);
  });
}

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

test('M2-ayarlar: masaüstünde yan panelden Ayarlar ve Bana düşenler', async ({ page }) => {
  await ac(page, '/?senaryo=berkin', 1440, 900);
  await page.getByRole('button', { name: 'Ayarlar' }).waitFor();
  await cek(page, 'M2-ayarlar');
  await page.getByRole('button', { name: /^Görevler/ }).click();
  await expect(page).toHaveURL(/\/bana/);
  await page.goBack();
  await page.getByRole('button', { name: 'Ayarlar' }).click();
  await expect(page).toHaveURL(/\/ayarlar/);
});
