import { expect, test } from '@playwright/test';

// P6 (0.33.1): taslakta Plan alt sayfası; P4 (0.33.0): AI çıktısını yorumla geri gönder formu.
test('plan ekranı: senin zamanın şeridi ve yürütme rozetleri', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/yeni/TEURX');
  await page.getByRole('button', { name: 'Plan', exact: true }).click();
  const d = page.getByRole('dialog', { name: 'Plan' });
  await expect(d.locator('.taslak-serit')).toHaveText(/^Senin zamanın: .*AI: \d+ iş/);
  await expect(d.locator('.taslak-rozet.ai').first()).toHaveText('AI yapar');
  await expect(d.getByRole('button', { name: 'Önce soruları cevapla' })).toBeDisabled();
});

test('AI çıktısı: yorumla geri gönder formu açılır, yorum yazılmadan gönderilmez', async ({ page }) => {
  await page.goto('/akis/RTD5/adim/6?senaryo=berkin&hal=ai');
  const e = page.getByRole('group', { name: 'Eylemler' });
  await e.getByRole('button', { name: 'Yorumla geri gönder' }).click();
  const f = e.getByRole('form', { name: 'Yorumla geri gönder' });
  await expect(f.getByRole('button', { name: 'Geri gönder' })).toBeDisabled();
  await f.getByRole('textbox', { name: 'Yorum' }).fill('Fiyatları güncelle');
  await f.getByRole('button', { name: 'Geri gönder' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Geri bildirim AI’a gitti' })).toBeVisible();
});
