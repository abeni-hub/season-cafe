from django.db import transaction

from apps.audit.services import log_activity
from apps.core.constants import round_qty
from apps.core.errors import DomainError
from apps.inventory.models import InventoryItem, ItemKind
from apps.products.models import Product
from .models import Recipe, RecipeLine


def upsert_recipe(*, product_id, yield_quantity, lines, notes="", actor) -> Recipe:
    yield_qty = round_qty(yield_quantity)
    if yield_qty <= 0:
        raise DomainError("Yield must be greater than zero.")
    if not lines:
        raise DomainError("Add at least one recipe line.")
    product = Product.objects.filter(pk=product_id).first()
    if product is None:
        raise DomainError("Product not found.")

    prepared = []
    seen = set()
    for line in lines:
        item_id = line.get("itemId")
        quantity = round_qty(line.get("quantity"))
        if not item_id or quantity <= 0:
            continue
        item = InventoryItem.objects.filter(pk=item_id).first()
        if item is None:
            raise DomainError("A recipe ingredient no longer exists.")
        if item.kind == ItemKind.FINISHED:
            raise DomainError("Finished goods cannot be recipe ingredients.")
        if str(item.id) in seen:
            raise DomainError("Each ingredient may only appear once in a recipe.")
        seen.add(str(item.id))
        prepared.append((item, quantity))
    if not prepared:
        raise DomainError("Add at least one recipe line.")

    with transaction.atomic():
        recipe, created = Recipe.objects.select_for_update().get_or_create(
            product=product,
            defaults={"yield_quantity": yield_qty, "notes": (notes or "").strip()},
        )
        if not created:
            recipe.yield_quantity = yield_qty
            if (notes or "").strip():
                recipe.notes = notes.strip()
            recipe.save(update_fields=["yield_quantity", "notes", "updated_at"])
        recipe.lines.all().delete()
        for item, quantity in prepared:
            RecipeLine.objects.create(recipe=recipe, item=item, quantity=quantity)
        log_activity(f"Recipe for {product.name} updated.", actor=actor)
    return Recipe.objects.prefetch_related("lines").get(pk=recipe.pk)
