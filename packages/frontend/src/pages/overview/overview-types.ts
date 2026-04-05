import type { Insight, QualityTier1, Team, LiveUpdate, DailySessionTrend, DailyCostTrend } from "@zendash/shared"

export interface LivePayload extends LiveUpdate {
  teams?: Team[]
  insights?: Insight[]
}

export interface OverviewView {
  totalSessions: number
  totalCost: number
  completionRate: number
  activeUsers: number
  totalUsers: number
  adoptionRate: number
  costPerSession: number
  sessionTrend: DailySessionTrend[]
  costTrend: DailyCostTrend[]
  insights: Insight[]
  teams: Team[]
  quality: QualityTier1 | null
}
