import { reatomComponent } from "@reatom/react"
import { overviewRoute } from "../../pages/overview/overview-route"

export const FilterBar = reatomComponent(() => {
  const isOverview = overviewRoute.exact()

  return <div className="ml-auto flex items-center gap-2">{isOverview && <div id="go-live-slot" />}</div>
}, "FilterBar")
