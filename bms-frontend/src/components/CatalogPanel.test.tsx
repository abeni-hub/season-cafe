import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CatalogPanel } from "./CatalogPanel";

describe("CatalogPanel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("saves a cake with its public website ID and a new ingredient", async () => {
    const user = userEvent.setup();
    const onSaveProduct = vi.fn().mockResolvedValue(true);
    const onSaveIngredient = vi.fn().mockResolvedValue(true);
    render(
      <CatalogPanel
        products={[]}
        ingredients={[]}
        categories={[]}
        disabled={false}
        canManageWebsite
        onSaveProduct={onSaveProduct}
        onDeleteProduct={vi.fn().mockResolvedValue(true)}
        onSaveIngredient={onSaveIngredient}
        onSaveCategory={vi.fn().mockResolvedValue(true)}
        onDeleteCategory={vi.fn().mockResolvedValue(true)}
      />,
    );

    await user.type(screen.getByLabelText("Cake name"), "Vanilla Custard");
    await user.type(screen.getByLabelText(/Public cake ID/), "vanilla-custard");
    await user.click(screen.getByRole("button", { name: "Add cake" }));

    const productPayload = onSaveProduct.mock.calls[0][1] as FormData;
    expect(productPayload.get("name")).toBe("Vanilla Custard");
    expect(productPayload.get("web_id")).toBe("vanilla-custard");
    expect(productPayload.get("is_active")).toBe("true");

    await user.type(screen.getByLabelText("Ingredient name"), "Cake Flour");
    await user.click(screen.getByRole("button", { name: "Add ingredient" }));

    expect(onSaveIngredient).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ name: "Cake Flour", unit: "kg", is_active: true }),
    );
  });

  it("confirms before requesting deletion of a cake", async () => {
    const user = userEvent.setup();
    const onDeleteProduct = vi.fn().mockResolvedValue(true);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <CatalogPanel
        products={[{
          id: 12,
          name: "Vanilla Cake",
          description: "",
          image: null,
          image_alt: "",
          category: null,
          category_name: "",
          web_id: "vanilla-cake",
          selling_unit: "cake",
          sku: null,
          unit_price: "125.00",
          is_active: true,
          is_published: false,
          is_featured: false,
          public_sort_order: 0,
        }]}
        ingredients={[]}
        categories={[]}
        disabled={false}
        canManageWebsite={false}
        onSaveProduct={vi.fn().mockResolvedValue(true)}
        onDeleteProduct={onDeleteProduct}
        onSaveIngredient={vi.fn().mockResolvedValue(true)}
        onSaveCategory={vi.fn().mockResolvedValue(true)}
        onDeleteCategory={vi.fn().mockResolvedValue(true)}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Delete Vanilla Cake" }));

    expect(window.confirm).toHaveBeenCalled();
    expect(onDeleteProduct).toHaveBeenCalledWith(12);
  });
});
