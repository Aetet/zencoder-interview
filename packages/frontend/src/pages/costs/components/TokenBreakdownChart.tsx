import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Card } from '../../../shared/components/Card'
import type { DailyTokenTrend } from '@zendash/shared'

export function TokenBreakdownChart({ data }: { data: DailyTokenTrend[] }) {
  return (
    <Card>
      <h3 className="text-sm font-medium text-foreground-secondary mb-4">Token Spend Over Time</h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(246,245,243,0.05)" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9f9e9c' }} tickFormatter={(v) => v.slice(5)} />
          <YAxis tick={{ fontSize: 10, fill: '#9f9e9c' }} tickFormatter={(v) => `$${v}`} />
          <Tooltip contentStyle={{ backgroundColor: '#181715', border: '1px solid rgba(246,245,243,0.09)', borderRadius: 8, fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          <Bar dataKey="input" stackId="a" fill="#3b82f6" name="Input" />
          <Bar dataKey="output" stackId="a" fill="#8b5cf6" name="Output" />
          <Bar dataKey="cacheCreation" stackId="a" fill="#06b6d4" name="Cache Create" />
          <Bar dataKey="cacheRead" stackId="a" fill="#218b30" name="Cache Read" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  )
}
