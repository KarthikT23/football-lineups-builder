// Squad pool — your saved list of regulars, used for name autocomplete and as the source
// list for "Shuffle teams". Deliberately just an array of strings with plain functions
// operating on it (add/remove), no class — this is the simplest possible thing to port:
// in C it's a fixed `char pool[MAX_POOL][NAME_LEN]` plus a count, and these two functions
// become `pool_add(Pool*, const char *name)` / `pool_remove(Pool*, int index)`.

export const MAX_POOL_SIZE = 40; // a sensible cap; a real C port would need a fixed array bound

export function addToPool(pool: string[], name: string): string[] {
  const trimmed = name.trim();
  if (!trimmed) return pool;
  if (pool.includes(trimmed)) return pool;
  if (pool.length >= MAX_POOL_SIZE) return pool;
  return [...pool, trimmed];
}

export function removeFromPool(pool: string[], index: number): string[] {
  if (index < 0 || index >= pool.length) return pool;
  return pool.filter((_, i) => i !== index);
}
