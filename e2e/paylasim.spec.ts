import { expect, test, type Page } from '@playwright/test';

// P1-C (D-C1, N-10): dış paylaşım Pano'dan ve adımdan bulunur; mesaj düzenlenir; önizleme; bağlantı kapatılır.
const ac = async (p: Page, yol: string) => {
  await p.setViewportSize({ width: 390, height: 844 });
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.addInitScript(() => { (window as any).open = (u: string) => { (window as any).__acilan = u; return null; }; });
  await p.goto(yol);
};
/** Sahte sunucuda bağlantıyı katılımcı gibi açar; durum kodu. */
const disAc = (p: Page, belirtec: string) => p.evaluate(async (t) => (await (window as any).__devirSahte.istek(new Request('https://sahte.devir/functions/v1/devir-mcp/l', { headers: { 'x-devir-baglanti': t } }))).status, belirtec);

test('Pano: bağlantıyı açmayan dış katılımcı görünür; paylaşım sayfası durumla açılır', async ({ page }) => {
  await ac(page, '/?senaryo=berkin');
  await page.getByRole('button', { name: 'Pano ve bekleyen işler' }).click();
  await expect(page.getByRole('heading', { name: 'DIŞ KATILIMCILAR' })).toBeAttached();
  const satir = page.getByRole('button', { name: /^Emre \(Test Bank\): Test Bank · \d+ açık adım · bağlantıyı açmadı/ });
  await satir.scrollIntoViewIfNeeded();
  await satir.click();
  const d = page.getByRole('dialog', { name: 'Emre ile paylaş' });
  await expect(d).toBeVisible();
  await expect(d.getByRole('status')).toContainText('Açık · henüz açılmadı');
  await expect(d.getByRole('status')).toContainText('kapanınca 30 gün');
});

test('adımdan paylaşım: düzenlenen mesaj WhatsApp\'a gider, silinen bağlantı sona eklenir', async ({ page }) => {
  await ac(page, '/akis/U422/adim/14?senaryo=berkin&tam=1');
  await page.getByRole('button', { name: 'Emre’ye bağlantı gönder' }).click();
  const d = page.getByRole('dialog', { name: 'Emre ile paylaş' });
  const m = d.getByLabel('WhatsApp mesajı');
  await expect(m).toHaveValue(/^Merhaba Emre, .* için senden beklenen adımlar burada: http.*\/l#k7Q2emreTestBank00wP9$/);
  await m.fill('Selam Emre, IP listesini buradan gönderebilir misin? http://localhost:5174/l#k7Q2emreTestBank00wP9');
  await d.getByRole('button', { name: 'WhatsApp’ta gönder' }).click();
  expect(decodeURIComponent((await page.evaluate(() => (window as any).__acilan)).split('text=')[1])).toBe('Selam Emre, IP listesini buradan gönderebilir misin? http://localhost:5174/l#k7Q2emreTestBank00wP9');
  await m.fill('Selam Emre, bağlantı aşağıda');
  await expect(d.getByText('Metinde bağlantı yok; gönderirken sonuna eklenir.')).toBeVisible();
  await d.getByRole('button', { name: 'WhatsApp’ta gönder' }).click();
  expect(decodeURIComponent((await page.evaluate(() => (window as any).__acilan)).split('text=')[1])).toMatch(/^Selam Emre, bağlantı aşağıda http.*\/l#k7Q2emreTestBank00wP9$/);
});

test('"Ne görecek?": katılımcının sayfası önizlenir, düğmeler çalışmaz, açılış sayılmaz', async ({ page }) => {
  await ac(page, '/akis/U422/adim/14?senaryo=berkin&tam=1');
  await page.getByRole('button', { name: 'Emre’ye bağlantı gönder' }).click();
  await page.getByRole('dialog', { name: 'Emre ile paylaş' }).getByRole('button', { name: 'Ne görecek?' }).click();
  await expect(page).toHaveURL(/\/akis\/U422\/onizleme\//);
  await expect(page.getByRole('status').filter({ hasText: 'Önizleme · Emre bağlantıyı açınca bunu görür' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('IP izin listesi talebi');
  await expect(page.getByRole('button', { name: 'Başladım' })).toBeDisabled();
  const n = await page.evaluate(async () => (await (window as any).__devirSahte.db.many('olay', { tip: 'okuma', kanal: 'baglanti' }, 'created_at')).length);
  expect(n).toBe(0);
  await page.getByRole('button', { name: 'Kapat' }).click();
  await expect(page).toHaveURL(/\/akis\/U422\/adim\/14/);
});

test('bağlantıyı kapat: onaydan sonra açılmaz; yeni bağlantı üretilir ve açılır', async ({ page }) => {
  await ac(page, '/akis/U422/adim/14?senaryo=berkin&tam=1');
  await page.getByRole('button', { name: 'Emre’ye bağlantı gönder' }).click();
  const d = page.getByRole('dialog', { name: 'Emre ile paylaş' });
  await expect(d.getByLabel('WhatsApp mesajı')).toBeVisible();
  expect(await disAc(page, 'k7Q2emreTestBank00wP9')).toBe(200);
  await d.getByRole('button', { name: 'Bağlantıyı kapat' }).click();
  await page.getByRole('dialog', { name: 'Bağlantı kapatılsın mı?' }).getByRole('button', { name: 'Kapat', exact: true }).click();
  await expect(d.getByRole('status')).toContainText('Bağlantı kapalı');
  await expect(d.getByRole('status')).toContainText('son açılış');
  expect(await disAc(page, 'k7Q2emreTestBank00wP9')).toBe(404);
  await d.getByRole('button', { name: 'Yeni bağlantı üret' }).click();
  const m = d.getByLabel('WhatsApp mesajı');
  await expect(m).toBeVisible();
  const yeni = /\/l#(\w+)$/.exec(await m.inputValue())![1];
  expect(yeni).not.toBe('k7Q2emreTestBank00wP9');
  expect(await disAc(page, yeni)).toBe(200);
});
