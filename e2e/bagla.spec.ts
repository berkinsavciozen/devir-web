import { expect, test } from '@playwright/test';

// 0.35.0: Bağla sayfasında altı uygulama; adres ve onay aynı, yol ve kısıt uygulamaya göre.
test('bağla: altı uygulama, sekme yolu ve başlığı değiştirir; adresle açılış', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/bagla?senaryo=berkin&uygulama=gemini');
  await expect(page.getByRole('heading', { name: 'Gemini’ye bağla' })).toBeVisible();
  const sekmeler = page.getByRole('tablist', { name: 'Uygulama' }).getByRole('tab');
  await expect(sekmeler).toHaveText(['Claude', 'ChatGPT', 'Gemini', 'Perplexity', 'Le Chat', 'Grok']);
  await expect(page.getByText(/Connected Apps › Add a custom app/)).toBeVisible();
  await page.getByRole('tab', { name: 'Grok' }).click();
  await expect(page.getByRole('heading', { name: 'Grok’a bağla' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Grok’u aç' })).toBeVisible();
  await page.getByRole('tab', { name: 'Le Chat' }).click();
  await expect(page.getByText(/Adı boşluksuz yaz: Devir/)).toBeVisible();
  // tanınmayan uygulama adı Claude'a düşer
  await page.goto('/bagla?senaryo=berkin&uygulama=yok');
  await expect(page.getByRole('heading', { name: 'Claude’a bağla' })).toBeVisible();
  // yatay taşma yok
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
