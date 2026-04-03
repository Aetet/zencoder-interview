import { reatomComponent } from '@reatom/react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Card } from '../../../shared/components/Card'
import { sessionTrend, isLive } from '../model'

export const SessionsChart = reatomComponent(() => {
  const data = sessionTrend()
  const live = isLive()

  return (
    <Card>
      <h3 className="text-sm font-medium text-foreground-secondary mb-4">
        Sessions Over Time
        {live && <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-error animate-pulse" />}
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(246,245,243,0.05)" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9f9e9c' }} tickFormatter={(v) => v.slice(5)} />
          <YAxis tick={{ fontSize: 10, fill: '#9f9e9c' }} />
          <Tooltip contentStyle={{ backgroundColor: '#181715', border: '1px solid rgba(246,245,243,0.09)', borderRadius: 8, fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          <Bar dataKey="completed" stackId="a" fill="#218b30" isAnimationActive={!live} animationDuration={live ? 150 : 400} />
          <Bar dataKey="errored" stackId="a" fill="#d1003e" isAnimationActive={!live} animationDuration={live ? 150 : 400} />
          <Bar dataKey="cancelled" stackId="a" fill="#9f9e9c" radius={[2, 2, 0, 0]} isAnimationActive={!live} animationDuration={live ? 150 : 400} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  )
}, 'SessionsChart')
