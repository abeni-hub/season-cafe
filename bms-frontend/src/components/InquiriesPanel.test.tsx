import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { InquiriesPanel } from "./InquiriesPanel";

describe("InquiriesPanel", () => {
  it("filters inquiries and sends status changes to the portal", async () => {
    const user = userEvent.setup();
    const onUpdateStatus = vi.fn().mockResolvedValue(true);
    render(
      <InquiriesPanel
        inquiries={[
          {
            id: 21,
            name: "Aster",
            email: "aster@example.test",
            phone: "",
            subject: "Birthday order",
            message: "Can you make a vanilla cake?",
            status: "new",
            source: "website",
            assigned_to_name: "",
            created_at: "2026-01-02T10:00:00Z",
          },
        ]}
        disabled={false}
        onUpdateStatus={onUpdateStatus}
      />,
    );

    expect(screen.getByText("Birthday order")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/Show/), "resolved");
    expect(screen.getByText("No messages in this filter")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/Show/), "all");
    await user.selectOptions(screen.getByLabelText("Status"), "in_progress");

    expect(onUpdateStatus).toHaveBeenCalledWith(21, "in_progress");
  });
});
