import { reatomComponent } from '@reatom/react'
import { rootRoute } from './pages/root-route'
import { FpsCounter } from './shared/components/FpsCounter'
import { ToastContainer } from './shared/components/Toast'
import { GlobalProgress } from './shared/components/GlobalProgress'
import { EditTeamBudgetModal } from './pages/teams/components/EditTeamBudgetModal'

export const App = reatomComponent(() => {
  return (
    <>
      <GlobalProgress />
      {rootRoute.render()}
      <EditTeamBudgetModal />
      <ToastContainer />
      <FpsCounter />
    </>
  )
}, 'App')
