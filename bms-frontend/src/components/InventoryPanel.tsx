import { useState } from "react";
import {
  CheckCircle2,
  Plus,
  Store,
  Truck,
  X,
} from "lucide-react";

export type Location = {
  id: number;
  name: string;
  kind: "home_bakery" | "cafe" | "other";
};

export type Product = {
  id: number;
  name: string;
  unit_price: string | null;
  selling_unit?: string;
};

export type Ingredient = {
  id: number;
  name: string;
  unit: "kg" | "g" | "l" | "ml" | "piece";
  category?: number | null;
  category_name?: string;
  reorder_level?: string;
  supplier_names?: string[];
};

export type StockTransfer = {
  id: number;
  shipment_id?: number | null;
  source_location: number;
  source_location_name?: string;
  destination_location: number;
  destination_location_name?: string;
  product?: number | null;
  product_name?: string | null;
  ingredient?: number | null;
  ingredient_name?: string | null;
  item_name?: string;
  unit?: string;
  quantity: string;
  received_quantity: string;
  remaining_quantity: string;
  status: string;
  reference?: string;
  recorded_by_name: string;
  received_by_name?: string;
  received_at?: string | null;
  created_at: string;
  receipts?: Array<{
    id: number;
    quantity: string;
    is_final: boolean;
    discrepancy_quantity: string;
    discrepancy_note: string;
    received_by_name: string;
    received_at: string;
  }>;
};

export type Movement = {
  id: number;
  item_name?: string;
  unit?: string;
  kind: string;
  product?: number;
  product_name?: string;
  ingredient?: number;
  ingredient_name?: string;
  quantity_delta: string;
  actor_name: string;
  created_at: string;
  note?: string;
  location?: number;
  location_name?: string;
};

export type Balance = {
  id?: number | null;
  location: number;
  ingredient?: number;
  product?: number;
  quantity: string;
  reserved_quantity: string;
  available_quantity: string;
  ingredient_name?: string;
  product_name?: string;
  unit?: string;
  category_name?: string;
  supplier_names?: string[];
};

export type Inventory = {
  ingredients: Balance[];
  products: Balance[];
};

function formatDate(value: string): string {
  try {
    return new Intl.DateTimeFormat("en-ET", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function InventoryPanel({
  inventory,
  movements,
  transfers,
  ingredients,
  products,
  locations,
  isOwner,
  assignedLocationId,
  canAdjust,
  canTransfer,
  location,
  disabled,
  onAdjust,
  onTransfer,
  onReceiveTransfer,
}: {
  inventory: Inventory;
  movements: Movement[];
  transfers: StockTransfer[];
  ingredients: Ingredient[];
  products: Product[];
  locations: Location[];
  isOwner: boolean;
  assignedLocationId?: number;
  canAdjust: boolean;
  canTransfer: boolean;
  location?: Location;
  disabled: boolean;
  onAdjust: (payload: unknown) => Promise<boolean>;
  onTransfer: (payload: unknown) => Promise<boolean>;
  onReceiveTransfer: (id: number, payload: unknown) => Promise<boolean>;
}) {
  const [itemType, setItemType] = useState<"ingredient" | "product">("ingredient");

  async function handleAdjustSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const saved = await onAdjust({
      [itemType]: Number(form.get("item")),
      quantity_delta: String(form.get("quantity_delta")),
      note: String(form.get("note") ?? ""),
    });
    if (!saved) return;
    formElement.reset();
  }

  const combinedStock = [
    ...inventory.ingredients.map((item) => {
      const ing = ingredients.find((entry) => entry.id === item.ingredient);
      return {
        id: `ing-${item.location}-${item.ingredient}`,
        name: item.ingredient_name || ing?.name || "Ingredient",
        unit: item.unit || ing?.unit || "",
        quantity: item.quantity,
        reserved: item.reserved_quantity,
        available: item.available_quantity,
        location: item.location,
        threshold: ing?.reorder_level ?? "0",
        category: item.category_name || ing?.category_name || "—",
        suppliers: item.supplier_names || ing?.supplier_names || [],
        type: "Ingredient",
      };
    }),
    ...inventory.products.map((item) => {
      const prod = products.find((entry) => entry.id === item.product);
      return {
        id: `prod-${item.location}-${item.product}`,
        name: item.product_name || prod?.name || "Cake",
        unit: "pcs",
        quantity: item.quantity,
        reserved: item.reserved_quantity,
        available: item.available_quantity,
        location: item.location,
        threshold: "—",
        category: "Finished Cake",
        suppliers: [],
        type: "Product",
      };
    }),
  ];

  return (
    <div className="stacked-panels">
      {/* Transfer Panel (if permitted) */}
      {canTransfer && (
        <TransferSection
          locations={locations}
          products={products}
          ingredients={ingredients}
          transfers={transfers}
          isOwner={isOwner}
          assignedLocationId={assignedLocationId}
          disabled={disabled}
          onSubmit={onTransfer}
          onReceive={onReceiveTransfer}
        />
      )}

      {/* Adjust Inventory Form (if permitted) */}
      {canAdjust && (
        <section className="panel form-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Stock Adjustment</p>
              <h2>Physical Count or Wastage Adjustment</h2>
            </div>
          </div>
          {!location && (
            <div className="setup-notice">
              <Store size={17} /> Select an active location to adjust stock.
            </div>
          )}
          <form className="portal-form" onSubmit={handleAdjustSubmit}>
            <div style={{ display: "flex", gap: "12px", marginBottom: "0.5rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <input
                  type="radio"
                  name="itemType"
                  checked={itemType === "ingredient"}
                  onChange={() => setItemType("ingredient")}
                />
                Ingredient / Raw Supply
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <input
                  type="radio"
                  name="itemType"
                  checked={itemType === "product"}
                  onChange={() => setItemType("product")}
                />
                Finished Cake Product
              </label>
            </div>

            <label>
              Item to Adjust
              <select name="item" required>
                <option value="">Choose item...</option>
                {itemType === "ingredient"
                  ? ingredients.map((ing) => (
                      <option value={ing.id} key={ing.id}>
                        {ing.name} ({ing.unit})
                      </option>
                    ))
                  : products.map((prod) => (
                      <option value={prod.id} key={prod.id}>
                        {prod.name}
                      </option>
                    ))}
              </select>
            </label>

            <label>
              Quantity Change (+ to add, - to write off)
              <input
                name="quantity_delta"
                type="number"
                step="0.001"
                required
                placeholder="e.g. -2.500 or +10.000"
              />
            </label>

            <label>
              Reason / Audit Note
              <input name="note" required placeholder="e.g. Broken during transit / inventory audit" />
            </label>

            <button className="button button-dark" disabled={disabled || !location}>
              Apply Stock Adjustment
            </button>
          </form>
        </section>
      )}

      {/* Stock Balances by Location Table */}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Inventory Balances</p>
            <h2>Current Stock by Location</h2>
          </div>
          <span>{combinedStock.length} items tracked</span>
        </div>

        {combinedStock.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th>On Hand</th>
                  <th>Reserved</th>
                  <th>Available</th>
                  <th>Reorder Level</th>
                  <th>Location</th>
                </tr>
              </thead>
              <tbody>
                {combinedStock.map((item) => {
                  const loc = locations.find((l) => l.id === item.location);
                  const isLow =
                    item.type === "Ingredient" &&
                    Number(item.threshold) > 0 &&
                    Number(item.available) <= Number(item.threshold);

                  return (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.name}</strong>
                        <small>{item.unit}</small>
                      </td>
                      <td>{item.category}</td>
                      <td>
                        <span className="role-chip" style={{ fontSize: "10px" }}>
                          {item.type}
                        </span>
                      </td>
                      <td>{item.quantity}</td>
                      <td>{item.reserved}</td>
                      <td>
                        <strong style={{ color: isLow ? "var(--brand-terracotta)" : "inherit" }}>
                          {item.available}
                        </strong>
                        {isLow && (
                          <small style={{ color: "var(--brand-terracotta)" }}>Low Stock</small>
                        )}
                      </td>
                      <td>{item.threshold}</td>
                      <td>{loc ? loc.name : `Location ${item.location}`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <h3>No inventory balances</h3>
            <p>Receiving purchases or recording production batches will create stock.</p>
          </div>
        )}
      </section>

      {/* Recent Movements Log */}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Audit Trail</p>
            <h2>Recent Stock Movements</h2>
          </div>
          <span>{movements.length} logged events</span>
        </div>

        {movements.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Type</th>
                  <th>Item</th>
                  <th>Change</th>
                  <th>Location</th>
                  <th>Recorded By</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => {
                  const isPos = !m.quantity_delta.startsWith("-");
                  return (
                    <tr key={m.id}>
                      <td>{formatDate(m.created_at)}</td>
                      <td>
                        <span className="role-chip" style={{ fontSize: "10px" }}>
                          {m.kind.replaceAll("_", " ")}
                        </span>
                      </td>
                      <td>{m.product_name || m.ingredient_name || "—"}</td>
                      <td>
                        <strong className={isPos ? "positive" : "negative"}>
                          {isPos ? `+${m.quantity_delta}` : m.quantity_delta}
                        </strong>
                      </td>
                      <td>{m.location_name}</td>
                      <td>{m.actor_name}</td>
                      <td>{m.note || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <p>No stock movements recorded yet.</p>
          </div>
        )}
      </section>
    </div>
  );
}

// Sub-component: Transfer Section
type TransferItemRow = {
  kind: "product" | "ingredient";
  id: string;
  quantity: string;
};

function TransferSection({
  locations,
  products,
  ingredients,
  transfers,
  isOwner,
  assignedLocationId,
  disabled,
  onSubmit,
  onReceive,
}: {
  locations: Location[];
  products: Product[];
  ingredients: Ingredient[];
  transfers: StockTransfer[];
  isOwner: boolean;
  assignedLocationId?: number;
  disabled: boolean;
  onSubmit: (payload: unknown) => Promise<boolean>;
  onReceive: (id: number, payload: unknown) => Promise<boolean>;
}) {
  const [items, setItems] = useState<TransferItemRow[]>([
    { kind: "product", id: "", quantity: "" },
  ]);
  const [sourceId, setSourceId] = useState(
    assignedLocationId ? String(assignedLocationId) : "",
  );
  const [destinationId, setDestinationId] = useState("");
  const [receiptDrafts, setReceiptDrafts] = useState<
    Record<number, { quantity: string; is_final: boolean; discrepancy_note: string }>
  >({});
  const [receivingId, setReceivingId] = useState<number | null>(null);

  const sourceLocations = locations.filter(
    (branch) => isOwner || branch.id === assignedLocationId,
  );
  const destLocations = locations.filter(
    (branch) => String(branch.id) !== sourceId,
  );

  async function handleTransferSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formElement = e.currentTarget;
    const form = new FormData(formElement);

    const payload = {
      source_location: Number(sourceId),
      destination_location: Number(destinationId),
      items: items.map((item) =>
        item.kind === "ingredient"
          ? { ingredient: Number(item.id), quantity: item.quantity }
          : { product: Number(item.id), quantity: item.quantity },
      ),
      reference: String(form.get("reference") ?? "").trim(),
      note: String(form.get("note") ?? "").trim(),
      idempotency_key: crypto.randomUUID(),
    };

    const ok = await onSubmit(payload);
    if (!ok) return;
    formElement.reset();
    setItems([{ kind: "product", id: "", quantity: "" }]);
    setDestinationId("");
  }

  async function handleReceiveSubmit(transfer: StockTransfer) {
    const draft = receiptDrafts[transfer.id] ?? {
      quantity: transfer.remaining_quantity,
      is_final: true,
      discrepancy_note: "",
    };

    setReceivingId(transfer.id);
    try {
      await onReceive(transfer.id, {
        ...draft,
        idempotency_key: crypto.randomUUID(),
      });
    } finally {
      setReceivingId(null);
    }
  }

  return (
    <div className="operation-layout">
      {/* Dispatch Transfer Form */}
      <section className="panel form-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Inter-Branch Movement</p>
            <h2>Dispatch Stock Transfer</h2>
          </div>
        </div>

        <form className="portal-form" onSubmit={handleTransferSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <label>
              Source Branch
              <select
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                required
              >
                <option value="">Choose origin...</option>
                {sourceLocations.map((loc) => (
                  <option value={loc.id} key={loc.id}>
                    {loc.name} ({loc.kind.replaceAll("_", " ")})
                  </option>
                ))}
              </select>
            </label>

            <label>
              Destination Branch
              <select
                value={destinationId}
                onChange={(e) => setDestinationId(e.target.value)}
                required
              >
                <option value="">Choose destination...</option>
                {destLocations.map((loc) => (
                  <option value={loc.id} key={loc.id}>
                    {loc.name} ({loc.kind.replaceAll("_", " ")})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="line-editor">
            <p className="eyebrow" style={{ margin: "0.25rem 0" }}>
              Items to Dispatch (Cakes &amp; Ingredients)
            </p>
            {items.map((row, index) => (
              <div
                className="line-row"
                key={index}
                style={{
                  gridTemplateColumns: "110px 1fr 90px 28px",
                  gap: "6px",
                }}
              >
                {/* Kind Selector: Cake vs Ingredient */}
                <select
                  value={row.kind}
                  onChange={(e) =>
                    setItems((current) =>
                      current.map((item, idx) =>
                        idx === index
                          ? { ...item, kind: e.target.value as "product" | "ingredient", id: "" }
                          : item,
                      ),
                    )
                  }
                >
                  <option value="product">Cake</option>
                  <option value="ingredient">Ingredient</option>
                </select>

                {/* Item Selector */}
                <select
                  value={row.id}
                  onChange={(e) =>
                    setItems((current) =>
                      current.map((item, idx) =>
                        idx === index ? { ...item, id: e.target.value } : item,
                      ),
                    )
                  }
                  required
                >
                  <option value="">
                    {row.kind === "product" ? "Choose cake..." : "Choose ingredient..."}
                  </option>
                  {row.kind === "product"
                    ? products.map((prod) => (
                        <option value={prod.id} key={prod.id}>
                          {prod.name}
                        </option>
                      ))
                    : ingredients.map((ing) => (
                        <option value={ing.id} key={ing.id}>
                          {ing.name} ({ing.unit})
                        </option>
                      ))}
                </select>

                {/* Quantity */}
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  placeholder="Qty"
                  value={row.quantity}
                  onChange={(e) =>
                    setItems((current) =>
                      current.map((item, idx) =>
                        idx === index ? { ...item, quantity: e.target.value } : item,
                      ),
                    )
                  }
                  required
                />

                {items.length > 1 && (
                  <button
                    type="button"
                    className="icon-action"
                    onClick={() =>
                      setItems((current) => current.filter((_, idx) => idx !== index))
                    }
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            className="quiet-button"
            onClick={() =>
              setItems((current) => [...current, { kind: "product", id: "", quantity: "" }])
            }
          >
            <Plus size={15} /> Add another transfer item
          </button>

          <label>
            Dispatch Reference / Manifest #
            <input name="reference" placeholder="e.g. TR-2026-0042 / Bole Driver Abel" />
          </label>

          <label>
            Transfer Notes
            <input name="note" placeholder="Storage instructions, delivery vehicle..." />
          </label>

          <button
            type="submit"
            className="button button-dark"
            disabled={disabled || !sourceId || !destinationId}
          >
            <Truck size={16} /> Dispatch Shipment
          </button>
        </form>
      </section>

      {/* Active Transfers & Receiving */}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Shipment Status &amp; Receiving</p>
            <h2>In-Transit &amp; Historical Transfers</h2>
          </div>
          <span>{transfers.length} transfers</span>
        </div>

        {transfers.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Transfer</th>
                  <th>Item Transferred</th>
                  <th>Route</th>
                  <th>Qty Dispatched</th>
                  <th>Status</th>
                  <th>Receive Action</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((tr) => {
                  const isInTransit = tr.status !== "received";
                  const draft = receiptDrafts[tr.id] ?? {
                    quantity: tr.remaining_quantity,
                    is_final: true,
                    discrepancy_note: "",
                  };

                  return (
                    <tr key={tr.id}>
                      <td>
                        <strong>#{tr.id}</strong>
                        {tr.reference && <small>{tr.reference}</small>}
                        <small>{formatDate(tr.created_at)}</small>
                      </td>

                      <td>
                        <strong>{tr.item_name || tr.product_name || tr.ingredient_name}</strong>
                        <small>{tr.unit || (tr.product ? "pcs" : "")}</small>
                      </td>

                      <td>
                        <div>
                          <span>{tr.source_location_name}</span>
                          <span style={{ margin: "0 4px", color: "var(--muted)" }}>➔</span>
                          <strong>{tr.destination_location_name}</strong>
                        </div>
                      </td>

                      <td>
                        <div>
                          Total: {tr.quantity}
                          {Number(tr.received_quantity) > 0 && (
                            <small style={{ color: "var(--brand-sage)" }}>
                              Received: {tr.received_quantity}
                            </small>
                          )}
                        </div>
                      </td>

                      <td>
                        <span className={`status-pill status-${tr.status}`}>
                          {tr.status.replaceAll("_", " ")}
                        </span>
                      </td>

                      <td>
                        {isInTransit ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            <div style={{ display: "flex", gap: "4px" }}>
                              <input
                                type="number"
                                step="0.001"
                                min="0"
                                max={tr.remaining_quantity}
                                value={draft.quantity}
                                style={{ width: "80px", minHeight: "32px", fontSize: "12px" }}
                                onChange={(e) =>
                                  setReceiptDrafts((cur) => ({
                                    ...cur,
                                    [tr.id]: { ...draft, quantity: e.target.value },
                                  }))
                                }
                              />
                              <button
                                type="button"
                                className="button button-sm button-dark"
                                disabled={disabled || receivingId === tr.id}
                                onClick={() => handleReceiveSubmit(tr)}
                              >
                                {receivingId === tr.id ? "Receiving..." : "Receive"}
                              </button>
                            </div>
                            {Number(draft.quantity) < Number(tr.remaining_quantity) && (
                              <input
                                placeholder="Discrepancy note (e.g. damaged)"
                                value={draft.discrepancy_note}
                                style={{ minHeight: "28px", fontSize: "11px" }}
                                onChange={(e) =>
                                  setReceiptDrafts((cur) => ({
                                    ...cur,
                                    [tr.id]: { ...draft, discrepancy_note: e.target.value },
                                  }))
                                }
                              />
                            )}
                          </div>
                        ) : (
                          <span style={{ color: "var(--brand-sage)", fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
                            <CheckCircle2 size={14} /> Fully Received
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <p>No transfers recorded between branches.</p>
          </div>
        )}
      </section>
    </div>
  );
}
