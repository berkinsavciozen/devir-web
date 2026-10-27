import { expect, test } from '@playwright/test';

// Sahte kipte uçtan uca davranış (gerçek sunucu kodu, bellekteki veri).
test.describe('işlev', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('karar: görev detayında seçimi değiştir, kararı ver → verilmiş karar', async ({ page }) => {
    await page.goto('/akis/XPVZ/adim/9?senaryo=berkin&hal=karar');
    await page.getByText('Kararı ver').waitFor();
    await page.getByLabel(/Çayeli Kadın Girişimi/).uncheck();
    await page.getByRole('button', { name: /Kararı ver/ }).click();
    await expect(page.getByText(/Verildi ·/)).toBeVisible();
    await expect(page.getByText(/4’sini kabul etti/)).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: 'Çayeli Kadın Girişimi' })).toContainText('kabul edilmedi');
  });
  test('soru: dalı cevapla → seçilmeyen dal söner', async ({ page }) => {
    await page.goto('/akis/XPVZ?senaryo=berkin&hal=dal');
    const soru = page.getByRole('listitem', { name: /^Açık soru:/ });
    await soru.first().click();
    await page.getByRole('radio', { name: /Her çiftçi kendi adına/ }).click();
    await page.getByRole('button', { name: 'Cevapla' }).click();
    await page.locator('.harita-gezinme .gezegen-hedef').first().waitFor();
    await expect(soru).toHaveCount(0);
  });
  test('soru: tarih bekleyen adıma tarih ver', async ({ page }) => {
    await page.goto('/akis/XPVZ?senaryo=berkin&hal=tarih');
    const soru = page.getByRole('listitem', { name: /Tarih bekliyor/ });
    await soru.click();
    await page.locator('input[type=date]').fill('2026-10-20');
    await page.getByRole('button', { name: 'Cevapla' }).click();
    await page.locator('.harita-gezinme .gezegen-hedef').first().waitFor();
    await expect(soru).toHaveCount(0);
  });
  test('dış katılımcı: başladım, bağlantıyla teslim, teşekkür', async ({ page }) => {
    await page.goto('/l/k7Q2emreTestBank00wP9?senaryo=berkin');
    await page.getByRole('button', { name: 'Başladım' }).click();
    await expect(page.getByRole('button', { name: 'Başladım' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Tamam' }).click();
    await page.getByRole('tab', { name: 'Bağlantı' }).click();
    await page.locator('input[type=url]').fill('drive.google.com/x');
    await expect(page.getByText('http ya da https', { exact: false })).toBeVisible();
    await page.locator('input[type=url]').fill('https://drive.google.com/x');
    await page.getByRole('button', { name: /Teslim et ve bitir/ }).click();
    await expect(page.getByText('Teşekkürler Emre.')).toBeVisible();
    await expect(page.getByText('Berkin’in ekranında görünüyor.')).toBeVisible();
  });
  test('dış katılımcı: geçersiz bağlantı', async ({ page }) => {
    await page.goto('/l/gecersizbaglanti0000?senaryo=berkin');
    await expect(page.getByText('Bu bağlantı artık açılmıyor.')).toBeVisible();
  });
  test('yeni iş: cümle → taslak → üç soru → akış kurulur', async ({ page }) => {
    await page.goto('/yeni?senaryo=berkin');
    await page.getByLabel('İş cümlesi').fill('Hasat için Aralık sonuna kadar Karadeniz’den 5 çiftçi daha kazandırmam lazım.');
    await page.getByRole('button', { name: 'Taslak çıkar' }).click();
    await expect(page).toHaveURL(/\/yeni\/TEURX/);
    const kur = page.getByRole('button', { name: 'Akışı kur' });
    await expect(kur).toBeDisabled();
    const soru = page.getByRole('heading', { level: 2 });
    await page.getByRole('button', { name: 'Hayır', exact: true }).click();
    await expect(soru).toContainText('vergi kaydı');
    await page.getByRole('button', { name: 'Evet', exact: true }).click();
    await expect(soru).toContainText('lojistik');
    await page.getByRole('button', { name: 'Hayır', exact: true }).click();
    await expect(kur).toBeEnabled();
    // varsayım rozeti: yanlış dersen soru olur, kur yeniden kilitlenir
    await page.getByRole('button', { name: /Varsayım: Elinde Karadeniz/ }).click();
    await page.getByRole('button', { name: 'Bu yanlış, sor' }).click();
    await expect(kur).toBeDisabled();
    await page.getByRole('button', { name: 'Var', exact: true }).click();
    await kur.click();
    await expect(page).toHaveURL(/\/akis\/[A-Z0-9]{4}/);
    await expect(page.getByRole('main', { name: /Hasat/ })).toBeVisible();
  });
  test('ekip: davet → paylaşım sayfası; Selin çıkarılır, anahtarı iptal edilir; alan değişir', async ({ page }) => {
    await page.goto('/ayarlar/ekip?senaryo=berkin&hal=ekip');
    await page.getByRole('button', { name: 'Kişi davet et' }).click();
    await page.getByLabel('E-posta').fill('ayse@ornek.com');
    await page.getByLabel('Adı', { exact: true }).fill('Ayşe');
    await page.getByRole('button', { name: 'Davet et', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Davet kaydedildi' })).toBeVisible();
    await page.getByRole('button', { name: 'Tamam' }).click();
    await expect(page.getByRole('region', { name: 'Ayşe daveti' })).toContainText('e-posta gitmedi');
    await page.getByRole('button', { name: /^Selin: rol/ }).click();
    await page.getByRole('button', { name: 'Alandan çıkar' }).click();
    await page.getByRole('button', { name: 'Çıkar', exact: true }).click();
    await expect(page.getByRole('button', { name: /^Selin: rol/ })).toHaveCount(0);
    await page.goto('/ayarlar?senaryo=berkin&hal=ekip');
    await expect(page.getByRole('button', { name: 'Selin anahtarını iptal et' })).toHaveCount(0);
    await page.goto('/hesap?senaryo=berkin&hal=ekip');
    await page.getByRole('button', { name: /Kapsama testi.* alanına geç/ }).click();
    await expect(page).toHaveURL(/\/(\?|$)/);
  });
});
