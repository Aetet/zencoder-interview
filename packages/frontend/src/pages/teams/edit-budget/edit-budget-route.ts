import { atom, action, computed, wrap } from "@reatom/core"
import { teamsRoute, budgetView } from "../teams-route"
import { api } from "../../../shared/api/client"
import { validateOrgBudget } from "../../../shared/utils/budget"
import { showToast } from "../../../shared/components/Toast"

export const editBudgetRoute = teamsRoute
  .reatomRoute({
    params({ edit }: { edit?: string }) {
      return edit !== undefined ? { edit } : null
    },
  })
  .extend(edit => {
    const editingValue = atom("", "editBudget.value")
    const isOpen = computed(() => edit() !== null, "editBudget.isOpen")

    const open = action(() => {
      editingValue.set(String(budgetView().monthlyBudget))
      edit.go({ edit: "" })
    }, "editBudget.open")

    const close = action(() => {
      edit.go({})
    }, "editBudget.close")

    const validation = computed(() => {
      const amount = Number(editingValue())
      if (!amount) return null
      const bv = budgetView()
      const currentSpend = bv.teamBudgets.reduce((s, t) => s + t.spent, 0)
      return validateOrgBudget(amount, currentSpend, bv.teamOverrides)
    }, "editBudget.validation")

    const save = action(async () => {
      const v = validation()
      if (v && !v.valid) {
        showToast(v.error!, "error")
        return
      }
      const bv = budgetView()
      await wrap(api.budgets.save({
        monthlyBudget: Number(editingValue()),
        teamOverrides: bv.teamOverrides,
      }))
      showToast("Budget saved successfully")
      edit.go({})
    }, "editBudget.save")

    return { editingValue, isOpen, open, close, save, validation }
  })
