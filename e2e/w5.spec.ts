import { expect, test, type Page } from '@playwright/test';

// W5 (4 Kas, K4, K5): telefonda gezegene dokununca harita ona yakınlaşır ve altta küçük kutu açılır (ad, durum, AI durumu,
// tek ana eylem, Ayrıntılar); ikinci dokunuş görevi açar. Kutu açıkken harita etiketsizdir.
const ac = async (p: Page, yol: string, w = 390, h = 844) => {
  await p.setViewportSize({ width: w, height: h });
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto(yol);
  await p.locator('.harita-gezinme .gezegen-hedef').first().waitFor();
};
const cek = (p: Page, ad: string) => p.screenshot({ path: `karsilastirma/uygulama/${ad}.png` });

test('W5 · dokun: yakınlaşır, kutu açılır; ana eylem kutuda; ikinci dokunuş görevi açar', async ({ page }) => {
  await ac(page, '/akis/RTD5?senaryo=berkin&hal=ai');
  const g = page.getByRole('listitem', { name: /^6\. adım/ });
  await g.click();
  const k = page.getByRole('dialog', { name: /^6\. Post görseli/ });
  await expect(k).toBeVisible();
  await expect(k).toContainText('AI yazdı, onayını bekliyor');
  await expect(k.getByRole('button', { name: 'Onayla, bitir' })).toBeVisible();
  await expect(k.getByRole('button', { name: 'Ayrıntılar ›' })).toBeVisible();
  // kutu haritadaki gezegeni örtmez
  const kb = (await k.boundingBox())!, gb = (await g.boundingBox())!;
  expect(gb.y + gb.height / 2).toBeLessThan(kb.y);
  await cek(page, 'W5-kutu');
  await g.click();
  await expect(page).toHaveURL(/\/akis\/RTD5\/adim\/6/);
});

test('W5 · kutu kapanır; Ayrıntılar görevi açar; masaüstünde kutu yok', async ({ page }) => {
  await ac(page, '/akis/RTD5?senaryo=berkin');
  await page.getByRole('listitem', { name: /^4\. adım/ }).click();
  const k = page.getByRole('dialog', { name: /^4\. / });
  await expect(k).toBeVisible();
  await k.getByRole('button', { name: 'Kutuyu kapat' }).click();
  await expect(k).toHaveCount(0);
  await page.getByRole('listitem', { name: /^4\. adım/ }).click();
  await page.getByRole('dialog', { name: /^4\. / }).getByRole('button', { name: 'Ayrıntılar ›' }).click();
  await expect(page).toHaveURL(/\/akis\/RTD5\/adim\/4/);
  await ac(page, '/akis/RTD5?senaryo=berkin', 1440, 900);
  await page.getByRole('listitem', { name: /^4\. adım/ }).click();
  await expect(page).toHaveURL(/\/akis\/RTD5\/adim\/4/);
  await expect(page.locator('.harita-kutu')).toHaveCount(0);
});
