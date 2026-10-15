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
});
