"""Explicit Vizier review transport. No signing, broadcasting or verdict overrides."""

from __future__ import annotations

import base64
import hashlib
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

DEFAULT_REVIEW_ORIGIN = "https://vizier.vassiliy-lakhonin.workers.dev"
REVIEW_ID = re.compile(r"rev_[a-f0-9-]{36}\Z")


class HumanReviewError(ValueError):
    """No permission to execute follows from a failed or ambiguous review operation."""


def canonical_bytes(value: Any) -> bytes:
    """Match the service's sorted-key ECMAScript JSON for supported JSON values."""
    try:
        import rfc8785
    except ImportError as exc:
        raise HumanReviewError("Install agenda-intelligence-md[reviews] for review support") from exc
    try:
        return rfc8785.dumps(value)
    except (ValueError, TypeError) as exc:
        raise HumanReviewError("Review contains unsupported JSON or unsafe numbers") from exc


def normalize_request(request: dict[str, Any]) -> dict[str, Any]:
    result = {**request, "expires_in_seconds": request.get("expires_in_seconds", 1800)}
    if set(result) != {"audience", "action", "evidence", "escalation_reason", "expires_in_seconds"}:
        raise HumanReviewError("Unexpected or missing review fields")
    for name, limit in (("audience", 200), ("escalation_reason", 2000)):
        if not isinstance(result[name], str) or not 1 <= len(result[name]) <= limit:
            raise HumanReviewError("Invalid review text fields")
    ttl = result["expires_in_seconds"]
    if type(ttl) is not int or not 60 <= ttl <= 3600:
        raise HumanReviewError("Review lifetime must be 60–3600 seconds")
    if not isinstance(result["action"], dict) or not isinstance(result["evidence"], dict):
        raise HumanReviewError("Action and evidence must be JSON objects")
    raw = canonical_bytes(result)
    if len(raw) > 32768:
        raise HumanReviewError("Review exceeds 32 KiB; reduce attached public evidence")
    # Detach from caller mutations before hashing or sending.
    return dict(json.loads(raw))


def request_hash(request: dict[str, Any]) -> str:
    return hashlib.sha256(canonical_bytes(normalize_request(request))).hexdigest()


def _decode(value: str) -> bytes:
    if not re.fullmatch(r"[A-Za-z0-9_-]+", value):
        raise HumanReviewError("Malformed base64url")
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req: Any, fp: Any, code: int, msg: str, headers: Any, newurl: str) -> None:
        raise HumanReviewError("Review service redirects are forbidden")


class HumanReviewClient:
    """Integration-key client. Deliberately has no approval/decision method."""

    def __init__(self, api_key: str, origin: str = DEFAULT_REVIEW_ORIGIN, timeout: float = 10.0) -> None:
        parsed = urllib.parse.urlsplit(origin)
        if (
            parsed.scheme != "https"
            or not parsed.hostname
            or parsed.username
            or parsed.password
            or parsed.path not in ("", "/")
            or parsed.query
            or parsed.fragment
        ):
            raise HumanReviewError("Review origin must be a trusted HTTPS origin without a path or credentials")
        if not api_key.strip() or "\n" in api_key or "\r" in api_key or not 0 < timeout <= 30:
            raise HumanReviewError("Invalid integration credential or timeout")
        self.origin = origin.rstrip("/")
        self._api_key = api_key
        self.timeout = timeout
        self._opener = urllib.request.build_opener(_NoRedirect())

    def _json(self, path: str, body: Any = None, authenticated: bool = True) -> dict[str, Any]:
        headers = {"Content-Type": "application/json", "User-Agent": "agenda-intelligence-human-review/1.12.0"}
        if authenticated:
            headers["Authorization"] = f"Bearer {self._api_key}"
        req = urllib.request.Request(
            self.origin + path,
            data=None if body is None else canonical_bytes(body),
            headers=headers,
            method="GET" if body is None else "POST",
        )
        try:
            with self._opener.open(req, timeout=self.timeout) as response:
                raw = response.read(131073)
            if len(raw) > 131072:
                raise HumanReviewError("Review response exceeds size limit")
            result = json.loads(raw)
            if not isinstance(result, dict):
                raise HumanReviewError("Malformed review response")
            return result
        except (OSError, ValueError) as exc:
            raise HumanReviewError(
                "Review operation failed; do not execute or blindly retry a claim. Reconcile through get_review."
            ) from exc

    def submit(self, request: dict[str, Any]) -> dict[str, str]:
        normalized = normalize_request(request)
        expected = request_hash(normalized)
        result = self._json("/v1/reviews", normalized)
        if (
            not REVIEW_ID.fullmatch(str(result.get("id", "")))
            or result.get("request_hash") != expected
            or result.get("status") != "PENDING"
        ):
            raise HumanReviewError("Review response does not bind the submitted request")
        return {"id": result["id"], "request_hash": expected, "review_url": self.origin + "/reviews"}

    def get_review(self, review_id: str) -> dict[str, Any]:
        if not REVIEW_ID.fullmatch(review_id):
            raise HumanReviewError("Invalid review ID")
        return self._json("/v1/reviews/" + review_id)

    def verify(self, request: dict[str, Any], review_id: str, token: str) -> dict[str, Any]:
        """Verify signature and exact local request. Offline verification does not claim approval."""
        try:
            from cryptography.hazmat.primitives import hashes
            from cryptography.hazmat.primitives.asymmetric import ec, utils
        except ImportError as exc:
            raise HumanReviewError("Install agenda-intelligence-md[reviews] for review support") from exc
        normalized = normalize_request(request)
        try:
            if len(token) > 12000 or not REVIEW_ID.fullmatch(review_id):
                raise ValueError("Invalid attestation")
            encoded_header, encoded_payload, encoded_signature = token.split(".")
            header, payload = json.loads(_decode(encoded_header)), json.loads(_decode(encoded_payload))
            if set(header) != {"alg", "typ", "kid"} or header["alg"] != "ES256":
                raise ValueError("Unexpected signing algorithm or header")
            if header["typ"] != "VIZIER-HUMAN-REVIEW+JWS" or not isinstance(header["kid"], str):
                raise ValueError("Wrong token domain")
            fields = {"iss", "aud", "jti", "request_hash", "decision", "reviewer", "reason", "iat", "exp", "purpose"}
            if set(payload) != fields or canonical_bytes(payload) != _decode(encoded_payload):
                raise ValueError("Invalid payload encoding")
            now = int(time.time())
            if (
                payload["iss"] != self.origin
                or payload["aud"] != normalized["audience"]
                or payload["jti"] != review_id
                or payload["request_hash"] != request_hash(normalized)
                or payload["decision"] != "APPROVED"
                or payload["reviewer"] != "reviewer"
                or payload["purpose"] != "manual-action-review"
                or not isinstance(payload["reason"], str)
                or not payload["reason"].strip()
                or type(payload["iat"]) is not int
                or type(payload["exp"]) is not int
                or not payload["iat"] <= now < payload["exp"]
                or not 0 < payload["exp"] - payload["iat"] <= 300
            ):
                raise ValueError("Attestation bindings or expiry mismatch")
            jwks = self._json("/.well-known/jwks.json", authenticated=False)
            keys = [key for key in jwks["keys"] if key.get("kid") == header["kid"]]
            if len(keys) != 1:
                raise ValueError("Unknown or ambiguous signing key")
            key = keys[0]
            if any(key.get(k) != v for k, v in {"kty": "EC", "crv": "P-256", "alg": "ES256", "use": "sig"}.items()):
                raise ValueError("Invalid public key")
            x, y, signature = _decode(key["x"]), _decode(key["y"]), _decode(encoded_signature)
            if len(x) != 32 or len(y) != 32 or len(signature) != 64:
                raise ValueError("Invalid ES256 lengths")
            public = ec.EllipticCurvePublicNumbers(int.from_bytes(x, "big"), int.from_bytes(y, "big"), ec.SECP256R1())
            der = utils.encode_dss_signature(
                int.from_bytes(signature[:32], "big"), int.from_bytes(signature[32:], "big")
            )
            public.public_key().verify(
                der, (encoded_header + "." + encoded_payload).encode(), ec.ECDSA(hashes.SHA256())
            )
            return dict(payload)
        except Exception as exc:
            raise HumanReviewError("Attestation is invalid, expired or not bound to the intended request") from exc

    def claim(self, request: dict[str, Any], review_id: str, token: str) -> dict[str, Any]:
        normalized = normalize_request(request)
        claims = self.verify(normalized, review_id, token)
        result = self._json(
            f"/v1/reviews/{review_id}/consume",
            {"token": token, "request_hash": claims["request_hash"], "audience": normalized["audience"]},
        )
        expected = {
            "id": review_id,
            "request_hash": claims["request_hash"],
            "audience": normalized["audience"],
            "status": "CONSUMED",
            "execution": "not_performed",
        }
        if any(result.get(k) != v for k, v in expected.items()):
            raise HumanReviewError("Invalid claim response; reconcile before any manual execution")
        return {**expected, "action": normalized["action"], "human_review_required": True, "wallet_signature": None}
