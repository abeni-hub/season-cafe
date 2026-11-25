import { useState, useRef, type FormEvent, useMemo } from "react";
import {
  Check,
  DollarSign,
  Plus,
  Minus,
  Printer,
  RefreshCw,
  Search,
  ShoppingCart,
  Store,
  Trash2,
  X,
} from "lucide-react";

export type Location = { id: number; name: string; kind?: string };
export type Product = { id: number; name: string; unit_price: string | null };
export type Order = {
  id: number;
  order_number: string;
  customer_name: string;
  status: string;
  payment_status: string;
  total?: string | null;
  amount_paid?: string | null;
  amount_due?: string | null;
  sale_id: number | null;
  location: number | null;
  items: Array<{ product: number; product_name: string; quantity: number; size: string; unit_price?: string | null }>;
};

type PaymentRecord = {
  method: string;
  amount: string;
  bank_name: string;
  payment_date: string;
  received_by_name: string;
};

type RefundRecord = {
  id: number;
  method: string;
  amount: string;
  bank_name: string;
  refund_date: string;
  reason: string;
  refunded_by_name: string;
  lines: Array<{ product: number; product_name: string; quantity: number }>;
};

export type Sale = {
  id: number;
  sold_at: string;
  cashier_name: string;
  order: number | null;
  order_number: string;
  status: "active" | "cancelled";
  cancellation_reason: string;
  cancelled_by_name: string;
  cancelled_at: string | null;
  total: string;
  amount_paid: string;
  amount_due: string;
  amount_refunded: string;
  lines: Array<{ product: number; product_name: string; quantity: number; unit_price: string }>;
  payment_history: PaymentRecord[];
  refunds: RefundRecord[];
};

type PaymentDraft = {
  method: string;
  amount: string;
  bank_name: string;
  payment_date: string;
};

type RefundDraft = {
  method: string;
  amount: string;
  bank_name: string;
  payment_date: string;
  reason: string;
  returned: Record<number, string>;
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

function localDateValue(): string {
  return new Date().toISOString().split("T")[0];
}

function decimalToCents(value: string | number): bigint {
  const [whole, fraction = ""] = String(value).trim().split(".");
  const normalizedFraction = (fraction + "00").slice(0, 2);
  const sign = whole.startsWith("-") ? -1n : 1n;
  const absWhole = whole.replace("-", "");
  return sign * (BigInt(absWhole || "0") * 100n + BigInt(normalizedFraction));
}

function centsToDecimal(cents: bigint): string {
  const sign = cents < 0n ? "-" : "";
  const absolute = cents < 0n ? -cents : cents;
  const whole = absolute / 100n;
  const fraction = absolute % 100n;
  return `${sign}${whole}.${String(fraction).padStart(2, "0")}`;
}

function requestKey(
  current: { signature: string; key: string } | undefined,
  payload: unknown,
): { signature: string; key: string } {
  const signature = JSON.stringify(payload);
  if (current?.signature === signature) return current;
  return { signature, key: crypto.randomUUID() };
}

export function SalesPanel({
  sales,
  products,
  orders,
  availability,
  location,
  locations = [],
  onSelectLocation,
  disabled,
  onSubmit,
  onCollectPayment,
  onRefund,
  onCancel,
}: {
  sales: Sale[];
  products: Product[];
  orders: Order[];
  availability: Array<{ product: number; available_quantity: string }>;
  location?: Location;
  locations?: Location[];
  onSelectLocation?: (locationId: number) => void;
  disabled: boolean;
  onSubmit: (payload: unknown) => Promise<boolean>;
  onCollectPayment: (saleId: number, payload: unknown) => Promise<boolean>;
  onRefund: (saleId: number, payload: unknown) => Promise<boolean>;
  onCancel: (saleId: number, payload: unknown) => Promise<boolean>;
}) {
  const [lines, setLines] = useState<Array<{ product: string; quantity: number; unit_price?: string }>>([]);
  const [orderId, setOrderId] = useState("");
  const [selectedMethod, setSelectedMethod] = useState<"cash" | "telebirr" | "bank_transfer">("cash");
  const [bankName, setBankName] = useState("");
  const [cashTendered, setCashTendered] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"pos" | "ledger">("pos");

  // Modals for actions
  const [activeModal, setActiveModal] = useState<
    | { type: "collect"; sale: Sale }
    | { type: "refund"; sale: Sale }
    | { type: "cancel"; sale: Sale }
    | { type: "receipt"; sale: Sale }
    | null
  >(null);

  const [collectDraft, setCollectDraft] = useState<PaymentDraft>({
    method: "cash",
    amount: "",
    bank_name: "",
    payment_date: localDateValue(),
  });
  const [refundDraft, setRefundDraft] = useState<RefundDraft>({
    method: "cash",
    amount: "",
    bank_name: "",
    payment_date: localDateValue(),
    reason: "",
    returned: {},
  });
  const [cancelReason, setCancelReason] = useState("");
  const [restockConfirmed, setRestockConfirmed] = useState(true);
  const [modalBusy, setModalBusy] = useState(false);
  const [modalError, setModalError] = useState("");

  const saleRequestKey = useRef<{ signature: string; key: string } | null>(null);

  const stockByProduct = useMemo(
    () => new Map<number, string>(availability.map((entry) => [entry.product, entry.available_quantity])),
    [availability],
  );

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const q = searchQuery.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, searchQuery]);

  const orderOptions = useMemo(
    () =>
      orders.filter(
        (order) =>
          order.location === location?.id &&
          !order.sale_id &&
          !["cancelled", "completed"].includes(order.status),
      ),
    [orders, location?.id],
  );

  const totalCents = useMemo(() => {
    return lines.reduce((total, line) => {
      const product = products.find((item) => String(item.id) === line.product);
      const priceStr = line.unit_price || product?.unit_price;
      if (!priceStr || line.quantity <= 0) return total;
      return total + decimalToCents(priceStr) * BigInt(line.quantity);
    }, 0n);
  }, [lines, products]);

  const totalDecimal = useMemo(() => centsToDecimal(totalCents), [totalCents]);
  const totalNum = Number(totalDecimal);

  // Change due calculations
  const cashTenderedNum = cashTendered ? Number(cashTendered) : 0;
  const changeDue = selectedMethod === "cash" && cashTenderedNum > totalNum ? cashTenderedNum - totalNum : 0;

  function handleQuickAddCake(product: Product) {
    const stock = Number(stockByProduct.get(product.id) ?? 0);
    if (stock <= 0) return;

    setLines((current) => {
      const existingIdx = current.findIndex((l) => l.product === String(product.id));
      if (existingIdx >= 0) {
        const curQty = current[existingIdx].quantity;
        if (curQty < stock) {
          return current.map((item, idx) =>
            idx === existingIdx ? { ...item, quantity: curQty + 1 } : item,
          );
        }
        return current;
      }
      return [
        ...current,
        {
          product: String(product.id),
          quantity: 1,
          unit_price: product.unit_price ?? "",
        },
      ];
    });
  }

  function handleQuantityChange(index: number, delta: number) {
    setLines((current) => {
      const item = current[index];
      if (!item) return current;
      const product = products.find((p) => String(p.id) === item.product);
      const stock = product ? Number(stockByProduct.get(product.id) ?? 9999) : 9999;
      const nextQty = item.quantity + delta;

      if (nextQty <= 0) {
        return current.filter((_, idx) => idx !== index);
      }
      if (nextQty > stock) return current;

      return current.map((row, idx) => (idx === index ? { ...row, quantity: nextQty } : row));
    });
  }

  function handleRemoveLine(index: number) {
    setLines((current) => current.filter((_, idx) => idx !== index));
  }

  async function submitSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!location || lines.length === 0 || totalCents === 0n) return;

    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    const payload = {
      order: orderId ? Number(orderId) : null,
      items: lines.map((line) => {
        const product = products.find((p) => String(p.id) === line.product);
        return {
          product: Number(line.product),
          quantity: line.quantity,
          unit_price: line.unit_price || product?.unit_price,
        };
      }),
      payments: [
        {
          method: selectedMethod,
          amount: totalDecimal,
          bank_name: selectedMethod === "bank_transfer" ? bankName.trim() : "",
          payment_date: localDateValue(),
        },
      ],
      note: String(form.get("note") ?? "").trim(),
    };

    saleRequestKey.current = requestKey(saleRequestKey.current ?? undefined, payload);
    const saved = await onSubmit({
      ...payload,
      idempotency_key: saleRequestKey.current.key,
    });

    if (!saved) return;
    saleRequestKey.current = null;
    setLines([]);
    setOrderId("");
    setCashTendered("");
    setBankName("");
    formElement.reset();
  }

  function openCollectModal(sale: Sale) {
    setCollectDraft({
      method: "cash",
      amount: sale.amount_due,
      bank_name: "",
      payment_date: localDateValue(),
    });
    setModalError("");
    setActiveModal({ type: "collect", sale });
  }

  async function handleCollectSubmit(e: FormEvent) {
    e.preventDefault();
    if (!activeModal || activeModal.type !== "collect") return;
    const sale = activeModal.sale;
    setModalBusy(true);
    setModalError("");
    try {
      const payload = {
        method: collectDraft.method,
        amount: collectDraft.amount,
        bank_name: collectDraft.method === "bank_transfer" ? collectDraft.bank_name.trim() : "",
        payment_date: collectDraft.payment_date,
        idempotency_key: crypto.randomUUID(),
      };
      const ok = await onCollectPayment(sale.id, payload);
      if (ok) setActiveModal(null);
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : "Failed to record payment.");
    } finally {
      setModalBusy(false);
    }
  }

  function openRefundModal(sale: Sale) {
    const paidCents = decimalToCents(sale.amount_paid);
    const refundedCents = decimalToCents(sale.amount_refunded);
    const refundableCents = paidCents > refundedCents ? paidCents - refundedCents : 0n;

    setRefundDraft({
      method: "cash",
      amount: centsToDecimal(refundableCents),
      bank_name: "",
      payment_date: localDateValue(),
      reason: "",
      returned: {},
    });
    setModalError("");
    setActiveModal({ type: "refund", sale });
  }

  async function handleRefundSubmit(e: FormEvent) {
    e.preventDefault();
    if (!activeModal || activeModal.type !== "refund") return;
    const sale = activeModal.sale;
    setModalBusy(true);
    setModalError("");
    try {
      const payload = {
        amount: refundDraft.amount,
        method: refundDraft.method,
        bank_name: refundDraft.method === "bank_transfer" ? refundDraft.bank_name.trim() : "",
        refund_date: refundDraft.payment_date,
        reason: refundDraft.reason.trim(),
        idempotency_key: crypto.randomUUID(),
        items: sale.lines.flatMap((line) => {
          const qty = Number(refundDraft.returned[line.product] || 0);
          return qty > 0 ? [{ product: line.product, quantity: qty }] : [];
        }),
      };
      const ok = await onRefund(sale.id, payload);
      if (ok) setActiveModal(null);
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : "Refund failed.");
    } finally {
      setModalBusy(false);
    }
  }

  function openCancelModal(sale: Sale) {
    setCancelReason("");
    setRestockConfirmed(true);
    setModalError("");
    setActiveModal({ type: "cancel", sale });
  }

  async function handleCancelSubmit(e: FormEvent) {
    e.preventDefault();
    if (!activeModal || activeModal.type !== "cancel") return;
    const sale = activeModal.sale;
    if (!cancelReason.trim()) {
      setModalError("Please provide a reason for cancelling this sale.");
      return;
    }
    setModalBusy(true);
    setModalError("");
    try {
      const payload = {
        reason: cancelReason.trim(),
        confirm_restock: restockConfirmed,
        idempotency_key: crypto.randomUUID(),
      };
      const ok = await onCancel(sale.id, payload);
      if (ok) setActiveModal(null);
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : "Cancellation failed.");
    } finally {
      setModalBusy(false);
    }
  }

  function openReceiptModal(sale: Sale) {
    setActiveModal({ type: "receipt", sale });
  }

  return (
    <div className="pos-root">
      {/* View Switcher Bar */}
      <div className="pos-top-header">
        <div className="pos-brand-context">
          <p className="eyebrow" style={{ margin: 0 }}>Café Point of Sale</p>
          <h2 className="pos-heading">Counter Sales &amp; Settle</h2>
        </div>

        <div className="pos-header-actions">
          {/* Location Switcher */}
          <div className="pos-location-badge">
            <Store size={16} className="text-emerald-700" />
            <span className="pos-loc-label">Active Register:</span>
            {locations.length > 1 && onSelectLocation ? (
              <select
                className="pos-location-select"
                value={location?.id ?? ""}
                onChange={(e) => onSelectLocation(Number(e.target.value))}
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} {loc.kind === "cafe" ? "☕" : "🏠"}
                  </option>
                ))}
              </select>
            ) : (
              <strong className="pos-location-name">{location ? location.name : "Select Location"}</strong>
            )}
          </div>

          {/* Mode Switcher */}
          <div className="pos-tabs">
            <button
              type="button"
              className={`pos-tab-button ${activeTab === "pos" ? "is-active" : ""}`}
              onClick={() => setActiveTab("pos")}
            >
              <ShoppingCart size={15} /> Register POS
            </button>
            <button
              type="button"
              className={`pos-tab-button ${activeTab === "ledger" ? "is-active" : ""}`}
              onClick={() => setActiveTab("ledger")}
            >
              Sales Register ({sales.length})
            </button>
          </div>
        </div>
      </div>

      {/* Main POS Interface (Catalog + Active Ticket) */}
      <div className="pos-layout">
        {/* LEFT: Menu / Catalog Quick-Touch Grid */}
        <section className="pos-catalog-panel">
          <div className="pos-catalog-toolbar">
            <div className="pos-search-box">
              <Search size={16} className="pos-search-icon" />
              <input
                type="text"
                placeholder="Search cake catalog..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pos-search-input"
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery("")} className="pos-search-clear">
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="pos-stock-status-pill">
              <span className="pos-pulse-dot" />
              <span>Live Stock Synchronized</span>
            </div>
          </div>

          <div className="pos-grid">
            {filteredProducts.map((product) => {
              const stock = Number(stockByProduct.get(product.id) ?? 0);
              const inStock = stock > 0;
              const inCart = lines.find((l) => l.product === String(product.id));

              return (
                <button
                  type="button"
                  key={product.id}
                  disabled={!inStock || disabled}
                  onClick={() => handleQuickAddCake(product)}
                  className={`pos-cake-card ${inStock ? "is-instock" : "is-out"} ${inCart ? "is-in-cart" : ""}`}
                >
                  <div className="pos-card-header">
                    <span className="pos-cake-name">{product.name}</span>
                    {inCart && (
                      <span className="pos-cart-badge">{inCart.quantity} in ticket</span>
                    )}
                  </div>

                  <div className="pos-card-footer">
                    <span className="pos-cake-price">{formatMoney(product.unit_price)}</span>
                    <span className={`pos-stock-badge ${inStock ? "has-stock" : "no-stock"}`}>
                      {inStock ? `${stock} on hand` : "Out of stock"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* RIGHT: Current Ticket & POS Settle Terminal */}
        <section className="pos-ticket-panel">
          <div className="pos-ticket-header">
            <div className="pos-ticket-title">
              <ShoppingCart size={18} />
              <h3>Current Sale Ticket</h3>
            </div>
            <span className="pos-ticket-count">{lines.length} items</span>
          </div>

          {/* Optional Pre-Order Linker */}
          {orderOptions.length > 0 && (
            <div className="pos-preorder-strip">
              <label className="pos-preorder-label">
                Convert Open Pre-Order:
                <select
                  className="pos-preorder-select"
                  value={orderId}
                  onChange={(event) => {
                    const selected = orderOptions.find((order) => String(order.id) === event.target.value);
                    setOrderId(event.target.value);
                    if (!selected) {
                      setLines([]);
                      return;
                    }
                    const newLines = selected.items.map((item) => ({
                      product: String(item.product),
                      quantity: item.quantity,
                      unit_price: item.unit_price ?? "",
                    }));
                    setLines(newLines);
                  }}
                >
                  <option value="">No linked order (Direct walk-in sale)</option>
                  {orderOptions.map((order) => (
                    <option value={order.id} key={order.id}>
                      {order.order_number} · {order.customer_name} (Due: {formatMoney(order.amount_due)})
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <form onSubmit={submitSale} className="pos-ticket-form">
            {/* Ticket Cart Line Items */}
            <div className="pos-cart-scroll">
              {lines.length === 0 ? (
                <div className="pos-empty-cart">
                  <div className="pos-empty-icon">
                    <ShoppingCart size={28} />
                  </div>
                  <h4>Ticket is empty</h4>
                  <p>Tap any cake in the catalog on the left to start a ticket.</p>
                </div>
              ) : (
                <div className="pos-line-list">
                  {lines.map((line, index) => {
                    const product = products.find((item) => String(item.id) === line.product);
                    const priceToUse = line.unit_price || product?.unit_price || "0";
                    const lineTotal = Number(priceToUse) * line.quantity;

                    return (
                      <div className="pos-line-item" key={index}>
                        <div className="pos-line-info">
                          <strong className="pos-line-title">{product?.name ?? "Cake"}</strong>
                          <span className="pos-line-unit">{formatMoney(priceToUse)} each</span>
                        </div>

                        <div className="pos-stepper">
                          <button
                            type="button"
                            className="pos-stepper-btn"
                            aria-label={`Decrease ${product?.name ?? "item"}`}
                            onClick={() => handleQuantityChange(index, -1)}
                          >
                            <Minus size={14} />
                          </button>
                          <span className="pos-stepper-val">{line.quantity}</span>
                          <button
                            type="button"
                            className="pos-stepper-btn"
                            aria-label={`Increase ${product?.name ?? "item"}`}
                            onClick={() => handleQuantityChange(index, 1)}
                          >
                            <Plus size={14} />
                          </button>
                        </div>

                        <span className="pos-line-total">{formatMoney(lineTotal)}</span>

                        <button
                          type="button"
                          className="pos-line-remove"
                          aria-label={`Remove cake item ${index + 1}`}
                          onClick={() => handleRemoveLine(index)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Summary Box */}
            <div className="pos-summary-box">
              <div className="pos-summary-row">
                <span>Subtotal</span>
                <strong>{formatMoney(totalDecimal)}</strong>
              </div>
              <div className="pos-summary-divider" />
              <div className="pos-total-row">
                <span>Total Payable</span>
                <strong className="pos-grand-total">{formatMoney(totalDecimal)}</strong>
              </div>
            </div>

            {/* Payment Methods */}
            <div className="pos-payment-section">
              <label className="pos-subheading">Payment Method</label>
              <div className="pos-methods-grid">
                <button
                  type="button"
                  className={`pos-method-btn ${selectedMethod === "cash" ? "is-selected" : ""}`}
                  onClick={() => setSelectedMethod("cash")}
                >
                  💵 Cash
                </button>
                <button
                  type="button"
                  className={`pos-method-btn ${selectedMethod === "telebirr" ? "is-selected" : ""}`}
                  onClick={() => setSelectedMethod("telebirr")}
                >
                  📱 Telebirr
                </button>
                <button
                  type="button"
                  className={`pos-method-btn ${selectedMethod === "bank_transfer" ? "is-selected" : ""}`}
                  onClick={() => setSelectedMethod("bank_transfer")}
                >
                  🏦 Bank Transfer
                </button>
              </div>

              {selectedMethod === "bank_transfer" && (
                <div className="pos-field" style={{ marginTop: "10px" }}>
                  <label>
                    Bank Name &amp; Reference:
                    <input
                      type="text"
                      placeholder="e.g. CBE / Awash transaction code"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      required
                      className="pos-input"
                    />
                  </label>
                </div>
              )}

              {selectedMethod === "cash" && (
                <div className="pos-cash-calculator">
                  <div className="pos-cash-field">
                    <label>
                      Cash Tendered by Customer (ETB)
                      <input
                        type="number"
                        step="1"
                        min="0"
                        placeholder="e.g. 1000"
                        value={cashTendered}
                        onChange={(e) => setCashTendered(e.target.value)}
                        className="pos-tendered-input"
                      />
                    </label>
                  </div>

                  <div className={`pos-change-card ${changeDue > 0 ? "has-change" : ""}`}>
                    <small>Change Due</small>
                    <strong className="pos-change-value">{formatMoney(changeDue)}</strong>
                  </div>
                </div>
              )}

              <div className="pos-note-field">
                <input
                  name="note"
                  placeholder="Sale memo or customer reference (optional)"
                  className="pos-input-sm"
                />
              </div>
            </div>

            {/* Action Button */}
            <button
              type="submit"
              disabled={disabled || !location || lines.length === 0}
              className="pos-submit-button"
            >
              <Check size={18} /> Confirm Sale &amp; Issue Receipt
            </button>
          </form>
        </section>
      </div>

      {/* Sales Register & Recent Transactions Ledger */}
      <section className="panel" style={{ marginTop: "1.5rem" }}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Transaction Ledger</p>
            <h2>Sales Register</h2>
          </div>
          <span>{sales.length} sales recorded</span>
        </div>

        {sales.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Sale #</th>
                  <th>Items Sold</th>
                  <th>Total &amp; Balance</th>
                  <th>Payments</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => {
                  const isActive = sale.status === "active";
                  const isPaid = Number(sale.amount_due) <= 0;
                  const paidCents = decimalToCents(sale.amount_paid);
                  const refundedCents = decimalToCents(sale.amount_refunded);
                  const refundableCents = paidCents > refundedCents ? paidCents - refundedCents : 0n;

                  return (
                    <tr key={sale.id}>
                      <td>
                        <strong>#{sale.id}</strong>
                        <small>{sale.order_number ? `Order: ${sale.order_number}` : "Direct Sale"}</small>
                        <small>{sale.cashier_name} · {formatDate(sale.sold_at)}</small>
                      </td>

                      <td>
                        {sale.lines.map((line) => (
                          <div key={line.product} style={{ marginBottom: "2px" }}>
                            <span>{line.quantity} × {line.product_name}</span>
                            <small> ({formatMoney(line.unit_price)} each)</small>
                          </div>
                        ))}
                      </td>

                      <td>
                        <div>
                          <strong>{formatMoney(sale.total)}</strong>
                          {!isPaid && (
                            <small style={{ color: "var(--brand-terracotta, #c85a32)", fontWeight: 600 }}>
                              Due: {formatMoney(sale.amount_due)}
                            </small>
                          )}
                        </div>
                      </td>

                      <td>
                        {sale.payment_history.length ? (
                          sale.payment_history.map((payment, index) => (
                            <div key={`${payment.payment_date}-${index}`}>
                              <span>{formatMoney(payment.amount)} · {payment.method.replaceAll("_", " ")}</span>
                              {payment.bank_name && <small> ({payment.bank_name})</small>}
                            </div>
                          ))
                        ) : (
                          <span style={{ color: "var(--brand-terracotta)" }}>Unpaid</span>
                        )}
                        {sale.refunds.length > 0 && (
                          <small style={{ color: "var(--brand-terracotta)", display: "block" }}>
                            Refunded: {formatMoney(sale.amount_refunded)}
                          </small>
                        )}
                      </td>

                      <td>
                        <span className={`status-pill status-${sale.status}`}>
                          {sale.status}
                        </span>
                        {sale.cancellation_reason && (
                          <small style={{ color: "var(--brand-terracotta)", display: "block" }}>
                            {sale.cancellation_reason}
                          </small>
                        )}
                      </td>

                      <td>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                          <button
                            type="button"
                            className="button button-sm button-outline"
                            title="Print 80mm receipt"
                            onClick={() => openReceiptModal(sale)}
                          >
                            <Printer size={13} /> Receipt
                          </button>

                          {isActive && !isPaid && (
                            <button
                              type="button"
                              className="button button-sm button-outline"
                              onClick={() => openCollectModal(sale)}
                            >
                              <DollarSign size={13} /> Collect
                            </button>
                          )}

                          {isActive && refundableCents > 0n && (
                            <button
                              type="button"
                              className="button button-sm button-outline"
                              onClick={() => openRefundModal(sale)}
                            >
                              <RefreshCw size={13} /> Refund
                            </button>
                          )}

                          {isActive && !sale.refunds.length && (
                            <button
                              type="button"
                              className="button button-sm button-danger"
                              onClick={() => openCancelModal(sale)}
                            >
                              Cancel
                            </button>
                          )}
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
            <h3>No sales yet</h3>
            <p>Counter sales and settled orders will appear here.</p>
          </div>
        )}
      </section>

      {/* MODAL 1: Collect Balance Modal */}
      {activeModal && activeModal.type === "collect" && (
        <div role="dialog" aria-modal="true" className="modal-backdrop">
          <div className="modal-card panel" style={{ maxWidth: "440px" }}>
            <div className="panel-heading">
              <h3>Collect Balance #{activeModal.sale.id}</h3>
              <button
                type="button"
                className="icon-action"
                onClick={() => setActiveModal(null)}
              >
                <X size={18} />
              </button>
            </div>
            {modalError && <p className="form-error">{modalError}</p>}
            <form onSubmit={handleCollectSubmit} className="portal-form">
              <label>
                Payment Method
                <select
                  value={collectDraft.method}
                  onChange={(e) =>
                    setCollectDraft((d) => ({ ...d, method: e.target.value }))
                  }
                >
                  <option value="cash">Cash</option>
                  <option value="telebirr">Telebirr</option>
                  <option value="bank_transfer">Bank transfer</option>
                </select>
              </label>

              <label>
                Amount (ETB)
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={collectDraft.amount}
                  onChange={(e) =>
                    setCollectDraft((d) => ({ ...d, amount: e.target.value }))
                  }
                  required
                />
              </label>

              {collectDraft.method === "bank_transfer" && (
                <label>
                  Bank Name &amp; Reference
                  <input
                    value={collectDraft.bank_name}
                    placeholder="e.g. CBE 1000..."
                    onChange={(e) =>
                      setCollectDraft((d) => ({ ...d, bank_name: e.target.value }))
                    }
                    required
                  />
                </label>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => setActiveModal(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button button-dark"
                  disabled={modalBusy}
                >
                  {modalBusy ? "Recording..." : "Save Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Refund Modal */}
      {activeModal && activeModal.type === "refund" && (
        <div role="dialog" aria-modal="true" className="modal-backdrop">
          <div className="modal-card panel" style={{ maxWidth: "500px" }}>
            <div className="panel-heading">
              <h3>Process Refund #{activeModal.sale.id}</h3>
              <button
                type="button"
                className="icon-action"
                onClick={() => setActiveModal(null)}
              >
                <X size={18} />
              </button>
            </div>
            {modalError && <p className="form-error">{modalError}</p>}
            <form onSubmit={handleRefundSubmit} className="portal-form">
              <label>
                Refund Method
                <select
                  value={refundDraft.method}
                  onChange={(e) =>
                    setRefundDraft((d) => ({ ...d, method: e.target.value }))
                  }
                >
                  <option value="cash">Cash</option>
                  <option value="telebirr">Telebirr</option>
                  <option value="bank_transfer">Bank transfer</option>
                </select>
              </label>

              <label>
                Refund Amount (ETB)
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={refundDraft.amount}
                  onChange={(e) =>
                    setRefundDraft((d) => ({ ...d, amount: e.target.value }))
                  }
                  required
                />
              </label>

              <label>
                Reason for Refund
                <input
                  value={refundDraft.reason}
                  placeholder="e.g. Customer cancelled order / Quality dissatisfaction"
                  onChange={(e) =>
                    setRefundDraft((d) => ({ ...d, reason: e.target.value }))
                  }
                  required
                />
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => setActiveModal(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button button-dark"
                  disabled={modalBusy}
                >
                  {modalBusy ? "Processing..." : "Process Refund"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Cancel Sale Modal */}
      {activeModal && activeModal.type === "cancel" && (
        <div role="dialog" aria-modal="true" className="modal-backdrop">
          <div className="modal-card panel" style={{ maxWidth: "440px" }}>
            <div className="panel-heading">
              <h3>Cancel Sale #{activeModal.sale.id}</h3>
              <button
                type="button"
                className="icon-action"
                onClick={() => setActiveModal(null)}
              >
                <X size={18} />
              </button>
            </div>
            {modalError && <p className="form-error">{modalError}</p>}
            <form onSubmit={handleCancelSubmit} className="portal-form">
              <label>
                Cancellation Reason
                <input
                  value={cancelReason}
                  placeholder="e.g. Mistake entry / customer left before collection"
                  onChange={(e) => setCancelReason(e.target.value)}
                  required
                />
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  type="checkbox"
                  checked={restockConfirmed}
                  onChange={(e) => setRestockConfirmed(e.target.checked)}
                />
                Return all cakes back to café inventory stock
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => setActiveModal(null)}
                >
                  Keep Sale
                </button>
                <button
                  type="submit"
                  className="button button-danger"
                  disabled={modalBusy}
                >
                  {modalBusy ? "Cancelling..." : "Confirm Cancellation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: 80mm Thermal Receipt Print Modal */}
      {activeModal && activeModal.type === "receipt" && (
        <div role="dialog" aria-modal="true" className="modal-backdrop">
          <div
            className="modal-card panel"
            style={{
              maxWidth: "380px",
              fontFamily: "'Courier New', Courier, monospace",
              padding: "20px",
              background: "#fff",
            }}
          >
            <div
              style={{
                textAlign: "center",
                borderBottom: "1px dashed #000",
                paddingBottom: "12px",
                marginBottom: "12px",
              }}
            >
              <h2 style={{ margin: "0 0 4px", fontSize: "18px", fontWeight: "bold" }}>
                SEASONS CAKE
              </h2>
              <p style={{ margin: "0", fontSize: "12px" }}>Delicious &amp; Fresh</p>
              <p style={{ margin: "4px 0 0", fontSize: "11px" }}>
                {location ? location.name : "Bakery & Café"}
              </p>
            </div>

            <div style={{ fontSize: "12px", lineHeight: "1.4", marginBottom: "10px" }}>
              <div>Receipt #: SALE-{activeModal.sale.id}</div>
              {activeModal.sale.order_number && (
                <div>Order #: {activeModal.sale.order_number}</div>
              )}
              <div>Date: {formatDate(activeModal.sale.sold_at)}</div>
              <div>Cashier: {activeModal.sale.cashier_name}</div>
            </div>

            <table
              style={{
                width: "100%",
                fontSize: "12px",
                borderTop: "1px dashed #000",
                borderBottom: "1px dashed #000",
                margin: "8px 0",
              }}
            >
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "4px 0" }}>Item</th>
                  <th style={{ textAlign: "center", padding: "4px 0" }}>Qty</th>
                  <th style={{ textAlign: "right", padding: "4px 0" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {activeModal.sale.lines.map((line) => (
                  <tr key={line.product}>
                    <td style={{ padding: "3px 0" }}>{line.product_name}</td>
                    <td style={{ textAlign: "center", padding: "3px 0" }}>{line.quantity}</td>
                    <td style={{ textAlign: "right", padding: "3px 0" }}>
                      {formatMoney(Number(line.unit_price) * line.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontWeight: "bold",
                fontSize: "14px",
                margin: "8px 0",
              }}
            >
              <span>TOTAL:</span>
              <span>{formatMoney(activeModal.sale.total)}</span>
            </div>

            <div style={{ fontSize: "11px", borderTop: "1px dashed #000", paddingTop: "6px" }}>
              <div>Payments Received:</div>
              {activeModal.sale.payment_history.map((p, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>
                    - {p.method.toUpperCase()} {p.bank_name ? `(${p.bank_name})` : ""}
                  </span>
                  <span>{formatMoney(p.amount)}</span>
                </div>
              ))}
            </div>

            <div
              style={{
                textAlign: "center",
                marginTop: "16px",
                fontSize: "11px",
                borderTop: "1px dashed #000",
                paddingTop: "8px",
              }}
            >
              <p style={{ margin: "0 0 2px" }}>Thank you for celebrating with</p>
              <strong>Seasons Cake!</strong>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: "16px",
                paddingTop: "12px",
                borderTop: "1px solid #e5e7eb",
              }}
            >
              <button
                type="button"
                className="button button-outline button-sm"
                onClick={() => setActiveModal(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="button button-dark button-sm"
                onClick={() => window.print()}
              >
                <Printer size={14} /> Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
