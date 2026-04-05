import { reatomComponent } from "@reatom/react"
import { teamsRoute } from "./teams-route"
import { teamRoute } from "./team/team-route"
import { Skeleton } from "../../shared/components/Skeleton"
import { TeamTabs } from "./components/TeamTabs"
import { AllTeamsContent } from "./all-teams/all-teams-page"
import { TeamPage } from "./team/team-page"
import { DeferredMount } from "../../shared/components/DeferredMount"

export const TeamsPage = reatomComponent(() => {
  const isExact = teamsRoute.exact()
  const isTeamSelected = teamRoute.match()
  const loading = !teamsRoute.loader.ready() && !teamsRoute.loader.data()

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="sticky top-0 z-10 bg-background pb-2 -mb-2">
        <TeamTabs />
      </div>
      {loading ? (
        <Skeleton className="flex-1" />
      ) : (
        <>
          <div className={isExact ? "contents" : "hidden"}>
            <DeferredMount>
              <AllTeamsContent />
            </DeferredMount>
          </div>
          {isTeamSelected && (
            <div className="flex flex-col gap-4">
              <TeamPage />
            </div>
          )}
        </>
      )}
    </div>
  )
}, "TeamsPage")
