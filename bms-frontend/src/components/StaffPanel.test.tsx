import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { StaffPanel, type StaffMember, type Location } from "./StaffPanel";

describe("StaffPanel", () => {
  const mockStaff: StaffMember[] = [
    {
      id: 1,
      username: "owner-abebe",
      first_name: "Abebe",
      last_name: "Tadesse",
      display_name: "Abebe Tadesse",
      email: "owner@seasonscake.com",
      role: "owner",
      workspace: "cafe",
      location: null,
      location_name: "All Branches",
      is_active: true,
    },
    {
      id: 2,
      username: "baker-sara",
      first_name: "Sara",
      last_name: "Bekele",
      display_name: "Sara Bekele",
      email: "sara@seasonscake.com",
      role: "employee",
      workspace: "bakery",
      location: 1,
      location_name: "Home Bakery",
      is_active: true,
    },
  ];

  const mockLocations: Location[] = [
    { id: 1, name: "Home Bakery", kind: "home_bakery" },
    { id: 2, name: "Bole Café", kind: "cafe" },
  ];

  it("renders the staff list with names, roles, and branch assignments", () => {
    render(
      <StaffPanel
        staff={mockStaff}
        locations={mockLocations}
        currentUserId={1}
        isOwner={true}
        disabled={false}
        onSaveStaff={vi.fn().mockResolvedValue(true)}
        onDeactivateStaff={vi.fn().mockResolvedValue(true)}
      />,
    );

    expect(screen.getByText("Abebe Tadesse")).toBeInTheDocument();
    expect(screen.getByText("Sara Bekele")).toBeInTheDocument();
    expect(screen.getByText(/@owner-abebe/)).toBeInTheDocument();
    expect(screen.getByText(/@baker-sara/)).toBeInTheDocument();
    expect(screen.getByText("Home Bakery (Production)")).toBeInTheDocument();
  });

  it("opens add team member modal and submits new staff account", async () => {
    const handleSaveStaff = vi.fn().mockResolvedValue(true);
    render(
      <StaffPanel
        staff={mockStaff}
        locations={mockLocations}
        currentUserId={1}
        isOwner={true}
        disabled={false}
        onSaveStaff={handleSaveStaff}
        onDeactivateStaff={vi.fn().mockResolvedValue(true)}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /add team member/i }));
    expect(screen.getByText("Onboard Employee")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("e.g. abebe.k"), {
      target: { value: "cashier.almaz" },
    });
    fireEvent.change(screen.getByPlaceholderText("Initial password"), {
      target: { value: "Pass1234!" },
    });
    fireEvent.change(screen.getByPlaceholderText("Abebe"), {
      target: { value: "Almaz" },
    });
    fireEvent.change(screen.getByPlaceholderText("Kebede"), {
      target: { value: "Hailu" },
    });

    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(handleSaveStaff).toHaveBeenCalledWith(null, expect.objectContaining({
      username: "cashier.almaz",
      first_name: "Almaz",
      last_name: "Hailu",
      password: "Pass1234!",
      role: "employee",
      workspace: "cafe",
    }));
  });
});
