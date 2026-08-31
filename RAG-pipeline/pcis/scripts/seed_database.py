"""
Database Seed Script — generates and inserts realistic synthetic data.

Generates:
- 7 roles (static)
- 20 police stations
- 200 officers + 50 admin users = 250 users
- ~3,000 persons
- 5,000 cases
- ~12,000 case_persons
- ~10,000 case_documents
- ~8,000 evidence records
- ~15,000 case_notes
- ~40,000 activities

Run with: python -m scripts.seed_database
"""

import asyncio
import random
import uuid
import hashlib
from datetime import datetime, timedelta
from passlib.context import CryptContext

from src.config.database import DatabaseManager, get_db
from src.config.logging_config import setup_logging

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ── Static Data ──────────────────────────────────────────────────────────

STATES = ["Maharashtra", "Delhi", "Karnataka", "Tamil Nadu", "Uttar Pradesh",
          "Gujarat", "Rajasthan", "West Bengal", "Madhya Pradesh", "Kerala"]

DISTRICTS = {
    "Maharashtra": ["Mumbai", "Pune", "Nagpur", "Thane"],
    "Delhi": ["Central Delhi", "South Delhi", "North Delhi", "East Delhi"],
    "Karnataka": ["Bangalore Urban", "Mysore"],
    "Tamil Nadu": ["Chennai", "Coimbatore"],
    "Uttar Pradesh": ["Lucknow", "Noida"],
    "Gujarat": ["Ahmedabad", "Surat"],
    "Rajasthan": ["Jaipur", "Jodhpur"],
    "West Bengal": ["Kolkata"],
    "Madhya Pradesh": ["Bhopal"],
    "Kerala": ["Thiruvananthapuram"],
}

CRIME_TYPES = [
    "MISSING_PERSON", "KIDNAPPING", "THEFT", "ROBBERY", "CYBER_CRIME",
    "FRAUD", "MURDER", "ASSAULT", "ACCIDENT", "DOMESTIC_VIOLENCE",
    "DRUG_OFFENSE", "OTHER",
]

CRIME_WEIGHTS = [8, 5, 20, 10, 12, 10, 3, 8, 10, 6, 5, 3]

PRIORITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
PRIORITY_WEIGHTS = [5, 15, 50, 30]

STATUSES = [
    "REGISTERED", "UNDER_INVESTIGATION", "CHARGE_SHEET_FILED",
    "COURT_PROCEEDINGS", "CLOSED_SOLVED", "CLOSED_UNSOLVED",
]
STATUS_WEIGHTS = [10, 30, 10, 10, 25, 15]

RANKS = ["INSPECTOR", "SUB_INSPECTOR", "ASI", "HEAD_CONSTABLE", "CONSTABLE"]
RANK_WEIGHTS = [10, 20, 15, 25, 30]

FIRST_NAMES_M = ["Rajesh", "Suresh", "Amit", "Vikram", "Deepak", "Anil", "Ravi",
                  "Sanjay", "Manish", "Rahul", "Nikhil", "Ajay", "Pradeep", "Vinod",
                  "Mukesh", "Ashok", "Dinesh", "Ramesh", "Sunil", "Manoj"]

FIRST_NAMES_F = ["Priya", "Sunita", "Anita", "Kavita", "Neha", "Pooja", "Rekha",
                  "Suman", "Meena", "Geeta", "Asha", "Lata", "Shanti", "Manju",
                  "Kamala", "Savita", "Nisha", "Seema", "Renu", "Uma"]

LAST_NAMES = ["Kumar", "Singh", "Sharma", "Verma", "Gupta", "Joshi", "Patel",
              "Reddy", "Nair", "Iyer", "Mishra", "Tiwari", "Yadav", "Chauhan",
              "Malik", "Das", "Rao", "Pillai", "Menon", "Patil"]

OCCUPATIONS = ["Farmer", "Teacher", "Student", "Driver", "Shopkeeper",
               "Engineer", "Doctor", "Laborer", "Businessman", "Homemaker",
               "Clerk", "Vendor", "Mechanic", "Electrician", "Unemployed"]

EVIDENCE_TYPES = ["PHYSICAL", "DIGITAL", "DOCUMENTARY", "BIOLOGICAL", "FORENSIC"]
DOC_TYPES = ["FIR", "WITNESS_STATEMENT", "MEDICAL_REPORT", "INVESTIGATION_REPORT",
             "CHARGE_SHEET", "CLOSURE_REPORT"]
NOTE_TYPES = ["OBSERVATION", "LEAD", "INTERVIEW_SUMMARY", "FOLLOW_UP", "PROGRESS_UPDATE"]

ROLES_DATA = [
    {"role_name": "ADMINISTRATOR", "display_name": "Administrator", "hierarchy_level": 1,
     "permissions": {"cases": {"create": True, "read": True, "update": True, "delete": True, "assign": True},
                     "persons": {"create": True, "read": True, "update": True, "delete": True},
                     "evidence": {"create": True, "read": True, "update": True, "delete": True},
                     "documents": {"create": True, "read": True, "update": True, "delete": True},
                     "case_notes": {"create": True, "read": True, "update": True, "delete": True},
                     "officers": {"create": True, "read": True, "update": True, "delete": True},
                     "stations": {"create": True, "read": True, "update": True, "delete": True},
                     "users": {"create": True, "read": True, "update": True, "delete": True},
                     "reports": {"generate": True, "export": True},
                     "sensitive_cases": {"read": True, "update": True}}},
    {"role_name": "INSPECTOR", "display_name": "Inspector", "hierarchy_level": 3,
     "permissions": {"cases": {"create": True, "read": True, "update": True, "delete": False, "assign": True},
                     "persons": {"create": True, "read": True, "update": True, "delete": False},
                     "evidence": {"create": True, "read": True, "update": True, "delete": False},
                     "documents": {"create": True, "read": True, "update": True, "delete": False},
                     "case_notes": {"create": True, "read": True, "update": True, "delete": False},
                     "officers": {"create": False, "read": True, "update": False, "delete": False},
                     "stations": {"create": False, "read": True, "update": False, "delete": False},
                     "users": {"create": False, "read": False, "update": False, "delete": False},
                     "reports": {"generate": True, "export": True},
                     "sensitive_cases": {"read": True, "update": False}}},
    {"role_name": "SUB_INSPECTOR", "display_name": "Sub Inspector", "hierarchy_level": 4,
     "permissions": {"cases": {"create": True, "read": True, "update": True, "delete": False, "assign": False},
                     "persons": {"create": True, "read": True, "update": True, "delete": False},
                     "evidence": {"create": True, "read": True, "update": True, "delete": False},
                     "documents": {"create": True, "read": True, "update": True, "delete": False},
                     "case_notes": {"create": True, "read": True, "update": True, "delete": False},
                     "officers": {"create": False, "read": True, "update": False, "delete": False},
                     "stations": {"create": False, "read": True, "update": False, "delete": False},
                     "users": {"create": False, "read": False, "update": False, "delete": False},
                     "reports": {"generate": True, "export": False},
                     "sensitive_cases": {"read": False, "update": False}}},
    {"role_name": "CONSTABLE", "display_name": "Constable", "hierarchy_level": 6,
     "permissions": {"cases": {"create": False, "read": True, "update": False, "delete": False, "assign": False},
                     "persons": {"create": False, "read": True, "update": False, "delete": False},
                     "evidence": {"create": True, "read": True, "update": False, "delete": False},
                     "documents": {"create": False, "read": True, "update": False, "delete": False},
                     "case_notes": {"create": True, "read": True, "update": False, "delete": False},
                     "officers": {"create": False, "read": True, "update": False, "delete": False},
                     "stations": {"create": False, "read": True, "update": False, "delete": False},
                     "users": {"create": False, "read": False, "update": False, "delete": False},
                     "reports": {"generate": False, "export": False},
                     "sensitive_cases": {"read": False, "update": False}}},
    {"role_name": "DATA_ENTRY_OPERATOR", "display_name": "Data Entry Operator", "hierarchy_level": 7,
     "permissions": {"cases": {"create": True, "read": True, "update": True, "delete": False, "assign": False},
                     "persons": {"create": True, "read": True, "update": True, "delete": False},
                     "evidence": {"create": True, "read": True, "update": False, "delete": False},
                     "documents": {"create": True, "read": True, "update": True, "delete": False},
                     "case_notes": {"create": False, "read": True, "update": False, "delete": False},
                     "officers": {"create": False, "read": True, "update": False, "delete": False},
                     "stations": {"create": False, "read": True, "update": False, "delete": False},
                     "users": {"create": False, "read": False, "update": False, "delete": False},
                     "reports": {"generate": False, "export": False},
                     "sensitive_cases": {"read": False, "update": False}}},
    {"role_name": "ANALYST", "display_name": "Analyst", "hierarchy_level": 5,
     "permissions": {"cases": {"create": False, "read": True, "update": False, "delete": False, "assign": False},
                     "persons": {"create": False, "read": True, "update": False, "delete": False},
                     "evidence": {"create": False, "read": True, "update": False, "delete": False},
                     "documents": {"create": False, "read": True, "update": False, "delete": False},
                     "case_notes": {"create": False, "read": True, "update": False, "delete": False},
                     "officers": {"create": False, "read": True, "update": False, "delete": False},
                     "stations": {"create": False, "read": True, "update": False, "delete": False},
                     "users": {"create": False, "read": False, "update": False, "delete": False},
                     "reports": {"generate": True, "export": True},
                     "sensitive_cases": {"read": False, "update": False}}},
    {"role_name": "VIEWER", "display_name": "Viewer", "hierarchy_level": 8,
     "permissions": {"cases": {"create": False, "read": True, "update": False, "delete": False, "assign": False},
                     "persons": {"create": False, "read": True, "update": False, "delete": False},
                     "evidence": {"create": False, "read": True, "update": False, "delete": False},
                     "documents": {"create": False, "read": True, "update": False, "delete": False},
                     "case_notes": {"create": False, "read": True, "update": False, "delete": False},
                     "officers": {"create": False, "read": True, "update": False, "delete": False},
                     "stations": {"create": False, "read": True, "update": False, "delete": False},
                     "users": {"create": False, "read": False, "update": False, "delete": False},
                     "reports": {"generate": False, "export": False},
                     "sensitive_cases": {"read": False, "update": False}}},
]


def _uid() -> str:
    return str(uuid.uuid4())


def _random_date(start_year: int = 2020, end_year: int = 2025) -> datetime:
    start = datetime(start_year, 1, 1)
    end = datetime(end_year, 12, 31)
    delta = end - start
    return start + timedelta(days=random.randint(0, delta.days))


def _random_phone() -> str:
    return f"+91{random.randint(7000000000, 9999999999)}"


async def seed():
    """Main seed function."""
    setup_logging()
    await DatabaseManager.connect()
    db = get_db()

    print("=" * 60)
    print("PCIS Database Seeder")
    print("=" * 60)

    # ── 1. Roles ─────────────────────────────────────────────────────
    print("\n[1/8] Seeding roles...")
    role_ids = {}
    for r in ROLES_DATA:
        rid = _uid()
        r["role_id"] = rid
        r["_id"] = rid
        r["is_system_role"] = True
        now = datetime.utcnow()
        r["created_at"] = now
        r["updated_at"] = now
        role_ids[r["role_name"]] = rid

    await db["roles"].insert_many(ROLES_DATA)
    print(f"  ✓ {len(ROLES_DATA)} roles created")

    # ── 2. Police Stations ───────────────────────────────────────────
    print("\n[2/8] Seeding police stations...")
    stations = []
    station_ids = []
    counter = 1
    for state in STATES[:4]:
        for district in DISTRICTS[state]:
            for _ in range(random.randint(1, 3)):
                if len(stations) >= 20:
                    break
                sid = _uid()
                station_ids.append(sid)
                code = f"{state[:2].upper()}-{district[:3].upper()}-{counter:02d}"
                stations.append({
                    "_id": sid,
                    "station_id": sid,
                    "station_code": code,
                    "station_name": f"{district} Police Station {counter}",
                    "district": district,
                    "state": state,
                    "address": {"street": f"MG Road, Ward {counter}", "city": district,
                                "district": district, "state": state, "pincode": f"{random.randint(100000, 999999)}"},
                    "contact": {"phone_primary": _random_phone(), "email": f"ps{counter}@police.gov.in"},
                    "station_type": "REGULAR",
                    "is_active": True,
                    "coordinates": {"latitude": round(random.uniform(8.0, 35.0), 6),
                                    "longitude": round(random.uniform(68.0, 97.0), 6)},
                    "metadata": {},
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow(),
                })
                counter += 1

    await db["police_stations"].insert_many(stations)
    print(f"  ✓ {len(stations)} police stations created")

    # ── 3. Officers ──────────────────────────────────────────────────
    print("\n[3/8] Seeding officers...")
    officers = []
    officer_ids = []
    for i in range(200):
        oid = _uid()
        officer_ids.append(oid)
        gender = random.choice(["M", "F"])
        first = random.choice(FIRST_NAMES_M if gender == "M" else FIRST_NAMES_F)
        last = random.choice(LAST_NAMES)
        rank = random.choices(RANKS, weights=RANK_WEIGHTS, k=1)[0]
        officers.append({
            "_id": oid,
            "officer_id": oid,
            "badge_number": f"BD-{i + 1:04d}",
            "full_name": {"first_name": first, "last_name": last},
            "display_name": f"{first} {last}",
            "designation": rank.replace("_", " ").title(),
            "rank": rank,
            "station_id": random.choice(station_ids),
            "specialization": [random.choice(["GENERAL", "CYBER", "FORENSICS", "HOMICIDE"])],
            "years_of_service": random.randint(1, 30),
            "phone": _random_phone(),
            "email": f"{first.lower()}.{last.lower()}{i}@police.gov.in",
            "employment_status": "ACTIVE",
            "previous_postings": [],
            "metadata": {},
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        })

    await db["officers"].insert_many(officers)
    print(f"  ✓ {len(officers)} officers created")

    # ── 4. Users ─────────────────────────────────────────────────────
    print("\n[4/8] Seeding users...")
    users = []
    admin_uid = _uid()
    default_hash = pwd_context.hash("password123")

    # Admin user
    users.append({
        "_id": admin_uid, "user_id": admin_uid,
        "username": "admin", "password_hash": default_hash,
        "role_id": role_ids["ADMINISTRATOR"],
        "linked_officer_id": None,
        "email": "admin@pcis.gov.in",
        "account_status": "ACTIVE",
        "failed_login_attempts": 0,
        "password_changed_at": datetime.utcnow(),
        "metadata": {},
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    })

    # Officer users
    role_for_rank = {
        "INSPECTOR": "INSPECTOR", "SUB_INSPECTOR": "SUB_INSPECTOR",
        "ASI": "CONSTABLE", "HEAD_CONSTABLE": "CONSTABLE", "CONSTABLE": "CONSTABLE",
    }
    for off in officers:
        uid = _uid()
        role_key = role_for_rank.get(off["rank"], "CONSTABLE")
        users.append({
            "_id": uid, "user_id": uid,
            "username": off["email"].split("@")[0],
            "password_hash": default_hash,
            "role_id": role_ids[role_key],
            "linked_officer_id": off["officer_id"],
            "email": off["email"],
            "account_status": "ACTIVE",
            "failed_login_attempts": 0,
            "password_changed_at": datetime.utcnow(),
            "metadata": {},
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        })

    await db["users"].insert_many(users)
    user_ids = [u["user_id"] for u in users]
    print(f"  ✓ {len(users)} users created (admin password: password123)")

    # ── 5. Persons ───────────────────────────────────────────────────
    print("\n[5/8] Seeding persons...")
    persons = []
    person_ids = []
    for i in range(3000):
        pid = _uid()
        person_ids.append(pid)
        gender = random.choice(["MALE", "FEMALE"])
        first = random.choice(FIRST_NAMES_M if gender == "MALE" else FIRST_NAMES_F)
        last = random.choice(LAST_NAMES)
        persons.append({
            "_id": pid, "person_id": pid,
            "full_name": {"first_name": first, "last_name": last},
            "display_name": f"{first} {last}",
            "gender": gender,
            "date_of_birth": _random_date(1960, 2005).strftime("%Y-%m-%d"),
            "approximate_age": random.randint(15, 70),
            "address": {"city": random.choice(["Mumbai", "Delhi", "Bangalore", "Chennai", "Pune"]),
                        "state": random.choice(STATES[:5])},
            "phone": _random_phone() if random.random() > 0.3 else None,
            "occupation": random.choice(OCCUPATIONS),
            "identification_marks": [random.choice(["Mole on left cheek", "Scar on forehead",
                                                     "Tattoo on right arm", "None visible"])] if random.random() > 0.5 else [],
            "nationality": "Indian",
            "is_deceased": False,
            "metadata": {},
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        })

    # Insert in batches
    for batch_start in range(0, len(persons), 500):
        await db["persons"].insert_many(persons[batch_start:batch_start + 500])
    print(f"  ✓ {len(persons)} persons created")

    # ── 6. Cases + Case Persons + Activities ─────────────────────────
    print("\n[6/8] Seeding cases, case_persons, and activities...")
    cases = []
    case_persons = []
    activities = []

    sections_pool = [
        {"act": "IPC", "section": "302", "description": "Murder"},
        {"act": "IPC", "section": "304", "description": "Culpable homicide"},
        {"act": "IPC", "section": "376", "description": "Rape"},
        {"act": "IPC", "section": "379", "description": "Theft"},
        {"act": "IPC", "section": "392", "description": "Robbery"},
        {"act": "IPC", "section": "420", "description": "Cheating"},
        {"act": "IPC", "section": "498A", "description": "Cruelty by husband"},
        {"act": "IPC", "section": "354", "description": "Assault on woman"},
        {"act": "IT Act", "section": "66", "description": "Computer related offenses"},
        {"act": "IPC", "section": "363", "description": "Kidnapping"},
        {"act": "IPC", "section": "279", "description": "Rash driving"},
        {"act": "NDPS Act", "section": "20", "description": "Drug possession"},
    ]

    for i in range(5000):
        cid = _uid()
        station_id = random.choice(station_ids)
        officer_id = random.choice(officer_ids)
        crime = random.choices(CRIME_TYPES, weights=CRIME_WEIGHTS, k=1)[0]
        prio = random.choices(PRIORITIES, weights=PRIORITY_WEIGHTS, k=1)[0]
        stat = random.choices(STATUSES, weights=STATUS_WEIGHTS, k=1)[0]
        reg_date = _random_date(2020, 2025)
        inc_date = reg_date - timedelta(days=random.randint(0, 30))

        case = {
            "_id": cid, "case_id": cid,
            "fir_number": f"FIR/{reg_date.year}/{station_id[:4].upper()}/{i + 1:05d}",
            "police_station_id": station_id,
            "assigned_officer_id": officer_id,
            "supporting_officer_ids": [],
            "crime_type": crime,
            "crime_category": random.choice(["COGNIZABLE", "NON_COGNIZABLE"]),
            "priority": prio,
            "current_status": stat,
            "registration_date": reg_date,
            "incident_date": inc_date,
            "incident_location": {
                "city": random.choice(["Mumbai", "Delhi", "Bangalore", "Chennai", "Pune"]),
                "state": random.choice(STATES[:5]),
                "landmark": random.choice(["Near Bus Stop", "Market Area", "Residential Colony", "Highway"]),
            },
            "short_summary": f"{crime.replace('_', ' ').title()} case reported in jurisdiction",
            "detailed_description": (
                f"A {crime.replace('_', ' ').lower()} incident was reported on "
                f"{inc_date.strftime('%d %B %Y')}. The complainant approached the police station "
                f"and filed a report. Investigation is {'ongoing' if stat == 'UNDER_INVESTIGATION' else 'as per current status'}."
            ),
            "applicable_sections": random.sample(sections_pool, k=random.randint(1, 3)),
            "source": random.choice(["WALK_IN", "PHONE", "ONLINE"]),
            "tags": [crime.lower()],
            "is_sensitive": random.random() < 0.05,
            "created_by": random.choice(user_ids),
            "updated_by": random.choice(user_ids),
            "metadata": {},
            "created_at": reg_date,
            "updated_at": reg_date + timedelta(days=random.randint(0, 60)),
        }

        if stat in ("CLOSED_SOLVED", "CLOSED_UNSOLVED"):
            case["closure_date"] = reg_date + timedelta(days=random.randint(30, 365))
            case["closure_reason"] = "Resolved" if stat == "CLOSED_SOLVED" else "Insufficient evidence"

        cases.append(case)

        # Case persons (2-4 per case)
        num_persons = random.randint(2, 4)
        roles = ["COMPLAINANT", "VICTIM"] + random.choices(
            ["WITNESS", "SUSPECT", "ACCUSED", "GUARDIAN"], k=num_persons - 2
        )
        selected_persons = random.sample(person_ids, k=min(num_persons, len(person_ids)))
        for j, (pid, role) in enumerate(zip(selected_persons, roles)):
            cpid = _uid()
            case_persons.append({
                "_id": cpid, "case_person_id": cpid,
                "case_id": cid, "person_id": pid,
                "role_in_case": role,
                "is_primary": j == 0,
                "status": "ACTIVE",
                "added_by": random.choice(user_ids),
                "created_at": reg_date,
                "updated_at": reg_date,
            })

        # Activity: case registered
        aid = _uid()
        activities.append({
            "_id": aid, "activity_id": aid,
            "case_id": cid,
            "activity_type": "CASE_REGISTERED",
            "performed_by": random.choice(user_ids),
            "timestamp": reg_date,
            "remarks": f"Case registered: {case['fir_number']}",
            "created_at": reg_date,
        })

    # Insert in batches
    for b in range(0, len(cases), 500):
        await db["cases"].insert_many(cases[b:b + 500])
    for b in range(0, len(case_persons), 1000):
        await db["case_persons"].insert_many(case_persons[b:b + 1000])
    for b in range(0, len(activities), 1000):
        await db["activities"].insert_many(activities[b:b + 1000])

    print(f"  ✓ {len(cases)} cases created")
    print(f"  ✓ {len(case_persons)} case_person associations created")
    print(f"  ✓ {len(activities)} activities created")

    # ── 7. Evidence ──────────────────────────────────────────────────
    print("\n[7/8] Seeding evidence...")
    evidence = []
    case_ids_list = [c["case_id"] for c in cases]
    for cid in random.sample(case_ids_list, k=min(4000, len(case_ids_list))):
        for _ in range(random.randint(1, 3)):
            eid = _uid()
            evidence.append({
                "_id": eid, "evidence_id": eid,
                "case_id": cid,
                "evidence_type": random.choice(EVIDENCE_TYPES),
                "description": random.choice([
                    "Mobile phone recovered from suspect",
                    "CCTV footage from nearby shop",
                    "Blood samples collected from scene",
                    "Weapon recovered from bushes",
                    "Financial transaction records",
                    "Clothing fibers from scene",
                ]),
                "collection_date": _random_date(2020, 2025),
                "collected_by": random.choice(officer_ids),
                "current_status": random.choice(["COLLECTED", "IN_CUSTODY", "SENT_TO_LAB", "ANALYZED"]),
                "forensic_status": random.choice(["NOT_SUBMITTED", "SUBMITTED", "ANALYSIS_COMPLETE"]),
                "is_critical": random.random() < 0.15,
                "metadata": {},
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            })

    for b in range(0, len(evidence), 1000):
        await db["evidence"].insert_many(evidence[b:b + 1000])
    print(f"  ✓ {len(evidence)} evidence records created")

    # ── 8. Case Notes + Documents ────────────────────────────────────
    print("\n[8/8] Seeding notes and documents...")
    notes = []
    documents = []

    for cid in case_ids_list:
        # Notes (2-4 per case)
        for _ in range(random.randint(2, 4)):
            nid = _uid()
            notes.append({
                "_id": nid, "note_id": nid,
                "case_id": cid,
                "officer_id": random.choice(officer_ids),
                "title": random.choice([
                    "Initial Assessment", "Witness Interview Summary",
                    "Follow-up Visit", "Evidence Review", "Progress Update",
                    "Lead Identified", "Suspect Observation",
                ]),
                "content": "Investigation note recorded during fieldwork. Details documented as per standard procedure.",
                "note_type": random.choice(NOTE_TYPES),
                "confidentiality_level": random.choice(["INTERNAL", "RESTRICTED"]),
                "tags": [],
                "created_at": _random_date(2020, 2025),
                "updated_at": datetime.utcnow(),
            })

        # Documents (1-3 per case)
        for _ in range(random.randint(1, 3)):
            did = _uid()
            dtype = random.choice(DOC_TYPES)
            documents.append({
                "_id": did, "document_id": did,
                "case_id": cid,
                "document_type": dtype,
                "document_title": f"{dtype.replace('_', ' ').title()} - {cid[:8]}",
                "uploaded_by": random.choice(user_ids),
                "upload_date": _random_date(2020, 2025),
                "ocr_status": "NOT_APPLICABLE",
                "language": "en",
                "is_confidential": False,
                "tags": [dtype.lower()],
                "metadata": {},
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            })

    for b in range(0, len(notes), 1000):
        await db["case_notes"].insert_many(notes[b:b + 1000])
    for b in range(0, len(documents), 1000):
        await db["case_documents"].insert_many(documents[b:b + 1000])

    print(f"  ✓ {len(notes)} case notes created")
    print(f"  ✓ {len(documents)} case documents created")

    # ── Summary ──────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("Seeding Complete!")
    print("=" * 60)
    print(f"  Roles:          {len(ROLES_DATA)}")
    print(f"  Stations:       {len(stations)}")
    print(f"  Officers:       {len(officers)}")
    print(f"  Users:          {len(users)}")
    print(f"  Persons:        {len(persons)}")
    print(f"  Cases:          {len(cases)}")
    print(f"  Case-Persons:   {len(case_persons)}")
    print(f"  Evidence:       {len(evidence)}")
    print(f"  Notes:          {len(notes)}")
    print(f"  Documents:      {len(documents)}")
    print(f"  Activities:     {len(activities)}")
    print(f"\n  Admin login:    admin / password123")

    await DatabaseManager.disconnect()


if __name__ == "__main__":
    asyncio.run(seed())
