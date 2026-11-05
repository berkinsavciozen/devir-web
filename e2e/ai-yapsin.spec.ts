import { expect, test, type Page } from '@playwright/test';

// 0.29.0 AI yapsın: agent görevinin sahibi işaretler; rutin çıktıyı yazınca görev bakılacak olur, sahibi bitirir.
const ac = async (p: Page, yol: string, w = 1440, h = 900) => {
  await p.setViewportSize({ width: w, height: h });
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto(yol);
};
const cek = (p: Page, ad: string) => p.screenshot({ path: `karsilastirma/uygulama/${ad}.png` });

for (const [w, h] of [[390, 844], [1440, 900]] as const) {
  test(`AI yapsın · ${w}: onay bekleyen görevde "Onayla, bitir" görevi tamamlar`, async ({ page }) => {
    await ac(page, '/akis/RTD5/adim/6?senaryo=berkin&hal=ai', w, h);
    const b = page.getByRole('region', { name: 'AI YAPSIN' });
    await expect(b.getByRole('status')).toHaveText(/^Açık\./);
    await expect(page.locator('.gd-cumle')).toHaveText(/çıktısını yazdı\. Bakıp onayla\.$/);
    const e = page.getByRole('group', { name: 'Eylemler' });
    await expect(e.getByRole('button', { name: 'Yorumla geri gönder' })).toBeVisible();
    await e.getByRole('button', { name: 'Onayla, bitir' }).click();
    await expect(page.getByRole('button', { name: 'Onayla, bitir' })).toHaveCount(0);
    await expect(page.locator('.gd-bas small')).toContainText(/tamam/i);
  });
}

test('AI yapsın: öncül bekleyen görev ne beklediğini söyler; ⋯ menüsünden kapatılır', async ({ page }) => {
  await ac(page, '/akis/RTD5/adim/10?senaryo=berkin&hal=ai');
  const b = page.getByRole('region', { name: 'AI YAPSIN' });
  await expect(page.locator('.gd-cumle')).toHaveText('9. görev bitince Berkin’in Claude’u başlar.');
  await expect(b.getByRole('checkbox', { name: /planlanan başlangıç/i })).not.toBeChecked();
  await page.getByRole('button', { name: 'Diğer eylemler' }).click();
  await page.getByRole('menuitem', { name: 'AI yapsın’ı kapat' }).click();
  await expect(b.getByRole('status')).toHaveText(/^Kapalı\./);
  await expect(b.getByText(/dışarıya gönderme işleri otomatik yapılmaz/)).toBeVisible();
  await expect(page.getByRole('group', { name: 'Eylemler' }).getByRole('button', { name: 'AI yapsın', exact: true })).toBeVisible();
});

test('AI yapsın: insan görevinde bölüm yok', async ({ page }) => {
  await ac(page, '/akis/RTD5/adim/7?senaryo=berkin&hal=ai');
  await page.locator('.gd-bas').waitFor();
  await expect(page.getByRole('region', { name: 'AI YAPSIN' })).toHaveCount(0);
});

test('Ayarlar: agent rutiniyle listelenir; kurulum sayfası adım adım, iki yol seçilebilir', async ({ page }) => {
  await ac(page, '/ayarlar?senaryo=berkin&hal=ai', 390, 844);
  await expect(page.getByRole('heading', { name: 'AGENT’LARIM' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Berkin’in Claude’u/ })).toBeVisible();
  await page.getByRole('button', { name: /^AI yapsın kurulumu/ }).click();
  const d = page.getByRole('dialog', { name: 'AI yapsın kurulumu' });
  await expect(d.getByRole('heading', { name: /Claude’u Devir’e bağla/ })).toBeVisible();
  await expect(d.getByRole('heading', { name: /Claude’da rutini kur/ })).toBeVisible();
  await expect(d.getByRole('button', { name: 'Rutin istemini kopyala' })).toBeVisible();
  await expect(d.getByRole('status')).toContainText('API tetiği bağlı');
  await cek(page, 'ai-kurulum');
  await d.getByRole('radio', { name: /İş hazır olunca hemen/ }).click();
  await expect(d.getByText(/bir kez gösterilen/).first()).toBeVisible();
  await cek(page, 'ai-kurulum-api');
  await d.getByPlaceholder('Ör. Berkin’in Claude’u').fill('Kod agent’ı');
  await d.getByPlaceholder(/routines\/…\/fire/).fill('https://api.anthropic.com/v1/claude_code/routines/trig_kod123/fire');
  await d.getByPlaceholder(/bir kez gösterilen jeton/).fill('sk-ant-oat01-sahtejetonsahtejeton');
  await d.getByRole('button', { name: 'Bağla', exact: true }).click();
  await expect(d.getByText(/Kod agent’ı tetiği eklendi/)).toBeVisible();
  await d.getByRole('button', { name: 'Kapat', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Kod agent’ı/ })).toBeVisible();
});

test('AI yapsın kurulumu: rutin yokken adımlar yapılacak; görevdeki bağlantı kurulumu açar', async ({ page }) => {
  await ac(page, '/ayarlar?senaryo=berkin&kur=ai', 390, 844);
  const d = page.getByRole('dialog', { name: 'AI yapsın kurulumu' });
  await expect(d.getByRole('heading', { name: /Claude’da rutini kur \(yapılacak\)/ })).toBeVisible();
  await expect(d.getByRole('status')).toContainText('henüz Devir’e uğramadı');
  await expect(d.getByRole('radio', { name: /Belirli saatlerde/ })).toHaveAttribute('aria-checked', 'true');
  await expect(d.getByRole('link', { name: 'Claude rutinlerini aç' })).toHaveAttribute('href', 'https://claude.ai/code/routines');
  await cek(page, 'ai-kurulum-bos');
});
