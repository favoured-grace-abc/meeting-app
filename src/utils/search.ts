let currentQuery = "";
const listeners = new Set<(query: string) => void>();

export function setSearchQuery(query: string): void {
  currentQuery = query;
  listeners.forEach((listener) => listener(query));
}

export function getSearchQuery(): string {
  return currentQuery;
}

export function subscribeSearch(listener: (query: string) => void): () => void {
  listeners.add(listener);
  listener(currentQuery);
  return () => listeners.delete(listener);
}