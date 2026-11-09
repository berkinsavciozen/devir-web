import { UYGULAMALAR, type Uygulama } from '../evren/ClaudeaBagla';
import { useBagliLlm } from '../evren/BosEvren';

/**
 * 9 Kas (düğme tablosu, yeni bulgu): "Claude’da aç" kişinin bağlı uygulamasıyla açılır (ChatGPT’de aç, Gemini’de aç…).
 * İstem, sunucunun Claude bağlantısındaki q'dan alınır; q almayan uygulamada (Gemini) istem panoya konur.
 */
const Q_ADRESI: Record<Uygulama, string | null> = {
  claude: 'https://claude.ai/new?q=',
  chatgpt: 'https://chatgpt.com/?q=',
  perplexity: 'https://www.perplexity.ai/search?q=',
  lechat: 'https://chat.mistral.ai/chat?q=',
  grok: 'https://grok.com/?q=',
  gemini: null,
};
const YENI: Record<Uygulama, string> = { claude: 'https://claude.ai/new', chatgpt: 'https://chatgpt.com/', gemini: 'https://gemini.google.com/app', perplexity: 'https://www.perplexity.ai/', lechat: 'https://chat.mistral.ai/chat', grok: 'https://grok.com/' };

/** Bağlantıdaki istem (q). */
export function istemOf(linkler: any): string | null {
  const u = linkler?.claude || linkler?.chatgpt;
  if (!u) return null;
  try { return new URL(u).searchParams.get('q'); } catch { return null; }
}

/** Uygulamada açılacak adres ve panoya konacak istem (q almayan uygulamada). */
export function sohbetLinki(uyg: Uygulama, linkler: any): { url: string; pano: string | null } | null {
  if (!linkler?.claude && !linkler?.chatgpt) return null;
  if (uyg === 'claude' && linkler.claude) return { url: linkler.claude, pano: null };
  if (uyg === 'chatgpt' && linkler.chatgpt) return { url: linkler.chatgpt, pano: null };
  const q = istemOf(linkler);
  if (!q) return { url: YENI[uyg], pano: null };
  const t = Q_ADRESI[uyg];
  return t ? { url: t + encodeURIComponent(q), pano: null } : { url: YENI[uyg], pano: q };
}

/** Kişinin sohbet uygulaması: bağlı ilk uygulama (Claude önce), hiçbiri yoksa Claude. AI yapsın yalnız Claude rutiniyle çalışır. */
export function useSohbet() {
  const { uyg } = useBagliLlm();
  const u: Uygulama = uyg || 'claude';
  return { uyg: u, U: UYGULAMALAR[u], claudeYok: !!uyg && uyg !== 'claude' };
}
