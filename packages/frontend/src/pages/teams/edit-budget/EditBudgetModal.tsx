import { reatomComponent } from "@reatom/react"
import { editBudgetRoute } from "./edit-budget-route"
import { Input } from "../../../shared/components/Input"
import { Modal } from "../../../shared/components/Modal"

export const EditBudgetModal = reatomComponent(() => {
  const open = editBudgetRoute.isOpen()
  if (!open) return null

  return (
    <Modal open onClose={() => editBudgetRoute.close()} title="Edit Org Budget">
      <form onSubmit={e => { e.preventDefault(); editBudgetRoute.save() }}>
        <label className="text-xs text-foreground-muted">Monthly Budget (USD)</label>
        <div className="mt-2">
          <EditInput />
        </div>
        <Validation />
        <div className="flex gap-3 mt-6">
          <button type="submit" className="flex-1 bg-primary text-primary-foreground py-2 rounded-xl text-sm font-medium hover:opacity-90 cursor-pointer">
            Save
          </button>
          <button type="button" onClick={() => editBudgetRoute.close()} className="flex-1 bg-accent text-foreground py-2 rounded-xl text-sm font-medium hover:bg-accent/80 cursor-pointer">
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  )
}, 'EditBudgetModal')

const EditInput = reatomComponent(() => (
  <Input
    type="number"
    value={editBudgetRoute.editingValue()}
    onChange={v => editBudgetRoute.editingValue.set(v)}
    autoFocus
  />
), 'EditBudgetInput')

const Validation = reatomComponent(() => {
  const v = editBudgetRoute.validation()
  if (!v) return null
  if (v.error) return <div className="text-xs mt-2 text-error">{v.error}</div>
  if (v.warning) return <div className="text-xs mt-2 text-warning">{v.warning}</div>
  return null
}, 'EditBudgetValidation')
