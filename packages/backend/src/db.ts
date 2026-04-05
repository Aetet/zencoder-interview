import pg from 'pg'

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://zendash:zendash_dev@localhost:5432/zendash'

/** The active pool. Replaced by tests via `setPool()`. */
let _pool: pg.Pool = new pg.Pool({
  connectionString: DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 20_000,
  connectionTimeoutMillis: 10_000,
})

export const pool: Pick<pg.Pool, 'query'> = {
  query: (...args: Parameters<pg.Pool['query']>) => _pool.query(...args),
}

/** Replace the pool (used by tests to inject a mock). */
export function setPool(p: pg.Pool) {
  _pool = p
}

/** Convert range string to a SQL interval expression */
export function rangeToInterval(range: string): string {
  switch (range) {
    case 'today': return '1 day'
    case '7d': return '7 days'
    case '90d': return '90 days'
    default: return '30 days'
  }
}

interface FilterParams {
  range?: string
  team_id?: string
  user_id?: string
  model?: string
}

/**
 * Build WHERE clause fragments and parameter array for baked table queries.
 * All baked tables have `date`, `team_id`, `model` columns.
 */
export function buildFilters(filters: FilterParams, startIdx = 1): {
  where: string
  params: unknown[]
  nextIdx: number
} {
  const conditions: string[] = []
  const params: unknown[] = []
  let idx = startIdx

  conditions.push(`date >= NOW() - INTERVAL '${rangeToInterval(filters.range ?? '30d')}'`)

  if (filters.team_id) {
    conditions.push(`team_id = $${idx}`)
    params.push(filters.team_id)
    idx++
  }
  if (filters.model) {
    conditions.push(`model = $${idx}`)
    params.push(filters.model)
    idx++
  }

  return {
    where: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
    nextIdx: idx,
  }
}

/** Round to 2 decimal places */
export function r2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Parse numeric/bigint string from PG to number */
export function num(val: string | number | null | undefined): number {
  if (val == null) return 0
  return typeof val === 'number' ? val : Number(val)
}
