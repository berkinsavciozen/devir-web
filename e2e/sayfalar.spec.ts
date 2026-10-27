import { expect, test, type Page } from '@playwright/test';

// Eksik sayfalar ve bağlantılar (PR B): akış bilgisi, kişi sayfası, "…" menüsü, adımlar arası gezinme, evren cümleleri.
const ac = async (p: Page, yol: string, w = 390, h = 844) => {
  await p.setViewportSize({ width: w, height: h });
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto(yol);
  await p.evaluate(() => document.fonts.ready);
};
const cek = (p: Page, ad: string) => p.screenshot({ path: `karsilastirma/uygulama/${ad}.png` });

test('B3-menu: "…" menüsünde liste süzgeci yok; bağlantı ve kişiler var', async ({ page }) => {
  await ac(page, '/akis/RTD5?senaryo=berkin');
  await page.getByRole('button', { name: 'Akış menüsü' }).click();
  const menu = page.getByRole('dialog', { name: 'Akış menüsü' });
  await expect(menu.getByRole('button', { name: 'Bağlantıyı kopyala' })).toBeVisible();
  await page.waitForTimeout(200);
  await cek(page, 'B3-menu');
  // plan 27 Eki, 2.6: süzgeç haritanın altındaki listede kalır
  for (const ad of [/^Adımlar/, /^Kararlar/, /^Çıktılar/]) await expect(menu.getByRole('button', { name: ad })).toHaveCount(0);
  await expect(menu.getByRole('list', { name: 'Kişiler' }).getByRole('listitem').first()).toBeVisible();
});

test('B9-bilgi: adımlar sekmesi süzülür, satır adıma açılır', async ({ page }) => {
  await ac(page, '/akis/RTD5/bilgi?senaryo=berkin');
  const liste = page.getByRole('list', { name: 'Adımlar' });
  await liste.getByRole('listitem').first().waitFor();
  const hepsi = await liste.getByRole('listitem').count();
  await cek(page, 'B9-bilgi');
  await page.getByRole('button', { name: 'Bitti' }).click();
  await expect(page.getByRole('button', { name: 'Bitti' })).toHaveAttribute('aria-pressed', 'true');
  const biten = await liste.getByRole('listitem').count();
  expect(biten).toBeLessThan(hepsi);
  await page.getByRole('button', { name: 'Hepsi' }).click();
  await liste.getByRole('listitem').first().click();
  await expect(page).toHaveURL(/\/akis\/RTD5\/adim\/\d+/);
});

// kararlar ve çıktılar ayrı sekme değil, listenin süzgeci (N16); eski ?sekme= adresi de süzgece düşer
for (const [s, ad] of [['suz=karar', 'B9-kararlar'], ['suz=cikti', 'B9-ciktilar'], ['sekme=kararlar', 'B9-eski-sekme']] as const) {
  test(`${ad}: ${s}`, async ({ page }) => {
    await ac(page, `/akis/RTD5/bilgi?senaryo=berkin&${s}`);
    await expect(page.getByRole('button', { name: s.includes('cikti') ? /^Çıktı/ : /^Karar/ })).toHaveAttribute('aria-pressed', 'true');
    await page.waitForTimeout(300);
    await cek(page, ad);
    // sekme düğmeleri 36 px çizilir, dolguyla 44 px hedef (.segment)
    const hedefler = await page.locator('button:not(.segment button), [role=link], .satir-kart').evaluateAll((els) => els.filter((e) => (e as HTMLElement).offsetParent).map((e) => { const r = e.getBoundingClientRect(); return Math.min(r.width, r.height); }));
    for (const h of hedefler) expect(h).toBeGreaterThanOrEqual(43.5);
  });
}

test('B10-kisi: menüde kişiler → kişi sayfası → haritada yolu', async ({ page }) => {
  await ac(page, '/akis/RTD5?senaryo=berkin');
  await page.getByRole('button', { name: 'Akış menüsü' }).click();
  await page.getByRole('list', { name: 'Kişiler' }).getByRole('listitem').first().click();
  await expect(page).toHaveURL(/\/akis\/RTD5\/kisi\//);
  await page.waitForTimeout(200);
  await cek(page, 'B10-kisi');
  await page.getByRole('button', { name: 'Haritada yolunu göster' }).click();
  await expect(page).toHaveURL(/\/akis\/RTD5\?odak=/);
});

test('B4-gez: önceki/sonraki düğmeleri ve ok tuşları', async ({ page }) => {
  await ac(page, '/akis/RTD5/adim/3?senaryo=berkin');
  await page.getByRole('button', { name: /^Sonraki görev: \d+/ }).waitFor();
  await cek(page, 'B4-gez');
  const uzunluk = await page.evaluate(() => history.length);
  const sonraki = page.getByRole('button', { name: /^Sonraki görev: \d+/ });
  const n = (await sonraki.getAttribute('aria-label'))!.match(/\d+/)![0];
  await sonraki.click();
  await expect(page).toHaveURL(new RegExp(`/adim/${n}`));
  await page.keyboard.press('ArrowLeft');
  await expect(page).toHaveURL(/\/adim\/3/);
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(new RegExp(`/adim/${n}`));
  // adımlar arası geçiş geçmişi doldurmaz: geri, adımdan önceki sayfaya döner
  expect(await page.evaluate(() => history.length), `önce ${uzunluk}`).toBe(uzunluk);
});

test('B4-zincir: "bunu bekleyenler" satırı o göreve gider', async ({ page }) => {
  await ac(page, '/akis/RTD5?senaryo=berkin');
  const z = page.getByRole('region', { name: 'ETKİLEYEN VE ETKİLEDİĞİ' }).locator('.gd-bag').last();
  // zinciri olan ilk açık adım
  for (const n of [3, 6, 7, 9, 10, 11, 12]) {
    await page.goto(`/akis/RTD5/adim/${n}?senaryo=berkin`);
    await page.locator('.gd-gez').waitFor();
    await page.waitForTimeout(150);
    if (await z.count()) break;
  }
  await z.waitFor();
  const etiket = (await z.getAttribute('aria-label'))!, no = etiket.match(/^(\d+)\. görev/)![1];
  await z.click();
  await expect(page).toHaveURL(new RegExp(`/adim/${no}`));
});

test('B1-ust: evrende üst cümle yok; harita ilk ekranın büyük kısmı', async ({ page }) => {
  await ac(page, '/?senaryo=berkin');
  const g = page.locator('.harita-gezinme');
  await g.waitFor();
  await expect(page.locator('.cumle-hedef')).toHaveCount(0);
  const b = (await g.boundingBox())!;
  expect(b.height / 844).toBeGreaterThan(.7);
});
