"""Create the first owner account without hardcoding credentials."""

import os
import secrets

from django.core.management.base import BaseCommand, CommandError

from apps.accounts.models import Role, User


class Command(BaseCommand):
    help = "Create an owner account (or reset its password) for a fresh deployment."

    def add_arguments(self, parser):
        parser.add_argument("--email", default=os.environ.get("ADMIN_EMAIL"))
        parser.add_argument("--name", default=os.environ.get("ADMIN_NAME", "Owner"))
        parser.add_argument("--password", default=os.environ.get("ADMIN_PASSWORD"))

    def handle(self, *args, **options):
        email = options["email"]
        if not email:
            raise CommandError("Provide --email or set ADMIN_EMAIL.")
        password = options["password"]
        generated = False
        if not password:
            password = secrets.token_urlsafe(12)
            generated = True
        if len(password) < 8:
            raise CommandError("Password must be at least 8 characters.")

        user = User.objects.filter(email__iexact=email).first()
        if user:
            self.stdout.write(f"Owner account {email} already exists; password unchanged.")
            return

        user = User.objects.create_superuser(
            email=email,
            password=password,
            name=options["name"],
            role=Role.OWNER,
        )
        self.stdout.write(self.style.SUCCESS(f"Created owner account {user.email}."))
        if generated:
            self.stdout.write(self.style.WARNING(f"Generated password (shown once): {password}"))
