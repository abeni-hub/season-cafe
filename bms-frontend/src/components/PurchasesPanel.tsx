import React, { useRef, useState } from "react";
import { Download, Plus, ShoppingBasket, X } from "lucide-react";
import { Button } from "./ui/button";
import { exportToCsv } from "../utils/exportCsv";

export type Location = { id: number; name: string; kind: "home_bakery" | "cafe" | "other" };
export type IngredientUnit = "kg" | "g" | "l" | "ml" | "piece";

export type Ingredient = {
  id: number;
  name: string;
  unit: IngredientUnit;
};

export type Purchase = {
  id: number;
  purchased_at: string;
  supplier_name: string;
  note: string;
  status: string;
  rejection_reason: string;
  total_cost: string;
  recorded_by_name: string;
  approved_by_name: string;
  approved_at: string | null;
  received_lines: Array<{
    ingredient_name: string;
    quantity: string;
    unit: IngredientUnit;
    stock_quantity: string;
    stock_unit: IngredientUnit;
    unit_cost: string;
    total_cost: string;
  }>;
};

export type BusinessSettings = {
  require_purchase_approval: boolean;
};

function formatMoney(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-ET", {
    style: "currency",
    currency: "ETB",
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-ET", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

interface PurchasesPanelProps {
  purchases: Purchase[];
  ingredients: Ingredient[];
  suppliers: Array<{ id: number; name: string }>;
  location?: Location;
  settings?: BusinessSettings;
  isOwner: boolean;
  canApprove: boolean;
  disabled: boolean;
  onSubmit: (payload: unknown) => Promise<boolean>;
  onApprove: (id: number) => Promise<boolean>;
  onReject: (id: number, reason: string) => Promise<boolean>;
  onUpdateSettings: (required: boolean) => Promise<boolean>;
}

export function PurchasesPanel({
  purchases,
  ingredients,
  suppliers,
  location,
  settings,
  isOwner,
  canApprove,
  disabled,
  onSubmit,
  onApprove,
  onReject,
  onUpdateSettings,
}: PurchasesPanelProps) {
  const [lines, setLines] = useState([
    { ingredient: "", quantity: "", unit: "kg" as IngredientUnit, unit_cost: "" },
  ]);
  const [rejectingPurchase, setRejectingPurchase] = useState<Purchase | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const idempotencyKey = useRef(crypto.randomUUID());

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const supplier = String(form.get("supplier") ?? "");
    const purchasedAt = String(form.get("purchased_at") ?? "");

    const saved = await onSubmit({
      idempotency_key: idempotencyKey.current,
      supplier: supplier ? Number(supplier) : null,
      purchased_at: purchasedAt ? new Date(purchasedAt).toISOString() : new Date().toISOString(),
      reference: String(form.get("reference") ?? ""),
      note: String(form.get("note") ?? ""),
      lines: lines.map((line) => ({
        ingredient: Number(line.ingredient),
        quantity: line.quantity,
        unit: line.unit,
        unit_cost: line.unit_cost,
      })),
    });
    if (!saved) return;

    idempotencyKey.current = crypto.randomUUID();
    setLines([{ ingredient: "", quantity: "", unit: "kg", unit_cost: "" }]);
    formElement.reset();
  }

  function handleExportCsv() {
    const headers = [
      "Purchase ID",
      "Date",
      "Supplier",
      "Ingredients Received",
      "Total Cost (ETB)",
      "Status",
      "Recorded by",
      "Approved by",
      "Note",
    ];
    const rows = purchases.map((p) => [
      `#${p.id}`,
      formatDate(p.purchased_at),
      p.supplier_name || "Unspecified",
      p.received_lines
        .map((l) => `${l.quantity} ${l.unit} ${l.ingredient_name} (${l.total_cost} ETB)`)
        .join("; "),
      p.total_cost,
      p.status,
      p.recorded_by_name || "—",
      p.approved_by_name || "—",
      p.note || "—",
    ]);
    exportToCsv("seasons-cake-ingredient-purchases", headers, rows);
  }

  async function handleConfirmReject(e: React.FormEvent) {
    e.preventDefault();
    if (!rejectingPurchase || !rejectReason.trim()) return;
    const success = await onReject(rejectingPurchase.id, rejectReason.trim());
    if (success) {
      setRejectingPurchase(null);
      setRejectReason("");
    }
  }

  return (
    <div className="operation-layout">
      <section className="panel form-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Home Bakery ingredient receipt</p>
            <h2>New purchase</h2>
          </div>
        </div>

        {!location && (
          <div className="setup-notice">
            Select one location to record purchases, or create locations from Catalog &amp; users.
          </div>
        )}

        {isOwner && (
          <label className="approval-setting">
            <input
              type="checkbox"
              checked={settings?.require_purchase_approval ?? false}
              disabled={disabled || !settings}
              onChange={(event) => void onUpdateSettings(event.target.checked)}
            />
            Require owner or authorized-manager approval before adding purchases to stock
          </label>
        )}
        {settings?.require_purchase_approval && (
          <p className="form-hint">
            New purchase records stay out of available stock until approved.
          </p>
        )}

        <form className="portal-form" onSubmit={submit}>
          <label>
            Supplier <span className="optional">(optional)</span>
            <select name="supplier">
              <option value="">Not specified</option>
              {suppliers.map((supplier) => (
                <option value={supplier.id} key={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Purchase date
            <input name="purchased_at" type="datetime-local" />
          </label>

          {lines.map((line, index) => (
            <div className="purchase-line" key={index}>
              <label>
                Ingredient
                <select
                  value={line.ingredient}
                  onChange={(event) =>
                    setLines((rows) =>
                      rows.map((row, i) =>
                        i === index
                          ? {
                              ...row,
                              ingredient: event.target.value,
                              unit:
                                ingredients.find(
                                  (item) => String(item.id) === event.target.value,
                                )?.unit ?? row.unit,
                            }
                          : row,
                      ),
                    )
                  }
                  required
                >
                  <option value="">Choose ingredient</option>
                  {ingredients.map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name} ({item.unit})
                    </option>
                  ))}
                </select>
              </label>

              <div className="form-row">
                <label>
                  Quantity
                  <input
                    type="number"
                    min=".001"
                    step=".001"
                    value={line.quantity}
                    onChange={(event) =>
                      setLines((rows) =>
                        rows.map((row, i) =>
                          i === index ? { ...row, quantity: event.target.value } : row,
                        ),
                      )
                    }
                    required
                  />
                </label>
                <label>
                  Unit
                  <select
                    value={line.unit}
                    onChange={(event) =>
                      setLines((rows) =>
                        rows.map((row, i) =>
                          i === index
                            ? { ...row, unit: event.target.value as IngredientUnit }
                            : row,
                        ),
                      )
                    }
                  >
                    <option value="kg">Kilogram</option>
                    <option value="g">Gram</option>
                    <option value="l">Litre</option>
                    <option value="ml">Millilitre</option>
                    <option value="piece">Piece</option>
                  </select>
                </label>
                <label>
                  Unit cost (ETB)
                  <input
                    type="number"
                    min="0"
                    step=".01"
                    value={line.unit_cost}
                    onChange={(event) =>
                      setLines((rows) =>
                        rows.map((row, i) =>
                          i === index ? { ...row, unit_cost: event.target.value } : row,
                        ),
                      )
                    }
                    required
                  />
                </label>
              </div>

              {lines.length > 1 && (
                <button
                  type="button"
                  className="quiet-button"
                  onClick={() => setLines((rows) => rows.filter((_, i) => i !== index))}
                >
                  <X size={14} /> Remove line
                </button>
              )}
            </div>
          ))}

          <button
            type="button"
            className="quiet-button"
            onClick={() =>
              setLines((rows) => [...rows, { ingredient: "", quantity: "", unit: "kg", unit_cost: "" }])
            }
          >
            <Plus size={15} /> Add ingredient
          </button>

          <div className="form-row">
            <label>
              Reference <span className="optional">(optional)</span>
              <input name="reference" />
            </label>
            <label>
              Note <span className="optional">(optional)</span>
              <input name="note" />
            </label>
          </div>

          <button className="button button-dark" disabled={disabled || !location}>
            <ShoppingBasket size={16} /> Record purchase
          </button>
          <p className="form-hint">
            Repeated submissions with the same request key cannot post the stock receipt twice.
          </p>
        </form>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Ingredient receipts and costs</p>
            <h2>Purchase history</h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span>{purchases.length} records</span>
            {purchases.length > 0 && (
              <button
                type="button"
                className="button button-outline button-sm"
                onClick={handleExportCsv}
                title="Export purchases to CSV"
              >
                <Download size={14} /> Export CSV
              </button>
            )}
          </div>
        </div>

        {purchases.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Purchase</th>
                  <th>Ingredients</th>
                  <th>Supplier</th>
                  <th>Total cost</th>
                  <th>Status</th>
                  <th>Recorded by</th>
                  <th>Approval</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((purchase) => (
                  <tr key={purchase.id}>
                    <td>
                      #{purchase.id}
                      <small>
                        {formatDate(purchase.purchased_at)}
                        {purchase.note ? ` · ${purchase.note}` : ""}
                      </small>
                    </td>
                    <td>
                      {purchase.received_lines
                        .map(
                          (line) =>
                            `${line.quantity} ${line.unit} ${line.ingredient_name} (${line.total_cost} ETB)`,
                        )
                        .join(", ")}
                    </td>
                    <td>{purchase.supplier_name || "Not specified"}</td>
                    <td>{formatMoney(purchase.total_cost)}</td>
                    <td>
                      <span className={`status-pill status-${purchase.status}`}>
                        {purchase.status.replaceAll("_", " ")}
                      </span>
                      {purchase.rejection_reason && (
                        <small>{purchase.rejection_reason}</small>
                      )}
                    </td>
                    <td>{purchase.recorded_by_name || "—"}</td>
                    <td>
                      {purchase.status === "pending" && canApprove ? (
                        <div style={{ display: "inline-flex", gap: "0.35rem" }}>
                          <Button
                            type="button"
                            disabled={disabled}
                            onClick={() => void onApprove(purchase.id)}
                          >
                            Approve
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={disabled}
                            onClick={() => {
                              setRejectingPurchase(purchase);
                              setRejectReason("");
                            }}
                          >
                            Reject
                          </Button>
                        </div>
                      ) : purchase.approved_by_name ? (
                        `By ${purchase.approved_by_name}`
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <h3>No purchases recorded</h3>
            <p>
              Approved receipts add their converted ingredient quantities to Home Bakery stock.
            </p>
          </div>
        )}
      </section>

      {/* Reject Purchase Modal */}
      {rejectingPurchase && (
        <div className="modal-backdrop" onClick={() => setRejectingPurchase(null)}>
          <div
            className="modal-card"
            style={{ maxWidth: "440px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">Approval Review</p>
                <h3>Reject Purchase #{rejectingPurchase.id}</h3>
              </div>
              <button
                type="button"
                className="icon-action"
                onClick={() => setRejectingPurchase(null)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleConfirmReject} className="portal-form" style={{ padding: "1rem" }}>
              <label>
                Reason for rejection *
                <textarea
                  required
                  rows={3}
                  placeholder="Explain why this purchase is being rejected..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              </label>
              <div className="modal-actions" style={{ marginTop: "1rem" }}>
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => setRejectingPurchase(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button button-danger"
                  disabled={disabled || !rejectReason.trim()}
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
