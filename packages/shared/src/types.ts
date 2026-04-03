export interface SessionSummary {
  totalSessions: number
  completedSessions: number
  completionRate: number
  activeUsers: number
  totalUsers: number
  adoptionRate: number
  costPerSession: number
  totalCost: number
  trend: DailySessionTrend[]
  costTrend: DailyCostTrend[]
}

export interface DailySessionTrend {
  date: string
  sessions: number
  completed: number
  errored: number
  cancelled: number
}

export interface DailyCostTrend {
  date: string
  cost: number
}

export interface CostBreakdown {
  total: number
  byTeam: { teamId: string; teamName: string; cost: number }[]
  byModel: { model: string; cost: number }[]
  byTokenType: TokenTypeBreakdown
  tokenTrend: DailyTokenTrend[]
  costPerSession: number
}

export interface TokenTypeBreakdown {
  input: number
  output: number
  cacheCreation: number
  cacheRead: number
}

export interface DailyTokenTrend {
  date: string
  input: number
  output: number
  cacheCreation: number
  cacheRead: number
}

export interface CacheData {
  orgCacheHitRate: number
  savings: number
  byTeam: { teamId: string; teamName: string; rate: number }[]
  trend: { date: string; rate: number }[]
}

export interface BudgetData {
  monthlyBudget: number
  currentSpend: number
  projected: number
  percentUsed: number
  thresholds: number[]
  teamBudgets: TeamBudget[]
}

export interface TeamBudget {
  teamId: string
  teamName: string
  budget: number
  spent: number
}

export interface Team {
  id: string
  name: string
  sessions: number
  cost: number
  completionRate: number
  costPerSession: number
  cacheHitRate: number
  trend: number[]
}

export interface TeamUser {
  id: string
  email: string
  sessions: number
  cost: number
  completionRate: number
  costPerSession: number
  lastActive: string
}

export interface TeamDetail {
  team: Team
  users: TeamUser[]
  adoptionTrend: { date: string; users: number }[]
  modelUsage: { model: string; sessions: number; percentage: number }[]
}

export interface TopFilesData {
  mostRead: TopFile[]
  mostEdited: TopFile[]
}

export interface TopFile {
  path: string
  count: number
  sessions: number
  cost: number
  churn: number
}

export interface Insight {
  type: 'highCostTeam' | 'lowCacheRate' | 'expensiveSession'
  title: string
  description: string
  severity: 'warning' | 'error' | 'info'
  link: string
}

export interface QualityTier1 {
  sessionSuccessRate: number
  errorsByCategory: Record<string, number>
  toolErrorRate: number
  retryableRecoveryRate: number
}

export interface AlertConfig {
  monthlyBudget: number
  thresholds: number[]
}

export interface LiveUpdate {
  totalSessions: number
  totalCost: number
  completionRate: number
  activeUsers: number
  costPerSession: number
  trend: DailySessionTrend[]
  costTrend: DailyCostTrend[]
}

export type TimeRange = 'today' | '7d' | '30d' | '90d' | 'custom'
export type ModelTier = 'haiku' | 'sonnet' | 'opus'
