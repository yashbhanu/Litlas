/**
 * The Supabase API (PostgREST) silently caps every response at `max_rows` rows
 * (supabase/config.toml [api] max_rows = 1000, same default on hosted projects). Any
 * query that can return more must page with `.range()`.
 */
export const API_MAX_ROWS = 1000;

/** Fetch up to `max` rows in pages of API_MAX_ROWS. The query must have a stable order. */
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  max = Number.POSITIVE_INFINITY,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < max; from += API_MAX_ROWS) {
    const to = Math.min(from + API_MAX_ROWS, max) - 1;
    const { data, error } = await fetchPage(from, to);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < to - from + 1) break;
  }
  return rows;
}
