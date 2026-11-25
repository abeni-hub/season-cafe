import type { Expense, LocationId } from '@/types/domain';
import { getDb, mutateDb } from './demo/store';
import { AppError } from './errors';
import { requirePermission } from './guard';
import { requireNonEmpty, requirePositive } from './helpers';
import { nowIso } from '@/utils/date';
import { uid } from '@/utils/id';

export const EXPENSE_CATEGORIES = [
  'ingredients',
  'packaging',
  'utilities',
  'rent',
  'salaries',
  'marketing',
  'other',
] as const;

export function listExpenses(): Expense[] {
  return [...getDb().expenses].sort(
    (a, b) => new Date(b.incurredAt).getTime() - new Date(a.incurredAt).getTime(),
  );
}

export interface ExpenseInput {
  category: Expense['category'];
  amountCents: number;
  location: LocationId;
  note: string;
  incurredAt: string;
}

export function recordExpense(input: ExpenseInput): Expense {
  const actor = requirePermission('expenses.manage');
  requirePositive(input.amountCents, 'Expense amount must be greater than zero.');
  if (!Number.isInteger(input.amountCents)) throw new AppError('Expense amount is invalid.');
  const note = requireNonEmpty(input.note, 'Add a short note for the expense.');
  if (!input.incurredAt) throw new AppError('Select the date the expense was incurred.');
  return mutateDb(
    (draft) => {
      const expense: Expense = {
        id: uid('exp'),
        category: input.category,
        amountCents: input.amountCents,
        location: input.location,
        note,
        incurredAt: input.incurredAt,
        recordedBy: actor.name,
      };
      draft.expenses.push(expense);
      draft.activity.unshift({
        id: uid('act'),
        message: `Expense recorded: ${note}.`,
        actor: actor.name,
        createdAt: nowIso(),
      });
      return expense;
    },
    undefined,
  );
}
