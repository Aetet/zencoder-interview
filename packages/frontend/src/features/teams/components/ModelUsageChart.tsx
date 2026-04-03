import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { Card } from '../../../shared/components/Card'

const MODEL_DATA = [
  { name: 'Haiku', value: 45, color: '#3b82f6' },
  { name: 'Sonnet', value: 40, color: '#8b5cf6' },
  { name: 'Opus', value: 15, color: '#c34513' },
]

export function ModelUsageChart() {
  return (
    <Card>
      <h3 className="text-sm font-medium text-foreground-secondary mb-4">Model Usage</h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={MODEL_DATA}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            dataKey="value"
          >
            {MODEL_DATA.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ backgroundColor: '#181715', border: '1px solid rgba(246,245,243,0.09)', borderRadius: 8, fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  )
}
