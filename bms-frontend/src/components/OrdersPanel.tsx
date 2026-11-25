import React, { useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  DollarSign,
  Plus,
  Store,
  X,
} from "lucide-react";

export type OrderItem = {
  product: number;
  product_name: string;
  quantity: number;
  size: string;
  unit_price?: string | null;
  total?: string | null;
};

export type OrderStatusEntry = {
  status: string;
  changed_by_name: string;
  created_at: string;
  note?: string;
};

export type OrderPayment = {
  id: number;
  method: string;
  amount: string;
  bank_name: string;
  payment_date: string;
  received_by_name: string;
  received_at: string;
};

export type Order = {
  id: number;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  created_by_name: string;
  sale_id: number | null;
  requested_for: string;
  status: string;
  payment_status: string;
  source: string;
  fulfillment: string;
  delivery_address: string;
  notes: string;
  location: number | null;
  location_name: string;
  total?: string | null;
  amount_paid?: string | null;
  amount_due?: string | null;
  items: OrderItem[];
  status_history: OrderStatusEntry[];
  payments?: OrderPayment[];
};

export type Product = {
  id: number;
  name: string;
  unit_price: string | null;
};

export type Location = {
  id: number;
  name: string;
  kind: "home_bakery" | "cafe" | "other";
};

function formatMoney(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  return new Intl.NumberFormat("en-ET", {
    style: "currency",
    currency: "ETB",
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

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

const nextOrderStatuses: Record<string, string[]> = {
  new: ["confirmed", "cancelled"],
  confirmed: ["in_production", "cancelled"],
  in_production: ["ready", "cancelled"],
  ready: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

const orderStatusLabel = (status: string) =>
  status === "in_production" ? "In preparation" : status.replaceAll("_", " ");

interface OrdersPanelProps {
  orders: Order[];
  products: Product[];
  locations: Location[];
  isOwner: boolean;
  location?: Location;
  disabled: boolean;
  onSubmit: (payload: unknown) => Promise<boolean>;
  onUpdate: (id: number, update: Record<string, string | number>) => Promise<boolean>;
  onRecordPayment?: (orderId: number, payload: unknown) => Promise<boolean>;
  onConvertToSale?: (order: Order) => void;
}

export function OrdersPanel({
  orders,
  products,
  locations,
  isOwner,
  location,
  disabled,
  onSubmit,
  onUpdate,
  onRecordPayment,
  onConvertToSale,
}: OrdersPanelProps) {
  const [lines, setLines] = useState([
    { product: "", quantity: 1, size: "", unit_price: "" },
  ]);
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">("pickup");
  const requestKey = useRef<{ signature: string; key: string } | null>(null);

  // Payment Modal State
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [bankName, setBankName] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(() =>
    new Date().toISOString().split("T")[0],
  );
  const [paymentBusy, setPaymentBusy] = useState<boolean>(false);
  const [paymentError, setPaymentError] = useState<string>("");

  function openPaymentModal(order: Order) {
    setPaymentOrder(order);
    setPaymentMethod("cash");
    // Pre-fill with remaining amount due if positive, or empty
    const due = Number(order.amount_due ?? 0);
    setPaymentAmount(due > 0 ? String(due) : "");
    setBankName("");
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setPaymentError("");
  }

  function closePaymentModal() {
    setPaymentOrder(null);
    setPaymentError("");
    setPaymentBusy(false);
  }

  async function handleRecordPaymentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!paymentOrder || !onRecordPayment) return;
    const amountNum = Number(paymentAmount);
    if (!paymentAmount || isNaN(amountNum) || amountNum <= 0) {
      setPaymentError("Please enter a valid payment amount.");
      return;
    }
    if (paymentMethod === "bank_transfer" && !bankName.trim()) {
      setPaymentError("Please specify the bank name for bank transfer.");
      return;
    }

    setPaymentBusy(true);
    setPaymentError("");
    try {
      const payload = {
        method: paymentMethod,
        amount: paymentAmount,
        bank_name: paymentMethod === "bank_transfer" ? bankName.trim() : "",
        payment_date: paymentDate,
        idempotency_key: crypto.randomUUID(),
      };
      const ok = await onRecordPayment(paymentOrder.id, payload);
      if (ok) {
        closePaymentModal();
      }
    } catch (err: unknown) {
      setPaymentError(err instanceof Error ? err.message : "Payment recording failed.");
    } finally {
      setPaymentBusy(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload = {
      customer_name: String(form.get("customer_name")),
      customer_phone: String(form.get("customer_phone")),
      customer_email: String(form.get("customer_email") ?? ""),
      requested_for: new Date(String(form.get("requested_for"))).toISOString(),
      source: String(form.get("source") ?? "staff"),
      fulfillment,
      delivery_address:
        fulfillment === "delivery" ? String(form.get("delivery_address") ?? "") : "",
      notes: String(form.get("notes") ?? ""),
      lines: lines.map((line) => {
        const item: {
          product: number;
          quantity: number;
          size: string;
          unit_price?: string;
        } = {
          product: Number(line.product),
          quantity: Number(line.quantity),
          size: line.size,
        };
        if (line.unit_price && line.unit_price.trim()) {
          item.unit_price = line.unit_price.trim();
        }
        return item;
      }),
    };
    const signature = JSON.stringify(payload);
    if (requestKey.current?.signature !== signature) {
      requestKey.current = { signature, key: crypto.randomUUID() };
    }
    const saved = await onSubmit({
      ...payload,
      idempotency_key: requestKey.current.key,
    });
    if (!saved) return;
    formElement.reset();
    requestKey.current = null;
    setLines([{ product: "", quantity: 1, size: "", unit_price: "" }]);
    setFulfillment("pickup");
  }

  const orderLocations = locations.filter(
    (branch) => branch.kind === "cafe" || branch.kind === "other",
  );

  const dueToday = orders.filter((order) => {
    if (["completed", "cancelled"].includes(order.status)) return false;
    const due = new Date(order.requested_for);
    const today = new Date();
    return (
      due.getFullYear() === today.getFullYear() &&
      due.getMonth() === today.getMonth() &&
      due.getDate() === today.getDate()
    );
  }).length;

  const overdue = orders.filter((order) => {
    if (["completed", "cancelled"].includes(order.status)) return false;
    return new Date(order.requested_for) < new Date();
  }).length;

  const pendingCollection = orders.filter(
    (order) => order.status === "ready" && !order.sale_id,
  ).length;

  return (
    <div className="panel-group">
      <section className="metric-grid" aria-label="Order summary">
        <article className="metric-card">
          <div className="metric-top">
            <span>Due today</span>
            <ClipboardList size={17} />
          </div>
          <strong>{dueToday}</strong>
          <small>Active customer orders</small>
        </article>

        <article className="metric-card">
          <div className="metric-top">
            <span>Overdue</span>
            <Activity size={17} />
          </div>
          <strong style={{ color: overdue > 0 ? "var(--brand-terracotta, #c85a32)" : "inherit" }}>
            {overdue}
          </strong>
          <small>Requires immediate follow-up</small>
        </article>

        <article className="metric-card">
          <div className="metric-top">
            <span>Ready for collection</span>
            <CheckCircle2 size={17} />
          </div>
          <strong style={{ color: pendingCollection > 0 ? "var(--brand-sage, #43714b)" : "inherit" }}>
            {pendingCollection}
          </strong>
          <small>Awaiting pickup / delivery</small>
        </article>
      </section>

      <div className="operation-layout">
        {/* Order Capture Form */}
        <section className="panel form-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Pre-Order & Custom Cakes</p>
              <h2>New customer order</h2>
            </div>
          </div>
          {!location && (
            <div className="setup-notice">
              <Store size={17} /> Select one location to record an operation, or create locations from Catalog &amp; users.
            </div>
          )}
          <form className="portal-form" onSubmit={submit}>
            <label>
              Customer name
              <input name="customer_name" required placeholder="Full customer name" />
            </label>
            <label>
              Phone
              <input name="customer_phone" type="tel" required placeholder="+251 9..." />
            </label>
            <label>
              Email <span className="optional">(optional)</span>
              <input name="customer_email" type="email" placeholder="customer@example.com" />
            </label>
            <label>
              Order received via
              <select name="source" defaultValue="staff">
                <option value="staff">In person / Counter</option>
                <option value="phone">Phone call</option>
                <option value="social">Social media (Telegram/WhatsApp)</option>
                <option value="other">Other channel</option>
              </select>
            </label>
            <label>
              Requested date and time
              <input name="requested_for" type="datetime-local" required />
            </label>
            <label>
              Fulfillment
              <select
                name="fulfillment"
                value={fulfillment}
                onChange={(event) =>
                  setFulfillment(event.target.value as "pickup" | "delivery")
                }
              >
                <option value="pickup">Pickup at café</option>
                <option value="delivery">Delivery</option>
              </select>
            </label>
            {fulfillment === "delivery" && (
              <label>
                Delivery address
                <textarea
                  name="delivery_address"
                  rows={2}
                  required
                  placeholder="Street, building, area or landmarks"
                />
              </label>
            )}

            <div className="line-editor">
              <p className="eyebrow" style={{ marginBottom: "0.25rem" }}>
                Cake items & Custom Pricing
              </p>
              <div className="order-line-header">
                <span>Cake Product</span>
                <span>Qty</span>
                <span>Size / Tier</span>
                <span>Price (ETB)</span>
                <span />
              </div>
              {lines.map((line, index) => (
                <div className="order-line-row" key={index}>
                  <select
                    aria-label={`Cake item ${index + 1}`}
                    value={line.product}
                    onChange={(event) => {
                      const prodId = event.target.value;
                      const catalogProduct = products.find(
                        (p) => String(p.id) === prodId,
                      );
                      setLines((current) =>
                        current.map((item, lineIndex) =>
                          lineIndex === index
                            ? {
                                ...item,
                                product: prodId,
                                unit_price:
                                  item.unit_price ||
                                  (catalogProduct?.unit_price ?? ""),
                              }
                            : item,
                        ),
                      );
                    }}
                    required
                  >
                    <option value="">Choose cake</option>
                    {products.map((product) => (
                      <option value={product.id} key={product.id}>
                        {product.name}
                        {product.unit_price ? ` (${formatMoney(product.unit_price)})` : ""}
                      </option>
                    ))}
                  </select>

                  <input
                    aria-label={`Quantity for cake ${index + 1}`}
                    type="number"
                    min="1"
                    step="1"
                    value={line.quantity}
                    onChange={(event) =>
                      setLines((current) =>
                        current.map((item, lineIndex) =>
                          lineIndex === index
                            ? { ...item, quantity: Number(event.target.value) }
                            : item,
                        ),
                      )
                    }
                    required
                  />

                  <input
                    aria-label={`Size for cake ${index + 1}`}
                    placeholder="e.g. 2-Tier"
                    value={line.size}
                    onChange={(event) =>
                      setLines((current) =>
                        current.map((item, lineIndex) =>
                          lineIndex === index
                            ? { ...item, size: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />

                  <input
                    aria-label={`Agreed price for cake ${index + 1}`}
                    placeholder="ETB"
                    type="number"
                    step="0.01"
                    min="0"
                    value={line.unit_price}
                    onChange={(event) =>
                      setLines((current) =>
                        current.map((item, lineIndex) =>
                          lineIndex === index
                            ? { ...item, unit_price: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />

                  {lines.length > 1 ? (
                    <button
                      className="icon-action"
                      type="button"
                      aria-label="Remove cake"
                      onClick={() =>
                        setLines((current) =>
                          current.filter((_, lineIndex) => lineIndex !== index),
                        )
                      }
                    >
                      <X size={16} />
                    </button>
                  ) : <span />}
                </div>
              ))}
            </div>

            <button
              type="button"
              className="quiet-button"
              onClick={() =>
                setLines((current) => [
                  ...current,
                  { product: "", quantity: 1, size: "", unit_price: "" },
                ])
              }
            >
              <Plus size={15} /> Add another cake item
            </button>

            <label>
              Customization instructions
              <textarea
                name="notes"
                rows={3}
                placeholder="Message on cake, dietary notes, color theme, design reference..."
              />
            </label>

            <button className="button button-dark" disabled={disabled || !location}>
              <Plus size={16} /> Save order
            </button>
          </form>
        </section>

        {/* Order Register Table */}
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Customer Order Register</p>
              <h2>Active & Historical Orders</h2>
            </div>
            <span>{orders.length} orders</span>
          </div>

          {orders.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Items & Notes</th>
                    <th>Requested For</th>
                    <th>Financials & Payment</th>
                    {isOwner && <th>Assigned Branch</th>}
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const isReady = order.status === "ready";
                    const isCompleted = order.status === "completed";
                    const isCancelled = order.status === "cancelled";
                    const isPaid = order.payment_status === "paid";

                    return (
                      <tr key={order.id}>
                        <td>
                          <strong>{order.order_number}</strong>
                          <small>
                            {order.source === "website"
                              ? "Website"
                              : order.source.replaceAll("_", " ")}{" "}
                            · {order.created_by_name || "System"}
                          </small>
                        </td>

                        <td>
                          <strong>{order.customer_name}</strong>
                          <small>
                            {order.customer_phone}
                            {order.customer_email ? ` · ${order.customer_email}` : ""}
                          </small>
                        </td>

                        <td>
                          {order.items.map((item) => (
                            <div key={item.product}>
                              <span>
                                {item.quantity} × {item.product_name}
                                {item.size ? ` (${item.size})` : ""}
                              </span>
                              {item.unit_price && (
                                <small> @ {formatMoney(item.unit_price)} each</small>
                              )}
                            </div>
                          ))}
                          {order.notes && (
                            <small
                              style={{
                                display: "block",
                                marginTop: "0.25rem",
                                color: "var(--brand-terracotta, #c85a32)",
                              }}
                            >
                              Note: {order.notes}
                            </small>
                          )}
                        </td>

                        <td>
                          {formatDate(order.requested_for)}
                          {order.fulfillment === "delivery" && order.delivery_address && (
                            <small style={{ display: "block" }}>
                              🚚 {order.delivery_address}
                            </small>
                          )}
                        </td>

                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                            <div>
                              <strong>{formatMoney(order.total)}</strong>
                              <span
                                className={`status-pill status-${order.payment_status}`}
                                style={{ marginLeft: "0.4rem" }}
                              >
                                {order.payment_status}
                              </span>
                            </div>

                            {order.amount_paid && Number(order.amount_paid) > 0 && (
                              <small style={{ color: "var(--brand-sage, #43714b)" }}>
                                Paid: {formatMoney(order.amount_paid)}
                              </small>
                            )}
                            {order.amount_due && Number(order.amount_due) > 0 && (
                              <small style={{ color: "var(--brand-terracotta, #c85a32)" }}>
                                Due: {formatMoney(order.amount_due)}
                              </small>
                            )}

                            {!isPaid && !isCancelled && !isCompleted && onRecordPayment && (
                              <button
                                type="button"
                                className="button button-sm button-outline"
                                style={{
                                  marginTop: "0.35rem",
                                  fontSize: "12px",
                                  padding: "0.2rem 0.5rem",
                                }}
                                onClick={() => openPaymentModal(order)}
                              >
                                <DollarSign size={13} /> Record Deposit / Pay
                              </button>
                            )}
                          </div>
                        </td>

                        {isOwner && (
                          <td>
                            <select
                              aria-label={`Assign order ${order.order_number} to a location`}
                              value={order.location ?? ""}
                              disabled={disabled}
                              onChange={(event) => {
                                if (event.target.value) {
                                  void onUpdate(order.id, {
                                    location: Number(event.target.value),
                                  });
                                }
                              }}
                            >
                              <option value="">Needs branch</option>
                              {orderLocations.map((branch) => (
                                <option value={branch.id} key={branch.id}>
                                  {branch.name}
                                </option>
                              ))}
                            </select>
                          </td>
                        )}

                        <td>
                          <span className={`status-pill status-${order.status}`}>
                            {orderStatusLabel(order.status)}
                          </span>
                          <small>
                            {order.status_history[order.status_history.length - 1]
                              ?.changed_by_name ?? "—"}
                          </small>
                        </td>

                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                            {!isCompleted && !isCancelled && (
                              <select
                                aria-label={`Update order ${order.order_number}`}
                                value={order.status}
                                disabled={disabled}
                                onChange={(event) =>
                                  void onUpdate(order.id, { status: event.target.value })
                                }
                              >
                                <option value={order.status}>
                                  {orderStatusLabel(order.status)}
                                </option>
                                {nextOrderStatuses[order.status]?.map((status) => (
                                  <option value={status} key={status}>
                                    Move to {orderStatusLabel(status)}
                                  </option>
                                ))}
                              </select>
                            )}

                            {isReady && !order.sale_id && onConvertToSale && (
                              <button
                                type="button"
                                className="button button-sm button-dark"
                                style={{
                                  fontSize: "12px",
                                  padding: "0.3rem 0.6rem",
                                  backgroundColor: "var(--brand-spruce, #1e3f33)",
                                }}
                                onClick={() => onConvertToSale(order)}
                              >
                                Settle & Deliver
                              </button>
                            )}

                            <details className="order-history">
                              <summary>History</summary>
                              {order.status_history.map((entry, index) => (
                                <p key={`${entry.created_at}-${index}`}>
                                  {orderStatusLabel(entry.status)} · {entry.changed_by_name} ·{" "}
                                  {formatDate(entry.created_at)}
                                  {entry.note ? ` — ${entry.note}` : ""}
                                </p>
                              ))}
                            </details>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <h3>No orders recorded</h3>
              <p>New customer pre-orders and custom cake requests appear here.</p>
            </div>
          )}
        </section>
      </div>

      {/* Accessible Record Deposit / Payment Modal Dialog */}
      {paymentOrder && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="payment-modal-title"
          className="modal-backdrop"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.45)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
        >
          <div
            className="modal-card panel"
            style={{
              width: "100%",
              maxWidth: "480px",
              background: "#fff",
              borderRadius: "12px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              overflow: "hidden",
            }}
          >
            <div
              className="panel-heading"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "1.25rem 1.5rem",
                borderBottom: "1px solid var(--border, #e5e7eb)",
              }}
            >
              <div>
                <p className="eyebrow">Customer Deposit / Advance Payment</p>
                <h3 id="payment-modal-title" style={{ margin: 0, fontSize: "1.25rem" }}>
                  Record Payment for {paymentOrder.order_number}
                </h3>
              </div>
              <button
                type="button"
                className="icon-action"
                aria-label="Close dialog"
                onClick={closePaymentModal}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRecordPaymentSubmit} style={{ padding: "1.5rem" }}>
              <div
                style={{
                  background: "var(--brand-sandstone, #f7f6f2)",
                  padding: "0.85rem 1rem",
                  borderRadius: "8px",
                  marginBottom: "1.25rem",
                  fontSize: "13px",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: "0.5rem",
                }}
              >
                <div>
                  <small style={{ color: "var(--text-muted, #6b7280)", display: "block" }}>Order Total</small>
                  <strong>{formatMoney(paymentOrder.total)}</strong>
                </div>
                <div>
                  <small style={{ color: "var(--text-muted, #6b7280)", display: "block" }}>Already Paid</small>
                  <strong style={{ color: "var(--brand-sage, #43714b)" }}>
                    {formatMoney(paymentOrder.amount_paid)}
                  </strong>
                </div>
                <div>
                  <small style={{ color: "var(--text-muted, #6b7280)", display: "block" }}>Remaining Due</small>
                  <strong style={{ color: "var(--brand-terracotta, #c85a32)" }}>
                    {formatMoney(paymentOrder.amount_due)}
                  </strong>
                </div>
              </div>

              {paymentError && (
                <div
                  style={{
                    color: "#dc2626",
                    background: "#fef2f2",
                    padding: "0.6rem 0.8rem",
                    borderRadius: "6px",
                    marginBottom: "1rem",
                    fontSize: "13px",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                  }}
                >
                  <AlertCircle size={15} />
                  <span>{paymentError}</span>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <label>
                  Payment Method
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    required
                  >
                    <option value="cash">Cash</option>
                    <option value="telebirr">Telebirr</option>
                    <option value="bank_transfer">Bank Transfer (CBE, Awash, etc.)</option>
                  </select>
                </label>

                {paymentMethod === "bank_transfer" && (
                  <label>
                    Bank Name
                    <input
                      type="text"
                      required
                      placeholder="e.g. Commercial Bank of Ethiopia, Awash Bank"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                    />
                  </label>
                )}

                <label>
                  Payment Amount (ETB)
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="e.g. 500.00"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                  />
                </label>

                <label>
                  Payment Date
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                  />
                </label>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "0.75rem",
                  marginTop: "1.5rem",
                  paddingTop: "1rem",
                  borderTop: "1px solid var(--border, #e5e7eb)",
                }}
              >
                <button
                  type="button"
                  className="button button-outline"
                  onClick={closePaymentModal}
                  disabled={paymentBusy}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button button-dark"
                  disabled={paymentBusy}
                  style={{ backgroundColor: "var(--brand-spruce, #1e3f33)" }}
                >
                  {paymentBusy ? "Recording..." : "Record Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
