import { Sidebar } from './Sidebar'
import { FilterBar } from './FilterBar'

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <FilterBar />
        <main className="flex-1 p-4 flex flex-col min-h-0 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  )
}
