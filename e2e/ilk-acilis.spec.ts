import { expect, test, type Page } from '@playwright/test';

// 6 Kas test bulguları W3 (B4, B7, B8) ve W2 akış düzeyinde AI yapsın (K3).
const ac = async (p: Page, yol: string, w = 390, h = 844) => {
  await p.setViewportSize({ width: w, height: h });
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto(yol);
};

for (const [w, h] of [[390, 844], [1440, 900]] as const) {
  test(`B4 · ${w}: LLM bağlı değilken ilk ekran bağlanmayı sunar; "Buradan yaz" yok`, async ({ page }) => {
    await ac(page, '/?senaryo=bos', w, h);
    await expect(page.getByRole('heading', { name: /İlk akışını başlat/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Buradan yaz' })).toHaveCount(0);
    await page.getByRole('button', { name: 'ChatGPT’ye bağla' }).click();
    await expect(page).toHaveURL(/\/bagla\?uygulama=chatgpt/);
  });

  test(`B7 · ${w}: Claude bağlıyken ilk ekran işi sohbette anlatmayı söyler`, async ({ page }) => {
    await ac(page, '/?senaryo=bos&hal=bagli', w, h);
    await expect(page.getByRole('heading', { name: /Claude bağlı/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Claude’u aç' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'ChatGPT’yi de bağla' })).toBeVisible();
  });
}

test('B7 · ilk akıştan önce sohbetten taslak düştüyse ilk ekran o taslak; geri dönünce evren kalır', async ({ page }) => {
  await ac(page, '/?senaryo=bos&hal=taslak');
  await expect(page).toHaveURL(/\/yeni\/ILK1\/harita/);
  await page.goBack();
  await expect(page).toHaveURL(/\/(\?|$)/);
  await page.waitForTimeout(600);
  await expect(page).not.toHaveURL(/\/yeni\//);
});

test('B8 · masaüstünde taslak solda haritasıyla; cevaplanan soru haritada dolar, "?" soruyu açar', async ({ page }) => {
  await ac(page, '/yeni/TEURX?senaryo=berkin', 1440, 900);
  const sol = page.locator('.taslak-sol');
  await expect(sol.getByText('TASLAK HARİTASI')).toBeVisible();
  await expect(sol.getByText(/3 soru bekliyor/)).toBeVisible();
  await expect(sol.locator('.gezegen-hedef[aria-label*="soruya bağlı"]')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Harita', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Evet', exact: true }).click();
  await expect(sol.getByText(/2 soru bekliyor/)).toBeVisible();
  await expect(sol.locator('.gezegen-hedef[aria-label*="soruya bağlı"]')).toHaveCount(2);
  const soru = page.getByRole('heading', { level: 2 });
  await sol.locator('.gezegen-hedef[aria-label*="soruya bağlı"]').last().click();
  await expect(soru).toBeVisible();
  await page.screenshot({ path: 'test-results/taslak-sol.png' });
});

test('K3 · akışın Bilgi bölümünde AI yapsın: agent işlerinin hepsinde aç ve kapat', async ({ page }) => {
  await ac(page, '/akis/RTD5/bilgi?senaryo=berkin&hal=ai');
  const satir = page.getByRole('button', { name: /^AI yapsın: / });
  await expect(satir).toBeVisible();
  await satir.click();
  const d = page.getByRole('dialog', { name: 'AI yapsın' });
  await d.getByRole('button', { name: 'Hepsinde kapat' }).click();
  await expect(d.getByRole('status')).toContainText('AI yapsın kapandı');
  await d.getByRole('button', { name: 'Agent işlerinin hepsinde aç' }).click();
  await expect(d.getByRole('status')).toContainText(/AI yapsın/);
});
