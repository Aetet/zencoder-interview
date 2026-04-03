import { Card } from '../../../shared/components/Card'
import { DataTable } from '../../../shared/components/DataTable'
import { formatCurrency } from '../../../shared/utils/format'
import type { TopFilesData, TopFile } from '@zendash/shared'

export function TopFilesTable({ data }: { data: TopFilesData }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Card>
        <h3 className="text-sm font-medium text-foreground-secondary mb-4">Most-Read Files</h3>
        <DataTable
          columns={[
            { key: 'path', header: 'File', render: (f: TopFile) => <span className="font-mono text-xs text-accent-foreground">{f.path}</span> },
            { key: 'count', header: 'Reads', render: (f: TopFile) => String(f.count) },
            { key: 'sessions', header: 'Sessions', render: (f: TopFile) => String(f.sessions) },
            { key: 'cost', header: 'Token Cost', render: (f: TopFile) => formatCurrency(f.cost) },
          ]}
          data={data.mostRead.slice(0, 10)}
        />
      </Card>

      <Card>
        <h3 className="text-sm font-medium text-foreground-secondary mb-4">Most-Edited Files</h3>
        <DataTable
          columns={[
            { key: 'path', header: 'File', render: (f: TopFile) => <span className="font-mono text-xs text-accent-foreground">{f.path}</span> },
            { key: 'count', header: 'Edits', render: (f: TopFile) => String(f.count) },
            { key: 'sessions', header: 'Sessions', render: (f: TopFile) => String(f.sessions) },
            { key: 'churn', header: 'Churn', render: (f: TopFile) => <span className={f.churn > 2 ? 'text-error' : ''}>{f.churn.toFixed(1)}</span> },
          ]}
          data={data.mostEdited.slice(0, 10)}
        />
      </Card>
    </div>
  )
}
