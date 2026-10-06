"""Published offline adapters must work without networking or fabricated execution."""

import contextlib
import io
import runpy
from pathlib import Path
from unittest.mock import patch

import pytest


@pytest.mark.parametrize("name", ["coinbase-agentkit-guard", "crewai-b2b-deal", "langgraph-escrow-arbitration"])
def test_offline_adapter_examples(name):
    path = Path(__file__).resolve().parents[1] / "examples" / name / "run.py"
    with patch(
        "urllib.request.urlopen", side_effect=AssertionError("Offline examples must not contact Workers")
    ) as remote:
        with contextlib.redirect_stdout(io.StringIO()) as output:
            runpy.run_path(str(path), run_name="__main__")
        remote.assert_not_called()
    assert "Offline" in output.getvalue()


def test_offline_virtuals_module_runs_and_requires_review():
    with patch(
        "urllib.request.urlopen", side_effect=AssertionError("Offline adapter must not contact Workers")
    ) as remote:
        with contextlib.redirect_stdout(io.StringIO()) as output:
            runpy.run_path(
                str(Path(__file__).resolve().parents[1] / "integrations/virtuals/agenda_virtuals_adapter.py"),
                run_name="__main__",
            )
        remote.assert_not_called()
    assert "no signing or settlement is authorized" in output.getvalue()
