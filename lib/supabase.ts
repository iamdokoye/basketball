import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-only: uses the service role key, which bypasses RLS. The browser never
// talks to Supabase directly, and `server-only` fails the build if this file is
// ever imported from a client component.
let client: SupabaseClient | undefined;

export function db(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.example).");
    }
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

type PageResult = { data: unknown[] | null; count: number | null; error: { message: string } | null };

const PAGE = 1000; // PostgREST's default max_rows

/**
 * Reads every row of a query. PostgREST caps responses at 1000 rows, so this
 * fetches the first page (with an exact count) and the rest in parallel.
 */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<PageResult>,
): Promise<T[]> {
  const first = await page(0, PAGE - 1);
  if (first.error) throw new Error(first.error.message);
  const rows = (first.data ?? []) as T[];
  const total = first.count ?? rows.length;
  if (total <= PAGE) return rows;

  const starts = Array.from({ length: Math.ceil((total - PAGE) / PAGE) }, (_, i) => (i + 1) * PAGE);
  const rest = await Promise.all(starts.map((from) => page(from, from + PAGE - 1)));
  for (const r of rest) {
    if (r.error) throw new Error(r.error.message);
    rows.push(...((r.data ?? []) as T[]));
  }
  return rows;
}
