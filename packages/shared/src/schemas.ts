import { z } from 'zod'

/** Common query params for filtered endpoints (sessions, costs, teams, etc.) */
export const filterQuerySchema = z.object({
  range: z.string().optional(),
  team_id: z.string().optional(),
  user_id: z.string().optional(),
  model: z.string().optional(),
})

/** POST /api/budgets body */
export const saveBudgetSchema = z.object({
  monthlyBudget: z.number().positive(),
  teamOverrides: z.record(z.string(), z.number()).optional(),
})
