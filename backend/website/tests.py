from io import BytesIO
import tempfile

from django.utils import timezone
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from PIL import Image
from rest_framework.test import APIClient, APITestCase

from seasonops.models import AuditEvent, CakeProduct, CatalogCategory, Customer, CustomerOrder, Location, Recipe, User

from .models import CustomerInquiry, WebsiteBanner, WebsiteSettings


class PublicWebsiteApiTests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(username="website-owner", role=User.Role.OWNER)
        self.category = CatalogCategory.objects.create(
            kind=CatalogCategory.Kind.PRODUCT,
            name="Celebration cakes",
            is_published=True,
        )
        self.product = CakeProduct.objects.create(
            name="Vanilla Cake",
            web_id="vanilla-cake",
            category=self.category,
            unit_price="1250.00",
            is_published=True,
        )
        self.settings = WebsiteSettings.objects.create(
            is_published=True,
            hero_title="A cake for your table",
            menu_title="The cake table",
        )

    def test_public_payload_includes_only_published_menu_and_public_settings(self):
        CakeProduct.objects.create(
            name="Draft Cake",
            web_id="draft-cake",
            unit_price="900.00",
        )
        response = self.client.get("/api/v1/public/site/")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["cms_active"])
        self.assertEqual([item["id"] for item in response.data["products"]], ["vanilla-cake"])
        self.assertEqual(response.data["categories"], [
            {"id": self.category.pk, "name": "Celebration cakes", "sort_order": 0},
        ])
        self.assertEqual(response.data["settings"]["hero_title"], "A cake for your table")
        self.assertNotIn("updated_by", response.data["settings"])

    def test_public_order_links_customer_and_is_idempotent(self):
        payload = {
            "customerName": "Customer One",
            "phone": "+251 911 222 333",
            "email": "customer@example.com",
            "cakeId": "vanilla-cake",
            "size": "Medium",
            "quantity": 1,
            "fulfillment": "pickup",
            "requestedDate": timezone.localdate().isoformat(),
            "idempotencyKey": "website-order-key-1",
        }

        first = self.client.post("/orders", payload, format="json")
        retry = self.client.post("/orders", payload, format="json")

        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(retry.status_code, 201, retry.data)
        self.assertEqual(first.data["id"], retry.data["id"])
        self.assertEqual(Customer.objects.count(), 1)
        self.assertEqual(CustomerOrder.objects.count(), 1)
        order = CustomerOrder.objects.get()
        self.assertEqual(order.customer.normalized_phone, "251911222333")
        self.assertEqual(order.customer_name, "Customer One")
        self.assertEqual(order.customer_email, "customer@example.com")

    def test_public_order_rejects_unpublished_products_after_cms_activation(self):
        product = CakeProduct.objects.create(
            name="Unpublished Cake",
            web_id="unpublished-cake",
            unit_price="900.00",
        )
        response = self.client.post(
            "/orders",
            {
                "customerName": "Customer One",
                "phone": "0911222333",
                "cakeId": product.web_id,
                "size": "Medium",
                "quantity": 1,
                "fulfillment": "pickup",
                "requestedDate": timezone.localdate().isoformat(),
                "idempotencyKey": "website-order-key-2",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(CustomerOrder.objects.count(), 0)

    def test_local_and_international_ethiopian_phone_formats_reuse_customer(self):
        base_payload = {
            "customerName": "Customer One",
            "cakeId": self.product.web_id,
            "size": "Medium",
            "quantity": 1,
            "fulfillment": "pickup",
            "requestedDate": timezone.localdate().isoformat(),
        }
        self.client.post(
            "/orders",
            {**base_payload, "phone": "+251 911 222 333", "idempotencyKey": "customer-format-1"},
            format="json",
        )
        self.client.post(
            "/orders",
            {**base_payload, "phone": "0911-222-333", "idempotencyKey": "customer-format-2"},
            format="json",
        )

        self.assertEqual(Customer.objects.count(), 1)
        self.assertEqual(CustomerOrder.objects.count(), 2)

    def test_inquiry_submission_is_idempotent_and_audited(self):
        payload = {
            "name": "Customer Two",
            "email": "two@example.com",
            "subject": "Custom cake",
            "message": "Please contact me about a celebration cake.",
            "idempotencyKey": "website-inquiry-key-1",
        }

        first = self.client.post("/api/v1/public/inquiries/", payload, format="json")
        retry = self.client.post("/api/v1/public/inquiries/", payload, format="json")

        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(retry.status_code, 200, retry.data)
        self.assertEqual(CustomerInquiry.objects.count(), 1)
        self.assertTrue(AuditEvent.objects.filter(action="customer_inquiry_create").exists())

    def test_cms_api_requires_website_permission_and_previews_drafts(self):
        draft = CakeProduct.objects.create(
            name="Preview Cake",
            web_id="preview-cake",
            unit_price="800.00",
        )
        manager_location = Location.objects.create(name="Preview Kitchen", code="preview-kitchen")
        manager = User.objects.create_user(
            username="content-manager",
            role=User.Role.MANAGER,
            location=manager_location,
            business_permissions=["website_content"],
        )
        response = self.client.get("/api/v1/website/preview/")
        self.assertEqual(response.status_code, 403)

        self.client.force_authenticate(manager)
        response = self.client.get("/api/v1/website/preview/")

        self.assertEqual(response.status_code, 200)
        self.assertCountEqual(
            [item["id"] for item in response.data["products"]],
            ["vanilla-cake", draft.web_id],
        )

    def test_publishing_settings_requires_home_and_menu_titles(self):
        self.client.force_authenticate(self.owner)
        WebsiteSettings.objects.filter(pk=1).update(
            is_published=False,
            hero_title="",
            menu_title="",
        )

        response = self.client.patch("/api/v1/website/settings/", {"is_published": True}, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertFalse(WebsiteSettings.objects.get(pk=1).is_published)

    def test_unpublished_images_require_a_staff_permission(self):
        image_buffer = BytesIO()
        Image.new("RGB", (2, 2), "white").save(image_buffer, format="PNG")
        upload = SimpleUploadedFile("banner.png", image_buffer.getvalue(), content_type="image/png")

        with tempfile.TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=media_root):
                self.client.force_authenticate(self.owner)
                create_response = self.client.post(
                    "/api/v1/website/banners/",
                    {"title": "Draft banner", "image": upload},
                    format="multipart",
                )
                self.assertEqual(create_response.status_code, 201, create_response.data)
                banner = WebsiteBanner.objects.get(pk=create_response.data["id"])
                path = banner.image.name
                public_response = APIClient().get(f"/media/{path}")
                self.assertEqual(public_response.status_code, 404)

                preview_response = self.client.get(f"/media/{path}")
                self.assertEqual(preview_response.status_code, 200)
                preview_response.close()

                publish_response = self.client.patch(
                    f"/api/v1/website/banners/{banner.pk}/",
                    {"is_published": True},
                    format="json",
                )
                self.assertEqual(publish_response.status_code, 200, publish_response.data)
                public_response = APIClient().get(f"/media/{path}")
                self.assertEqual(public_response.status_code, 200)
                public_response.close()


class RecipeMetadataApiTests(APITestCase):
    def test_recipe_name_and_description_are_saved_in_a_version(self):
        owner = User.objects.create_user(username="recipe-owner", role=User.Role.OWNER)
        product = CakeProduct.objects.create(name="Named Cake")
        response = APIClient()
        response.force_authenticate(owner)

        ingredient_response = response.post(
            "/api/v1/ingredients/",
            {"name": "Flour", "unit": "kg", "reorder_level": "0"},
            format="json",
        )
        self.assertEqual(ingredient_response.status_code, 201, ingredient_response.data)
        recipe_response = response.post(
            "/api/v1/recipes/",
            {
                "product": product.pk,
                "name": "Vanilla sponge",
                "description": "Standard sponge recipe.",
                "ingredients": [
                    {
                        "ingredient": ingredient_response.data["id"],
                        "quantity": "1.250",
                        "unit": "kg",
                    },
                ],
            },
            format="json",
        )

        self.assertEqual(recipe_response.status_code, 201, recipe_response.data)
        recipe = Recipe.objects.get()
        self.assertEqual(recipe.name, "Vanilla sponge")
        self.assertEqual(recipe.description, "Standard sponge recipe.")
