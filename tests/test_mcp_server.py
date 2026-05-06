from agenda_intelligence.mcp_server import (
    get_lens,
    get_protocol,
    list_lenses,
    source_plan,
)


def test_get_protocol_entrypoint_returns_markdown():
    result = get_protocol("entrypoint")

    assert result["implemented"] is True
    assert result["error"] is None
    assert result["path"] == "Agenda-Intelligence.md"
    assert "Do not summarize public agenda by default" in result["protocol"]


def test_list_lenses_can_filter_by_type():
    result = list_lenses("regional")

    assert result["implemented"] is True
    assert result["error"] is None
    assert set(result["lenses"]) == {"regional"}
    assert "eu" in result["lenses"]["regional"]


def test_get_lens_returns_packaged_markdown():
    result = get_lens("regional", "eu")

    assert result["implemented"] is True
    assert result["error"] is None
    assert result["path"].endswith("regional/eu.md")
    assert "European Union" in result["lens"]


def test_source_plan_returns_packaged_requirements():
    result = source_plan("technology-ai")

    assert result["implemented"] is True
    assert result["error"] is None
    assert result["plan"]["category"] == "technology-ai"
    assert "must_check" in result["plan"]


def test_source_plan_unknown_category_returns_error():
    result = source_plan("unknown")

    assert result["implemented"] is True
    assert result["plan"] is None
    assert "Unknown source category" in result["error"]
