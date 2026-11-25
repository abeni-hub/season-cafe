import re

from django.db import transaction

from apps.audit.services import log_activity
from apps.core.errors import DomainError
from apps.core.models import BusinessSettings
from apps.core.services import require_non_empty
from .models import Message, SiteContent

SITE_FIELDS = {
    "heroEyebrow": "hero_eyebrow",
    "heroTitle": "hero_title",
    "heroLead": "hero_lead",
    "aboutTitle": "about_title",
    "aboutLead": "about_lead",
    "aboutBody": "about_body",
    "customOrderNote": "custom_order_note",
    "contactPhone": "contact_phone",
    "contactEmail": "contact_email",
    "contactAddress": "contact_address",
    "openingHours": "opening_hours",
}


def update_site_content(*, patch: dict, actor) -> SiteContent:
    content = SiteContent.load()
    if "heroTitle" in patch:
        content.hero_title = require_non_empty(patch["heroTitle"], "The hero title cannot be empty.")
    for key, field in SITE_FIELDS.items():
        if key in patch and key != "heroTitle":
            setattr(content, field, (patch[key] or "").strip())
    if "galleryCaptions" in patch:
        captions = patch["galleryCaptions"]
        if not isinstance(captions, list) or len(captions) != 6:
            raise DomainError("Gallery caption count is fixed.")
        content.gallery_captions = [str(caption).strip() for caption in captions]
    content.save()
    log_activity("Website content updated.", actor=actor)
    return content


def update_settings(*, patch: dict, actor) -> BusinessSettings:
    settings = BusinessSettings.load()
    if "businessName" in patch:
        settings.business_name = require_non_empty(patch["businessName"], "Business name is required.")
    if "tagline" in patch:
        settings.tagline = require_non_empty(patch["tagline"], "Tagline is required.")
    if "currency" in patch:
        currency = (patch["currency"] or "").strip()
        if not re.fullmatch(r"[A-Z]{3}", currency):
            raise DomainError("Currency must be a 3-letter ISO code.")
        settings.currency = currency
    settings.save()
    log_activity("Business settings updated.", actor=actor)
    return settings


def submit_message(*, name, subject, body, email="", phone="") -> Message:
    clean_name = require_non_empty(name, "Please include your name.")
    clean_subject = require_non_empty(subject, "Please include a subject.")
    clean_body = require_non_empty(body, "Please include a message.")
    email = (email or "").strip()
    phone = (phone or "").strip()
    if not email and not phone:
        raise DomainError("Please include an email address or phone number.")
    with transaction.atomic():
        message = Message.objects.create(
            name=clean_name,
            subject=clean_subject,
            body=clean_body,
            email=email,
            phone=phone,
        )
        log_activity(
            f"Website message received from {clean_name}.", actor="Website"
        )
    return message


def mark_message_read(*, message_id, actor) -> Message:
    message = Message.objects.filter(pk=message_id).first()
    if message is None:
        raise DomainError("Message not found.")
    if not message.is_read:
        message.is_read = True
        message.save(update_fields=["is_read"])
    return message
