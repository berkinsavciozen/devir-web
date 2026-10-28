import { expect, test, type Page } from '@playwright/test';

// P8 (plan 27 Eki, Epic 5): Devir AI sohbeti. Sahte kipte sunucunun sohbet döngüsü gerçek; model yerine kalıp motoru
// (sahteSohbet): "N. adım bitti" → tamam önerisi, "N. adımı atla" → onay isteyen atlama, başka her şeye akış özeti.
const ac = async (p: Page, yol: string, w = 390, h = 844) => {
  await p.setViewportSize({ width: w, height: h });
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto(yol);
};
const pencere = (p: Page) => p.getByRole('dialog', { name: 'Devir AI' });
const sor = async (p: Page, metin: string) => {
  const d = pencere(p);
  await d.getByRole('textbox', { name: "Devir AI'a mesaj" }).fill(metin);
  await d.getByRole('button', { name: 'Gönder' }).click();
};

test('Devir AI · 390: evrenden açılır, soruya akış verisiyle cevap verir, kullanımı gösterir', async ({ page }) => {
  await ac(page, '/?senaryo=berkin');
  await page.getByRole('button', { name: 'Devir AI' }).click();
  const d = pencere(page);
  await expect(d).toBeVisible();
  await expect(d.locator('.ai-bas small')).toHaveText('Tüm akışların hakkında');
  await expect(d.getByLabel('Devir AI kullanımı')).toHaveText('Bu ayın kullanımı: %62');
  await d.getByRole('button', { name: 'Bugün neye bakayım?' }).click();
  await expect(d.locator('.ai-mesaj.kullanici')).toHaveText('Bugün neye bakayım?');
  await expect(d.locator('.ai-mesaj.asistan')).toHaveCount(1);
  await expect(d.locator('.ai-mesaj.asistan')).not.toBeEmpty();
  await expect(d.locator('.ai-oneri')).toHaveCount(0);
});

test('Devir AI · 390: akışta bağlamı bilir; önerilen değişiklik Uygula ile yazılır', async ({ page }) => {
  await ac(page, '/akis/RTD5?senaryo=berkin');
  await page.getByRole('button', { name: 'Devir AI' }).click();
  const d = pencere(page);
  await expect(d.locator('.ai-bas small')).toHaveText('RTD5 hakkında');
  await sor(page, '3. adım bitti');
  const k = d.locator('.ai-oneri');
  await expect(k).toContainText('ÖNERİLEN DEĞİŞİKLİK');
  await expect(k).toContainText('3. adım: durum → tamam');
  await k.getByRole('button', { name: 'Uygula' }).click();
  await expect(k.locator('h3')).toHaveText('UYGULANDI');
  await expect(k.locator('li small')).toHaveText('Yazıldı');
  // yazılan değişiklik görev detayında görünür
  await page.keyboard.press('Escape');
  await expect(d).toHaveCount(0);
  await page.evaluate(() => { history.pushState(null, '', '/akis/RTD5/adim/3?senaryo=berkin'); dispatchEvent(new Event('devir:yol')); });
  await page.locator('.gd-bas').waitFor();
  await expect(page.getByRole('button', { name: 'Bitti olarak işaretle' })).toHaveCount(0);
});

test('Devir AI · 390: atlama ayrıca onay ister; Vazgeç yazmaz', async ({ page }) => {
  await ac(page, '/akis/RTD5?senaryo=berkin');
  await page.getByRole('button', { name: 'Devir AI' }).click();
  const d = pencere(page);
  await sor(page, '4. adımı atla');
  const k = d.locator('.ai-oneri');
  await expect(k).toContainText('Ayrıca onay ister');
  await k.getByRole('button', { name: 'Uygula' }).click();
  await expect(k).toContainText('Emin misin?');
  await k.getByRole('button', { name: 'Vazgeç' }).click();
  await expect(k.locator('h3')).toHaveText('VAZGEÇİLDİ');
  await sor(page, '4. adımı atla');
  const k2 = d.locator('.ai-oneri').nth(1);
  await k2.getByRole('button', { name: 'Uygula' }).click();
  await k2.getByRole('button', { name: 'Evet, uygula' }).click();
  await expect(k2.locator('h3')).toHaveText('UYGULANDI');
});

test('Devir AI · 390: sınır dolunca yazı kapalı, ne zaman yenileneceği yazar', async ({ page }) => {
  await ac(page, '/?senaryo=berkin&hal=sinir');
  await page.getByRole('button', { name: 'Devir AI' }).click();
  const d = pencere(page);
  await expect(d.getByLabel('Devir AI kullanımı')).toContainText('doldu');
  await expect(d.getByRole('textbox', { name: "Devir AI'a mesaj" })).toBeDisabled();
});

test('Devir AI · 390: model anahtarı yoksa kapalı olduğunu söyler', async ({ page }) => {
  await ac(page, '/?senaryo=berkin&hal=ai-kapali');
  await page.getByRole('button', { name: 'Devir AI' }).click();
  await sor(page, 'Merhaba');
  await expect(pencere(page).getByRole('alert')).toContainText('Devir AI şu an kapalı');
});

test('Devir AI · 1440: panel üstünde düğme, sağda panel; adım sayfasında adımı bilir', async ({ page }) => {
  await ac(page, '/akis/RTD5/adim/3?senaryo=berkin', 1440, 900);
  await page.locator('.panel-ust').getByRole('button', { name: 'Devir AI' }).click();
  const d = pencere(page);
  await expect(d.locator('.ai-bas small')).toHaveText('RTD5 · 3. adım hakkında');
  const b = await d.boundingBox();
  expect(b!.x).toBeGreaterThan(900);
});

test('Devir AI · 390: yazarken odak yazı alanında kalır, Enter gönderir', async ({ page }) => {
  await ac(page, '/akis/RTD5?senaryo=berkin');
  await page.getByRole('button', { name: 'Devir AI' }).click();
  const t = pencere(page).getByRole('textbox', { name: "Devir AI'a mesaj" });
  await t.click();
  await page.keyboard.type('3. adım bitti');
  await expect(t).toHaveValue('3. adım bitti');
  await expect(t).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(t).toHaveValue('');
  await expect(pencere(page).locator('.ai-oneri')).toContainText('3. adım: durum → tamam');
});
