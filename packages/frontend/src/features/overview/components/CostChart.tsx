import { reatomComponent } from '@reatom/react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { Card } from '../../../shared/components/Card'
import { overviewRoute } from '../overview-model'

export const CostChart = reatomComponent(() => {
  const data = overviewRoute.costTrend()
  const live = overviewRoute.isLive()

  return (
    <Card>
      <h3 className="text-sm font-medium text-foreground-secondary mb-4">
        Cost Over Time
        {live && <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-error animate-pulse" />}
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(246,245,243,0.05)" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9f9e9c' }} tickFormatter={(v) => v.slice(5)} />
          <YAxis tick={{ fontSize: 10, fill: '#9f9e9c' }} tickFormatter={(v) => `$${v}`} />
          <Tooltip contentStyle={{ backgroundColor: '#181715', border: '1px solid rgba(246,245,243,0.09)', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`$${v.toFixed(2)}`, 'Cost']} />
          <ReferenceLine y={200} stroke="#d1003e" strokeDasharray="6 4" label={{ value: 'Budget', position: 'right', fontSize: 10, fill: '#d1003e' }} />
          <Area type="monotone" dataKey="cost" stroke="#c34513" fill="rgba(195,69,19,0.15)" strokeWidth={2} isAnimationActive={!live} animationDuration={live ? 150 : 400} />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  )
}, 'CostChart')
