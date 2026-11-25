import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { OrdersPanel, type Order, type Product, type Location } from "./OrdersPanel";

describe("OrdersPanel", () => {
  const mockOrders: Order[] = [
    {
      id: 1,
      order_number: "ORD-2026-0001",
      customer_name: "Sarah Miller",
      customer_phone: "+251911000111",
      customer_email: "sarah@example.com",
      created_by_name: "Cashier Bob",
      sale_id: null,
      requested_for: "2026-11-23T14:00:00Z",
      status: "ready",
      payment_status: "partial",
      source: "phone",
      fulfillment: "pickup",
      delivery_address: "",
      notes: "Happy 30th Birthday lettering in gold",
      location: 1,
      location_name: "Bole Medhanialem Café",
      total: "850.00",
      amount_paid: "300.00",
      amount_due: "550.00",
      items: [
        {
          product: 10,
          product_name: "Strawberry Gateau",
          quantity: 1,
          size: "10-inch Custom",
          unit_price: "850.00",
          total: "850.00",
        },
      ],
      status_history: [
        {
          status: "new",
          changed_by_name: "Bob",
          created_at: "2026-11-23T08:00:00Z",
        },
        {
          status: "ready",
          changed_by_name: "Baker John",
          created_at: "2026-11-23T12:00:00Z",
        },
      ],
    },
  ];

  const mockProducts: Product[] = [
    { id: 10, name: "Strawberry Gateau", unit_price: "600.00" },
  ];

  const mockLocations: Location[] = [
    { id: 1, name: "Bole Medhanialem Café", kind: "cafe" },
  ];

  it("renders order financial details and payment status badge", () => {
    render(
      <OrdersPanel
        orders={mockOrders}
        products={mockProducts}
        locations={mockLocations}
        isOwner={true}
        location={mockLocations[0]}
        disabled={false}
        onSubmit={vi.fn()}
        onUpdate={vi.fn()}
        onRecordPayment={vi.fn()}
        onConvertToSale={vi.fn()}
      />,
    );

    expect(screen.getByText("ORD-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("Sarah Miller")).toBeInTheDocument();
    expect(screen.getByText(/Happy 30th Birthday/)).toBeInTheDocument();
    // Payment badge and due amount
    expect(screen.getByText("partial")).toBeInTheDocument();
    expect(screen.getByText(/Due:/)).toBeInTheDocument();
  });

  it("opens payment modal and submits deposit", async () => {
    const onRecordPayment = vi.fn().mockResolvedValue(true);

    render(
      <OrdersPanel
        orders={mockOrders}
        products={mockProducts}
        locations={mockLocations}
        isOwner={true}
        location={mockLocations[0]}
        disabled={false}
        onSubmit={vi.fn()}
        onUpdate={vi.fn()}
        onRecordPayment={onRecordPayment}
        onConvertToSale={vi.fn()}
      />,
    );

    const recordPayBtn = screen.getByRole("button", { name: /Record Deposit \/ Pay/i });
    fireEvent.click(recordPayBtn);

    // Modal dialog is open
    expect(screen.getByText(/Record Payment for ORD-2026-0001/i)).toBeInTheDocument();
    // Remaining due is pre-filled as default amount
    const amountInput = screen.getByLabelText(/Payment Amount/i) as HTMLInputElement;
    expect(amountInput.value).toBe("550");

    // Submit payment
    const submitBtn = screen.getByRole("button", { name: /^Record Payment$/i });
    fireEvent.click(submitBtn);

    expect(onRecordPayment).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        method: "cash",
        amount: "550",
      }),
    );
  });

  it("renders 'Settle & Deliver' button on ready orders and triggers callback", () => {
    const onConvertToSale = vi.fn();

    render(
      <OrdersPanel
        orders={mockOrders}
        products={mockProducts}
        locations={mockLocations}
        isOwner={true}
        location={mockLocations[0]}
        disabled={false}
        onSubmit={vi.fn()}
        onUpdate={vi.fn()}
        onRecordPayment={vi.fn()}
        onConvertToSale={onConvertToSale}
      />,
    );

    const settleBtn = screen.getByRole("button", { name: /Settle & Deliver/i });
    expect(settleBtn).toBeInTheDocument();

    fireEvent.click(settleBtn);
    expect(onConvertToSale).toHaveBeenCalledWith(mockOrders[0]);
  });
});
