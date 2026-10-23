import { expect, test, type Page } from '@playwright/test';

// W4 (23 Eki test bulguları): panoda akışlar ve katılımcılar (N4, N5, N10), görev ikonu mini harita (N8);
// akış detayında şeritler + tek adım listesi, karar/çıktı işaretleri (N16, N17); atlanan adım bitmiş sayılmaz.
const ac = async (p: Page, yol: string, w = 390, h = 844) => {
  await p.setViewportSize({ width: w, height: h });
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto(yol);
  await p.evaluate(() => document.fonts.ready);
};
const cek = (p: Page, ad: string) => p.screenshot({ path: `karsilastirma/uygulama/${ad}.png`, fullPage: true });

for (const [w, h] of [[360, 780], [1440, 900]]) {
  test(`N4, N5, N10 · ${w}: panoda akışlar ve ekip, agent, dış katılımcılar`, async ({ page }) => {
    await ac(page, '/?senaryo=berkin', w, h);
    if (w < 1024) await page.getByRole('button', { name: 'Pano ve bekleyen işler' }).click();
    const AK = page.getByRole('list', { name: 'Pano akışları' });
    await expect(AK.getByRole('button', { name: /^Test Bank: \d+\/\d+ adım/ })).toBeAttached();
    const KT = page.getByRole('list', { name: 'Katılımcılar' });
    await expect(KT.getByRole('button', { name: /^Selin: / })).toBeAttached();
    await expect(KT.getByRole('button', { name: /^Claude \(agent\): / })).toBeAttached();
    await expect(KT.getByRole('button', { name: /^Emre \(dış katılımcı\): / })).toBeAttached();
    // sen listede yoksun (Sende süzgecinde varsın)
    await expect(KT.getByRole('button', { name: /^Berkin/ })).toHaveCount(0);
    await cek(page, `W4-pano-${w}`);
    // görev satırının ikonu akışın küçük haritası (N8): yörünge çizgileri var
    expect(await page.getByRole('list', { name: 'Bekleyen işler' }).locator('svg.pano-ikon').first().innerHTML()).toMatch(/<path|<circle[^>]*stroke/);
    await KT.getByRole('button', { name: /^Selin: / }).click();
    await expect(page).toHaveURL(/\/akis\/U422\/kisi\/Selin/);
  });
}

test('atlanan adım bitmiş sayılmaz: Hasat postu ilerlemesi atlananı ayrı söyler', async ({ page }) => {
  await ac(page, '/?senaryo=berkin', 1440, 900);
  await expect(page.getByRole('list', { name: 'Pano akışları' }).getByRole('button', { name: /^Hasat postu: \d+\/\d+ adım · \d+ atlandı/ })).toBeAttached();
});

test('N16 · 1440: şeritlerin hepsi görünür, altında adım listesi; adım seçilince detay, geri listeye', async ({ page }) => {
  await ac(page, '/akis/U422?senaryo=berkin', 1440, 900);
  const etiketler = page.getByRole('list', { name: 'Şeritler' }).getByRole('listitem');
  await expect(etiketler).toHaveCount(6);
  const liste = page.getByRole('list', { name: 'Adımlar' });
  await expect(liste.getByRole('button').first()).toBeVisible();
  const son = await etiketler.last().boundingBox(), ilk = await liste.getByRole('button').first().boundingBox();
  expect(son!.y + son!.height).toBeLessThan(ilk!.y);
  await expect(page.getByRole('tab')).toHaveCount(0);
  await cek(page, 'W4-akis-1440');
  await liste.getByRole('button', { name: /^15\. adım/ }).click();
  await expect(page).toHaveURL(/\/akis\/U422\/adim\/15/);
  await expect(page.locator('.gd-kaydir h2')).toHaveText(/Sızma testi/);
  await page.locator('.panel-geri').first().click();
  await expect(page).toHaveURL(/\/akis\/U422(\?|$)/);
  await expect(liste.getByRole('button').first()).toBeVisible();
});

test('N17: satırda karar ve çıktı işaretleri; Karar ve Çıktı süzgeçleri', async ({ page }) => {
  await ac(page, '/akis/RTD5?senaryo=berkin', 360, 780);
  const liste = page.getByRole('list', { name: 'Adımlar' });
  await expect(liste.getByRole('button', { name: /Karar adımı\.$/ }).first()).toBeAttached();
  await expect(liste.getByRole('button', { name: /\d+ çıktı\.$/ }).first()).toBeAttached();
  await page.getByRole('button', { name: /^Karar \d+/ }).click();
  const satirlar = liste.getByRole('listitem');
  await expect(satirlar.first()).toBeAttached();
  for (const b of await liste.getByRole('button').all()) await expect(b).toHaveAccessibleName(/Karar adımı\.|^[^0-9]/);
  await page.getByRole('button', { name: /^Çıktı \d+/ }).click();
  await expect(page.getByRole('heading', { name: 'ADIMLARA GÖRE' })).toBeAttached();
  await cek(page, 'W4-akis-360');
});
