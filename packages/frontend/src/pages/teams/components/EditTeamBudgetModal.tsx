import { reatomComponent } from "@reatom/react"
import { editTeamRoute, editAllTeamRoute } from "../teams-route"
import { Input } from "../../../shared/components/Input"
import { Modal } from "../../../shared/components/Modal"
import { cn } from "../../../shared/utils/cn"

export const EditTeamBudgetModal = reatomComponent(() => {
  const detailOpen = editTeamRoute.isOpen()
  const gridOpen = editAllTeamRoute.isOpen()
  if (!detailOpen && !gridOpen) return null

  const teamId = detailOpen
    ? editTeamRoute.editingTeamId()
    : editAllTeamRoute.editingTeamId()

  const handleClose = () => detailOpen ? editTeamRoute.close() : editAllTeamRoute.close()
  const handleSave = () => detailOpen ? editTeamRoute.save() : editAllTeamRoute.save()

  return (
    <Modal open onClose={handleClose} title={`Edit Budget — ${teamId}`}>
      <form
        onSubmit={e => {
          e.preventDefault()
          handleSave()
        }}
      >
        <label className="text-xs text-foreground-muted">
          Monthly Budget (USD). Clear to remove override.
        </label>
        <div className="mt-2">
          <EditInput source={detailOpen ? "detail" : "grid"} />
        </div>
        <EditDelta source={detailOpen ? "detail" : "grid"} />
        <div className="flex gap-3 mt-6">
          <button
            type="submit"
            className="flex-1 bg-primary text-primary-foreground py-2 rounded-xl text-sm font-medium hover:opacity-90 cursor-pointer"
          >
            Save
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 bg-accent text-foreground py-2 rounded-xl text-sm font-medium hover:bg-accent/80 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  )
}, "EditTeamBudgetModal")

const EditInput = reatomComponent(({ source }: { source: "detail" | "grid" }) => {
  const route = source === "detail" ? editTeamRoute : editAllTeamRoute
  return (
    <Input
      type="number"
      value={route.editingValue()}
      onChange={v => route.editingValue.set(v)}
      autoFocus
    />
  )
}, "EditTeamInput")

const EditDelta = reatomComponent(({ source }: { source: "detail" | "grid" }) => {
  const route = source === "detail" ? editTeamRoute : editAllTeamRoute
  const delta = route.editingDelta()
  if (!delta || delta.type === "same") return null

  const color =
    delta.type === "increase" ? "text-warning" : delta.type === "decrease" ? "text-warning" : "text-foreground-muted"

  return <div className={cn("text-xs mt-2", color)}>{delta.message}</div>
}, "EditTeamDelta")
