import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReportFiltersPanel, type ReportFilters } from "./ReportFiltersPanel";

const filters: ReportFilters = {
  product: "",
  payment_method: "",
  employee: "",
  start_date: "",
  end_date: "",
};

describe("ReportFiltersPanel", () => {
  it("reports selected filters while preserving the other values", () => {
    const onChange = vi.fn();
    render(
      <ReportFiltersPanel
        products={[{ id: 4, name: "Vanilla cake" }]}
        employees={[{ id: 9, display_name: "Mekdes", role: "Manager", location_name: "Café" }]}
        filters={filters}
        startDate="2025-03-01"
        endDate="2025-03-01"
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("Cake"), { target: { value: "4" } });

    expect(onChange).toHaveBeenLastCalledWith({ ...filters, product: "4" });
    expect(screen.getByText("2025-03-01 to 2025-03-01")).toBeInTheDocument();
  });

  it("offers payment and employee filters", () => {
    const onChange = vi.fn();
    render(
      <ReportFiltersPanel
        products={[]}
        employees={[{ id: 9, display_name: "Mekdes", role: "Manager", location_name: "Café" }]}
        filters={filters}
        startDate=""
        endDate=""
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("Payment method"), { target: { value: "telebirr" } });
    expect(onChange).toHaveBeenLastCalledWith({ ...filters, payment_method: "telebirr" });
    expect(screen.getByRole("option", { name: "Mekdes · Café" })).toBeInTheDocument();
  });
});
