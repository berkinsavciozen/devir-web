import { expect, test, type Page } from '@playwright/test';

// Eksik sayfalar ve bağlantılar (PR B): akış bilgisi, kişi sayfası, "…" menüsü, adımlar arası gezinme, evren cümleleri.
const ac = async (p: Page, yol: string, w = 390, h = 844) => {
  await p.setViewportSize({ width: w, height: h });
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto(yol);
  await p.evaluate(() => document.fonts.ready);
};
const cek = (p: Page, ad: string) => p.screenshot({ path: `karsilastirma/uygulama/${ad}.png` });

test('B3-menu: "…" menüsü → haritanın altındaki bölümde sekme', async ({ page }) => {
  await ac(page, '/akis/RTD5?senaryo=berkin');
  await page.getByRole('button', { name: 'Akış menüsü' }).click();
  await page.waitForTimeout(200);
  await cek(page, 'B3-menu');
  await page.getByRole('button', { name: /^Kararlar/ }).click();
  // telefonda aynı sayfada kalır (el notu 12); bölüm başlığı görünür olur
  await expect(page).toHaveURL(/\/akis\/RTD5\?/);
  await expect(page.locator('.bolum-durak')).toBeInViewport();
  await expect(page.getByRole('tab', { name: 'Kararlar' })).toHaveAttribute('aria-selected', 'true');
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

for (const [s, ad] of [['kararlar', 'B9-kararlar'], ['ciktilar', 'B9-ciktilar'], ['kisiler', 'B9-kisiler']] as const) {
  test(`${ad}: ${s} sekmesi`, async ({ page }) => {
    await ac(page, `/akis/RTD5/bilgi?senaryo=berkin&sekme=${s}`);
    await page.waitForTimeout(300);
    await cek(page, ad);
    // sekme düğmeleri 36 px çizilir, dolguyla 44 px hedef (.segment)
    const hedefler = await page.locator('button:not(.segment button), [role=link], .satir-kart').evaluateAll((els) => els.filter((e) => (e as HTMLElement).offsetParent).map((e) => { const r = e.getBoundingClientRect(); return Math.min(r.width, r.height); }));
    for (const h of hedefler) expect(h).toBeGreaterThanOrEqual(43.5);
  });
}

test('B10-kisi: kişiler → kişi sayfası → haritada yolu', async ({ page }) => {
  await ac(page, '/akis/RTD5/bilgi?senaryo=berkin&sekme=kisiler');
  await page.getByRole('list', { name: 'Kişiler' }).getByRole('listitem').first().click();
  await expect(page).toHaveURL(/\/akis\/RTD5\/kisi\//);
  await page.waitForTimeout(200);
  await cek(page, 'B10-kisi');
  await page.getByRole('button', { name: 'Haritada yolunu göster' }).click();
  await expect(page).toHaveURL(/\/akis\/RTD5\?odak=/);
});

test('B4-gez: önceki/sonraki düğmeleri ve ok tuşları', async ({ page }) => {
  await ac(page, '/akis/RTD5/adim/3?senaryo=berkin');
  await page.getByRole('button', { name: /^Sonraki adım: \d+/ }).waitFor();
  await cek(page, 'B4-gez');
  const uzunluk = await page.evaluate(() => history.length);
  const sonraki = page.getByRole('button', { name: /^Sonraki adım: \d+/ });
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

test('B4-zincir: "bu adım bitince" zinciri bir sonraki adıma gider', async ({ page }) => {
  await ac(page, '/akis/RTD5?senaryo=berkin');
  const z = page.locator('.zincir-hedef').first();
  // zinciri olan ilk açık adım
  for (const n of [3, 6, 7, 9, 10, 11, 12]) {
    await page.goto(`/akis/RTD5/adim/${n}?senaryo=berkin`);
    await page.locator('.adim-gez').waitFor();
    await page.waitForTimeout(150);
    if (await z.count()) break;
  }
  await z.waitFor();
  const etiket = (await z.getAttribute('aria-label'))!, no = etiket.match(/: (\d+)\. adım/)![1];
  await z.click();
  await expect(page).toHaveURL(new RegExp(`/adim/${no}`));
});

test('B1-cumle: evren cümlesi anlattığı adıma açılır', async ({ page }) => {
  await ac(page, '/?senaryo=berkin');
  const c = page.locator('.cumle-hedef').first();
  await c.waitFor();
  await c.click();
  await expect(page).toHaveURL(/\/akis\/[^/]+\/adim\/\d+/);
});
