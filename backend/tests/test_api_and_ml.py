import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.main import app
from ml.anomaly_detector import evaluate_synthetic_benchmark
from voice.voice_processor import extract_structured_from_transcript


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_system_status_and_seed(client: TestClient):
    resp = client.get("/api/system/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["database_connected"] is True
    assert data["counts"]["astronauts"] >= 3
    assert data["counts"]["datasets"] >= 7


def test_astronaut_crud_and_history(client: TestClient):
    create_resp = client.post(
        "/api/astronauts",
        json={
            "call_sign": "TST-99",
            "full_name": "Test Operator",
            "role": "Payload Specialist",
            "mission_name": "ARTEMIS-SIM-04",
            "mission_day": 5,
            "mission_duration_days": 90,
            "data_source": "MANUAL",
        },
    )
    assert create_resp.status_code == 201
    created = create_resp.json()
    aid = created["id"]
    assert created["data_source"] == "MANUAL"

    upd_resp = client.put(f"/api/astronauts/{aid}", json={"mission_day": 6, "role": "Flight Engineer"})
    assert upd_resp.status_code == 200
    assert upd_resp.json()["mission_day"] == 6

    det_resp = client.get(f"/api/astronauts/{aid}")
    assert det_resp.status_code == 200
    assert len(det_resp.json()["history"]) >= 2

    del_resp = client.delete(f"/api/astronauts/{aid}")
    assert del_resp.status_code == 200
    assert del_resp.json()["deleted"] is True


def test_health_validation_and_imputation(client: TestClient):
    bad = client.post("/api/health", json={"astronaut_id": 1, "heart_rate_bpm": 500})
    assert bad.status_code == 422

    ok = client.post(
        "/api/health",
        json={
            "astronaut_id": 1,
            "heart_rate_bpm": 64.0,
            "data_source": "MANUAL",
            "mood_notes": "Pytest manual check",
        },
    )
    assert ok.status_code == 201
    assert ok.json()["data_source"] == "MANUAL"


def test_ml_benchmark_evaluation():
    metrics = evaluate_synthetic_benchmark()
    assert "SYNTHETIC_BENCHMARK" in metrics["evaluation_scope"]
    assert metrics["total_samples"] == 54
    assert metrics["f1_score"] >= 0.6


def test_voice_structured_extraction():
    res = extract_structured_from_transcript(
        "Heart rate is 74, SpO2 98, slept 7.5 hours, stress level 3, mood 8.",
        target_mode="health_log",
        astronaut_id=1,
    )
    assert res["requires_confirmation"] is True
    assert res["validation_passed"] is True
    assert res["extracted_fields"]["heart_rate_bpm"] == 74.0
    assert res["extracted_fields"]["spo2_pct"] == 98.0


def test_rag_assistant_grounding_and_citations(client: TestClient):
    resp = client.post(
        "/api/assistant/query",
        json={"question": "How does space radiation affect astronauts?", "astronaut_id": 1},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["citations"]) >= 1
    assert "Decision-support only" in body["uncertainty_note"]
