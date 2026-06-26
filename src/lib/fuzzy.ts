// Busca fuzzy (subsequência tolerante) com pontuação e realce.
// Usada na paleta de comandos e no "Ir para nota" (quick switcher).

export interface FuzzyResult {
  match: boolean;
  score: number;
  /** intervalos [início, fim) das letras casadas, para realçar. */
  ranges: [number, number][];
}

export function fuzzyMatch(query: string, text: string): FuzzyResult {
  const q = query.trim().toLowerCase();
  if (!q) return { match: true, score: 0, ranges: [] };
  const tl = text.toLowerCase();

  let qi = 0;
  let score = 0;
  let prev = -2;
  const ranges: [number, number][] = [];

  for (let i = 0; i < tl.length && qi < q.length; i++) {
    if (tl[i] !== q[qi]) continue;
    let s = 1;
    if (i === prev + 1) s += 4; // letras consecutivas
    if (i === 0 || /[\s\-_/.\\]/.test(tl[i - 1])) s += 3; // início de palavra
    score += s;
    if (ranges.length && ranges[ranges.length - 1][1] === i) {
      ranges[ranges.length - 1][1] = i + 1;
    } else {
      ranges.push([i, i + 1]);
    }
    prev = i;
    qi++;
  }

  if (qi < q.length) return { match: false, score: 0, ranges: [] };

  // bônus por substring contígua (e prefixo)
  const idx = tl.indexOf(q);
  if (idx >= 0) score += 10 + (idx === 0 ? 6 : 0);
  // textos mais curtos ganham um empurrãozinho
  score -= tl.length * 0.01;

  return { match: true, score, ranges };
}

export interface FuzzyParts {
  text: string;
  hit: boolean;
}

/** Quebra o texto em segmentos casados/não-casados para realce no markup. */
export function highlightParts(text: string, ranges: [number, number][]): FuzzyParts[] {
  if (!ranges.length) return [{ text, hit: false }];
  const parts: FuzzyParts[] = [];
  let pos = 0;
  for (const [a, b] of ranges) {
    if (a > pos) parts.push({ text: text.slice(pos, a), hit: false });
    parts.push({ text: text.slice(a, b), hit: true });
    pos = b;
  }
  if (pos < text.length) parts.push({ text: text.slice(pos), hit: false });
  return parts;
}
