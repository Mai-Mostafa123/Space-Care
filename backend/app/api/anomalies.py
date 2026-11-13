import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.models import AnomalyAlert, Astronaut, utc_now_iso
from app.schemas.schemas import AnomalyStatusUpdate
from ml.anomaly_detector import evaluate_synthetic_benchmark, run_anomaly_detection_for_astronaut

router = APIRouter(prefix="/api/anomalies", tags=["Anomalies & ML"])


@router.get("")
def list_anomalies(
    astronaut_id: Optional[int] = Query(default=None),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
):
    q = db.query(AnomalyAlert)
    if astronaut_id is not None:
        q = q.filter(AnomalyAlert.astronaut_id == astronaut_id)
    if status_filter and status_filter != "ALL":
        q = q.filter(AnomalyAlert.status == status_filter)
    rows = q.order_by(AnomalyAlert.detected_at.desc()).all()
    astro_map = {a.id: a.call_sign for a in db.query(Astronaut).all()}
    return [
        {
            "id": a.id,
            "astronaut_id": a.astronaut_id,
            "call_sign": astro_map.get(a.astronaut_id, f"ID-{a.astronaut_id}"),
            "detected_at": a.detected_at,
            "variables_involved": a.variables_involved,
            "observed_values": json.loads(a.observed_values_json),
            "baseline_reference": json.loads(a.baseline_reference_json),
            "deviation_description": a.deviation_description,
            "detection_method": a.detection_method,
            "anomaly_score": a.anomaly_score,
            "confidence_level": a.confidence_level,
            "severity_tier": a.severity_tier,
            "status": a.status,
            "data_source": a.data_source,
            "explanation": a.explanation,
            "uncertainty_statement": a.uncertainty_statement,
            "acknowledged_at": a.acknowledged_at,
        }
        for a in rows
    ]


@router.post("/detect/{astronaut_id}")
def detect_for_astronaut(astronaut_id: int, db: Session = Depends(get_db)):
    result = run_anomaly_detection_for_astronaut(db, astronaut_id, persist_alerts=True)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.post("/detect-all")
def detect_all_crew(db: Session = Depends(get_db)):
    astronauts = db.query(Astronaut).all()
    results = [run_anomaly_detection_for_astronaut(db, a.id, persist_alerts=True) for a in astronauts]
    return {"crew_scanned": len(results), "results": results}


@router.get("/evaluation")
def get_ml_benchmark_evaluation():
    return evaluate_synthetic_benchmark()


@router.patch("/{alert_id}")
def update_anomaly_status(alert_id: int, payload: AnomalyStatusUpdate, db: Session = Depends(get_db)):
    alert = db.query(AnomalyAlert).filter(AnomalyAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Anomaly alert not found")
    alert.status = payload.status
    if payload.status in ("ACKNOWLEDGED", "RESOLVED"):
        alert.acknowledged_at = utc_now_iso()
    else:
        alert.acknowledged_at = None
    db.commit()
    return {"id": alert.id, "status": alert.status, "acknowledged_at": alert.acknowledged_at}
