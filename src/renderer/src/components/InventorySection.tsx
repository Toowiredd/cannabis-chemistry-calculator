import { useCallback, useState } from 'react'
import { useAppStore, type InventoryItem } from 'renderer/src/stores/appStore'
import { cn } from 'renderer/lib/utils'
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  ShoppingCart,
  FlaskConical,
} from 'lucide-react'
import { Toast, type ToastVariant } from './Toast'

/**
 * 2026-07-25 ccc workflow-validator audit (BLOCKER B4 + B5 + B6 + B7)
 *
 * Inventory is the last write-only slice in `appStore.ts` — the
 * store has `addInventoryItem`, `deleteInventoryItem`, and
 * `setInventory`, but no UI surface was calling `add` /
 * `delete`. The "Insufficient material" warning on the Decarb +
 * QuickBatch tabs short-circuited on `inventory.items.length === 0`,
 * so it never fired on the default empty state. The Dashboard's
 * "Material on Hand" stat was always 0.
 *
 * This component is the inventory UI (it uses `addInventoryItem` +
 * `deleteInventoryItem` — the two store actions the producer side
 * needs; `setInventory` is left for bulk operations owned by a
 * future dispatch):
 * - Inline add form (no modal). Fields match the `InventoryItem`
 *   schema on the store: `name` (required, free text), `amountGrams`
 *   (required, number, positive), `type` ('purchase' | 'usage'),
 *   `date` (default today), `cost?` (optional, number), `notes?`
 *   (optional, free text).
 * - Items list below the form. Each row has name, type badge,
 *   amount in grams, date, optional cost.
 * - Per-row actions: edit (inline form on the row) and delete (with
 *   inline 2-step confirm — destructive action must be unambiguous,
 *   but inline so the user doesn't lose context).
 * - Per-row aria-labels (audit M7 fix pattern, see StrainManager).
 * - Toast on save (success + error) — same pattern as PresetActions
 *   and TabActions.
 * - Empty state: the form is pre-expanded with a big "Add your
 *   first batch" CTA so the user is never stuck on an empty
 *   "0 items" message. The first add collapses the CTA into the
 *   normal "Add item" form.
 *
 * Scope note: this file does NOT touch `appStore.ts` (state-routing
 * owns the store). The store actions already exist; this component
 * is the only UI surface that calls them.
 */

interface FormData {
  name: string
  amountGrams: string
  type: 'purchase' | 'usage'
  date: string
  cost: string
  notes: string
}

function todayIso(): string {
  const d = new Date()
  return d.toISOString().split('T')[0]
}

const EMPTY_FORM: FormData = {
  name: '',
  amountGrams: '',
  type: 'purchase',
  date: todayIso(),
  cost: '',
  notes: '',
}

function genId(): string {
  return `inv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function InventorySection() {
  const items = useAppStore(s => s.inventory.items)
  const addInventoryItem = useAppStore(s => s.addInventoryItem)
  const deleteInventoryItem = useAppStore(s => s.deleteInventoryItem)

  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null
  )
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [editForm, setEditForm] = useState<FormData>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [editError, setEditError] = useState<string | null>(null)

  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [toastVisible, setToastVisible] = useState(false)
  const [toastVariant, setToastVariant] = useState<ToastVariant>('default')

  const showToast = useCallback(
    (msg: string, variant: ToastVariant = 'default') => {
      setToastMsg(msg)
      setToastVariant(variant)
      setToastVisible(true)
      setTimeout(() => setToastVisible(false), 2200)
    },
    []
  )

  const resetForm = useCallback(() => {
    setForm(EMPTY_FORM)
    setFormError(null)
  }, [])

  const startAdding = useCallback(() => {
    setAdding(true)
    setFormError(null)
  }, [])

  const cancelAdding = useCallback(() => {
    setAdding(false)
    resetForm()
  }, [resetForm])

  const validate = useCallback((data: FormData): string | null => {
    if (!data.name.trim()) return 'Name is required'
    const grams = parseFloat(data.amountGrams)
    if (data.amountGrams.trim() === '' || Number.isNaN(grams)) {
      return 'Amount in grams is required'
    }
    if (grams <= 0) return 'Amount must be greater than zero'
    if (data.cost.trim() !== '') {
      const c = parseFloat(data.cost)
      if (Number.isNaN(c) || c < 0) return 'Cost must be a non-negative number'
    }
    return null
  }, [])

  const handleSubmit = useCallback(() => {
    const err = validate(form)
    if (err) {
      setFormError(err)
      return
    }
    const id = genId()
    const item: InventoryItem = {
      id,
      date: form.date || todayIso(),
      type: form.type,
      name: form.name.trim(),
      amountGrams: form.amountGrams.trim(),
      // Only stamp `cost` / `notes` when the user actually entered
      // something. The store schema makes them optional, and a
      // persistent empty-string would be a phantom field for the
      // Journal / summary consumers.
      ...(form.cost.trim() !== '' ? { cost: form.cost.trim() } : {}),
      ...(form.notes.trim() !== '' ? { notes: form.notes.trim() } : {}),
    }
    try {
      addInventoryItem(item)
      showToast(`Added ${item.name}`, 'success')
      setAdding(false)
      resetForm()
    } catch {
      showToast('Could not add to inventory', 'danger')
    }
  }, [form, validate, addInventoryItem, showToast, resetForm])

  const startEditing = useCallback((item: InventoryItem) => {
    setEditingId(item.id)
    setConfirmingDeleteId(null)
    setEditError(null)
    setEditForm({
      name: item.name,
      amountGrams: item.amountGrams,
      type: item.type,
      date: item.date,
      cost: item.cost ?? '',
      notes: item.notes ?? '',
    })
  }, [])

  const cancelEditing = useCallback(() => {
    setEditingId(null)
    setEditError(null)
    setEditForm(EMPTY_FORM)
  }, [])

  const handleSaveEdit = useCallback(
    (originalId: string) => {
      const err = validate(editForm)
      if (err) {
        setEditError(err)
        return
      }
      const updated: InventoryItem = {
        id: originalId,
        date: editForm.date || todayIso(),
        type: editForm.type,
        name: editForm.name.trim(),
        amountGrams: editForm.amountGrams.trim(),
        ...(editForm.cost.trim() !== '' ? { cost: editForm.cost.trim() } : {}),
        ...(editForm.notes.trim() !== ''
          ? { notes: editForm.notes.trim() }
          : {}),
      }
      try {
        // Edit is implemented as delete-then-add because the store
        // exposes `addInventoryItem` (push to head) and
        // `deleteInventoryItem` (filter by id), and we are explicitly
        // forbidden from touching the store. The two-step preserves
        // the existing item's id, which is the only field an external
        // consumer (Journal cross-reference, future export) can rely
        // on.
        //
        // ORDER MATTERS: the add pushes a new item with the SAME id
        // as the original. If we add first, then delete-by-id, the
        // delete filters BOTH items out (the new copy and the
        // original share the id), leaving the list empty. Delete
        // first, then add.
        deleteInventoryItem(originalId)
        addInventoryItem(updated)
        showToast(`Updated ${updated.name}`, 'success')
        setEditingId(null)
        setEditForm(EMPTY_FORM)
      } catch {
        showToast('Could not update item', 'danger')
      }
    },
    [editForm, validate, addInventoryItem, deleteInventoryItem, showToast]
  )

  const askDelete = useCallback((id: string) => {
    setConfirmingDeleteId(id)
    setEditingId(null)
  }, [])

  const cancelDelete = useCallback(() => {
    setConfirmingDeleteId(null)
  }, [])

  const confirmDelete = useCallback(
    (item: InventoryItem) => {
      try {
        deleteInventoryItem(item.id)
        showToast(`Removed ${item.name}`, 'success')
        setConfirmingDeleteId(null)
      } catch {
        showToast('Could not remove item', 'danger')
      }
    },
    [deleteInventoryItem, showToast]
  )

  // When the user removes the LAST item, the inventory returns to
  // the empty state. The empty-state CTA is rendered above
  // automatically (driven by `isEmpty`).
  const sortedItems = [...items].sort((a, b) => b.date.localeCompare(a.date))
  const isEmpty = items.length === 0
  const showForm = isEmpty || adding

  return (
    <section
      aria-labelledby="inventory-section-title"
      className="flex min-w-0 flex-col gap-3 overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/5 p-4 sm:p-5"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Package className="size-4 text-foreground/70" />
          <h3
            className="text-sm font-semibold text-foreground/70"
            id="inventory-section-title"
          >
            Inventory
          </h3>
          {!isEmpty && (
            <span className="rounded-full border border-foreground/10 bg-foreground/5 px-2 py-0.5 text-xs text-foreground/70">
              {items.length} item{items.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
        {!isEmpty && !adding && (
          <button
            aria-label="Add inventory item"
            className="btn-primary"
            data-testid="inventory-add-button"
            onClick={startAdding}
            type="button"
          >
            <Plus aria-hidden="true" className="size-3.5" />
            Add item
          </button>
        )}
      </header>

      {isEmpty && (
        <div
          className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-foreground/20 bg-foreground/5 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
          data-testid="inventory-empty-cta"
        >
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-sm font-semibold text-foreground">
              Add your first batch
            </span>
            <span className="text-xs text-foreground/70">
              Track material on hand so the calculator can warn you when a batch
              would exceed what you have. Most beginners start with about{' '}
              <strong className="font-medium text-foreground/85">1 oz (28g)</strong>
              {' '}— enough for a few small batches to learn on.
            </span>
          </div>
        </div>
      )}

      {showForm && (
        <div
          className="flex flex-col gap-3 rounded-xl border border-foreground/10 bg-foreground/5 p-3 sm:p-4"
          data-testid="inventory-add-form"
        >
          {formError && (
            <div
              className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger"
              role="alert"
            >
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex min-w-0 flex-col gap-1 sm:col-span-2 lg:col-span-1">
              <label
                className="text-xs font-medium text-foreground/70"
                htmlFor="inv-name"
              >
                Name
              </label>
              <input
                className="min-h-11 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
                data-testid="inventory-name-input"
                id="inv-name"
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. My first batch - 28g (1 oz)"
                type="text"
                value={form.name}
              />
            </div>

            <div className="flex min-w-0 flex-col gap-1">
              <label
                className="text-xs font-medium text-foreground/70"
                htmlFor="inv-amount"
              >
                Amount (g)
              </label>
              <input
                className="min-h-11 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
                data-testid="inventory-amount-input"
                id="inv-amount"
                min="0"
                onChange={e =>
                  setForm(f => ({ ...f, amountGrams: e.target.value }))
                }
                placeholder="28 (≈ 1 oz)"
                step="0.01"
                type="number"
                value={form.amountGrams}
              />
            </div>

            <div className="flex min-w-0 flex-col gap-1">
              <label
                className="text-xs font-medium text-foreground/70"
                htmlFor="inv-type"
              >
                Type
              </label>
              <select
                className="min-h-11 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-foreground/40"
                data-testid="inventory-type-input"
                id="inv-type"
                onChange={e =>
                  setForm(f => ({
                    ...f,
                    type: e.target.value as 'purchase' | 'usage',
                  }))
                }
                value={form.type}
              >
                <option value="purchase">Purchase (add to stock)</option>
                <option value="usage">Usage (consume from stock)</option>
              </select>
            </div>

            <div className="flex min-w-0 flex-col gap-1">
              <label
                className="text-xs font-medium text-foreground/70"
                htmlFor="inv-date"
              >
                Date
              </label>
              <input
                className="min-h-11 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-foreground/40"
                data-testid="inventory-date-input"
                id="inv-date"
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                type="date"
                value={form.date}
              />
            </div>

            <div className="flex min-w-0 flex-col gap-1">
              <label
                className="text-xs font-medium text-foreground/70"
                htmlFor="inv-cost"
              >
                Cost (optional)
              </label>
              <input
                className="min-h-11 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
                data-testid="inventory-cost-input"
                id="inv-cost"
                min="0"
                onChange={e => setForm(f => ({ ...f, cost: e.target.value }))}
                placeholder="$0.00"
                step="0.01"
                type="number"
                value={form.cost}
              />
            </div>

            <div className="flex min-w-0 flex-col gap-1 sm:col-span-2 lg:col-span-3">
              <label
                className="text-xs font-medium text-foreground/70"
                htmlFor="inv-notes"
              >
                Notes (optional)
              </label>
              <input
                className="min-h-11 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
                data-testid="inventory-notes-input"
                id="inv-notes"
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Dispensary, batch number, etc."
                type="text"
                value={form.notes}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {!isEmpty && (
              <button
                className="btn-ghost"
                onClick={cancelAdding}
                type="button"
              >
                <X aria-hidden="true" className="size-3.5" />
                Cancel
              </button>
            )}
            <button
              className="btn-primary"
              data-testid="inventory-save-button"
              onClick={handleSubmit}
              type="button"
            >
              <Save aria-hidden="true" className="size-3.5" />
              {isEmpty ? 'Add to inventory' : 'Add item'}
            </button>
          </div>
        </div>
      )}

      {!isEmpty && (
        <ul
          aria-label="Inventory items"
          className="flex list-none flex-col gap-2 p-0"
          data-testid="inventory-list"
        >
          {sortedItems.map(item => {
            if (editingId === item.id) {
              return (
                <li
                  className="flex flex-col gap-3 rounded-lg border border-foreground/20 bg-foreground/5 p-3"
                  data-testid="inventory-edit-row"
                  key={`edit-${item.id}`}
                >
                  {editError && (
                    <div
                      className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger"
                      role="alert"
                    >
                      {editError}
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="flex min-w-0 flex-col gap-1 sm:col-span-2 lg:col-span-1">
                      <label
                        className="text-xs font-medium text-foreground/70"
                        htmlFor={`edit-name-${item.id}`}
                      >
                        Name
                      </label>
                      <input
                        className="min-h-11 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
                        id={`edit-name-${item.id}`}
                        onChange={e =>
                          setEditForm(f => ({ ...f, name: e.target.value }))
                        }
                        type="text"
                        value={editForm.name}
                      />
                    </div>
                    <div className="flex min-w-0 flex-col gap-1">
                      <label
                        className="text-xs font-medium text-foreground/70"
                        htmlFor={`edit-amount-${item.id}`}
                      >
                        Amount (g)
                      </label>
                      <input
                        className="min-h-11 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
                        id={`edit-amount-${item.id}`}
                        min="0"
                        onChange={e =>
                          setEditForm(f => ({
                            ...f,
                            amountGrams: e.target.value,
                          }))
                        }
                        step="0.01"
                        type="number"
                        value={editForm.amountGrams}
                      />
                    </div>
                    <div className="flex min-w-0 flex-col gap-1">
                      <label
                        className="text-xs font-medium text-foreground/70"
                        htmlFor={`edit-type-${item.id}`}
                      >
                        Type
                      </label>
                      <select
                        className="min-h-11 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-foreground/40"
                        id={`edit-type-${item.id}`}
                        onChange={e =>
                          setEditForm(f => ({
                            ...f,
                            type: e.target.value as 'purchase' | 'usage',
                          }))
                        }
                        value={editForm.type}
                      >
                        <option value="purchase">Purchase</option>
                        <option value="usage">Usage</option>
                      </select>
                    </div>
                    <div className="flex min-w-0 flex-col gap-1">
                      <label
                        className="text-xs font-medium text-foreground/70"
                        htmlFor={`edit-date-${item.id}`}
                      >
                        Date
                      </label>
                      <input
                        className="min-h-11 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
                        id={`edit-date-${item.id}`}
                        onChange={e =>
                          setEditForm(f => ({ ...f, date: e.target.value }))
                        }
                        type="date"
                        value={editForm.date}
                      />
                    </div>
                    <div className="flex min-w-0 flex-col gap-1">
                      <label
                        className="text-xs font-medium text-foreground/70"
                        htmlFor={`edit-cost-${item.id}`}
                      >
                        Cost (optional)
                      </label>
                      <input
                        className="min-h-11 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
                        id={`edit-cost-${item.id}`}
                        min="0"
                        onChange={e =>
                          setEditForm(f => ({ ...f, cost: e.target.value }))
                        }
                        step="0.01"
                        type="number"
                        value={editForm.cost}
                      />
                    </div>
                    <div className="flex min-w-0 flex-col gap-1 sm:col-span-2 lg:col-span-3">
                      <label
                        className="text-xs font-medium text-foreground/70"
                        htmlFor={`edit-notes-${item.id}`}
                      >
                        Notes (optional)
                      </label>
                      <input
                        className="min-h-11 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/30 focus:border-foreground/40"
                        id={`edit-notes-${item.id}`}
                        onChange={e =>
                          setEditForm(f => ({ ...f, notes: e.target.value }))
                        }
                        type="text"
                        value={editForm.notes}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      className="btn-ghost"
                      onClick={cancelEditing}
                      type="button"
                    >
                      Cancel
                    </button>
                    <button
                      className="btn-primary"
                      onClick={() => handleSaveEdit(item.id)}
                      type="button"
                    >
                      <Save aria-hidden="true" className="size-3.5" />
                      Save changes
                    </button>
                  </div>
                </li>
              )
            }

            if (confirmingDeleteId === item.id) {
              return (
                <li
                  className="flex flex-col gap-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  data-testid="inventory-confirm-delete"
                  key={`confirm-${item.id}`}
                >
                  <span className="text-xs text-danger">
                    Remove <strong>{item.name}</strong> from inventory? This
                    cannot be undone.
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      className="btn-ghost"
                      onClick={cancelDelete}
                      type="button"
                    >
                      Cancel
                    </button>
                    <button
                      aria-label={`Confirm remove ${item.name}`}
                      className="btn-danger"
                      data-testid="inventory-confirm-delete-button"
                      onClick={() => confirmDelete(item)}
                      type="button"
                    >
                      <Trash2 aria-hidden="true" className="size-3.5" />
                      Remove
                    </button>
                  </div>
                </li>
              )
            }

            const isPurchase = item.type === 'purchase'
            const grams = parseFloat(item.amountGrams) || 0
            const costNum = item.cost ? parseFloat(item.cost) : null
            return (
              <li
                className="flex flex-col gap-2 rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                data-testid="inventory-item-row"
                key={item.id}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                      isPurchase
                        ? 'bg-success/10 text-success'
                        : 'bg-info/10 text-info'
                    )}
                  >
                    {isPurchase ? (
                      <ShoppingCart className="size-4" />
                    ) : (
                      <FlaskConical className="size-4" />
                    )}
                  </span>
                  <div className="flex min-w-0 flex-col">
                    <span
                      className="truncate text-sm font-medium text-foreground"
                      data-testid="inventory-item-name"
                    >
                      {item.name}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-foreground/70">
                      <span
                        className={cn(
                          'rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                          isPurchase
                            ? 'border-success/30 bg-success/10 text-success'
                            : 'border-info/30 bg-info/10 text-info'
                        )}
                      >
                        {isPurchase ? 'Purchase' : 'Usage'}
                      </span>
                      <span data-testid="inventory-item-amount">
                        {grams.toFixed(1)} g
                      </span>
                      <span>·</span>
                      <span data-testid="inventory-item-date">{item.date}</span>
                      {costNum != null && !Number.isNaN(costNum) && (
                        <>
                          <span>·</span>
                          <span data-testid="inventory-item-cost">
                            ${costNum.toFixed(2)}
                          </span>
                        </>
                      )}
                      {item.notes && (
                        <>
                          <span>·</span>
                          <span
                            className="truncate"
                            data-testid="inventory-item-notes"
                          >
                            {item.notes}
                          </span>
                        </>
                      )}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    aria-label={`Edit ${item.name}`}
                    className="rounded p-2 text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground"
                    data-testid="inventory-edit-button"
                    onClick={() => startEditing(item)}
                    type="button"
                  >
                    <Pencil aria-hidden="true" className="size-3.5" />
                  </button>
                  <button
                    aria-label={`Delete ${item.name}`}
                    className="rounded p-2 text-foreground/70 transition-colors hover:bg-danger/10 hover:text-danger"
                    data-testid="inventory-delete-button"
                    onClick={() => askDelete(item.id)}
                    type="button"
                  >
                    <Trash2 aria-hidden="true" className="size-3.5" />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Toast message={toastMsg} variant={toastVariant} visible={toastVisible} />
    </section>
  )
}
