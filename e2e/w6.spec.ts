import { expect, test, type Page } from '@playwright/test';

// W6 (4 Kas): Görevler = "sen ve agent'ların". Üst cümle, senden beklenenler (onay, karar, iş), agent'ların (iş kipi),
// kişi şeritli harita (sen + agent'ların, akış haritası işaretleriyle), agent detayında AI durumuna göre işler ve geçmiş.
const ac = async (p: Page, yol: string, w = 390, h = 844) => {
  await p.setViewportSize({ width: w, height: h });
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto(yol);
};
const cek = (p: Page, ad: string) => p.screenshot({ path: `karsilastirma/uygulama/${ad}.png`, fullPage: true });

test('W6 · üst cümle ve karar kuyruğu (P5): önce AI onayı, sonra karar; satır çıktıyı açar', async ({ page }) => {
  await ac(page, '/gorevler?senaryo=berkin&hal=w3');
  await expect(page.getByText(/Senden 1 onay, 1 karar ve \d+ iş bekleniyor\./)).toBeVisible();
  await expect(page.getByRole('button', { name: /Kişi: Ben \+ agent’larım/ })).toBeVisible();
  const L = page.getByRole('list', { name: 'Kararların, işlerin ve agent’ların' });
  await expect(L.getByRole('heading', { name: /KARARLARIN/ })).toBeVisible();
  const satirlar = L.locator('.satir-kart');
  await expect(satirlar.nth(0)).toContainText('Post görseli');
  await expect(satirlar.nth(0)).toContainText('AI yazdı, onayını bekliyor');
  await expect(satirlar.nth(1)).toContainText('karar');
  await expect(L.getByRole('button', { name: /: Onayla$/ })).toHaveCount(1);
  await cek(page, 'W6-gorevler');
  await satirlar.nth(0).click();
  await expect(page).toHaveURL(/\/akis\/RTD5\/adim\/6/);
});

test('W6 · Onayla satırdan bitirir; liste ve cümle güncellenir', async ({ page }) => {
  await ac(page, '/gorevler?senaryo=berkin&hal=w3');
  await page.getByRole('button', { name: /: Onayla$/ }).first().click();
  await expect(page.getByText(/Senden 1 karar ve \d+ iş bekleniyor\./)).toBeVisible();
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

test('W6 · harita sen ve agent’ların şeritleri; masaüstünde solda', async ({ page }) => {
  await ac(page, '/gorevler?senaryo=berkin&hal=w3');
  await expect(page.getByRole('heading', { name: 'HARİTA · SEN VE AGENT’LARIN' })).toBeVisible();
  await ac(page, '/gorevler?senaryo=berkin&hal=w3', 1440, 900);
  await expect(page.locator('.gorev-sol-ad', { hasText: 'Berkin’in Claude’u' })).toBeVisible();
  await page.screenshot({ path: 'karsilastirma/uygulama/W6-gorevler-1440.png' });
});

test('W6 · başka kişi süzgecinde eski görünüm kalır', async ({ page }) => {
  await ac(page, '/gorevler?senaryo=berkin&hal=w3&kisi=hepsi');
  await expect(page.getByRole('heading', { name: /KARARLARIN/ })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'GÖREV HARİTASI · KİŞİLER' })).toBeVisible();
});
