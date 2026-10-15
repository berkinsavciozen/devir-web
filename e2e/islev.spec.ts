import { expect, test } from '@playwright/test';

// Sahte kipte uçtan uca davranış (gerçek sunucu kodu, bellekteki veri).
test.describe('işlev', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('karar: seçimi değiştir, kararı ver → C2', async ({ page }) => {
    await page.goto('/akis/XPVZ/adim/9?senaryo=berkin&hal=karar');
    await page.getByText('Kararı ver').waitFor();
    await page.getByLabel(/Çayeli Kadın Girişimi/).uncheck();
    await page.getByRole('button', { name: /Kararı ver/ }).click();
    await expect(page.getByText(/Verildi ·/)).toBeVisible();
    await expect(page.getByText('4/5')).toBeVisible();
  });
  test('soru: dalı cevapla → seçilmeyen dal söner', async ({ page }) => {
    await page.goto('/akis/XPVZ?senaryo=berkin&hal=dal');
    await page.getByText('biri kalır', { exact: false }).waitFor();
    await page.getByRole('listitem', { name: /^Açık soru:/ }).click();
    await page.getByRole('radio', { name: /Her çiftçi kendi adına/ }).click();
    await page.getByRole('button', { name: 'Cevapla' }).click();
    await expect(page.getByText('biri kalır', { exact: false })).toHaveCount(0);
  });
  test('soru: tarih bekleyen adıma tarih ver', async ({ page }) => {
    await page.goto('/akis/XPVZ?senaryo=berkin&hal=tarih');
    await page.getByText('belli olur', { exact: false }).waitFor();
    await page.getByRole('listitem', { name: /Tarih bekliyor/ }).click();
    await page.locator('input[type=date]').fill('2026-10-20');
    await page.getByRole('button', { name: 'Cevapla' }).click();
    await expect(page.getByText('belli olur', { exact: false })).toHaveCount(0);
  });
});
