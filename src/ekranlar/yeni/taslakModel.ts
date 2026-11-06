/**
 * W4 (4 Kas, B5): taslak haritası. Taslak eksik olsa bile tek bakışta görülür: adımlar sahip rolüne göre şeritlerde,
 * yatayda tahmini zaman (bugünden, süre tahmini ve bağımlılıklarla en erken bitiş), hedef çizgisi. Vurgular:
 * sahibi belli olmayan rol, cevabı beklenen soruya bağlı (koşullu) adım, hedefi aşan adım.
 */
const GUN = 864e5;
export interface TRol { kod: string; ad: string; tip: string; kisi: string | null }
export interface TAdim { id: string; ad: string; sahip_rol: string; sure_tahmin_gun: number | null; bagimli: string[]; kosul: { soru: string; deger: string } | null; ust?: string | null; yurutme?: string | null; inceleme?: string | null; karar?: boolean; karar_tur?: string | null; sahip_tip?: string; karar_secenekleri?: string[] | null }
export interface TNokta { a: TAdim; no: number; bas: number; bit: number; serit: number; x: number; y: number; soru: string | null; gec: boolean }
export interface THarita {
  seritler: { rol: TRol; y: number; eksik: boolean }[]; noktalar: TNokta[]; x0: number; x1: number; t0: number; t1: number; hedefX: number | null; bugunX: number; h: number;
  eksikRol: TRol[]; sorulu: TNokta[]; gecikme: TNokta[]; bitis: number; hedef: number | null;
}

/** Sahibi belli değil: insan ya da dış rol, kişisi yok (agent rolü kurulumda kişinin agent'ı olur). */
export const rolEksik = (r: TRol) => r.tip !== 'agent' && !r.kisi;
export const rolAdi = (r: TRol) => r.kisi || r.ad;

export function taslakHaritasi(t: { adimlar: TAdim[]; roller: TRol[]; hedef_tarih: string | null; sorular?: { kod: string }[] }, o: { now: number; x0?: number; x1?: number; y0?: number; satir?: number; cevaplar?: Record<string, string> }): THarita {
  const x0 = o.x0 ?? 120, x1 = o.x1 ?? 356, y0 = o.y0 ?? 0, S = o.satir ?? 64;
  const A = (t.adimlar || []).filter((a) => !a.ust);
  const byId = new Map(A.map((a) => [a.id, a]));
  // en erken bitiş: bağımlılıkların en geç bitişinden sonra, süre tahminiyle (yoksa 1 gün)
  const bit = new Map<string, number>(), bas = new Map<string, number>();
  const hesap = (a: TAdim, yol: Set<string> = new Set()): number => {
    if (bit.has(a.id)) return bit.get(a.id)!;
    if (yol.has(a.id)) return o.now;
    yol.add(a.id);
    const b = Math.max(o.now, ...(a.bagimli || []).map((d) => byId.get(d)).filter(Boolean).map((d) => hesap(d!, yol)));
    const e = b + Math.max(.5, a.sure_tahmin_gun ?? 1) * GUN;
    bas.set(a.id, b); bit.set(a.id, e);
    return e;
  };
  A.forEach((a) => hesap(a));
  const hedef = t.hedef_tarih ? Date.parse(t.hedef_tarih + 'T23:59:00+03:00') : null;
  const bitis = Math.max(o.now, ...A.map((a) => bit.get(a.id)!));
  const t0 = o.now - GUN, t1 = Math.max(bitis, hedef ?? 0) + 3 * GUN;
  const X = (ms: number) => x0 + ((ms - t0) / (t1 - t0)) * (x1 - x0);
  // şeritler: rollerin adım sırası (ilk adımı önce gelen rol üstte); adımı olmayan rol çizilmez
  const roller = (t.roller || []).filter((r) => A.some((a) => a.sahip_rol === r.kod));
  for (const a of A) if (!roller.some((r) => r.kod === a.sahip_rol)) roller.push({ kod: a.sahip_rol, ad: a.sahip_rol, tip: 'insan', kisi: null });
  roller.sort((p, q) => A.findIndex((a) => a.sahip_rol === p.kod) - A.findIndex((a) => a.sahip_rol === q.kod));
  const seritler = roller.map((rol, i) => ({ rol, y: y0 + S / 2 + i * S, eksik: rolEksik(rol) }));
  const acikSoru = new Set((t.sorular || []).map((q) => q.kod).filter((k) => o.cevaplar?.[k] == null));
  const noktalar: TNokta[] = [];
  A.forEach((a, i) => {
    const s = roller.findIndex((r) => r.kod === a.sahip_rol);
    const x = X(bit.get(a.id)!);
    // aynı şeritte yakın düşenler aşağı yukarı ayrışır
    const yakin = noktalar.filter((n) => n.serit === s && Math.abs(n.x - x) < 22).length;
    const dy = yakin ? (yakin % 2 ? -1 : 1) * Math.ceil(yakin / 2) * 14 : 0;
    noktalar.push({ a, no: i + 1, bas: bas.get(a.id)!, bit: bit.get(a.id)!, serit: s, x, y: seritler[s].y + Math.max(-S / 2 + 10, Math.min(S / 2 - 10, dy)), soru: a.kosul && acikSoru.has(a.kosul.soru) ? a.kosul.soru : null, gec: hedef != null && bit.get(a.id)! > hedef });
  });
  return {
    seritler, noktalar, x0, x1, t0, t1, hedefX: hedef != null ? X(hedef) : null, bugunX: X(o.now), h: Math.max(1, roller.length) * S,
    eksikRol: roller.filter(rolEksik), sorulu: noktalar.filter((n) => n.soru), gecikme: noktalar.filter((n) => n.gec), bitis, hedef,
  };
}

/** "13 adım · 3 soru bekliyor · 2 rolün sahibi belli değil · tahmini bitiş hedeften 5 gün sonra" */
export function taslakCumlesi(H: THarita, soruSayisi: number, gunAy: (ms: number) => string): string {
  const p = [`${H.noktalar.length} adım`];
  if (soruSayisi) p.push(`${soruSayisi} soru bekliyor`);
  if (H.eksikRol.length) p.push(`${H.eksikRol.length} rolün sahibi belli değil`);
  if (H.hedef != null) {
    const fark = Math.ceil((H.bitis - H.hedef) / GUN);
    p.push(fark > 0 ? `tahmini bitiş hedeften ${fark} gün sonra` : `tahmini bitiş ${gunAy(H.bitis)}, hedef ${gunAy(H.hedef)}`);
  } else p.push(`tahmini bitiş ${gunAy(H.bitis)}`);
  return p.join(' · ') + '.';
}
