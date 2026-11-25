import { useState } from "react";
import {
  Download,
  KeyRound,
  Plus,
  Shield,
  ShieldAlert,
  Store,
  UserCheck,
  UserMinus,
  Users,
  X,
} from "lucide-react";
import { exportToCsv } from "../utils/exportCsv";

export type StaffMember = {
  id: number;
  username: string;
  first_name?: string;
  last_name?: string;
  display_name: string;
  email?: string;
  role: "owner" | "manager" | "employee";
  workspace: "bakery" | "cafe";
  location: number | null;
  location_name: string;
  is_active: boolean;
  date_joined?: string;
};

export type Location = {
  id: number;
  name: string;
  kind: "home_bakery" | "cafe" | "other";
};

export type StaffPayload = {
  username?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  role: "owner" | "manager" | "employee";
  workspace: "bakery" | "cafe";
  location?: number | null;
  password?: string;
  is_active?: boolean;
};

interface StaffPanelProps {
  staff: StaffMember[];
  locations: Location[];
  currentUserId: number;
  isOwner: boolean;
  disabled: boolean;
  onSaveStaff: (id: number | null, payload: StaffPayload) => Promise<boolean>;
  onDeactivateStaff: (id: number) => Promise<boolean>;
}

export function StaffPanel({
  staff,
  locations,
  currentUserId,
  isOwner,
  disabled,
  onSaveStaff,
  onDeactivateStaff,
}: StaffPanelProps) {
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("active");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMember, setEditingMember] = useState<StaffMember | null>(null);
  const [error, setError] = useState("");

  // Add form states
  const [addUsername, setAddUsername] = useState("");
  const [addFirstName, setAddFirstName] = useState("");
  const [addLastName, setAddLastName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState<"employee" | "manager" | "owner">("employee");
  const [addWorkspace, setAddWorkspace] = useState<"cafe" | "bakery">("cafe");
  const [addLocationId, setAddLocationId] = useState<string>("");
  const [addPassword, setAddPassword] = useState("");

  // Edit form states
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<"employee" | "manager" | "owner">("employee");
  const [editWorkspace, setEditWorkspace] = useState<"cafe" | "bakery">("cafe");
  const [editLocationId, setEditLocationId] = useState<string>("");
  const [editPassword, setEditPassword] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);

  const filteredStaff = staff.filter((m) => {
    if (filterActive === "active") return m.is_active;
    if (filterActive === "inactive") return !m.is_active;
    return true;
  });

  function openEditModal(member: StaffMember) {
    setEditingMember(member);
    setEditFirstName(member.first_name || "");
    setEditLastName(member.last_name || "");
    setEditEmail(member.email || "");
    setEditRole(member.role);
    setEditWorkspace(member.workspace);
    setEditLocationId(member.location ? String(member.location) : "");
    setEditPassword("");
    setEditIsActive(member.is_active);
    setError("");
  }

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!addUsername.trim()) {
      setError("Username is required.");
      return;
    }
    if (!addPassword.trim()) {
      setError("A temporary or secure password is required.");
      return;
    }

    const payload: StaffPayload = {
      username: addUsername.trim(),
      first_name: addFirstName.trim(),
      last_name: addLastName.trim(),
      email: addEmail.trim(),
      role: addRole,
      workspace: addWorkspace,
      location: addLocationId ? Number(addLocationId) : null,
      password: addPassword.trim(),
    };

    const success = await onSaveStaff(null, payload);
    if (success) {
      setShowAddModal(false);
      setAddUsername("");
      setAddFirstName("");
      setAddLastName("");
      setAddEmail("");
      setAddPassword("");
    }
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingMember) return;
    setError("");

    const payload: StaffPayload = {
      first_name: editFirstName.trim(),
      last_name: editLastName.trim(),
      email: editEmail.trim(),
      role: editRole,
      workspace: editWorkspace,
      location: editLocationId ? Number(editLocationId) : null,
      is_active: editIsActive,
    };
    if (editPassword.trim()) {
      payload.password = editPassword.trim();
    }

    const success = await onSaveStaff(editingMember.id, payload);
    if (success) {
      setEditingMember(null);
    }
  }

  function handleExportCsv() {
    const headers = [
      "Staff ID",
      "Username",
      "Full Name",
      "Email",
      "Role",
      "Workspace",
      "Assigned Location",
      "Active Status",
    ];
    const rows = filteredStaff.map((m) => [
      m.id,
      m.username,
      m.display_name,
      m.email || "—",
      m.role,
      m.workspace === "bakery" ? "Home Bakery" : "Café",
      m.location_name || "All Branches",
      m.is_active ? "Active" : "Inactive",
    ]);
    exportToCsv("seasons-cake-staff-roster", headers, rows);
  }

  return (
    <div className="stacked-panels">
      <section className="panel">
        <div className="panel-heading" style={{ flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <p className="eyebrow">Team &amp; Access Control</p>
            <h2>Staff Roster &amp; Permissions</h2>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <div style={{ display: "inline-flex", background: "var(--color-bg)", borderRadius: "var(--radius-sm)", padding: "2px", border: "1px solid var(--color-border)" }}>
              <button
                type="button"
                className={`button button-sm ${filterActive === "active" ? "button-dark" : "button-ghost"}`}
                style={{ padding: "0.25rem 0.6rem", fontSize: "0.85rem" }}
                onClick={() => setFilterActive("active")}
              >
                Active
              </button>
              <button
                type="button"
                className={`button button-sm ${filterActive === "all" ? "button-dark" : "button-ghost"}`}
                style={{ padding: "0.25rem 0.6rem", fontSize: "0.85rem" }}
                onClick={() => setFilterActive("all")}
              >
                All
              </button>
              <button
                type="button"
                className={`button button-sm ${filterActive === "inactive" ? "button-dark" : "button-ghost"}`}
                style={{ padding: "0.25rem 0.6rem", fontSize: "0.85rem" }}
                onClick={() => setFilterActive("inactive")}
              >
                Inactive
              </button>
            </div>

            <button
              type="button"
              className="button button-outline button-sm"
              onClick={handleExportCsv}
              title="Export staff roster to CSV"
            >
              <Download size={14} /> Export CSV
            </button>

            {isOwner && (
              <button
                type="button"
                className="button button-dark button-sm"
                onClick={() => {
                  setShowAddModal(true);
                  setError("");
                }}
              >
                <Plus size={15} /> Add Team Member
              </button>
            )}
          </div>
        </div>

        {filteredStaff.length === 0 ? (
          <div className="empty-state" style={{ padding: "3rem 1rem", textAlign: "center" }}>
            <Users size={32} style={{ opacity: 0.4, marginBottom: "0.5rem" }} />
            <p style={{ fontWeight: 600 }}>No staff members found matching the filter.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Team Member</th>
                  <th>Role</th>
                  <th>Workspace</th>
                  <th>Assigned Branch</th>
                  <th>Status</th>
                  {isOwner && <th style={{ textAlign: "right" }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map((member) => (
                  <tr key={member.id} style={{ opacity: member.is_active ? 1 : 0.65 }}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                        <div
                          style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "50%",
                            background: member.role === "owner" ? "var(--brand-spruce, #1E3F33)" : "var(--brand-terracotta, #C85A32)",
                            color: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 700,
                            fontSize: "0.85rem",
                          }}
                        >
                          {member.display_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <strong>{member.display_name}</strong>
                          <small style={{ display: "block", color: "var(--color-muted)" }}>
                            @{member.username} {member.email && `· ${member.email}`}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span
                        className="status-pill"
                        style={{
                          textTransform: "capitalize",
                          background:
                            member.role === "owner"
                              ? "#e6f4ea"
                              : member.role === "manager"
                              ? "#e8f0fe"
                              : "#f1f3f4",
                          color:
                            member.role === "owner"
                              ? "#137333"
                              : member.role === "manager"
                              ? "#1a73e8"
                              : "#3c4043",
                          fontWeight: 600,
                        }}
                      >
                        {member.role === "owner" && <Shield size={12} style={{ marginRight: 3, verticalAlign: -1 }} />}
                        {member.role}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: "0.9rem" }}>
                        {member.workspace === "bakery" ? "Home Bakery (Production)" : "Café (Sales & POS)"}
                      </span>
                    </td>
                    <td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <Store size={14} style={{ opacity: 0.6 }} />
                        {member.location_name || "All Branches"}
                      </span>
                    </td>
                    <td>
                      <span className={`status-pill status-${member.is_active ? "confirmed" : "cancelled"}`}>
                        {member.is_active ? "Active" : "Deactivated"}
                      </span>
                    </td>
                    {isOwner && (
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "0.4rem" }}>
                          <button
                            type="button"
                            className="button button-outline button-sm"
                            style={{ padding: "0.25rem 0.5rem" }}
                            onClick={() => openEditModal(member)}
                          >
                            Edit
                          </button>
                          {member.id !== currentUserId && member.is_active && (
                            <button
                              type="button"
                              className="button button-ghost button-sm"
                              style={{ padding: "0.25rem 0.5rem", color: "var(--color-danger, #d93025)" }}
                              title="Deactivate account"
                              disabled={disabled}
                              onClick={async () => {
                                if (window.confirm(`Deactivate staff account for ${member.display_name}?`)) {
                                  await onDeactivateStaff(member.id);
                                }
                              }}
                            >
                              <UserMinus size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Add Staff Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div
            className="modal-card"
            style={{ maxWidth: "520px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">Onboard Employee</p>
                <h3>Add Team Member</h3>
              </div>
              <button
                type="button"
                className="icon-action"
                onClick={() => setShowAddModal(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {error && (
              <div className="inline-alert" style={{ margin: "1rem" }} role="alert">
                <ShieldAlert size={16} /> <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="portal-form" style={{ padding: "1rem" }}>
              <div className="form-row">
                <label>
                  Username *
                  <input
                    type="text"
                    required
                    placeholder="e.g. abebe.k"
                    value={addUsername}
                    onChange={(e) => setAddUsername(e.target.value)}
                  />
                </label>
                <label>
                  Password *
                  <input
                    type="password"
                    required
                    placeholder="Initial password"
                    value={addPassword}
                    onChange={(e) => setAddPassword(e.target.value)}
                  />
                </label>
              </div>

              <div className="form-row">
                <label>
                  First name
                  <input
                    type="text"
                    placeholder="Abebe"
                    value={addFirstName}
                    onChange={(e) => setAddFirstName(e.target.value)}
                  />
                </label>
                <label>
                  Last name
                  <input
                    type="text"
                    placeholder="Kebede"
                    value={addLastName}
                    onChange={(e) => setAddLastName(e.target.value)}
                  />
                </label>
              </div>

              <div className="form-row">
                <label>
                  Email
                  <input
                    type="email"
                    placeholder="staff@seasonscake.com"
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                  />
                </label>
                <label>
                  Role *
                  <select
                    value={addRole}
                    onChange={(e) => setAddRole(e.target.value as typeof addRole)}
                  >
                    <option value="employee">Employee (Operational access)</option>
                    <option value="manager">Manager (Branch supervision)</option>
                    <option value="owner">Owner (Full admin &amp; financial)</option>
                  </select>
                </label>
              </div>

              <div className="form-row">
                <label>
                  Workspace *
                  <select
                    value={addWorkspace}
                    onChange={(e) => setAddWorkspace(e.target.value as typeof addWorkspace)}
                  >
                    <option value="cafe">Café (POS, Orders, Sales)</option>
                    <option value="bakery">Home Bakery (Production, Recipes, Stock)</option>
                  </select>
                </label>
                <label>
                  Assigned Branch
                  <select
                    value={addLocationId}
                    onChange={(e) => setAddLocationId(e.target.value)}
                  >
                    <option value="">All Branches / Unrestricted</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} ({loc.kind.replaceAll("_", " ")})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="modal-actions" style={{ marginTop: "1.5rem" }}>
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="button button-dark" disabled={disabled}>
                  <UserCheck size={16} /> Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {editingMember && (
        <div className="modal-backdrop" onClick={() => setEditingMember(null)}>
          <div
            className="modal-card"
            style={{ maxWidth: "520px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">Modify Account</p>
                <h3>Edit: {editingMember.display_name}</h3>
              </div>
              <button
                type="button"
                className="icon-action"
                onClick={() => setEditingMember(null)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {error && (
              <div className="inline-alert" style={{ margin: "1rem" }} role="alert">
                <ShieldAlert size={16} /> <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="portal-form" style={{ padding: "1rem" }}>
              <div className="form-row">
                <label>
                  First name
                  <input
                    type="text"
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                  />
                </label>
                <label>
                  Last name
                  <input
                    type="text"
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                  />
                </label>
              </div>

              <div className="form-row">
                <label>
                  Email
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                  />
                </label>
                <label>
                  Role
                  <select
                    value={editRole}
                    disabled={editingMember.id === currentUserId}
                    onChange={(e) => setEditRole(e.target.value as typeof editRole)}
                  >
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                    <option value="owner">Owner</option>
                  </select>
                </label>
              </div>

              <div className="form-row">
                <label>
                  Workspace
                  <select
                    value={editWorkspace}
                    onChange={(e) => setEditWorkspace(e.target.value as typeof editWorkspace)}
                  >
                    <option value="cafe">Café</option>
                    <option value="bakery">Home Bakery</option>
                  </select>
                </label>
                <label>
                  Assigned Branch
                  <select
                    value={editLocationId}
                    onChange={(e) => setEditLocationId(e.target.value)}
                  >
                    <option value="">All Branches / Unrestricted</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="form-row">
                <label style={{ gridColumn: "1 / -1" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <KeyRound size={14} /> Reset Password (leave blank to keep current)
                  </span>
                  <input
                    type="password"
                    placeholder="Enter new password if changing"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                  />
                </label>
              </div>

              {editingMember.id !== currentUserId && (
                <div style={{ marginTop: "0.5rem" }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={editIsActive}
                      onChange={(e) => setEditIsActive(e.target.checked)}
                    />
                    <span>Account is Active</span>
                  </label>
                </div>
              )}

              <div className="modal-actions" style={{ marginTop: "1.5rem" }}>
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => setEditingMember(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="button button-dark" disabled={disabled}>
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
