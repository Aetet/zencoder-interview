import { type ModelTier, calculateCost } from './pricing.js'

export interface MockTeam {
  id: string
  name: string
}

export interface MockUser {
  id: string
  email: string
  teamId: string
}

export interface MockSession {
  id: string
  userId: string
  teamId: string
  model: ModelTier
  status: 'completed' | 'error' | 'cancelled'
  inputTokens: number
  outputTokens: number
  cacheCreation: number
  cacheRead: number
  cost: number
  toolCalls: number
  toolErrors: number
  errorCategory?: 'api' | 'tool' | 'permission' | 'runtime'
  timestamp: string
  durationMs: number
}

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function weightedPick<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r <= 0) return items[i]
  }
  return items[items.length - 1]
}

const TEAM_DEFS: MockTeam[] = [
  { id: 'backend', name: 'Backend' },
  { id: 'frontend', name: 'Frontend' },
  { id: 'platform', name: 'Platform' },
  { id: 'data', name: 'Data' },
  { id: 'mobile', name: 'Mobile' },
  { id: 'devops', name: 'DevOps' },
]

const FIRST_NAMES = ['alice', 'bob', 'carol', 'dave', 'eve', 'frank', 'grace', 'heidi', 'ivan', 'judy']
const LAST_NAMES = ['smith', 'jones', 'chen', 'garcia', 'kim', 'patel', 'silva', 'nguyen', 'murphy', 'taylor']

function generateUsers(teams: MockTeam[]): MockUser[] {
  const users: MockUser[] = []
  let id = 1
  for (const team of teams) {
    const count = rand(7, 10)
    for (let i = 0; i < count; i++) {
      const first = pick(FIRST_NAMES)
      const last = pick(LAST_NAMES)
      users.push({
        id: `user-${id}`,
        email: `${first}.${last}${id}@acme.com`,
        teamId: team.id,
      })
      id++
    }
  }
  return users
}

function generateSessions(teams: MockTeam[], users: MockUser[], days: number, perDay: number): MockSession[] {
  const sessions: MockSession[] = []
  const now = new Date()
  const models: ModelTier[] = ['haiku', 'sonnet', 'opus']
  const modelWeights = [60, 30, 10]
  const statuses: Array<MockSession['status']> = ['completed', 'error', 'cancelled']
  const statusWeights = [85, 10, 5]
  const errorCategories: Array<'api' | 'tool' | 'permission' | 'runtime'> = ['api', 'tool', 'permission', 'runtime']

  for (let d = days - 1; d >= 0; d--) {
    const dayCount = perDay + rand(-20, 20)
    for (let i = 0; i < dayCount; i++) {
      const user = pick(users)
      const model = weightedPick(models, modelWeights)
      const status = weightedPick(statuses, statusWeights)
      const inputTokens = rand(200, 800)
      const outputTokens = rand(50, 400)
      const cacheCreation = rand(0, 500)
      const cacheRead = rand(0, 300)
      const toolCalls = rand(5, 20)
      const toolErrors = Math.random() < 0.1 ? rand(1, 3) : 0

      const date = new Date(now)
      date.setDate(date.getDate() - d)
      date.setHours(rand(8, 20), rand(0, 59), rand(0, 59))

      const cost = calculateCost(model, { input: inputTokens, output: outputTokens, cacheCreation, cacheRead })

      sessions.push({
        id: `sess-${sessions.length + 1}`,
        userId: user.id,
        teamId: user.teamId,
        model,
        status,
        inputTokens,
        outputTokens,
        cacheCreation,
        cacheRead,
        cost,
        toolCalls,
        toolErrors,
        errorCategory: status === 'error' ? pick(errorCategories) : undefined,
        timestamp: date.toISOString(),
        durationMs: rand(5000, 360000),
      })
    }
  }

  return sessions
}

export function generateMockData() {
  const teams = TEAM_DEFS
  const users = generateUsers(teams)
  const sessions = generateSessions(teams, users, 30, 100)
  return { teams, users, sessions }
}
