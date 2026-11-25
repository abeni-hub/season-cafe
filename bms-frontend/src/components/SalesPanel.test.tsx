import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SalesPanel, type Sale, type Product, type Order, type Location } from "./SalesPanel";

describe("SalesPanel (Café POS)", () => {
  const mockProducts: Product[] = [
    { id: 10, name: "Chocolate Fudge Cake", unit_price: "450.00" },
    { id: 20, name: "Red Velvet Delight", unit_price: "500.00" },
  ];

  const mockSales: Sale[] = [
    {
      id: 101,
      sold_at: "2026-11-23T10:30:00Z",
      cashier_name: "Cashier Bob",
      order: null,
      order_number: "",
      status: "active",
      cancellation_reason: "",
      cancelled_by_name: "",
      cancelled_at: null,
      total: "450.00",
      amount_paid: "450.00",
      amount_due: "0.00",
      amount_refunded: "0.00",
      lines: [{ product: 10, product_name: "Chocolate Fudge Cake", quantity: 1, unit_price: "450.00" }],
      payment_history: [
        {
          method: "cash",
          amount: "450.00",
          bank_name: "",
          payment_date: "2026-11-23T10:30:00Z",
          received_by_name: "Cashier Bob",
        },
      ],
      refunds: [],
    },
  ];

  const mockOrders: Order[] = [];
  const mockAvailability = [
    { product: 10, available_quantity: "5" },
    { product: 20, available_quantity: "0" },
  ];
  const mockLocation: Location = { id: 1, name: "Bole Medhanialem Café" };

  it("renders POS quick-touch buttons and displays live stock status", () => {
    render(
      <SalesPanel
        sales={mockSales}
        products={mockProducts}
        orders={mockOrders}
        availability={mockAvailability}
        location={mockLocation}
        disabled={false}
        onSubmit={vi.fn().mockResolvedValue(true)}
        onCollectPayment={vi.fn().mockResolvedValue(true)}
        onRefund={vi.fn().mockResolvedValue(true)}
        onCancel={vi.fn().mockResolvedValue(true)}
      />,
    );

    expect(screen.getByText("Café Point of Sale")).toBeInTheDocument();
    expect(screen.getByText("Chocolate Fudge Cake")).toBeInTheDocument();
    expect(screen.getByText("5 on hand")).toBeInTheDocument();
    expect(screen.getByText("Out of stock")).toBeInTheDocument();
  });

  it("calculates cash change due accurately", () => {
    render(
      <SalesPanel
        sales={mockSales}
        products={mockProducts}
        orders={mockOrders}
        availability={mockAvailability}
        location={mockLocation}
        disabled={false}
        onSubmit={vi.fn().mockResolvedValue(true)}
        onCollectPayment={vi.fn().mockResolvedValue(true)}
        onRefund={vi.fn().mockResolvedValue(true)}
        onCancel={vi.fn().mockResolvedValue(true)}
      />,
    );

    // Click on the Chocolate Fudge Cake quick-touch card to populate line item
    fireEvent.click(screen.getByText("Chocolate Fudge Cake"));

    // Find Cash Tendered input
    const tenderedInput = screen.getByPlaceholderText("e.g. 1000");
    fireEvent.change(tenderedInput, { target: { value: "500" } });

    // 500 tendered - 450 total = 50 ETB change
    expect(screen.getByText("Change Due")).toBeInTheDocument();
    expect(screen.getByText("Change Due").parentElement).toHaveTextContent("50.00");
  });

  it("opens thermal receipt modal and displays official Seasons Cake branding", () => {
    render(
      <SalesPanel
        sales={mockSales}
        products={mockProducts}
        orders={mockOrders}
        availability={mockAvailability}
        location={mockLocation}
        disabled={false}
        onSubmit={vi.fn().mockResolvedValue(true)}
        onCollectPayment={vi.fn().mockResolvedValue(true)}
        onRefund={vi.fn().mockResolvedValue(true)}
        onCancel={vi.fn().mockResolvedValue(true)}
      />,
    );

    // Click receipt button for sale #101
    const receiptButton = screen.getByTitle("Print 80mm receipt");
    fireEvent.click(receiptButton);

    // Modal should show Seasons Cake official brand name and tagline
    expect(screen.getByText("SEASONS CAKE")).toBeInTheDocument();
    expect(screen.getByText("Delicious & Fresh")).toBeInTheDocument();
    expect(screen.getByText(/SALE-101/)).toBeInTheDocument();
  });
});
