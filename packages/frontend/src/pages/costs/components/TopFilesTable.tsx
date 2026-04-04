import { Card } from '../../../shared/components/Card'
import { DataTable } from '../../../shared/components/DataTable'
import type { TopFilesData, TopFile } from '@zendash/shared'

export function TopFilesTable({ data }: { data: TopFilesData }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Card>
        <h3 className="text-sm font-medium text-foreground-secondary mb-4">Most-Read Files</h3>
        <DataTable
          columns={[
            { key: 'path', header: 'File', render: (f: TopFile) => <span className="font-mono text-xs text-accent-foreground truncate block" title={f.path}>{f.path}</span> },
            { key: 'count', header: 'Reads', className: 'text-right tabular-nums w-20', render: (f: TopFile) => f.count.toLocaleString() },
            { key: 'sessions', header: 'Sessions', className: 'text-right tabular-nums w-24', render: (f: TopFile) => f.sessions.toLocaleString() },
          ]}
          data={data.mostRead.slice(0, 10)}
        />
      </Card>

      <Card>
        <h3 className="text-sm font-medium text-foreground-secondary mb-4">Most-Edited Files</h3>
        <DataTable
          columns={[
            { key: 'path', header: 'File', render: (f: TopFile) => <span className="font-mono text-xs text-accent-foreground truncate block" title={f.path}>{f.path}</span> },
            { key: 'count', header: 'Edits', className: 'text-right tabular-nums w-20', render: (f: TopFile) => f.count.toLocaleString() },
            { key: 'sessions', header: 'Sessions', className: 'text-right tabular-nums w-24', render: (f: TopFile) => f.sessions.toLocaleString() },
          ]}
          data={data.mostEdited.slice(0, 10)}
        />
      </Card>
    </div>
  )
}
