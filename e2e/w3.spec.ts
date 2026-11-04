import { expect, test, type Page } from '@playwright/test';

// W3 (4 Kas, K3): Ayarlar'da tek Agent'larım listesi. Her agent: rutini, işi, onay bekleyen çıktısı; detayda bağlantı,
// rutin (adlandır, bağla, kaldır), işler. Kurulum: her adım tek cümle + ne göreceğin; "Devir listede yoksa" notu.
const ac = async (p: Page, yol: string, w = 390, h = 844) => {
  await p.setViewportSize({ width: w, height: h });
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto(yol);
};
const cek = (p: Page, ad: string) => p.screenshot({ path: `karsilastirma/uygulama/${ad}.png` });

test('W3 · agent’lar tek listede: onay bekleyen, boştaki rutin, genel rutin; bağlı uygulamalar ayrı', async ({ page }) => {
  await ac(page, '/ayarlar?senaryo=berkin&hal=w3');
  await expect(page.getByRole('heading', { name: 'AGENT’LARIM' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Berkin’in Claude’u.*1 çıktı onayını bekliyor/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Araştırma rutini.*Boşta · anında rutin/ })).toBeVisible();
  await expect(page.locator('.satir-kart', { hasText: 'Tüm agent’larının işine bakar' })).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'BAĞLI UYGULAMALAR' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'AI YAPSIN · CLAUDE RUTİNLERİ' })).toHaveCount(0);
  await cek(page, 'W3-agentlarim');
});

test('W3 · agent detayı: bağlantı, rutin, onay bekleyen iş; işe gider', async ({ page }) => {
  await ac(page, '/ayarlar?senaryo=berkin&hal=w3');
  await page.getByRole('button', { name: /^Berkin’in Claude’u/ }).click();
  const d = page.getByRole('dialog', { name: 'Berkin’in Claude’u' });
  await expect(d.getByRole('region', { name: 'Bağlantı' })).toContainText('Claude · senin adına yazar');
  await expect(d.getByRole('region', { name: 'Rutinler' })).toContainText('Anında · son çalışma');
  await expect(d.getByRole('button', { name: /rutinini bağla/ })).toHaveCount(0);
  await cek(page, 'W3-agent-detay');
  await d.getByRole('region', { name: 'ONAYINI BEKLİYOR' }).getByRole('button', { name: /Post görseli/ }).click();
  await expect(page).toHaveURL(/\/akis\/RTD5\/adim\/6/);
});

test('W3 · rutin yeniden adlandırılır; işi olmayan rutin bir agent’a bağlanır', async ({ page }) => {
  await ac(page, '/ayarlar?senaryo=berkin&hal=w3');
  await page.getByRole('button', { name: /^Araştırma rutini/ }).click();
  let d = page.locator('.alt-sayfa').filter({ has: page.locator('.agent-detay') });
  await expect(d).toContainText('henüz hiçbir görevin sahibi değil');
  await d.getByRole('button', { name: 'Adlandır' }).click();
  await d.getByRole('textbox', { name: 'Araştırma rutini rutininin adı' }).fill('Araştırma agent’ı');
  await d.getByRole('button', { name: 'Kaydet' }).click();
  await expect(d.getByRole('status')).toContainText(/Araştırma agent’ı agent'ının işlerini yapar/);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: /^Araştırma agent’ı/ })).toBeVisible();
  // rutinini kaldırınca agent genel zamanlanmış rutine düşer; genel rutin açıkça ona bağlanabilir
  await page.getByRole('button', { name: /^Berkin’in Claude’u/ }).click();
  await page.getByRole('dialog', { name: 'Berkin’in Claude’u' }).getByRole('button', { name: 'Kaldır' }).click();
  await page.getByRole('dialog', { name: /rutini kaldırılsın mı/ }).getByRole('button', { name: 'Kaldır', exact: true }).click();
  await page.getByRole('button', { name: /^Berkin’in Claude’u/ }).click();
  d = page.getByRole('dialog', { name: 'Berkin’in Claude’u' });
  await expect(d.getByRole('region', { name: 'Rutinler' })).toContainText('genel rutin; bu agent’ın işlerine de bakar');
  await cek(page, 'W3-rutin-bagla');
  await d.getByRole('button', { name: '“Zamanlanmış rutin” rutinini bağla' }).click();
  await expect(d.getByRole('region', { name: 'Rutinler' })).toContainText('Zamanlanmış · son çalışma');
  await page.keyboard.press('Escape');
  await expect(page.locator('.satir-kart', { hasText: 'Tüm agent’larının işine bakar' })).toHaveCount(0);
});

test('W3 · kurulum: her adım ne göreceğini söyler; Devir listede yoksa notu; agent için kurulumda istem agent adını taşır', async ({ page }) => {
  await ac(page, '/ayarlar?senaryo=berkin&kur=ai');
  const d = page.getByRole('dialog', { name: 'AI yapsın kurulumu' });
  await expect(d.locator('.rk-gor').first()).toContainText('Göreceğin:');
  await expect(d.getByText(/Devir listede yoksa/)).toBeVisible();
  await expect(d.getByRole('radio', { name: /Jeton gerekmez/ })).toBeVisible();
  await cek(page, 'W3-kurulum');
  await ac(page, '/ayarlar?senaryo=berkin&hal=w3');
  await page.getByRole('button', { name: /^Berkin’in Claude’u/ }).click();
  await page.getByRole('dialog', { name: 'Berkin’in Claude’u' }).getByRole('button', { name: 'Kurulum adımları' }).click();
  const k = page.getByRole('dialog', { name: 'AI yapsın kurulumu' });
  await expect(k.getByRole('heading', { name: /Berkin’in Claude’u/ })).toBeVisible();
  await k.getByRole('radio', { name: /İş hazır olunca hemen/ }).click();
  await expect(k.getByPlaceholder('Ör. Berkin’in Claude’u')).toHaveValue('Berkin’in Claude’u');
});
