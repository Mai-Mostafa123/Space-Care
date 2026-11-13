import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.models import Astronaut, AuditLog, HealthRecord, ProfileHistory, utc_now_iso
from app.schemas.schemas import AstronautCreate, AstronautOut, AstronautUpdate

router = APIRouter(prefix="/api/astronauts", tags=["Astronauts"])


@router.get("", response_model=list[AstronautOut])
def list_astronauts(db: Session = Depends(get_db)):
    return db.query(Astronaut).order_by(Astronaut.id.asc()).all()


@router.get("/{astronaut_id}")
def get_astronaut(astronaut_id: int, db: Session = Depends(get_db)):
    astro = db.query(Astronaut).filter(Astronaut.id == astronaut_id).first()
    if not astro:
        raise HTTPException(status_code=404, detail="Astronaut profile not found")
    history = (
        db.query(ProfileHistory)
        .filter(ProfileHistory.astronaut_id == astronaut_id)
        .order_by(ProfileHistory.changed_at.desc())
        .all()
    )
    latest_health = (
        db.query(HealthRecord)
        .filter(HealthRecord.astronaut_id == astronaut_id)
        .order_by(HealthRecord.recorded_at.desc())
        .limit(10)
        .all()
    )
    return {
        "profile": AstronautOut.model_validate(astro),
        "history": [
            {
                "id": h.id,
                "field_changed": h.field_changed,
                "previous_value": h.previous_value,
                "new_value": h.new_value,
                "change_source": h.change_source,
                "changed_at": h.changed_at,
            }
            for h in history
        ],
        "recent_health_count": len(latest_health),
    }


@router.post("", response_model=AstronautOut, status_code=status.HTTP_201_CREATED)
def create_astronaut(payload: AstronautCreate, db: Session = Depends(get_db)):
    existing = db.query(Astronaut).filter(Astronaut.call_sign == payload.call_sign).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Call sign {payload.call_sign} already exists")
    now = utc_now_iso()
    data = payload.model_dump(exclude={"change_source"})
    astro = Astronaut(**data, created_at=now, updated_at=now)
    db.add(astro)
    db.flush()
    db.add(
        ProfileHistory(
            astronaut_id=astro.id,
            field_changed="PROFILE_CREATED",
            previous_value="",
            new_value=payload.call_sign,
            change_source=payload.change_source,
            changed_at=now,
        )
    )
    db.add(
        AuditLog(
            event_type="PROFILE_CREATE",
            entity_type="ASTRONAUT",
            entity_id=str(astro.id),
            action="CREATE",
            details_json=json.dumps({"call_sign": payload.call_sign, "data_source": payload.data_source}),
        )
    )
    db.commit()
    db.refresh(astro)
    return astro


@router.put("/{astronaut_id}", response_model=AstronautOut)
def update_astronaut(astronaut_id: int, payload: AstronautUpdate, db: Session = Depends(get_db)):
    astro = db.query(Astronaut).filter(Astronaut.id == astronaut_id).first()
    if not astro:
        raise HTTPException(status_code=404, detail="Astronaut profile not found")

    now = utc_now_iso()
    updates = payload.model_dump(exclude_unset=True, exclude={"change_source"})
    for field, new_val in updates.items():
        old_val = getattr(astro, field)
        if str(old_val) != str(new_val):
            db.add(
                ProfileHistory(
                    astronaut_id=astro.id,
                    field_changed=field,
                    previous_value=str(old_val),
                    new_value=str(new_val),
                    change_source=payload.change_source,
                    changed_at=now,
                )
            )
            setattr(astro, field, new_val)

    astro.updated_at = now
    db.add(
        AuditLog(
            event_type="PROFILE_UPDATE",
            entity_type="ASTRONAUT",
            entity_id=str(astro.id),
            action="UPDATE",
            details_json=json.dumps(list(updates.keys())),
        )
    )
    db.commit()
    db.refresh(astro)
    return astro


@router.delete("/{astronaut_id}")
def delete_astronaut(astronaut_id: int, db: Session = Depends(get_db)):
    astro = db.query(Astronaut).filter(Astronaut.id == astronaut_id).first()
    if not astro:
        raise HTTPException(status_code=404, detail="Astronaut profile not found")
    call_sign = astro.call_sign
    db.delete(astro)
    db.add(
        AuditLog(
            event_type="PROFILE_DELETE",
            entity_type="ASTRONAUT",
            entity_id=str(astronaut_id),
            action="DELETE",
            details_json=json.dumps({"call_sign": call_sign}),
        )
    )
    db.commit()
    return {"deleted": True, "astronaut_id": astronaut_id, "call_sign": call_sign}
