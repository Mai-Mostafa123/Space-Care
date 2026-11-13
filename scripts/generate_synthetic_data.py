"""
Deterministic Synthetic 30-Day Astronaut & Habitat Benchmark Generator
Dataset ID: AEGIS-SYNTH-30D
Classification: SIMULATED (all records explicitly tagged SYNTHETIC)

Generates scientifically plausible synthetic time-series data for 3 fictional
crew members over 30 mission days, with explicitly labeled synthetic anomalies
for ML baseline training and benchmark evaluation (Precision, Recall, F1, FPR).

NEVER represents real astronauts or official NASA flight measurements.
"""

import csv
import json
import math
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

SEED = 42
START_DATE = datetime(2026, 10, 14, 8, 0, 0, tzinfo=timezone.utc)

SYNTHETIC_CREW = [
    {
        "call_sign": "CDR-01",
        "full_name": "Elena Vance (Synthetic)",
        "role": "Mission Commander",
        "mission_name": "ARTEMIS-SIM-04",
        "age_group": "40-44",
        "blood_type": "O+",
        "mission_day": 30,
        "mission_duration_days": 180,
        "avatar_url": "/src/assets/images/crew_avatar_commander_1794596745666.jpg",
        "notes": "SYNTHETIC BENCHMARK PROFILE. Baseline resting HR ~61 bpm, high resistive exercise adherence.",
        "data_source": "SYNTHETIC",
        "baseline": {"hr": 61.0, "spo2": 98.4, "sleep": 7.2, "stress": 2.8, "mood": 7.9, "activity": 110},
    },
    {
        "call_sign": "BMS-02",
        "full_name": "Dr. Aris Thorne (Synthetic)",
        "role": "Biomedical Specialist",
        "mission_name": "ARTEMIS-SIM-04",
        "age_group": "35-39",
        "blood_type": "A-",
        "mission_day": 30,
        "mission_duration_days": 180,
        "avatar_url": "/src/assets/images/crew_avatar_specialist_1794596748852.jpg",
        "notes": "SYNTHETIC BENCHMARK PROFILE. Baseline resting HR ~66 bpm; includes labeled synthetic sleep-CO2 drift days 24-26.",
        "data_source": "SYNTHETIC",
        "baseline": {"hr": 66.0, "spo2": 97.9, "sleep": 6.9, "stress": 3.2, "mood": 7.6, "activity": 95},
    },
    {
        "call_sign": "ENG-03",
        "full_name": "Marcus Chen (Synthetic)",
        "role": "ECLSS Systems Engineer",
        "mission_name": "ARTEMIS-SIM-04",
        "age_group": "30-34",
        "blood_type": "B+",
        "mission_day": 30,
        "mission_duration_days": 180,
        "avatar_url": "",
        "notes": "SYNTHETIC BENCHMARK PROFILE. Baseline resting HR ~58 bpm; includes labeled synthetic EVA workload spike day 14.",
        "data_source": "SYNTHETIC",
        "baseline": {"hr": 58.0, "spo2": 98.7, "sleep": 7.5, "stress": 2.5, "mood": 8.1, "activity": 120},
    },
]


def generate_benchmark():
    rng = random.Random(SEED)
    health_records = []
    environmental_records = []

    for day in range(30):
        ts = (START_DATE + timedelta(days=day)).isoformat()

        # Habitat environmental baseline + synthetic perturbations
        spe_spike = 1.0 if day in (18, 19) else 0.0  # Labeled synthetic SPE radiation window
        co2_drift = 1.0 if day in (23, 24, 25) else 0.0  # Labeled synthetic scrubber CO2 rise

        radiation = round(0.62 + rng.gauss(0, 0.04) + (2.45 if spe_spike else 0.0), 3)
        co2_ppm = round(2150 + rng.gauss(0, 90) + (2650 if co2_drift else 0.0), 1)
        oxygen_pct = round(20.9 + rng.gauss(0, 0.12) - (0.35 if co2_drift else 0.0), 2)
        temp_c = round(22.1 + rng.gauss(0, 0.35) + (1.4 if co2_drift else 0.0), 2)
        humidity_pct = round(44.5 + rng.gauss(0, 1.8) + (8.0 if co2_drift else 0.0), 1)
        pressure_kpa = round(101.3 + rng.gauss(0, 0.15), 2)

        env_anomaly = bool(spe_spike or co2_drift)
        environmental_records.append(
            {
                "mission_name": "ARTEMIS-SIM-04",
                "habitat_zone": "Crew Quarters & Medical Bay",
                "recorded_at": ts,
                "radiation_msv_day": radiation,
                "cabin_co2_ppm": co2_ppm,
                "oxygen_pct": oxygen_pct,
                "temperature_c": temp_c,
                "humidity_pct": humidity_pct,
                "pressure_kpa": pressure_kpa,
                "data_source": "SYNTHETIC",
                "synthetic_ground_truth_anomaly": env_anomaly,
                "anomaly_label_reason": (
                    "Injected synthetic SPE radiation excursion"
                    if spe_spike
                    else ("Injected synthetic ECLSS CO2 scrubber rise" if co2_drift else "Nominal synthetic baseline")
                ),
            }
        )

        for crew in SYNTHETIC_CREW:
            b = crew["baseline"]
            call_sign = crew["call_sign"]

            # Individual circadian wave + realistic noise
            wave = math.sin(day * 0.45) * 1.1
            hr = b["hr"] + wave + rng.gauss(0, 1.6)
            spo2 = b["spo2"] + rng.gauss(0, 0.25)
            sleep = b["sleep"] + rng.gauss(0, 0.35)
            stress = b["stress"] + rng.gauss(0, 0.4)
            mood = b["mood"] + rng.gauss(0, 0.35)
            activity = int(max(30, b["activity"] + rng.gauss(0, 12)))
            exercise_type = ["ARED Resistive", "Treadmill T2", "Cycle Ergometer"][day % 3]

            gt_anomaly = False
            gt_reason = "Nominal synthetic personal baseline"

            # Labeled synthetic anomaly 1: BMS-02 sleep restriction + HR elevation during CO2 drift (days 24-26)
            if call_sign == "BMS-02" and day in (23, 24, 25):
                hr += 14.5
                spo2 -= 1.8
                sleep -= 2.1
                stress += 3.6
                mood -= 2.3
                gt_anomaly = True
                gt_reason = "Synthetic multi-variable sleep restriction, elevated resting HR, and cabin CO2 co-drift"

            # Labeled synthetic anomaly 2: CDR-01 acute cardiovascular strain & stress spike (day 27-28)
            if call_sign == "CDR-01" and day in (26, 27):
                hr += 15.0
                spo2 -= 1.3
                sleep -= 1.6
                stress += 3.2
                mood -= 1.7
                gt_anomaly = True
                gt_reason = "Synthetic personal baseline resting HR elevation and sleep fragmentation"

            # Labeled synthetic anomaly 3: ENG-03 post-EVA workload + dehydration proxy spike (day 14)
            if call_sign == "ENG-03" and day == 13:
                hr += 16.5
                spo2 -= 1.1
                activity += 75
                exercise_type = "Simulated EVA Maintenance"
                stress += 2.9
                gt_anomaly = True
                gt_reason = "Synthetic high-exertion EVA workload and elevated resting HR"

            hr = round(max(45.0, min(145.0, hr)), 1)
            spo2 = round(max(91.0, min(100.0, spo2)), 1)
            sleep = round(max(3.2, min(10.0, sleep)), 2)
            deep_sleep = round(sleep * (0.21 + rng.uniform(-0.02, 0.02)), 2)
            rem_sleep = round(sleep * (0.23 + rng.uniform(-0.02, 0.02)), 2)
            sleep_quality = round(max(35.0, min(98.0, 58.0 + sleep * 4.4 - stress * 2.1)), 1)
            stress = round(max(1.0, min(10.0, stress)), 1)
            mood = round(max(1.0, min(10.0, mood)), 1)

            health_records.append(
                {
                    "call_sign": call_sign,
                    "recorded_at": ts,
                    "heart_rate_bpm": hr,
                    "spo2_pct": spo2,
                    "sleep_duration_hrs": sleep,
                    "sleep_quality_score": sleep_quality,
                    "deep_sleep_hrs": deep_sleep,
                    "rem_sleep_hrs": rem_sleep,
                    "activity_minutes": activity,
                    "exercise_type": exercise_type,
                    "stress_score": stress,
                    "mood_score": mood,
                    "mood_notes": gt_reason,
                    "data_source": "SYNTHETIC",
                    "synthetic_ground_truth_anomaly": gt_anomaly,
                }
            )

    return {
        "dataset_identifier": "AEGIS-SYNTH-30D",
        "data_source": "SYNTHETIC",
        "disclaimer": "SYNTHETIC BENCHMARK DATA ONLY. Not real astronaut records.",
        "astronauts": [
            {k: v for k, v in c.items() if k != "baseline"} for c in SYNTHETIC_CREW
        ],
        "health_records": health_records,
        "environmental_records": environmental_records,
    }


def main():
    out_dir = Path(__file__).resolve().parent.parent / "data" / "synthetic"
    out_dir.mkdir(parents=True, exist_ok=True)
    payload = generate_benchmark()

    json_path = out_dir / "synthetic_benchmark_30d.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    csv_path = out_dir / "synthetic_health_30d.csv"
    fieldnames = list(payload["health_records"][0].keys())
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(payload["health_records"])

    print(
        f"Generated {len(payload['health_records'])} SYNTHETIC health records and "
        f"{len(payload['environmental_records'])} SYNTHETIC environmental records at {json_path}"
    )


if __name__ == "__main__":
    main()
