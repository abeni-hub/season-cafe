import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { TableShell } from '@/components/ui/table';
import { Pill } from '@/components/ui/badge';
import { useDb, useSession } from '@/hooks/useStore';
import { useToast } from '@/components/ui/toast';
import { ROLE_LABELS, ROLE_PERMISSIONS } from '@/config/permissions';
import { HAS_REMOTE_API } from '@/config/brand';
import { createEmployee, listEmployees, updateEmployee } from '@/services/live/employeeService';
import type { Employee, Role } from '@/types/domain';
import { formatDate } from '@/utils/date';

const roles: Role[] = ['owner', 'admin', 'manager', 'cashier', 'production', 'inventory'];

const roleDescriptions: Record<Role, string> = {
  owner: 'Full access to every module, including finance and staff administration.',
  admin: 'Operational administration across all modules.',
  manager: 'All operational modules and reporting, without staff-account administration.',
  cashier: 'Point of sale, orders and customer payments; no inventory or finance settings.',
  production: 'Production batches, recipes and read-only inventory visibility.',
  inventory: 'Stock, purchasing and transfers; no sales or finance access.',
};

export function EmployeesPage() {
  const db = useDb();
  const session = useSession();
  const toast = useToast();
  const employees = listEmployees();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [createForm, setCreateForm] = useState<{ name: string; email: string; password: string; role: Role }>({
    name: '',
    email: '',
    password: '',
    role: 'cashier',
  });
  const [editForm, setEditForm] = useState<{ name: string; role: Role; isActive: boolean }>({
    name: '',
    role: 'cashier',
    isActive: true,
  });

  const openEdit = (employee: Employee) => {
    setEditing(employee);
    setEditForm({ name: employee.name, role: employee.role, isActive: employee.isActive });
  };

  const submitCreate = async () => {
    try {
      await createEmployee(createForm);
      toast.success('Staff account created.');
      setCreateOpen(false);
      setCreateForm({ name: '', email: '', password: '', role: 'cashier' });
    } catch (error) {
      toast.error(error);
    }
  };

  const submitEdit = async () => {
    if (!editing) return;
    try {
      await updateEmployee(editing.id, editForm);
      toast.success('Account updated.');
      setEditing(null);
    } catch (error) {
      toast.error(error);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Team & access"
        description="Role-based access. Navigation hides unavailable modules, but every service enforces permissions server-side in production."
        actions={<Button onClick={() => setCreateOpen(true)}><UserPlus className="h-4 w-4" /> Add staff</Button>}
      />

      <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {roles.map((role) => (
          <div key={role} className="card px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="font-display text-base text-forest-deep">{ROLE_LABELS[role]}</p>
              <Pill tone="outline">{ROLE_PERMISSIONS[role].length} permissions</Pill>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">{roleDescriptions[role]}</p>
          </div>
        ))}
      </div>

      <TableShell>
        <table className="table-base">
          <thead>
            <tr>
              <th className="th">Name</th>
              <th className="th">Email</th>
              <th className="th">Role</th>
              <th className="th">Status</th>
              <th className="th">Added</th>
              <th className="th" />
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => (
              <tr key={employee.id} className="transition-colors hover:bg-paper/45">
                <td className="td">
                  <p className="font-medium text-ink">{employee.name}</p>
                  {session?.employeeId === employee.id && <p className="text-[10px] uppercase tracking-wide text-clay">You</p>}
                </td>
                <td className="td text-xs">{employee.email}</td>
                <td className="td"><Pill tone={employee.role === 'owner' ? 'green' : 'neutral'}>{ROLE_LABELS[employee.role]}</Pill></td>
                <td className="td">
                  <Pill tone={employee.isActive ? 'green' : 'red'}>{employee.isActive ? 'Active' : 'Disabled'}</Pill>
                </td>
                <td className="td text-xs">{formatDate(employee.createdAt)}</td>
                <td className="td text-right">
                  <Button size="sm" variant="outline" onClick={() => openEdit(employee)}>Manage</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>

      <p className="mt-4 text-[11px] leading-relaxed text-muted">
        {HAS_REMOTE_API
          ? 'Accounts are stored in PostgreSQL. Roles are enforced by the Django API on every request; hiding navigation is a convenience, not the security boundary.'
          : 'Demo accounts sign in with the shared demo password shown on the login screen. Replace this adapter with the Django authentication flow before production; frontend restrictions are advisory only.'}
      </p>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add staff account"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={submitCreate}>Create account</Button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Full name" htmlFor="employee-name">
            <Input id="employee-name" value={createForm.name} onChange={(e) => setCreateForm((current) => ({ ...current, name: e.target.value }))} />
          </Field>
          <Field label="Email" htmlFor="employee-email">
            <Input id="employee-email" type="email" value={createForm.email} onChange={(e) => setCreateForm((current) => ({ ...current, email: e.target.value }))} />
          </Field>
          <Field
            label="Temporary password"
            htmlFor="employee-password"
            hint={HAS_REMOTE_API ? 'At least 8 characters. Share it securely; it cannot be viewed later.' : 'At least 6 characters.'}
          >
            <Input id="employee-password" type="text" value={createForm.password} onChange={(e) => setCreateForm((current) => ({ ...current, password: e.target.value }))} />
          </Field>
          <Field label="Role" htmlFor="employee-role">
            <Select id="employee-role" value={createForm.role} onChange={(e) => setCreateForm((current) => ({ ...current, role: e.target.value as Role }))}>
              {roles.map((role) => (
                <option key={role} value={role}>{ROLE_LABELS[role]}</option>
              ))}
            </Select>
          </Field>
        </div>
      </Modal>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing ? `Manage ${editing.name}` : 'Manage account'}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={submitEdit}>Save changes</Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Field label="Full name" htmlFor="edit-employee-name">
            <Input id="edit-employee-name" value={editForm.name} onChange={(e) => setEditForm((current) => ({ ...current, name: e.target.value }))} />
          </Field>
          <Field label="Role" htmlFor="edit-employee-role">
            <Select id="edit-employee-role" value={editForm.role} onChange={(e) => setEditForm((current) => ({ ...current, role: e.target.value as Role }))}>
              {roles.map((role) => (
                <option key={role} value={role}>{ROLE_LABELS[role]}</option>
              ))}
            </Select>
          </Field>
          <Field label="Account status" htmlFor="edit-employee-active">
            <Select
              id="edit-employee-active"
              value={editForm.isActive ? 'active' : 'disabled'}
              onChange={(e) => setEditForm((current) => ({ ...current, isActive: e.target.value === 'active' }))}
            >
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </Select>
          </Field>
        </div>
      </Modal>
    </div>
  );
}
