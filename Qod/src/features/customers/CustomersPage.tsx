import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Users } from 'lucide-react';
import { EmptyState, PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { TableShell } from '@/components/ui/table';
import { OrderStatusPill } from '@/components/shared/StatusPills';
import { useDb } from '@/hooks/useStore';
import { useToast } from '@/components/ui/toast';
import { createCustomer, listCustomers, updateCustomer } from '@/services/live/customerService';
import { customerOutstanding, orderTotals } from '@/services/orderMath';
import type { Customer, CustomerKind } from '@/types/domain';
import { formatDate, formatDateTime } from '@/utils/date';
import { formatCents } from '@/utils/money';

interface CustomerFormState {
  kind: CustomerKind;
  name: string;
  organization: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
}

const emptyForm: CustomerFormState = {
  kind: 'individual',
  name: '',
  organization: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
};

export function CustomersPage() {
  const db = useDb();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerFormState>(emptyForm);
  const [viewing, setViewing] = useState<Customer | null>(null);

  const customers = listCustomers();
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return customers;
    return customers.filter((customer) =>
      [customer.name, customer.organization, customer.email, customer.phone]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(needle)),
    );
  }, [customers, query]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (customer: Customer) => {
    setEditing(customer);
    setForm({
      kind: customer.kind,
      name: customer.name,
      organization: customer.organization ?? '',
      phone: customer.phone ?? '',
      email: customer.email ?? '',
      address: customer.address ?? '',
      notes: customer.notes ?? '',
    });
    setFormOpen(true);
  };

  const save = async () => {
    try {
      if (editing) {
        await updateCustomer(editing.id, form);
        toast.success('Customer updated.');
      } else {
        await createCustomer(form);
        toast.success('Customer created.');
      }
      setFormOpen(false);
    } catch (error) {
      toast.error(error);
    }
  };

  const viewingOrders = viewing
    ? db.orders
        .filter((order) => order.customerId === viewing.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : [];

  return (
    <div>
      <PageHeader
        eyebrow="Sales"
        title="Customers"
        description="Individuals and organisations with their contact details, order history and running balances."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> New customer
          </Button>
        }
      />

      <div className="mb-4 max-w-sm">
        <Field label="Search" htmlFor="customer-search">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <Input
              id="customer-search"
              className="pl-9"
              placeholder="Name, organisation, contact"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </Field>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title="No customers yet"
          description="Create an individual or organisation profile to track orders and balances."
        />
      ) : (
        <TableShell>
          <table className="table-base">
            <thead>
              <tr>
                <th className="th">Customer</th>
                <th className="th">Type</th>
                <th className="th">Contact</th>
                <th className="th text-center">Orders</th>
                <th className="th text-right">Balance</th>
                <th className="th">Added</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((customer) => {
                const orders = db.orders.filter((order) => order.customerId === customer.id);
                const balance = customerOutstanding(db, customer.id);
                return (
                  <tr key={customer.id} className="transition-colors hover:bg-paper/40">
                    <td className="td">
                      <p className="font-semibold text-ink">{customer.name}</p>
                      {customer.organization && <p className="text-[11px] text-muted">{customer.organization}</p>}
                    </td>
                    <td className="td text-xs capitalize">{customer.kind}</td>
                    <td className="td text-xs text-muted">
                      {customer.phone || customer.email || '—'}
                    </td>
                    <td className="td text-center">{orders.length}</td>
                    <td className="td text-right">
                      <span className={balance > 0 ? 'font-semibold text-clay-deep' : 'text-muted'}>
                        {formatCents(balance, db.settings.currency)}
                      </span>
                    </td>
                    <td className="td text-xs">{formatDate(customer.createdAt)}</td>
                    <td className="td">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setViewing(customer)}>
                          History
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openEdit(customer)}>
                          Edit
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableShell>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit customer' : 'New customer'}
        description="Contact details support quotations, invoices and order communication."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editing ? 'Save changes' : 'Create customer'}</Button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Customer type" htmlFor="customer-kind">
            <Select
              id="customer-kind"
              value={form.kind}
              onChange={(e) => setForm((current) => ({ ...current, kind: e.target.value as CustomerKind }))}
            >
              <option value="individual">Individual</option>
              <option value="organization">Organisation</option>
            </Select>
          </Field>
          <Field label="Name" htmlFor="customer-name">
            <Input id="customer-name" value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))} />
          </Field>
          {form.kind === 'organization' && (
            <Field label="Organisation" htmlFor="customer-org" className="sm:col-span-2">
              <Input id="customer-org" value={form.organization} onChange={(e) => setForm((current) => ({ ...current, organization: e.target.value }))} />
            </Field>
          )}
          <Field label="Phone" htmlFor="customer-phone">
            <Input id="customer-phone" value={form.phone} onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))} />
          </Field>
          <Field label="Email" htmlFor="customer-email">
            <Input id="customer-email" type="email" value={form.email} onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))} />
          </Field>
          <Field label="Address" htmlFor="customer-address" className="sm:col-span-2">
            <Input id="customer-address" value={form.address} onChange={(e) => setForm((current) => ({ ...current, address: e.target.value }))} />
          </Field>
          <Field label="Notes" htmlFor="customer-notes" className="sm:col-span-2">
            <Textarea id="customer-notes" value={form.notes} onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title={viewing ? `${viewing.name} — order history` : 'Order history'}
        description={viewing?.organization ?? undefined}
        size="lg"
      >
        {viewing && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-paper/60 p-3 text-xs sm:grid-cols-4">
              <div>
                <p className="uppercase tracking-[0.1em] text-muted">Phone</p>
                <p className="mt-0.5 text-ink">{viewing.phone || '—'}</p>
              </div>
              <div>
                <p className="uppercase tracking-[0.1em] text-muted">Email</p>
                <p className="mt-0.5 text-ink">{viewing.email || '—'}</p>
              </div>
              <div>
                <p className="uppercase tracking-[0.1em] text-muted">Balance</p>
                <p className="mt-0.5 font-semibold text-clay-deep">{formatCents(customerOutstanding(db, viewing.id), db.settings.currency)}</p>
              </div>
              <div>
                <p className="uppercase tracking-[0.1em] text-muted">Since</p>
                <p className="mt-0.5 text-ink">{formatDate(viewing.createdAt)}</p>
              </div>
            </div>
            {viewing.notes && <p className="text-xs text-muted">{viewing.notes}</p>}
            {viewingOrders.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
                No orders recorded for this customer.
              </p>
            ) : (
              <TableShell>
                <table className="table-base">
                  <thead>
                    <tr>
                      <th className="th">Order</th>
                      <th className="th">Date</th>
                      <th className="th">Status</th>
                      <th className="th text-right">Total</th>
                      <th className="th text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewingOrders.map((order) => {
                      const totals = orderTotals(db, order);
                      return (
                        <tr key={order.id}>
                          <td className="td">
                            <Link to={`/admin/orders/${order.id}`} className="font-semibold text-forest hover:underline">
                              {order.code}
                            </Link>
                          </td>
                          <td className="td text-xs">{formatDateTime(order.createdAt)}</td>
                          <td className="td"><OrderStatusPill status={order.status} /></td>
                          <td className="td text-right">{order.status === 'inquiry' ? '—' : formatCents(totals.totalCents, db.settings.currency)}</td>
                          <td className="td text-right">{order.status === 'inquiry' ? '—' : formatCents(totals.balanceCents, db.settings.currency)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableShell>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
