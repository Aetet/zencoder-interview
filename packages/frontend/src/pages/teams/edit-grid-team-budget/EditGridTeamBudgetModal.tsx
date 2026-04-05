import { reatomComponent } from "@reatom/react"
import { editGridTeamBudgetRoute } from "./edit-grid-team-budget-route"
import { Input } from "../../../shared/components/Input"
import { Modal } from "../../../shared/components/Modal"
import { cn } from "../../../shared/utils/cn"

export const EditGridTeamBudgetModal = reatomComponent(() => {
  const open = editGridTeamBudgetRoute.isOpen()
  if (!open) return null

  const teamId = editGridTeamBudgetRoute.editingTeamId()

  return (
    <Modal open onClose={() => editGridTeamBudgetRoute.close()} title={`Edit Budget — ${teamId}`}>
      <form onSubmit={e => { e.preventDefault(); editGridTeamBudgetRoute.save() }}>
        <label className="text-xs text-foreground-muted">Monthly Budget (USD). Clear to remove override.</label>
        <div className="mt-2">
          <EditInput />
        </div>
        <EditDelta />
        <div className="flex gap-3 mt-6">
          <button type="submit" className="flex-1 bg-primary text-primary-foreground py-2 rounded-xl text-sm font-medium hover:opacity-90 cursor-pointer">
            Save
          </button>
          <button type="button" onClick={() => editGridTeamBudgetRoute.close()} className="flex-1 bg-accent text-foreground py-2 rounded-xl text-sm font-medium hover:bg-accent/80 cursor-pointer">
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  )
}, "EditGridTeamBudgetModal")

const EditInput = reatomComponent(() => (
  <Input
    type="number"
    value={editGridTeamBudgetRoute.editingValue()}
    onChange={v => editGridTeamBudgetRoute.editingValue.set(v)}
    autoFocus
  />
), "EditGridTeamBudgetInput")

const EditDelta = reatomComponent(() => {
  const delta = editGridTeamBudgetRoute.editingDelta()
  if (!delta || delta.type === "same") return null

  const color = delta.type === "remove" ? "text-foreground-muted" : "text-warning"
  return <div className={cn("text-xs mt-2", color)}>{delta.message}</div>
}, "EditGridTeamBudgetDelta")
