// Cache em memória dos backlinks/menções por (vault, nota), pra não revarrer o vault
// a cada vez que você reabre a mesma nota. Invalidado quando o vault muda no disco.
interface Backlink {
  path: string;
  name: string;
  snippet: string;
}
interface Entry {
  links: Backlink[];
  mentions: Backlink[];
}

const cache = new Map<string, Entry>();

export function getBacklinkCache(vault: string, target: string): Entry | undefined {
  return cache.get(vault + "|" + target);
}
export function setBacklinkCache(vault: string, target: string, entry: Entry): void {
  cache.set(vault + "|" + target, entry);
}
export function clearBacklinkCache(): void {
  cache.clear();
}
