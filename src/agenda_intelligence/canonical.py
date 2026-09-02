"""RFC 8785 (JCS) canonicalization and the decision-Gate hash binding.

The hosted Gate publishes ``canonicalization: "RFC8785-JCS"`` in
``decision_policies_list`` and [ADR 0025](../../docs/adr/0025-signed-readiness-receipts.md)
requires an enforcing caller to compute the expected hashes from its own copy of
the request rather than echoing the ones ``decision_check`` returned. Until this
module existed, a Python caller had nothing to compute them with:
``services._input_digest`` is ``json.dumps(sort_keys=True)``, which is a
different serialization and stamps a different field (``run_provenance``).

This module reproduces the Worker's ``jcs()``
(``deploy/cloudflare-worker/src/jws.js``) exactly, so a hash computed here and a
hash computed there agree on the same request. The parity is pinned by
``tests/test_jcs_canonicalization.py`` against fixtures generated from that JS
file.

Scope. This is a serialization, not a verifier: it says two parties agree on the
bytes of a request, not that the request is true, authorized, or safe.
"""

from __future__ import annotations

import hashlib
from decimal import Decimal
from typing import Any, Mapping, Sequence

__all__ = [
    "ACTION_IDENTITY_FIELDS",
    "action_identity",
    "canonicalize",
    "decision_request_hashes",
    "ecmascript_number_to_string",
    "sha256_jcs",
]

# The four fields the Worker binds into action_hash, in the order it reads them.
# Order is irrelevant to the digest — JCS sorts keys — but keeping the tuple in
# the Worker's order makes the two files readable side by side.
ACTION_IDENTITY_FIELDS = ("actor", "requested_action", "target", "risk_tier")

_STRING_ESCAPES = {
    '"': '\\"',
    "\\": "\\\\",
    "\b": "\\b",
    "\f": "\\f",
    "\n": "\\n",
    "\r": "\\r",
    "\t": "\\t",
}


def ecmascript_number_to_string(value: float) -> str:
    """Serialize a double the way ECMAScript ``Number::toString`` does.

    RFC 8785 defers number formatting to ECMAScript, so JSON numbers must be
    rendered as JavaScript renders them, not as Python does. Three cases where
    Python's ``json.dumps`` disagrees and would produce a different digest:

    ``9.0`` is ``9``, not ``9.0``; ``-0.0`` is ``0``, not ``-0.0``; and
    ``1e-7`` is ``1e-7``, not Python's zero-padded ``1e-07``.

    Implements ECMA-262 6.1.6.1.20 over the shortest round-tripping decimal
    digits, which is what ``repr`` already computes.
    """

    if value != value or value in (float("inf"), float("-inf")):
        raise ValueError("JCS forbids non-finite numbers")
    if value == 0:
        return "0"  # collapses -0.0, as JSON.stringify(-0) does

    sign = "-" if value < 0 else ""
    digits_tuple = Decimal(repr(abs(value))).as_tuple()
    digits = "".join(str(digit) for digit in digits_tuple.digits)
    digits = digits.rstrip("0") or "0"
    # n is the position of the decimal point: value = 0.<digits> * 10**n
    n = len(digits_tuple.digits) + int(digits_tuple.exponent)
    k = len(digits)

    if k <= n <= 21:
        return sign + digits + "0" * (n - k)
    if 0 < n <= 21:
        return sign + digits[:n] + "." + digits[n:]
    if -6 < n <= 0:
        return sign + "0." + "0" * (-n) + digits
    exponent = n - 1
    exponent_text = ("+" if exponent >= 0 else "-") + str(abs(exponent))
    mantissa = digits[0] if k == 1 else digits[0] + "." + digits[1:]
    return sign + mantissa + "e" + exponent_text


def _canonical_string(value: str) -> str:
    out = ['"']
    for character in value:
        escape = _STRING_ESCAPES.get(character)
        if escape is not None:
            out.append(escape)
        elif character < "\x20":
            out.append(f"\\u{ord(character):04x}")
        else:
            out.append(character)
    out.append('"')
    return "".join(out)


def _sort_key(key: str) -> bytes:
    """Order object keys by UTF-16 code unit, as RFC 8785 requires.

    Python orders strings by code point, which agrees with UTF-16 order for the
    BMP and disagrees above it: an astral key sorts after U+E000-U+FFFF here and
    before them in Python. Encoding to UTF-16BE and comparing bytes reproduces
    the JavaScript ordering the Worker gets from ``Array.prototype.sort``.
    """

    return key.encode("utf-16-be")


def canonicalize(value: Any) -> str:
    """Return the RFC 8785 canonical JSON text for ``value``.

    Numbers are treated as IEEE-754 doubles because that is what the Worker
    receives after parsing the request off the wire; a Python ``int`` is
    converted the same way JSON parsing would convert it.
    """

    if value is None:
        return "null"
    if value is True:
        return "true"
    if value is False:
        return "false"
    if isinstance(value, str):
        return _canonical_string(value)
    if isinstance(value, (int, float)):
        return ecmascript_number_to_string(float(value))
    if isinstance(value, Mapping):
        keys = sorted((str(key) for key in value), key=_sort_key)
        body = ",".join(f"{_canonical_string(key)}:{canonicalize(value[key])}" for key in keys)
        return "{" + body + "}"
    if isinstance(value, Sequence):
        return "[" + ",".join(canonicalize(item) for item in value) + "]"
    raise TypeError(f"JCS cannot serialize {type(value).__name__}")


def sha256_jcs(value: Any) -> str:
    """``sha256:<hex>`` over the canonical JSON text, as the Gate computes it."""

    return "sha256:" + hashlib.sha256(canonicalize(value).encode("utf-8")).hexdigest()


def action_identity(request: Mapping[str, Any]) -> dict[str, Any]:
    """The four-field action identity the receipt binds, as the Worker builds it.

    Missing fields are carried as ``null`` rather than dropped, because the
    Worker reads them off the object and JCS keeps a ``null`` value.
    """

    return {field: request.get(field) for field in ACTION_IDENTITY_FIELDS}


def decision_request_hashes(request: Mapping[str, Any]) -> dict[str, str]:
    """Compute ``request_hash`` and ``action_hash`` for a pre-action request.

    An enforcing caller passes these to ``decision_verify`` as
    ``expected_request_hash`` and ``expected_action_hash``. Computing them from
    its own copy of the request is the point: echoing the values that
    ``decision_check`` returned would bind the receipt to whatever it was told,
    not to the request it is about to act on.

    Both parties must also agree on Unicode normal form. JCS canonicalizes
    structure, not text, so a request whose strings arrive as NFD hashes
    differently from the same request in NFC and the Gate answers
    ``binding_mismatch``. Normalize before calling if the text can reach you by
    more than one route.
    """

    return {
        "request_hash": sha256_jcs(request),
        "action_hash": sha256_jcs(action_identity(request)),
    }
