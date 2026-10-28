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
  test(`alt görev · ${w}: üst görevde liste ve sayılar; akordiyonda yönetim, "Ayrıntılar" yok`, async ({ page }) => {
    await ac(page, '/akis/RTD5/adim/10?senaryo=berkin&hal=alt', w, h);
    const bolum = page.getByRole('region', { name: /ALT GÖREVLER/ });
    await expect(bolum.locator('.gd-bolum-baslik')).toHaveText('ALT GÖREVLER · 1/3');
    await expect(bolum.locator('.gd-akordiyon')).toHaveCount(3);
    await expect(page.locator('.gd-bas small')).toContainText('1/3 alt görev');
    // K2: üst görevin sayıları alt görevlerden
    await expect(page.locator('.gd-sayilar')).toContainText('1/3alt görev');
    await expect(page.locator('.gd-sayilar')).toContainText('en erken bitiş');
    await expect(page.locator('.gd-sayilar')).toContainText('son tarih');
    // plan 28 Eki, B5: alt görev aynı yerde yönetilir
    const ig = bolum.locator('.gd-akordiyon', { hasText: 'Instagram içgörülerini çek' });
    await ig.locator('summary').click();
    await expect(ig.getByRole('combobox', { name: 'Sahip' })).toBeVisible();
    await expect(ig.getByLabel('Son tarih')).toBeVisible();
    await expect(ig.getByRole('textbox', { name: /alt göreve not/ })).toBeVisible();
    await expect(ig.getByRole('button', { name: 'Ayrıntılar' })).toHaveCount(0);
  });
}

test('alt görev · 390: alt görevin adresi üst görevi o akordiyon açık getirir', async ({ page }) => {
  await ac(page, '/akis/RTD5/adim/12?senaryo=berkin&hal=alt', 390, 844);
  await expect(page.locator('.gd-bas h2')).toContainText('Rapor');
  const ig = page.locator('.gd-akordiyon', { hasText: 'Instagram içgörülerini çek' });
  await expect(ig).toHaveAttribute('open', '');
  await expect(page.locator('.gd-akordiyon[open]')).toHaveCount(1);
  await expect(ig.getByRole('combobox', { name: 'Sahip' })).toBeInViewport();
});

test('alt görev · 390: akordiyondan not ve son tarih yazılır', async ({ page }) => {
  await ac(page, '/akis/RTD5/adim/10?senaryo=berkin&hal=alt', 390, 844);
  const bolum = page.getByRole('region', { name: /ALT GÖREVLER/ });
  const ak = bolum.locator('.gd-akordiyon', { hasText: 'Instagram içgörülerini çek' });
  await ak.locator('summary').click();
  await ak.getByRole('textbox', { name: /alt göreve not/ }).fill('Müşteriye soruldu');
  await ak.getByRole('button', { name: 'Notu ekle' }).click();
  await expect(ak.getByRole('list', { name: 'Notlar' })).toContainText('Müşteriye soruldu');
  await ak.getByLabel('Son tarih').fill('2026-11-20');
  await expect(ak.locator('summary')).toContainText('son tarih 20 Kas');
  await page.screenshot({ path: 'karsilastirma/uygulama/Q4-akordiyon-390.png', fullPage: false });
});

test('alt görev · 390: detaydan eklenir; eklenen listede ve akış listesinde üstünün altında', async ({ page }) => {
  await ac(page, '/akis/RTD5/adim/3?senaryo=berkin', 390, 844);
  const bolum = page.getByRole('region', { name: /ALT GÖREVLER/ });
  await expect(bolum.locator('.gd-akordiyon')).toHaveCount(0);
  await bolum.getByRole('textbox', { name: 'Yeni alt görevin adı' }).fill('TestFlight davet bağlantısını oluştur');
  await bolum.getByRole('button', { name: 'Alt görevi ekle' }).click();
  await expect(bolum.locator('.gd-akordiyon')).toHaveCount(1);
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

test('alt görev · 390: akordiyonda yalnız sırası gelmiş kendi alt görevi bitirilir', async ({ page }) => {
  await ac(page, '/akis/RTD5/adim/10?senaryo=berkin&hal=alt', 390, 844);
  const bolum = page.getByRole('region', { name: /ALT GÖREVLER/ });
  // öncülü (9) bitmemiş: durum düğmeleri yok
  const ig = bolum.locator('.gd-akordiyon', { hasText: 'Instagram içgörülerini çek' });
  await ig.locator('summary').click();
  await expect(ig.getByRole('button', { name: 'Bitti' })).toHaveCount(0);
  await expect(ig.getByRole('group', { name: 'Durum' })).toHaveCount(0);
  await expect(bolum.locator('.gd-akordiyon[open]')).toHaveCount(1);
});

test('alt görev · 390: akış listesinde üst görev daraltılır, alt görevler girintili', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/akis/RTD5/bilgi?senaryo=berkin&hal=alt');
  const liste = page.getByRole('list', { name: 'Adımlar' });
  const dar = liste.getByRole('button', { name: /alt görevleri daralt/ });
  await expect(dar).toHaveCount(1);
  await expect(dar).toHaveAttribute('aria-expanded', 'true');
  const ust = await liste.getByRole('button', { name: /^10\. adım/ }).boundingBox();
  const alt = await liste.getByRole('button', { name: /^11\. alt görev/ }).boundingBox();
  expect(alt!.x).toBeGreaterThan(ust!.x + 8);
  const once = await liste.getByRole('listitem').count();
  await dar.click();
  await expect(liste.getByRole('listitem')).toHaveCount(once - 3);
  await expect(liste.getByRole('button', { name: /alt görevleri aç/ })).toHaveAttribute('aria-expanded', 'false');
});

test('alt görev · 390: Görevler listesinde alt görev üst göreviyle, üst görev ilerlemesiyle', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/gorevler?senaryo=berkin&hal=alt&kisi=hepsi&durum=hepsi');
  const L = page.getByRole('list', { name: 'Görevler' });
  await expect(L.locator('.ust-kirinti').first()).toBeVisible();
  await expect(L.getByRole('button', { name: /^Rapor › / }).first()).toBeVisible();
  await expect(L.getByRole('button', { name: /1\/3 alt görev/ })).toHaveCount(1);
});
