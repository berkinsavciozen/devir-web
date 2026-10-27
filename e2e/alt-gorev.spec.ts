import { expect, test, type Page } from '@playwright/test';

// W5 (el notları 23 Eki N23, N24): gerçek alt görev. Görev detayında alt görevler listelenir ve eklenir; alt görevin sayfası
// üst görevden ayırt edilir (uydu boyunda gezegen, "ALT GÖREV" etiketi, üst göreve dönüş); haritada alt görevler uydu.
const ac = async (p: Page, yol: string, w: number, h: number) => {
  await p.setViewportSize({ width: w, height: h });
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto(yol);
  await p.locator('.gd-bas').waitFor();
};

for (const [w, h] of [[390, 844], [1440, 900]] as const) {
  test(`alt görev · ${w}: üst görevde liste ve sayı; alt görev sayfası ayrı, üstüne döner`, async ({ page }) => {
    await ac(page, '/akis/RTD5/adim/10?senaryo=berkin&hal=alt', w, h);
    const bolum = page.getByRole('region', { name: /ALT GÖREVLER/ });
    await expect(bolum.locator('.gd-bolum-baslik')).toHaveText('ALT GÖREVLER · 1/3');
    await expect(bolum.locator('.gd-bag')).toHaveCount(3);
    await expect(page.locator('.gd-bas small')).toContainText('1/3 alt görev');
    await expect(page.locator('.gd-ust')).toHaveCount(0);
    await bolum.getByRole('button', { name: /Instagram içgörülerini çek/ }).click();
    await expect(page).toHaveURL(/\/akis\/RTD5\/adim\/12/);
    await expect(page.locator('.gd-tur')).toHaveText('ALT GÖREV');
    await expect(page.locator('.gd-bas h2')).toContainText('Instagram içgörüleri');
    // alt görevin altına alt görev eklenmez
    await expect(page.getByRole('textbox', { name: 'Yeni alt görevin adı' })).toHaveCount(0);
    await page.locator('.gd-ust').click();
    await expect(page).toHaveURL(/\/akis\/RTD5\/adim\/10/);
    await expect(page.locator('.gd-tur')).toHaveCount(0);
  });
}

test('alt görev · 390: detaydan eklenir; eklenen listede ve akış listesinde üstünün altında', async ({ page }) => {
  await ac(page, '/akis/RTD5/adim/3?senaryo=berkin', 390, 844);
  const bolum = page.getByRole('region', { name: /ALT GÖREVLER/ });
  await expect(bolum.locator('.gd-bag')).toHaveCount(0);
  await bolum.getByRole('textbox', { name: 'Yeni alt görevin adı' }).fill('TestFlight davet bağlantısını oluştur');
  await bolum.getByRole('button', { name: 'Alt görevi ekle' }).click();
  await expect(bolum.locator('.gd-bag')).toHaveCount(1);
  await expect(bolum.locator('.gd-bolum-baslik')).toHaveText('ALT GÖREVLER · 0/1');
  await expect(bolum.getByRole('textbox', { name: 'Yeni alt görevin adı' })).toHaveValue('');
  // açık alt görev varken üst görev "bitti" olarak işaretlenmez
  await expect(page.getByRole('button', { name: 'Bitti olarak işaretle' })).toHaveCount(0);
  await expect(page.locator('.gd-eylem')).toContainText('Alt görevlerin hepsi bitince');
});

test('alt görev · 390: akış listesinde alt görevler üstünün hemen ardından, sayısıyla', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/akis/RTD5/bilgi?senaryo=berkin&hal=alt');
  const liste = page.getByRole('list', { name: 'Adımlar' });
  await liste.getByRole('listitem').first().waitFor({ state: 'attached' });
  const satirlar = (await liste.getByRole('listitem').allTextContents()).map((t) => t.trim());
  const i = satirlar.findIndex((t) => t.startsWith('10. '));
  expect(satirlar[i]).toContain('1/3 alt görev');
  expect(satirlar.slice(i + 1, i + 4).map((t) => t.split('.')[0])).toEqual(['11', '12', '13']);
  await expect(liste.getByRole('listitem').nth(i + 1).getByRole('button')).toHaveAccessibleName(/alt görev \(10\. Rapor görevinin\)/);
});

test('alt görev · 1440: panel konumu akış › üst görev › alt görev', async ({ page }) => {
  await ac(page, '/akis/RTD5/adim/12?senaryo=berkin&hal=alt', 1440, 900);
  await expect(page.locator('.panel-konum')).toHaveText(/› Rapor › Instagram içgörüleri/);
});

test('alt görev · 390: haritada alt görev gezegen değil, üstünün uydusu', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/akis/RTD5?senaryo=berkin&hal=alt');
  // uydu sistemi v2 (plan 27 Eki, 3.B): uzakta Satürn halkası ve biten oranı
  await expect(page.locator('.uydu-halka').first()).toBeAttached();
  await expect(page.locator('svg text', { hasText: '1/3' }).first()).toBeAttached();
});
