import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageHeader } from '@/components/ui/page';
import { HAS_REMOTE_API } from '@/config/brand';
import { Field, Select } from '@/components/ui/field';
import { TableShell } from '@/components/ui/table';
import { Money } from '@/components/shared/Money';
import { useDb } from '@/hooks/useStore';
import {
  customerBalances,
  dashboardSummary,
  expensesByCategory,
  inventoryValuation,
  productPerformance,
  salesSeries,
  totalExpenses,
} from '@/services/reportService';
import { supplierBalances } from '@/services/live/purchasingService';
import { formatCents, quantity } from '@/utils/money';

const ranges = [
  { value: 7, label: 'Last 7 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
];

export function ReportsPage() {
  const db = useDb();
  const [days, setDays] = useState(30);
  const currency = db.settings.currency;

  const series = useMemo(() => salesSeries(days), [days, db]);
  const products = productPerformance(days);
  const expenses = expensesByCategory(days);
  const expenseTotal = totalExpenses(days);
  const valuation = inventoryValuation();
  const customers = customerBalances();
  const suppliers = supplierBalances();
  const summary = dashboardSummary();

  const collected = series.reduce((sum, point) => sum + point.collectedCents, 0);
  const net = collected - expenseTotal;

  const moneyTick = (value: number) => formatCents(value, currency, { compact: true });

  return (
    <div>
      <PageHeader
        eyebrow="Finance"
        title="Reports"
        description={HAS_REMOTE_API ? 'Actual figures from recorded transactions. Nothing here is projected or simulated — all amounts derive from the live ledger.' : 'Actual figures from recorded transactions. Nothing here is projected or simulated — all amounts derive from the demo ledger.'}
        actions={
          <Field label="Period" htmlFor="report-range" className="w-44">
            <Select id="report-range" value={days} onChange={(e) => setDays(Number(e.target.value))}>
              {ranges.map((range) => (
                <option key={range.value} value={range.value}>{range.label}</option>
              ))}
            </Select>
          </Field>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Collected in period</p>
          <p className="mt-1 font-display text-xl text-forest-deep">{formatCents(collected, currency)}</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Expenses in period</p>
          <p className="mt-1 font-display text-xl text-clay-deep">{formatCents(expenseTotal, currency)}</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Collections less expenses</p>
          <p className={`mt-1 font-display text-xl ${net >= 0 ? 'text-forest-deep' : 'text-[#8d2f24]'}`}>{formatCents(net, currency)}</p>
          <p className="mt-1 text-[10px] text-muted">Not a statutory profit figure — excludes purchase and payroll policy.</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Outstanding customer balances</p>
          <p className="mt-1 font-display text-xl text-forest-deep">{formatCents(summary.outstandingCents, currency)}</p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="card p-5">
          <p className="eyebrow">Collections</p>
          <h3 className="font-display text-lg text-forest-deep">Daily net collections</h3>
          <div className="mt-3 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="reportCollections" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3f5c35" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#3f5c35" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e3dbc9" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#7c7564' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tickFormatter={moneyTick} tick={{ fontSize: 10, fill: '#7c7564' }} tickLine={false} axisLine={false} width={70} />
                <Tooltip formatter={(value: number) => formatCents(Number(value), currency)} labelStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="collectedCents" stroke="#3f5c35" strokeWidth={2} fill="url(#reportCollections)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5">
          <p className="eyebrow">Costs</p>
          <h3 className="font-display text-lg text-forest-deep">Expenses by category</h3>
          <div className="mt-3 h-64">
            {expenses.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={expenses} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e3dbc9" vertical={false} />
                  <XAxis dataKey="category" tick={{ fontSize: 10, fill: '#7c7564' }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={moneyTick} tick={{ fontSize: 10, fill: '#7c7564' }} tickLine={false} axisLine={false} width={70} />
                  <Tooltip formatter={(value: number) => formatCents(Number(value), currency)} />
                  <Bar dataKey="totalCents" fill="#b0552f" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-xs text-muted">No expenses recorded in this period.</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <div>
          <h3 className="mb-2 font-display text-lg text-forest-deep">Product performance</h3>
          <TableShell>
            <table className="table-base">
              <thead>
                <tr>
                  <th className="th">Product</th>
                  <th className="th text-right">Units</th>
                  <th className="th text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {products.map((row) => (
                  <tr key={row.name}>
                    <td className="td text-xs font-medium text-ink">{row.name}</td>
                    <td className="td text-right text-xs">{quantity(row.quantity)}</td>
                    <td className="td text-right text-xs"><Money cents={row.revenueCents} /></td>
                  </tr>
                ))}
                {!products.length && (
                  <tr><td className="td text-xs text-muted" colSpan={3}>No fulfilled orders in this period.</td></tr>
                )}
              </tbody>
            </table>
          </TableShell>
        </div>

        <div>
          <h3 className="mb-2 font-display text-lg text-forest-deep">Inventory valuation</h3>
          <TableShell>
            <table className="table-base">
              <thead>
                <tr>
                  <th className="th">Item</th>
                  <th className="th text-right">On hand</th>
                  <th className="th text-right">Value at cost</th>
                </tr>
              </thead>
              <tbody>
                {valuation.rows.slice(0, 6).map((row) => (
                  <tr key={row.itemId}>
                    <td className="td text-xs font-medium text-ink">{row.name}</td>
                    <td className="td text-right text-xs">{quantity(row.total)} {row.unit}</td>
                    <td className="td text-right text-xs"><Money cents={row.valueCents} /></td>
                  </tr>
                ))}
                <tr className="bg-paper/60">
                  <td className="td text-xs font-semibold" colSpan={2}>Total tracked value</td>
                  <td className="td text-right text-xs font-semibold"><Money cents={valuation.totalCents} /></td>
                </tr>
              </tbody>
            </table>
          </TableShell>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <div>
          <h3 className="mb-2 font-display text-lg text-forest-deep">Customer balances</h3>
          <TableShell>
            <table className="table-base">
              <thead>
                <tr>
                  <th className="th">Customer</th>
                  <th className="th text-right">Open orders</th>
                  <th className="th text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((row) => (
                  <tr key={row.customerId}>
                    <td className="td text-xs font-medium text-ink">{row.name}</td>
                    <td className="td text-right text-xs">{row.openOrders}</td>
                    <td className="td text-right text-xs"><Money cents={row.balanceCents} /></td>
                  </tr>
                ))}
                {!customers.length && (
                  <tr><td className="td text-xs text-muted" colSpan={3}>No outstanding customer balances.</td></tr>
                )}
              </tbody>
            </table>
          </TableShell>
        </div>

        <div>
          <h3 className="mb-2 font-display text-lg text-forest-deep">Supplier balances</h3>
          <TableShell>
            <table className="table-base">
              <thead>
                <tr>
                  <th className="th">Supplier</th>
                  <th className="th text-right">Received</th>
                  <th className="th text-right">Balance owed</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((row) => (
                  <tr key={row.supplier.id}>
                    <td className="td text-xs font-medium text-ink">{row.supplier.name}</td>
                    <td className="td text-right text-xs"><Money cents={row.receivedCents} /></td>
                    <td className="td text-right text-xs"><Money cents={row.balanceCents} /></td>
                  </tr>
                ))}
                {!suppliers.length && (
                  <tr><td className="td text-xs text-muted" colSpan={3}>No suppliers recorded.</td></tr>
                )}
              </tbody>
            </table>
          </TableShell>
        </div>
      </div>

      <p className="mt-5 text-[11px] leading-relaxed text-muted">
        Collections include deposits and final payments minus refunds. Outstanding balances use order total
        minus valid payments. Inventory valuation uses current weighted average cost.{' '}
        {HAS_REMOTE_API
          ? 'Figures are derived from the live API snapshot.'
          : 'All figures are demo records from the local browser adapter.'}
      </p>
    </div>
  );
}
