import { expect, test, type Page } from '@playwright/test';

// Harita gezinme (PR A): yakınlaşma, küme yelpazesi, kule kartı, kişi kartı, simge hedefleri.
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
    // RTD5'te 1, 2, 5, 8 aynı dakikada bitti: aynı noktada, yakınlaşınca da küme kalır (§4.12)
    await hedefKontrol(page);
    await cek(page, 'B3-yakin');
    await page.getByRole('button', { name: 'Haritayı sığdır' }).click();
    await page.waitForTimeout(300);
    await expect(page.getByRole('listitem', { name: /4 adım bir arada/ })).toHaveCount(1);
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

  // 3.24a: rozet önce kümeye yakınlaşır; en yakında hâlâ üst üsteyse (aynı dakikada bitenler) yelpaze açılır
  const kumeyiAc = async (page: Page) => {
    const rozet = page.getByRole('listitem', { name: /4 adım bir arada/ }), kume = page.getByRole('list', { name: 'Küme' });
    for (let i = 0; i < 4 && !(await kume.count()); i++) { await rozet.click(); await page.waitForTimeout(350); }
  };
  test('B3-yelpaze: küme rozeti → yakınlaşır, en yakında yelpaze; üye → adım', async ({ page }) => {
    await ac(page, '/akis/RTD5?senaryo=berkin');
    await page.getByRole('listitem', { name: /4 adım bir arada/ }).click();
    await page.waitForTimeout(350);
    await expect(page.getByRole('button', { name: 'Haritayı sığdır' })).toBeEnabled();
    await expect(page.getByRole('list', { name: 'Küme' })).toHaveCount(0);
    await kumeyiAc(page);
    await expect(page.getByRole('list', { name: 'Küme' }).getByRole('listitem')).toHaveCount(5);
    await page.waitForTimeout(100);
    await cek(page, 'B3-yelpaze');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('list', { name: 'Küme' })).toHaveCount(0);
    await kumeyiAc(page);
    await page.getByRole('list', { name: 'Küme' }).getByRole('listitem', { name: /^1\. adım/ }).click();
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
    await page.mouse.move(110, 380);
    for (let i = 0; i < 10; i++) { await page.mouse.wheel(0, -60); await page.waitForTimeout(16); }
    await page.waitForTimeout(100);
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
    await page.getByText('tutuyor', { exact: false }).first().waitFor();
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

// plan 27 Eki, 3.28: en yakında daha da yaklaşmak akışa kendiliğinden girmez, önce sorar
test.describe('evren geçiş onayı', () => {
  test.use({ hasTouch: true });
  test('B1-gecis: en yakında yaklaşmaya devam → "akışına geçilsin mi?"; Kal kapatır, Geç açar', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?senaryo=berkin');
    const g = page.getByRole('listitem', { name: /^Hasat postu/ });
    await g.waitFor();
    const b = (await g.boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    const kart = page.getByRole('dialog', { name: 'Akışa geçiş' });
    for (let i = 0; i < 60 && !(await kart.count()); i++) { await page.mouse.wheel(0, -80); await page.waitForTimeout(16); }
    await expect(kart).toContainText('Hasat postu akışına geçilsin mi?');
    expect(page.url()).not.toContain('/akis/');
    await page.screenshot({ path: 'karsilastirma/uygulama/B1-gecis.png' });
    await kart.getByRole('button', { name: 'Kal' }).click();
    await expect(kart).toHaveCount(0);
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    for (let i = 0; i < 10 && !(await kart.count()); i++) { await page.mouse.wheel(0, -80); await page.waitForTimeout(16); }
    await kart.getByRole('button', { name: 'Geç' }).click();
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
