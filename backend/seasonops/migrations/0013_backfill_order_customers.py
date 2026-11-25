import re

from django.db import migrations


def backfill_order_customers(apps, schema_editor):
    Customer = apps.get_model("seasonops", "Customer")
    CustomerOrder = apps.get_model("seasonops", "CustomerOrder")
    database = schema_editor.connection.alias

    for order in CustomerOrder.objects.using(database).order_by("id").iterator():
        phone = (order.customer_phone or "").strip()
        digits = "".join(re.findall(r"\d", phone))
        if digits.startswith("00"):
            digits = digits[2:]
        if len(digits) == 10 and digits.startswith("0"):
            digits = f"251{digits[1:]}"
        elif len(digits) == 9 and digits[0] in {"7", "9"}:
            digits = f"251{digits}"
        normalized_phone = digits or phone.casefold()
        if not normalized_phone:
            continue
        customer, _ = Customer.objects.using(database).get_or_create(
            normalized_phone=normalized_phone,
            defaults={
                "name": order.customer_name,
                "phone": phone,
                "email": order.customer_email,
            },
        )
        CustomerOrder.objects.using(database).filter(pk=order.pk).update(customer_id=customer.pk)


class Migration(migrations.Migration):
    dependencies = [
        ("seasonops", "0012_customer_cakeproduct_is_featured_and_more"),
    ]

    operations = [
        migrations.RunPython(backfill_order_customers, migrations.RunPython.noop),
    ]
