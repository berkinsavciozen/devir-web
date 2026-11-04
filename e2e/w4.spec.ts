import { expect, test, type Page } from '@playwright/test';

// W4 (4 Kas, B5): taslak haritası. Taslak kurulmadan haritada görünür: rol şeritleri, tahmini zaman, hedef;
// sahibi belli olmayan rol, soruya bağlı adım ve hedefi aşan adım vurgulanır. Görevler, Akışlar ve /yeni'den açılır.
const ac = async (p: Page, yol: string, w = 390, h = 844) => {
  await p.setViewportSize({ width: w, height: h });
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto(yol);
};

test('W4 · taslak haritası: cümle, şeritler, eksikler, adımlar; soru satırı soruları açar', async ({ page }) => {
  await ac(page, '/yeni/TEURX/harita?senaryo=berkin');
  await expect(page.getByText(/13 adım · 3 soru bekliyor · 2 rolün sahibi belli/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'TASLAK HARİTASI' })).toBeVisible();
  const L = page.getByRole('list', { name: 'Taslak' });
  await expect(L.getByRole('heading', { name: 'KURMADAN ÖNCE · 5' })).toBeVisible();
  await expect(L).toContainText('Mali müşavir: kim yapacak belli değil');
  await expect(L).toContainText('cevabına bağlı: 6. adım');
  await expect(L.getByRole('heading', { name: 'ADIMLAR · 13' })).toBeVisible();
  await page.screenshot({ path: 'karsilastirma/uygulama/W4-taslak-harita.png', fullPage: true });
  await page.getByRole('button', { name: '6. İlgili çiftçileri Karadeniz\'de yerinde ziyaret et' }).click();
  await expect(page.getByRole('button', { name: /^6\. İlgili çiftçileri/, pressed: true })).toBeVisible();
  await L.getByRole('button', { name: /yerinde ziyaret edecek misin/ }).click();
  await expect(page).toHaveURL(/\/yeni\/TEURX$/);
  await page.getByRole('button', { name: 'Harita' }).click();
  await expect(page).toHaveURL(/\/yeni\/TEURX\/harita/);
});

test('W4 · girişler: Görevler bekleyenler ve /yeni yarım taslaklar haritayı açar', async ({ page }) => {
  await ac(page, '/gorevler?senaryo=berkin');
  await page.getByRole('button', { name: /^Taslak: Hasat için Karadeniz/ }).first().click();
  await expect(page).toHaveURL(/\/yeni\/[A-Z0-9]+\/harita/);
  await ac(page, '/yeni?senaryo=berkin');
  await page.locator('.taslak-liste button').first().click();
  await expect(page).toHaveURL(/\/yeni\/[A-Z0-9]+\/harita/);
});
