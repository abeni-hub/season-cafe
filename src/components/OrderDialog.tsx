import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, X } from "lucide-react";
import { cakes, type Cake } from "../data/siteData";
import { submitOrder, type OrderRequest } from "../services/customerApi";

interface OrderDialogProps {
  open: boolean;
  initialCake?: Cake;
  availableCakes?: Cake[];
  onClose: () => void;
}

const sizes = ["Small", "Medium", "Large", "Custom"];
const today = new Date();
const minDate = new Date(today.getTime() - today.getTimezoneOffset() * 60_000)
  .toISOString()
  .slice(0, 10);
const emptyForm = {
  customerName: "",
  phone: "",
  email: "",
  cakeId: "",
  size: "",
  quantity: 1,
  instructions: "",
  fulfillment: "pickup" as "pickup" | "delivery",
  requestedDate: "",
  deliveryAddress: "",
};
type OrderFormState = typeof emptyForm;

function getOrderErrors(form: OrderFormState): Partial<Record<keyof OrderFormState, string>> {
  const errors: Partial<Record<keyof OrderFormState, string>> = {};
  if (!form.customerName.trim()) errors.customerName = "Enter your name.";
  if (!form.phone.trim()) errors.phone = "Enter a phone number so the bakery can reach you.";
  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  if (!form.cakeId) errors.cakeId = "Choose a cake.";
  if (!form.size) errors.size = "Choose a size.";
  if (!Number.isInteger(form.quantity) || form.quantity < 1 || form.quantity > 20) {
    errors.quantity = "Enter a quantity from 1 to 20.";
  }
  if (!form.requestedDate || form.requestedDate < minDate) {
    errors.requestedDate = "Choose today or a future date.";
  }
  if (form.fulfillment === "delivery" && !form.deliveryAddress.trim()) {
    errors.deliveryAddress = "Enter the delivery address.";
  }
  return errors;
}

export function OrderDialog({ open, initialCake, availableCakes = cakes, onClose }: OrderDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const requestKey = useRef<{ signature: string; key: string } | null>(null);
  const [step, setStep] = useState<"form" | "review" | "sent">("form");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reviewAttempted, setReviewAttempted] = useState(false);
  const [form, setForm] = useState({ ...emptyForm, cakeId: initialCake?.id ?? "" });
  const fieldErrors = getOrderErrors(form);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (open) {
      setStep("form");
      setError("");
      setReviewAttempted(false);
      setForm({ ...emptyForm, cakeId: initialCake?.id ?? "" });
    }
  }, [open, initialCake]);

  const selectedCake = useMemo(
    () => availableCakes.find((cake) => cake.id === form.cakeId),
    [availableCakes, form.cakeId],
  );

  function updateField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function reviewOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReviewAttempted(true);
    const errors = getOrderErrors(form);
    const firstInvalid = ([
      "customerName",
      "phone",
      "email",
      "cakeId",
      "size",
      "quantity",
      "requestedDate",
      "deliveryAddress",
    ] as const).find((field) => errors[field]);
    if (firstInvalid) {
      document.getElementById(`order-${firstInvalid}`)?.focus();
      return;
    }
    setError("");
    setStep("review");
  }

  async function placeOrder() {
    if (!selectedCake) {
      setError("Choose a cake before continuing.");
      setStep("form");
      return;
    }
    const orderPayload = {
      customerName: form.customerName.trim(),
      phone: form.phone.trim(),
      ...(form.email.trim() ? { email: form.email.trim() } : {}),
      cakeId: form.cakeId,
      size: form.size,
      quantity: Number(form.quantity),
      ...(form.instructions.trim() ? { instructions: form.instructions.trim() } : {}),
      fulfillment: form.fulfillment,
      requestedDate: form.requestedDate,
      ...(form.fulfillment === "delivery"
        ? { deliveryAddress: form.deliveryAddress.trim() }
        : {}),
    };
    const signature = JSON.stringify(orderPayload);
    if (requestKey.current?.signature !== signature) {
      requestKey.current = { signature, key: crypto.randomUUID() };
    }
    const order: OrderRequest = {
      ...orderPayload,
      idempotencyKey: requestKey.current.key,
    };
    setBusy(true);
    setError("");
    try {
      await submitOrder(order);
      requestKey.current = null;
      setStep("sent");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The request could not be sent. Nothing has been submitted.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      className="order-dialog"
      ref={dialogRef}
      aria-labelledby="order-dialog-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current && !busy) onClose();
      }}
    >
      <div className="order-dialog-inner">
        <button
          className="icon-button dialog-close"
          onClick={onClose}
          disabled={busy}
          aria-label="Close order form"
        >
          <X size={20} />
        </button>

        {step === "sent" ? (
          <div className="order-confirmation">
            <span className="confirmation-mark" aria-hidden="true">✓</span>
            <p className="eyebrow">Order request sent</p>
            <h2 id="order-dialog-title">Thank you, {form.customerName}.</h2>
            <p>Your order request was sent successfully. The bakery will follow up to confirm the details.</p>
            <button className="button button-dark" onClick={onClose}>Close</button>
          </div>
        ) : step === "review" ? (
          <section className="order-review">
            <button className="text-button back-button" onClick={() => setStep("form")}>
              <ArrowLeft size={16} /> Edit details
            </button>
            <p className="eyebrow">Before we send it</p>
            <h2 id="order-dialog-title">Review your order</h2>
            <p className="review-intro">Check that everything looks right. We’ll confirm availability and pricing with you.</p>
            <dl className="order-summary">
              <div><dt>Name</dt><dd>{form.customerName}</dd></div>
              <div><dt>Phone</dt><dd>{form.phone}</dd></div>
              {form.email && <div><dt>Email</dt><dd>{form.email}</dd></div>}
              <div><dt>Cake</dt><dd>{selectedCake?.name ?? "Choose a cake"}</dd></div>
              <div><dt>Size · quantity</dt><dd>{form.size} · {form.quantity}</dd></div>
              <div><dt>When</dt><dd>{form.requestedDate}</dd></div>
              <div><dt>{form.fulfillment === "delivery" ? "Delivery address" : "Collection"}</dt><dd>{form.fulfillment === "delivery" ? form.deliveryAddress : "Pickup"}</dd></div>
              {form.instructions && <div><dt>Notes</dt><dd>{form.instructions}</dd></div>}
            </dl>
            {error && <p className="form-alert" role="alert">{error}</p>}
            <button className="button button-dark order-submit" onClick={placeOrder} disabled={busy}>
              {busy ? "Sending…" : "Send order request"}
            </button>
            <p className="form-note">Your order is not confirmed until the bakery replies.</p>
          </section>
        ) : (
          <>
            <p className="eyebrow">Made for your moment</p>
            <h2 id="order-dialog-title">Start an order</h2>
            <p className="dialog-intro">Share a few details and we’ll help shape the cake around your occasion.</p>
            <form className="order-form" onSubmit={reviewOrder} noValidate>
              <label>
                Your name <span aria-hidden="true">*</span>
                <input id="order-customerName" name="name" autoComplete="name" required aria-invalid={reviewAttempted && Boolean(fieldErrors.customerName)} aria-describedby={reviewAttempted && fieldErrors.customerName ? "order-customerName-error" : undefined} value={form.customerName} onChange={(event) => updateField("customerName", event.target.value)} />
                {reviewAttempted && fieldErrors.customerName && <span className="field-error" id="order-customerName-error">{fieldErrors.customerName}</span>}
              </label>
              <div className="form-two-columns">
                <label>
                  Phone number <span aria-hidden="true">*</span>
                  <input id="order-phone" name="phone" type="tel" autoComplete="tel" required aria-invalid={reviewAttempted && Boolean(fieldErrors.phone)} aria-describedby={reviewAttempted && fieldErrors.phone ? "order-phone-error" : undefined} value={form.phone} onChange={(event) => updateField("phone", event.target.value)} />
                  {reviewAttempted && fieldErrors.phone && <span className="field-error" id="order-phone-error">{fieldErrors.phone}</span>}
                </label>
                <label>
                  Email <span className="optional">(optional)</span>
                  <input id="order-email" name="email" type="email" autoComplete="email" aria-invalid={reviewAttempted && Boolean(fieldErrors.email)} aria-describedby={reviewAttempted && fieldErrors.email ? "order-email-error" : undefined} value={form.email} onChange={(event) => updateField("email", event.target.value)} />
                  {reviewAttempted && fieldErrors.email && <span className="field-error" id="order-email-error">{fieldErrors.email}</span>}
                </label>
              </div>
              <div className="form-two-columns">
                <label>
                  Cake <span aria-hidden="true">*</span>
                  <select id="order-cakeId" required aria-invalid={reviewAttempted && Boolean(fieldErrors.cakeId)} aria-describedby={reviewAttempted && fieldErrors.cakeId ? "order-cakeId-error" : undefined} value={form.cakeId} onChange={(event) => updateField("cakeId", event.target.value)}>
                    <option value="">Choose a cake</option>
                    {availableCakes.map((cake) => <option value={cake.id} key={cake.id}>{cake.name} — {cake.category}</option>)}
                  </select>
                  {reviewAttempted && fieldErrors.cakeId && <span className="field-error" id="order-cakeId-error">{fieldErrors.cakeId}</span>}
                </label>
                <label>
                  Size <span aria-hidden="true">*</span>
                  <select id="order-size" required aria-invalid={reviewAttempted && Boolean(fieldErrors.size)} aria-describedby={reviewAttempted && fieldErrors.size ? "order-size-error" : undefined} value={form.size} onChange={(event) => updateField("size", event.target.value)}>
                    <option value="">Choose a size</option>
                    {sizes.map((size) => <option value={size} key={size}>{size}</option>)}
                  </select>
                  {reviewAttempted && fieldErrors.size && <span className="field-error" id="order-size-error">{fieldErrors.size}</span>}
                </label>
              </div>
              <div className="form-two-columns">
                <label>
                  Quantity <span aria-hidden="true">*</span>
                  <input id="order-quantity" name="quantity" type="number" min="1" max="20" required aria-invalid={reviewAttempted && Boolean(fieldErrors.quantity)} aria-describedby={reviewAttempted && fieldErrors.quantity ? "order-quantity-error" : undefined} value={form.quantity} onChange={(event) => updateField("quantity", Number(event.target.value))} />
                  {reviewAttempted && fieldErrors.quantity && <span className="field-error" id="order-quantity-error">{fieldErrors.quantity}</span>}
                </label>
                <label>
                  Requested date <span aria-hidden="true">*</span>
                  <input id="order-requestedDate" name="date" type="date" min={minDate} required aria-invalid={reviewAttempted && Boolean(fieldErrors.requestedDate)} aria-describedby={reviewAttempted && fieldErrors.requestedDate ? "order-requestedDate-error" : undefined} value={form.requestedDate} onChange={(event) => updateField("requestedDate", event.target.value)} />
                  {reviewAttempted && fieldErrors.requestedDate && <span className="field-error" id="order-requestedDate-error">{fieldErrors.requestedDate}</span>}
                </label>
              </div>
              <fieldset className="fulfillment-field">
                <legend>How would you like to receive it? <span aria-hidden="true">*</span></legend>
                <div className="radio-options">
                  <label><input type="radio" name="fulfillment" checked={form.fulfillment === "pickup"} onChange={() => updateField("fulfillment", "pickup")} /> Pickup</label>
                  <label><input type="radio" name="fulfillment" checked={form.fulfillment === "delivery"} onChange={() => updateField("fulfillment", "delivery")} /> Delivery</label>
                </div>
              </fieldset>
              {form.fulfillment === "delivery" && (
                <label>
                  Delivery address <span aria-hidden="true">*</span>
                  <textarea id="order-deliveryAddress" rows={2} autoComplete="street-address" required aria-invalid={reviewAttempted && Boolean(fieldErrors.deliveryAddress)} aria-describedby={reviewAttempted && fieldErrors.deliveryAddress ? "order-deliveryAddress-error" : undefined} value={form.deliveryAddress} onChange={(event) => updateField("deliveryAddress", event.target.value)} />
                  {reviewAttempted && fieldErrors.deliveryAddress && <span className="field-error" id="order-deliveryAddress-error">{fieldErrors.deliveryAddress}</span>}
                </label>
              )}
              <label>
                Customisation or special instructions <span className="optional">(optional)</span>
                <textarea rows={3} value={form.instructions} onChange={(event) => updateField("instructions", event.target.value)} placeholder="Colours, message on the cake, or anything else we should know" />
              </label>
              {error && <p className="form-alert" role="alert">{error}</p>}
              <button className="button button-dark order-submit" type="submit">Review your order</button>
              <p className="form-note">No account needed. We’ll confirm availability and pricing before your order is final.</p>
            </form>
          </>
        )}
      </div>
    </dialog>
  );
}
