"""Access control, metering and CORS for the portable HTTP shell.

The service layer decides what an answer is. This module decides who may ask,
how often, and keeps the count an operator bills against. Standard library
only, and the counters live in this process: one host, one ledger. A deployment
that runs several replicas needs a shared store, and this module is the seam to
put one behind.

Configuration is environment-only, so a container can be handed a policy without
a config file:

``AGENDA_INTELLIGENCE_API_KEYS``
    ``client:secret`` pairs, comma separated. Unset means open mode, which is
    for local development and says so at startup and on ``/readyz``.
``AGENDA_INTELLIGENCE_REQUIRE_AUTH``
    ``1`` refuses to start without keys. Set it wherever the shell is reachable
    by anything but the developer who started it.
``AGENDA_INTELLIGENCE_RATE_LIMIT_PER_MINUTE``
    Requests per client per minute. Default 60. ``0`` disables the limit and is
    only accepted when it is written out in full.
``AGENDA_INTELLIGENCE_CORS_ORIGINS``
    Exact origins allowed to call from a browser, comma separated. Default none.
``AGENDA_INTELLIGENCE_ADMIN_KEY``
    Bearer secret for ``GET /usage``. Without one, the endpoint is off.

Misconfiguration fails closed: a policy that cannot be parsed raises at startup
rather than starting a server that quietly enforces nothing.
"""

from __future__ import annotations

import hmac
import os
import threading
import time
import uuid
from dataclasses import dataclass, field

DEFAULT_RATE_LIMIT_PER_MINUTE = 60
OPEN_CLIENT = "anonymous"

# Endpoints that must answer before a caller has credentials: an orchestrator
# has to be able to tell a starting container from a broken one.
PUBLIC_PATHS = frozenset({"/healthz", "/readyz"})


class PolicyError(ValueError):
    """Raised when the environment describes a policy that cannot be enforced."""


def _split(raw: str) -> list[str]:
    return [part.strip() for part in raw.split(",") if part.strip()]


@dataclass(frozen=True)
class AccessPolicy:
    """Who may call, how often, and from which browser origin."""

    keys: dict[str, str] = field(default_factory=dict)  # secret -> client name
    rate_limit_per_minute: int = DEFAULT_RATE_LIMIT_PER_MINUTE
    cors_origins: tuple[str, ...] = ()
    admin_key: str = ""

    @property
    def open_mode(self) -> bool:
        return not self.keys

    @classmethod
    def from_env(cls, env: dict[str, str] | None = None) -> AccessPolicy:
        source = os.environ if env is None else env

        keys: dict[str, str] = {}
        for pair in _split(source.get("AGENDA_INTELLIGENCE_API_KEYS", "")):
            name, sep, secret = pair.partition(":")
            if not sep or not name.strip() or not secret.strip():
                raise PolicyError(
                    "AGENDA_INTELLIGENCE_API_KEYS entries must be 'client:secret'; "
                    "one entry was not in that form (the value is not repeated here)"
                )
            if secret in keys:
                raise PolicyError("AGENDA_INTELLIGENCE_API_KEYS reuses one secret for two clients")
            keys[secret] = name.strip()

        require_auth = source.get("AGENDA_INTELLIGENCE_REQUIRE_AUTH", "").strip() in {"1", "true", "yes"}
        if require_auth and not keys:
            raise PolicyError("AGENDA_INTELLIGENCE_REQUIRE_AUTH is set but AGENDA_INTELLIGENCE_API_KEYS is empty")

        raw_limit = source.get("AGENDA_INTELLIGENCE_RATE_LIMIT_PER_MINUTE", "").strip()
        if raw_limit == "":
            limit = DEFAULT_RATE_LIMIT_PER_MINUTE
        else:
            try:
                limit = int(raw_limit)
            except ValueError as exc:
                raise PolicyError(
                    f"AGENDA_INTELLIGENCE_RATE_LIMIT_PER_MINUTE must be an integer, got {raw_limit!r}"
                ) from exc
            if limit < 0:
                raise PolicyError("AGENDA_INTELLIGENCE_RATE_LIMIT_PER_MINUTE must not be negative")

        origins = tuple(_split(source.get("AGENDA_INTELLIGENCE_CORS_ORIGINS", "")))
        for origin in origins:
            if origin == "*":
                raise PolicyError(
                    "AGENDA_INTELLIGENCE_CORS_ORIGINS does not accept '*'; name the origins that may call"
                )
            if not origin.startswith(("http://", "https://")):
                raise PolicyError(f"AGENDA_INTELLIGENCE_CORS_ORIGINS entries must be full origins, got {origin!r}")

        return cls(
            keys=keys,
            rate_limit_per_minute=limit,
            cors_origins=origins,
            admin_key=source.get("AGENDA_INTELLIGENCE_ADMIN_KEY", "").strip(),
        )

    def describe(self) -> dict:
        """Startup and readiness summary. Never includes a secret."""
        return {
            "auth": "open" if self.open_mode else "api-key",
            "clients": sorted(set(self.keys.values())),
            "rate_limit_per_minute": self.rate_limit_per_minute,
            "cors_origins": list(self.cors_origins),
            "usage_endpoint": bool(self.admin_key),
        }

    def client_for(self, authorization: str | None) -> str | None:
        """Return the client name for a bearer secret, or ``None`` when unknown."""
        if self.open_mode:
            return OPEN_CLIENT
        secret = bearer(authorization)
        if not secret:
            return None
        for known, name in self.keys.items():
            if hmac.compare_digest(known, secret):
                return name
        return None

    def is_admin(self, authorization: str | None) -> bool:
        secret = bearer(authorization)
        if not self.admin_key or not secret:
            return False
        return hmac.compare_digest(self.admin_key, secret)

    def cors_headers(self, origin: str | None) -> list[tuple[str, str]]:
        """Headers for an allowed origin. An origin that is not on the list gets none."""
        if not origin or origin not in self.cors_origins:
            return []
        return [
            ("access-control-allow-origin", origin),
            ("access-control-allow-methods", "GET, POST, OPTIONS"),
            ("access-control-allow-headers", "authorization, content-type, x-request-id"),
            ("access-control-max-age", "600"),
            ("vary", "origin"),
        ]


def bearer(authorization: str | None) -> str:
    """Extract a bearer secret from an Authorization header."""
    if not authorization:
        return ""
    scheme, _, value = authorization.strip().partition(" ")
    if scheme.lower() != "bearer":
        return ""
    return value.strip()


class RateLimiter:
    """Fixed-window counter per client.

    In-memory and therefore per process. It is deliberately not approximate: a
    caller that has spent its window is refused until the window turns, because
    a limit that lets a burst through is not a limit an operator can price.
    """

    def __init__(self, per_minute: int, clock=time.monotonic) -> None:
        self._per_minute = per_minute
        self._clock = clock
        self._lock = threading.Lock()
        self._windows: dict[str, tuple[int, int]] = {}  # client -> (window index, count)

    @property
    def enabled(self) -> bool:
        return self._per_minute > 0

    def check(self, client: str) -> tuple[bool, int, int]:
        """Consume one request. Returns ``(allowed, remaining, retry_after_seconds)``."""
        if not self.enabled:
            return True, -1, 0
        now = self._clock()
        window = int(now // 60)
        retry_after = int(60 - (now % 60)) or 1
        with self._lock:
            index, count = self._windows.get(client, (window, 0))
            if index != window:
                index, count = window, 0
            if count >= self._per_minute:
                self._windows[client] = (index, count)
                return False, 0, retry_after
            count += 1
            self._windows[client] = (index, count)
            return True, self._per_minute - count, retry_after


class UsageLedger:
    """Per-client, per-endpoint counts.

    This is what turns an integration into an invoice, so it counts refusals as
    well as answers: a partner arguing about a bill wants to see the 429s too.
    """

    def __init__(self, clock=time.time) -> None:
        self._clock = clock
        self._lock = threading.Lock()
        self._rows: dict[tuple[str, str], dict[str, float | int]] = {}
        self._started = clock()

    def record(self, client: str, path: str, status: int) -> None:
        with self._lock:
            row = self._rows.setdefault(
                (client, path),
                {"requests": 0, "ok": 0, "client_error": 0, "rate_limited": 0, "server_error": 0, "last_seen": 0.0},
            )
            row["requests"] = int(row["requests"]) + 1
            if status == 429:
                row["rate_limited"] = int(row["rate_limited"]) + 1
            elif status >= 500:
                row["server_error"] = int(row["server_error"]) + 1
            elif status >= 400:
                row["client_error"] = int(row["client_error"]) + 1
            else:
                row["ok"] = int(row["ok"]) + 1
            row["last_seen"] = self._clock()

    def snapshot(self) -> dict:
        with self._lock:
            rows = [
                {"client": client, "endpoint": path, **{k: v for k, v in counts.items()}}
                for (client, path), counts in sorted(self._rows.items())
            ]
        return {"since": self._started, "rows": rows}


def request_id(header_value: str | None) -> str:
    """Reuse a caller's request id when it is safe to echo, else mint one."""
    if header_value:
        candidate = header_value.strip()
        if 0 < len(candidate) <= 200 and all(ch.isalnum() or ch in "-_." for ch in candidate):
            return candidate
    return uuid.uuid4().hex
