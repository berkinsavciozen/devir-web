import { expect, test, type Page } from '@playwright/test';

// W3 (4 Kas, K3) → 16 Kas tek sayfa (/ayarlar/ai): agent'lar, Claude rutinleri ve bağlantılar bir arada; Ayarlar'da tek satır. Her agent: rutini, işi, onay bekleyen çıktısı; detayda bağlantı,
// rutin (adlandır, bağla, kaldır), işler. Kurulum: her adım tek cümle + ne göreceğin; "Devir listede yoksa" notu.
const ac = async (p: Page, yol: string, w = 390, h = 844) => {
  await p.setViewportSize({ width: w, height: h });
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto(yol);
};
const cek = (p: Page, ad: string) => p.screenshot({ path: `karsilastirma/uygulama/${ad}.png` });

test('W3 · Ayarlar’da tek satır; sayfada agent kartları, rutinler, bağlantılar', async ({ page }) => {
  await ac(page, '/ayarlar?senaryo=berkin&hal=w3');
  await expect(page.getByRole('heading', { name: 'AGENT’LARIM', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /^Agent’lar ve AI yapsın/ }).click();
  await expect(page).toHaveURL(/\/ayarlar\/ai/);
  await expect(page.getByRole('heading', { name: 'HAZIR MI' })).toBeVisible();
  const A = page.getByRole('region', { name: 'Agent’ların' });
  await expect(A.getByRole('button', { name: /^Berkin’in Claude’u.*1 onayını bekliyor/ })).toBeVisible();
  // 0.34.0 (K1): rutin agent değildir; "Araştırma rutini" rutinlerde, tüm agent'lar için
  const R = page.getByRole('region', { name: 'Rutinlerin' });
  await expect(R.locator('.ai-rutin', { hasText: 'Araştırma rutini' })).toContainText('Tüm agent’ların');
  await expect(page.getByRole('region', { name: 'Bağlantılar' })).toContainText('Claude');
  await cek(page, 'W3-agentlarim');
});

test('W3 · agent detayı (İşleri, renk ve kaldırma): bağlantı, rutin, onay bekleyen iş; işe gider', async ({ page }) => {
  await ac(page, '/ayarlar/ai?senaryo=berkin&hal=w3&agent=Berkin’in Claude’u');
  await page.getByRole('button', { name: 'İşleri, renk ve kaldırma' }).click();
  const d = page.getByRole('dialog', { name: 'Berkin’in Claude’u' });
  await expect(d.getByRole('region', { name: 'Bağlantı' })).toContainText('Claude · senin adına yazar');
  await expect(d.getByRole('region', { name: 'Rutinler' })).toContainText('Anında · Berkin’in Claude’u · bu agent’ın işini o başlatır · son çalışma');
  await cek(page, 'W3-agent-detay');
  await d.getByRole('region', { name: 'ONAYINI BEKLİYOR' }).getByRole('button', { name: /Post görseli/ }).click();
  await d.getByRole('button', { name: 'Göreve git' }).click();
  await expect(page).toHaveURL(/\/akis\/RTD5\/adim\/6/);
});

test('16 Kas · sağlık tek kural: sessiz rutin söylenir, Kim çalıştırır seçicisi bağlar, kaldırılan rutin yeniden açılır', async ({ page }) => {
  await ac(page, '/ayarlar/ai?senaryo=berkin&hal=ai2');
  const A = page.getByRole('region', { name: 'Agent’ların' });
  const ar = A.locator('.ai-kart', { hasText: 'Araştırmacı' });
  await expect(ar.locator('.ai-rozet')).toHaveText('Sessiz');
  await expect(ar).toContainText('Devir araştırma (saatlik) rutini 9 Eki’den beri uğramadı');
  await expect(A.locator('.ai-kart', { hasText: 'Yayın yazarı' }).locator('.ai-rozet')).toHaveText('İlk çalışma bekleniyor');
  await expect(page.getByRole('region', { name: 'Hazır mı' })).toContainText('2 rutinde sorun');
  await ar.getByRole('button', { name: /^Araştırmacı/ }).click();
  await expect(ar.getByRole('link', { name: 'Claude’da rutinleri aç' })).toHaveAttribute('href', 'https://claude.ai/code/routines');
  // bağ tek yerden: Araştırmacı'yı anında rutine bağla
  await ar.getByRole('combobox', { name: 'Kim çalıştırır' }).selectOption({ label: 'Devir · anında işler · anında' });
  await expect(ar.locator('.ai-rozet')).toHaveText('Canlı');
  await cek(page, 'ai2-bagla');
  const R = page.getByRole('region', { name: 'Rutinlerin' });
  await R.getByText('Kaldırılan rutinler (1)').click();
  await R.locator('.ai-rutin.kapali').getByRole('button', { name: 'Yeniden aç' }).click();
  await expect(R.getByRole('status')).toContainText('yeniden açıldı');
  // Claude'daki ad ayrı yazılır
  await R.locator('.ai-rutin', { hasText: 'Yayın yazarı' }).getByRole('button', { name: 'Claude’daki adını yaz' }).click();
  await R.getByRole('textbox', { name: /Yayın yazarı rutininin Claude’daki adı/ }).fill('Devir yayın (günlük)');
  await R.getByRole('button', { name: 'Kaydet' }).click();
  await expect(R.locator('.ai-rutin', { hasText: 'Devir yayın (günlük)' })).toContainText('Devir’deki adı Yayın yazarı');
});

test('W3 · kurulum: her adım ne göreceğini söyler; eski ?kur=ai adresi sayfada açılır; agent kurulumu agent adını taşır, Devir’de önceden kaydedilir', async ({ page }) => {
  await ac(page, '/ayarlar?senaryo=berkin&kur=ai');
  await expect(page).toHaveURL(/\/ayarlar\/ai/);
  const d = page.getByRole('dialog', { name: 'AI yapsın kurulumu' });
  await expect(d.locator('.rk-gor').first()).toContainText('Göreceğin:');
  await expect(d.getByText(/Devir listede yoksa/)).toBeVisible();
  await expect(d.getByRole('radio', { name: /Jeton gerekmez/ })).toBeVisible();
  await cek(page, 'W3-kurulum');
  await ac(page, '/ayarlar/ai?senaryo=berkin&hal=ai2&agent=Yayın yazarı');
  await page.locator('.ai-kart', { hasText: 'Yayın yazarı' }).getByRole('button', { name: 'Kurulumu yeniden gör' }).click();
  const k = page.getByRole('dialog', { name: 'AI yapsın kurulumu' });
  await expect(k.getByRole('heading', { name: /Yayın yazarı/ })).toBeVisible();
  await k.getByPlaceholder('Yayın yazarı').fill('Devir yayın');
  await k.getByRole('button', { name: 'Devir’de kaydet' }).click();
  await expect(k.getByText(/Yayın yazarı rutini Devir'de kuruldu/)).toBeVisible();
  await k.getByRole('radio', { name: /İş hazır olunca hemen/ }).click();
  await expect(k.getByRole('checkbox', { name: 'Yayın yazarı' })).toBeChecked();
  await expect(k.getByRole('checkbox', { name: /Tüm agent’larım/ })).not.toBeChecked();
});

test('16 Kas W2 · sessiz rutinli görev bunu söyler; "Rutine bak" agent kartına gider', async ({ page }) => {
  await ac(page, '/akis/RTD5/adim/9?senaryo=berkin&hal=ai2');
  await expect(page.locator('.gd-cumle')).toContainText('Devir araştırma (saatlik) rutini 3 günden uzun süredir Devir’e uğramıyor');
  await page.getByRole('button', { name: 'Rutine bak' }).first().click();
  await expect(page).toHaveURL(/\/ayarlar\/ai\?agent=Ara%C5%9Ft%C4%B1rmac%C4%B1$/);
  await expect(page.locator('.ai-kart.hedef')).toContainText('Araştırmacı');
  await expect(page.getByRole('dialog', { name: 'AI yapsın kurulumu' })).toHaveCount(0);
  await cek(page, 'W2-rutine-bak');
});
