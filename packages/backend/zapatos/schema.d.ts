/*
** Zapatos schema types for the PostgreSQL baked tables.
** Manually written to match migrations/postgres/ schema.
** Regenerate with `npx zapatos` when connected to a running DB.
*/

import type * as db from 'zapatos/db'

// === teams ===
declare module 'zapatos/schema' {
  interface teams {
    Table: 'teams'
    Selectable: {
      id: string
      name: string
    }
    Insertable: {
      id: string
      name: string
    }
    Updatable: Partial<teams['Insertable']>
    Whereable: Partial<teams['Selectable']>
    Column: keyof teams['Selectable']
    SQL: db.GenericSQLExpression
  }
}

// === users ===
declare module 'zapatos/schema' {
  interface users {
    Table: 'users'
    Selectable: {
      id: string
      email: string
      team_id: string
    }
    Insertable: {
      id: string
      email: string
      team_id: string
    }
    Updatable: Partial<users['Insertable']>
    Whereable: Partial<users['Selectable']>
    Column: keyof users['Selectable']
    SQL: db.GenericSQLExpression
  }
}

// === daily_session_summary ===
declare module 'zapatos/schema' {
  interface daily_session_summary {
    Table: 'daily_session_summary'
    Selectable: {
      date: Date
      team_id: string
      model: string
      total_sessions: number
      completed: number
      errored: number
      cancelled: number
      total_cost: string // NUMERIC comes as string
      active_users: number
    }
    Insertable: daily_session_summary['Selectable']
    Updatable: Partial<daily_session_summary['Insertable']>
    Whereable: Partial<daily_session_summary['Selectable']>
    Column: keyof daily_session_summary['Selectable']
    SQL: db.GenericSQLExpression
  }
}

// === daily_token_stats ===
declare module 'zapatos/schema' {
  interface daily_token_stats {
    Table: 'daily_token_stats'
    Selectable: {
      date: Date
      team_id: string
      model: string
      input_tokens: string  // BIGINT as string
      output_tokens: string
      cache_creation: string
      cache_read: string
      total_cost: string
    }
    Insertable: daily_token_stats['Selectable']
    Updatable: Partial<daily_token_stats['Insertable']>
    Whereable: Partial<daily_token_stats['Selectable']>
    Column: keyof daily_token_stats['Selectable']
    SQL: db.GenericSQLExpression
  }
}

// === daily_quality_stats ===
declare module 'zapatos/schema' {
  interface daily_quality_stats {
    Table: 'daily_quality_stats'
    Selectable: {
      date: Date
      team_id: string
      model: string
      total_sessions: number
      completed: number
      tool_calls: number
      tool_errors: number
      errors_api: number
      errors_tool: number
      errors_permission: number
      errors_runtime: number
    }
    Insertable: daily_quality_stats['Selectable']
    Updatable: Partial<daily_quality_stats['Insertable']>
    Whereable: Partial<daily_quality_stats['Selectable']>
    Column: keyof daily_quality_stats['Selectable']
    SQL: db.GenericSQLExpression
  }
}

// === team_user_stats ===
declare module 'zapatos/schema' {
  interface team_user_stats {
    Table: 'team_user_stats'
    Selectable: {
      user_id: string
      team_id: string
      date: Date
      sessions: number
      cost: string
      completed: number
      last_active: Date
    }
    Insertable: team_user_stats['Selectable']
    Updatable: Partial<team_user_stats['Insertable']>
    Whereable: Partial<team_user_stats['Selectable']>
    Column: keyof team_user_stats['Selectable']
    SQL: db.GenericSQLExpression
  }
}

// === alerts_log ===
declare module 'zapatos/schema' {
  interface alerts_log {
    Table: 'alerts_log'
    Selectable: {
      id: string
      type: string
      severity: string
      title: string
      description: string
      team_id: string | null
      ts: Date
    }
    Insertable: {
      id: string
      type: string
      severity: string
      title: string
      description: string
      team_id?: string | null
      ts?: Date
    }
    Updatable: Partial<alerts_log['Insertable']>
    Whereable: Partial<alerts_log['Selectable']>
    Column: keyof alerts_log['Selectable']
    SQL: db.GenericSQLExpression
  }
}

// === budget_config ===
declare module 'zapatos/schema' {
  interface budget_config {
    Table: 'budget_config'
    Selectable: {
      id: number
      monthly_budget: string
      thresholds: number[]
      team_overrides: Record<string, number>
    }
    Insertable: {
      id?: number
      monthly_budget: string
      thresholds: number[]
      team_overrides: Record<string, number>
    }
    Updatable: Partial<budget_config['Insertable']>
    Whereable: Partial<budget_config['Selectable']>
    Column: keyof budget_config['Selectable']
    SQL: db.GenericSQLExpression
  }
}
