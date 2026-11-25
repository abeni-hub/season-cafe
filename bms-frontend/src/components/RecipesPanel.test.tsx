import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RecipesPanel } from "./RecipesPanel";

describe("RecipesPanel", () => {
  it("creates a recipe with per-cake ingredient amounts", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(true);
    render(
      <RecipesPanel
        recipes={[]}
        products={[{
          id: 2,
          name: "Vanilla Custard",
          description: "",
          image: null,
          image_alt: "",
          category: null,
          category_name: "",
          web_id: "vanilla-custard",
          selling_unit: "cake",
          sku: null,
          unit_price: "125.00",
          is_active: true,
          is_published: false,
          is_featured: false,
          public_sort_order: 0,
        }]}
        ingredients={[{
          id: 3,
          name: "Cake Flour",
          unit: "kg",
          category: null,
          category_name: "",
          supplier_names: [],
          reorder_level: "1.000",
          is_active: true,
        }]}
        canManage
        disabled={false}
        onCreate={onCreate}
        onGoToCatalog={vi.fn()}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Cake product"), "2");
    await user.type(screen.getByLabelText("Recipe name"), "Vanilla sponge");
    await user.type(screen.getByLabelText("Ingredient 1"), "Cake Flour");
    await user.type(screen.getByLabelText("Amount for ingredient 1"), "0.250");
    await user.click(screen.getByRole("button", { name: "Save recipe version" }));

    expect(onCreate).toHaveBeenCalledWith({
      product: 2,
      name: "Vanilla sponge",
      description: "",
      ingredients: [{ ingredient: 3, quantity: "0.250", unit: "kg" }],
    });
  });
});
