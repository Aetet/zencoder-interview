import { reatomComponent } from "@reatom/react"
import { editTeamBudgetRoute } from "./edit-team-budget-route"
import { Input } from "../../../shared/components/Input"
import { Modal } from "../../../shared/components/Modal"
import { cn } from "../../../shared/utils/cn"

export const EditTeamBudgetModal = reatomComponent(() => {
  const open = editTeamBudgetRoute.isOpen()
  if (!open) return null

  const teamId = editTeamBudgetRoute.editingTeamId()

  return (
    <Modal open onClose={() => editTeamBudgetRoute.close()} title={`Edit Budget — ${teamId}`}>
      <form onSubmit={e => { e.preventDefault(); editTeamBudgetRoute.save() }}>
        <label className="text-xs text-foreground-muted">Monthly Budget (USD). Clear to remove override.</label>
        <div className="mt-2">
          <EditInput />
        </div>
        <EditDelta />
        <div className="flex gap-3 mt-6">
          <button type="submit" className="flex-1 bg-primary text-primary-foreground py-2 rounded-xl text-sm font-medium hover:opacity-90 cursor-pointer">
            Save
          </button>
          <button type="button" onClick={() => editTeamBudgetRoute.close()} className="flex-1 bg-accent text-foreground py-2 rounded-xl text-sm font-medium hover:bg-accent/80 cursor-pointer">
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  )
}, "EditTeamBudgetModal")

const EditInput = reatomComponent(() => (
  <Input
    type="number"
    value={editTeamBudgetRoute.editingValue()}
    onChange={v => editTeamBudgetRoute.editingValue.set(v)}
    autoFocus
  />
), "EditTeamBudgetInput")

const EditDelta = reatomComponent(() => {
  const delta = editTeamBudgetRoute.editingDelta()
  if (!delta || delta.type === "same") return null

  const color = delta.type === "remove" ? "text-foreground-muted" : "text-warning"
  return <div className={cn("text-xs mt-2", color)}>{delta.message}</div>
}, "EditTeamBudgetDelta")
