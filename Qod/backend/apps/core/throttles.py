from rest_framework.throttling import SimpleRateThrottle


class PublicWriteThrottle(SimpleRateThrottle):
    scope = "public_write"

    def get_cache_key(self, request, view):
        return self.cache_format % {
            "scope": self.scope,
            "ident": self.get_ident(request),
        }
