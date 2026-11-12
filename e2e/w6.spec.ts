import { expect, test, type Page } from '@playwright/test';

// W6 (4 Kas): Görevler = "sen ve agent'ların". Üst cümle, senden beklenenler (onay, karar, iş), agent'ların (iş kipi),
// kişi şeritli harita (sen + agent'ların, akış haritası işaretleriyle), agent detayında AI durumuna göre işler ve geçmiş.
const ac = async (p: Page, yol: string, w = 390, h = 844) => {
  await p.setViewportSize({ width: w, height: h });
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto(yol);
};
const cek = (p: Page, ad: string) => p.screenshot({ path: `karsilastirma/uygulama/${ad}.png`, fullPage: true });

test('W6 → Tek Pano (12 Kas): Görevler Pano’yu Kişi = Ben ile açar; senden beklenen, agent’ların; kart göreve açar', async ({ page }) => {
  await ac(page, '/gorevler?senaryo=berkin&hal=w3');
  await expect(page.getByRole('heading', { name: 'Görevler', level: 2 })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Kimin işleri' }).getByRole('button', { name: 'Ben' })).toHaveAttribute('aria-pressed', 'true');
  const S = page.getByRole('region', { name: /SENDEN BEKLENEN/ });
  await expect(S.locator('.gorev-kart', { hasText: 'Post görseli' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Agent’ların' }).getByRole('button', { name: /^Berkin’in Claude’u/ })).toBeVisible();
  await cek(page, 'W6-gorevler');
  await S.locator('.gorev-kart', { hasText: 'Post görseli' }).getByRole('button').first().click();
  await expect(page).toHaveURL(/\/akis\/RTD5\/adim\/6/);
});

test('W6 → Tek Pano: Hepsi süzgeci adrese yazılır; agent’ların ve bekleyenler yalnız Ben’de', async ({ page }) => {
  await ac(page, '/gorevler?senaryo=berkin&hal=w3');
  await page.getByRole('group', { name: 'Kimin işleri' }).getByRole('button', { name: 'Hepsi' }).click();
  await expect(page).toHaveURL(/kisi=hepsi/);
  await expect(page.getByRole('region', { name: 'Agent’ların' })).toHaveCount(0);
  await page.goBack();
  await expect(page.getByRole('region', { name: 'Agent’ların' })).toBeVisible();
});

test('W6 · agent’ların ve agent detayı: AI durumuna göre işler, satırda çalışma geçmişi', async ({ page }) => {
  await ac(page, '/gorevler?senaryo=berkin&hal=w3');
  await page.getByRole('button', { name: /^Berkin’in Claude’u/ }).click();
  const d = page.getByRole('dialog', { name: 'Berkin’in Claude’u' });
  await expect(d.getByRole('region', { name: 'Bağlantı' })).toHaveCount(0);
  await expect(d.getByRole('region', { name: 'ONAYINI BEKLİYOR' })).toContainText('6. Post görseli');
  await expect(d.getByRole('region', { name: 'AI YAPSIN · SIRADA' })).toContainText('10. Rapor');
  await d.getByRole('button', { name: /6\. Post görseli/ }).click();
  await expect(d.getByRole('list', { name: /çalışma geçmişi/ })).toBeVisible();
  await d.getByRole('button', { name: 'Göreve git' }).click();
  await expect(page).toHaveURL(/\/akis\/RTD5\/adim\/6/);
});

test('W6 · harita sen ve agent’ların şeritleri masaüstünde solda', async ({ page }) => {
  await ac(page, '/gorevler?senaryo=berkin&hal=w3', 1440, 900);
  await expect(page.getByRole('heading', { name: 'HARİTA · SEN VE AGENT’LARIN' })).toBeVisible();
  await expect(page.locator('.gorev-sol-ad', { hasText: 'Berkin’in Claude’u' })).toBeVisible();
  await page.screenshot({ path: 'karsilastirma/uygulama/W6-gorevler-1440.png' });
});

test('W6 · Hepsi süzgecinde harita kişi şeritli (masaüstü)', async ({ page }) => {
  await ac(page, '/gorevler?senaryo=berkin&hal=w3&kisi=hepsi', 1440, 900);
  await expect(page.getByRole('heading', { name: 'GÖREV HARİTASI · KİŞİLER' })).toBeVisible();
});
