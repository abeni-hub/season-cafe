import { useState } from 'react';
import { Wallet } from 'lucide-react';
import { PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { TableShell } from '@/components/ui/table';
import { Pill } from '@/components/ui/badge';
import { Money } from '@/components/shared/Money';
import { useDb } from '@/hooks/useStore';
import { useToast } from '@/components/ui/toast';
import { EXPENSE_CATEGORIES, listExpenses, recordExpense } from '@/services/live/expenseService';
import type { Expense, LocationId } from '@/types/domain';
import { formatDate, isoDate, startOfDayMs } from '@/utils/date';
import { formatCents, parseMoneyToCents } from '@/utils/money';

const categoryTones: Record<Expense['category'], 'green' | 'blue' | 'neutral' | 'amber' | 'red' | 'outline' | 'clay'> = {
  ingredients: 'green',
  packaging: 'blue',
  utilities: 'neutral',
  rent: 'amber',
  salaries: 'clay',
  marketing: 'outline',
  other: 'neutral',
};

export function ExpensesPage() {
  const db = useDb();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const expenses = listExpenses();
  const currency = db.settings.currency;

  const thisMonth = expenses.filter((expense) => {
    const date = new Date(expense.incurredAt);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  });
  const monthTotal = thisMonth.reduce((sum, expense) => sum + expense.amountCents, 0);
  const allTotal = expenses.reduce((sum, expense) => sum + expense.amountCents, 0);

  const [draft, setDraft] = useState<{
    category: Expense['category'];
    amount: string;
    location: LocationId;
    incurredAt: string;
    note: string;
  }>({
    category: 'ingredients',
    amount: '',
    location: 'home_bakery',
    incurredAt: isoDate(new Date()),
    note: '',
  });

  const submit = async () => {
    try {
      await recordExpense({
        category: draft.category,
        amountCents: parseMoneyToCents(draft.amount),
        location: draft.location,
        incurredAt: draft.incurredAt,
        note: draft.note,
      });
      toast.success('Expense recorded.');
      setOpen(false);
      setDraft((current) => ({ ...current, amount: '', note: '' }));
    } catch (error) {
      toast.error(error);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Finance"
        title="Expenses"
        description="Operating costs, recorded by category and location. Expenses are financial events; they never adjust stock."
        actions={<Button onClick={() => setOpen(true)}><Wallet className="h-4 w-4" /> Record expense</Button>}
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <div className="card px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">This month</p>
          <p className="mt-1 font-display text-xl text-clay-deep">{formatCents(monthTotal, currency)}</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Recorded total</p>
          <p className="mt-1 font-display text-xl text-forest-deep">{formatCents(allTotal, currency)}</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Entries</p>
          <p className="mt-1 font-display text-xl text-forest-deep">{expenses.length}</p>
        </div>
      </div>

      <TableShell>
        <table className="table-base">
          <thead>
            <tr>
              <th className="th">Incurred</th>
              <th className="th">Category</th>
              <th className="th">Location</th>
              <th className="th">Note</th>
              <th className="th">Recorded by</th>
              <th className="th text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((expense) => (
              <tr key={expense.id} className="transition-colors hover:bg-paper/45">
                <td className="td text-xs">{formatDate(expense.incurredAt)}</td>
                <td className="td"><Pill tone={categoryTones[expense.category]}>{expense.category}</Pill></td>
                <td className="td text-xs">{expense.location === 'cafe' ? 'Café' : 'Home Bakery'}</td>
                <td className="td text-xs">{expense.note}</td>
                <td className="td text-xs text-muted">{expense.recordedBy}</td>
                <td className="td text-right font-medium"><Money cents={expense.amountCents} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>

      <p className="mt-4 text-[11px] leading-relaxed text-muted">
        Purchases recorded through purchase receipts already carry supplier costs; expenses here cover
        operating overheads such as rent, utilities and salaries. Keep them separate to avoid double counting.
      </p>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Record expense"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit}>Record expense</Button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Category" htmlFor="expense-category">
            <Select id="expense-category" value={draft.category} onChange={(e) => setDraft((current) => ({ ...current, category: e.target.value as Expense['category'] }))}>
              {EXPENSE_CATEGORIES.map((category) => (
                <option key={category} value={category}>{category.charAt(0).toUpperCase() + category.slice(1)}</option>
              ))}
            </Select>
          </Field>
          <Field label="Amount" htmlFor="expense-amount">
            <Input id="expense-amount" inputMode="decimal" value={draft.amount} onChange={(e) => setDraft((current) => ({ ...current, amount: e.target.value }))} />
          </Field>
          <Field label="Location" htmlFor="expense-location">
            <Select id="expense-location" value={draft.location} onChange={(e) => setDraft((current) => ({ ...current, location: e.target.value as LocationId }))}>
              {db.settings.locations.map((location) => (
                <option key={location.id} value={location.id}>{location.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Incurred on" htmlFor="expense-date">
            <Input id="expense-date" type="date" value={draft.incurredAt} onChange={(e) => setDraft((current) => ({ ...current, incurredAt: e.target.value }))} />
          </Field>
          <Field label="Note" htmlFor="expense-note" className="sm:col-span-2" hint={`Today is ${formatDate(isoDate(new Date(startOfDayMs())))}.`}>
            <Textarea id="expense-note" value={draft.note} onChange={(e) => setDraft((current) => ({ ...current, note: e.target.value }))} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
