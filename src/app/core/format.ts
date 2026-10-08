const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatBRL(cents: number | null | undefined): string {
  return BRL.format((cents ?? 0) / 100);
}

export function formatInt(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString('pt-BR');
}

export function formatCpf(cpf: string | null | undefined): string {
  if (!cpf || cpf.length !== 11) return 'não disponível';
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
}

export function formatCnpj(cnpj: string): string {
  if (cnpj.length !== 14) return cnpj;
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
}

export function formatCpfCnpj(digits: string | null | undefined): string {
  if (!digits) return 'não disponível';
  return digits.length === 14 ? formatCnpj(digits) : formatCpf(digits);
}

export function entityLink(digits: string | null | undefined): string[] | null {
  if (!digits) return null;
  if (digits.length === 14) return ['/cnpj', digits];
  if (digits.length === 11) return ['/cpf', digits];
  return null;
}

const PLATFORM_LABEL: Record<string, string> = {
  facebook: 'Facebook', instagram: 'Instagram', x: 'X (Twitter)', youtube: 'YouTube', tiktok: 'TikTok',
  linkedin: 'LinkedIn', whatsapp: 'WhatsApp', telegram: 'Telegram', kwai: 'Kwai', website: 'Site', other: 'Outro',
};

export function platformLabel(platform: string): string {
  return PLATFORM_LABEL[platform] ?? platform;
}

const RESULT_TONE: Record<string, 'green' | 'red' | 'neutral'> = {
  ELEITO: 'green', 'ELEITO POR MÉDIA': 'green', 'ELEITO POR QP': 'green', 'NÃO ELEITO': 'red', SUPLENTE: 'neutral',
};

export function resultTone(result: string | null): 'green' | 'red' | 'neutral' {
  if (!result) return 'neutral';
  return RESULT_TONE[result.toUpperCase()] ?? 'neutral';
}

const EXPENSE_CATEGORY_LABEL: Record<string, string> = {
  CANETA: 'Canetas', LAPIS: 'Lápis', LAPISEIRA: 'Lapiseiras', BORRACHA: 'Borrachas', APONTADOR: 'Apontadores',
  ADESIVO: 'Adesivos', CRACHA: 'Crachás', ETIQUETA: 'Etiquetas', CLIPS: 'Clipes', GRAMPO: 'Grampos',
  GRAMPEADOR: 'Grampeadores', REGUA: 'Réguas', 'BLOCO DE ANOTA': 'Blocos de anotação', ENVELOPE: 'Envelopes',
  'MARCADOR DE TEXTO': 'Marcadores de texto', PRANCHETA: 'Pranchetas', PERFURADOR: 'Perfuradores', ELASTICO: 'Elásticos',
};

export function expenseCategoryLabel(category: string): string {
  return EXPENSE_CATEGORY_LABEL[category] ?? category;
}

export function formatPct(pct: number): string {
  return `${pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

export function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC';
  } catch {
    return iso;
  }
}

export function formatShortDate(raw: string | null): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw.slice(0, 10);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export const VERDICT_LABEL: Record<string, string | undefined> = { bizarro: 'bizarro', inconclusivo: 'inconclusivo', plausivel: 'plausível' };
export const SEVERITY_LABEL: Record<string, string | undefined> = { high: 'alta', medium: 'média', low: 'baixa' };

export function verdictBadge(verdict: string): string {
  return verdict === 'bizarro' ? 'badge--red' : verdict === 'inconclusivo' ? 'badge--accent' : '';
}

export function severityBadge(severity: string | null): string {
  return severity === 'high' ? 'badge--red' : severity === 'medium' ? 'badge--accent' : '';
}

export function pageList(page: number, total: number): Array<number | 'ellipsis'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const keep = [...new Set([1, total, page - 1, page, page + 1])].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: Array<number | 'ellipsis'> = [];
  let prev = 0;
  for (const p of keep) {
    if (prev && p - prev > 1) out.push('ellipsis');
    out.push(p);
    prev = p;
  }
  return out;
}
