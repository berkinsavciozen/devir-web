import { expect, test } from '@playwright/test';

// P1-F: akış ve adım adları ekranda kesilmez. Sahte veriye canlıdaki uzun adlar konur, tasarım kısa adları kaldırılır;
// sunucu kısa adı kendisi üretir. 360 px'te başlıklar, satır adları ve şerit adları taşmaz, "…" ile bitmez;
// satır adları aynı boyda kalır (sığmayan iki satıra iner), tam ad üzerine gelince (title) görünür.

const UZUN: Record<string, string> = {
  1: 'Komisyon koşullarını teyit et ve çiftçi teklif paketini hazırla',
  6: 'Kooperatiften üyeler adına fatura kesme yetki belgesini al',
  14: 'Vergi kaydı olmayan 2 çiftçi için makbuz ve belge modelini mali müşavirle netleştir',
  3: 'Vergi kaydı olmayan çiftçiler için makbuz ve belge modelini mali müşavirle netleştir',
};

async function kesikler(page: import('@playwright/test').Page) {
  return page.evaluate(() => [...document.querySelectorAll('h1, h2, .satir-metin b, .sahne-metin')]
    .filter((e) => (e as HTMLElement).offsetParent !== null)
    .filter((e) => (e.textContent || '').trim().endsWith('…') || (getComputedStyle(e).textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 1) || (e.matches('.satir-metin b') && e.scrollHeight > e.clientHeight + 1))
    .map((e) => (e.textContent || '').trim()));
}

test('360 px: uzun akış ve adım adları kesilmez; satırda kısa ad, adım detayında tam ad', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  // Evren'deki pano görev listesini önbelleğe alır; adlar değişmeden önce o sorgu açılmasın diye Ayarlar'dan başlanır
  await page.goto('/ayarlar?senaryo=berkin');
  await expect(page.getByRole('main').first()).toBeVisible();
  await page.evaluate(async (UZUN) => {
    const s = (window as any).__devirSahte;
    const a = (await s.db.many('akis', { kisa_kod: 'XPVZ' }))[0];
    await s.db.update('akis', { id: a.id }, { baslik: "Hasat: Karadeniz'den 5 çiftçi kazanımı (en az 3'ü faturalı, kooperatif ağırlıklı)", baglam: { ...a.baglam, kisa_ad: undefined, kisa_adlar: undefined } });
    for (const d of await s.db.many('adim', { akis_id: a.id })) if (UZUN[d.no]) await s.db.update('adim', { id: d.id }, { ad: UZUN[d.no] });
  }, UZUN);
  const git = async (y: string) => { await page.evaluate((y) => { history.pushState(null, '', y); dispatchEvent(new Event('devir:yol')); }, y); };

  // Tek Pano (12 Kas): Görevler'in Zaman görünümü bütün açık işleri görev kartıyla gösterir; kartta kısa ad
  await git('/gorevler?kisi=hepsi&gorunum=zaman');
  await expect(page.getByRole('main', { name: 'Görevler' })).toBeVisible();
  await expect(page.locator('.gorev-kart', { hasText: /komisyon koşullarını/i }).first()).toBeVisible();
  expect(await kesikler(page)).toEqual([]);

  await expect(page.getByText('Hasat çiftçi kazanımı').first()).toBeVisible();

  await git('/akis/XPVZ/adim/6');
  // W5: detay başlığı adımın tam adı
  await expect(page.getByRole('heading', { name: UZUN[6] })).toBeVisible();
  expect(await kesikler(page)).toEqual([]);
});
