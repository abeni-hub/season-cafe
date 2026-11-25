from io import StringIO

import pytest
from django.core.management import call_command
from rest_framework.test import APIClient

PASSWORD = "test-pass-123"


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def seeded(db):
    call_command("seed", password=PASSWORD, stdout=StringIO())
    return True


@pytest.fixture
def login(api):
    def _login(email, password=PASSWORD):
        response = api.post(
            "/api/v1/auth/login/",
            {"email": email, "password": password},
            format="json",
        )
        assert response.status_code == 200, response.content
        api.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
        return response.data

    return _login
