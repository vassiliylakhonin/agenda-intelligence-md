from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_removed_fleet_artifacts_do_not_return():
    assert not (ROOT / "massive-fleet-catalog.json").exists()
    assert not (ROOT / "scripts" / "generate-massive-fleet.py").exists()


def test_pitch_material_does_not_present_synthetic_metrics_as_results():
    pitch_text = "\n".join(
        path.read_text(encoding="utf-8") for path in sorted((ROOT / "docs" / "pitch").glob("*.md"))
    ).lower()
    forbidden = (
        "measured impact",
        "customer roi:",
        "zero sanctions leakages",
        "100% elimination",
        "34% increase",
        "6.5x",
        "10 analysts ×",
        "gross margin model",
    )
    assert not [phrase for phrase in forbidden if phrase in pitch_text]
