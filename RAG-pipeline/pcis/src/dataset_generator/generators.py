"""
Synthetic generators for all 11 PCIS domain entities.
Generates realistic, interconnected datasets with relational integrity.
"""

import random
import uuid
import hashlib
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Tuple
from passlib.context import CryptContext

from src.dataset_generator.seed_data import (
    POLICE_STATIONS,
    MALE_FIRST_NAMES,
    FEMALE_FIRST_NAMES,
    LAST_NAMES,
    OCCUPATIONS,
    OFFICER_SPECIALIZATIONS,
    LEGAL_SECTIONS_MAP,
    NOTE_TEMPLATES,
    ACTIVITY_TEMPLATES,
    EVIDENCE_DESCRIPTIONS,
    DOCUMENT_CONTENT_TEMPLATES,
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
DEFAULT_PASSWORD_HASH = pwd_context.hash("Password@123")


class StationGenerator:
    @staticmethod
    def generate() -> List[Dict[str, Any]]:
        stations = []
        for i, s in enumerate(POLICE_STATIONS):
            station_id = f"STATION-{s['station_code']}"
            stations.append({
                "station_id": station_id,
                "station_code": s["station_code"],
                "station_name": s["station_name"],
                "district": s["district"],
                "state": s["state"],
                "address": s["address"],
                "latitude": s["latitude"],
                "longitude": s["longitude"],
                "jurisdiction": s["jurisdiction"],
                "phone": s["phone"],
                "email": s["email"],
                "is_active": True,
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat()
            })
        return stations


class OfficerGenerator:
    RANKS = ["INSPECTOR", "SUB_INSPECTOR", "ASI", "HEAD_CONSTABLE", "CONSTABLE"]
    RANK_WEIGHTS = [10, 25, 20, 25, 20]

    @classmethod
    def generate(cls, count: int, stations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        officers = []
        for i in range(1, count + 1):
            is_male = random.random() > 0.3
            first = random.choice(MALE_FIRST_NAMES if is_male else FEMALE_FIRST_NAMES)
            last = random.choice(LAST_NAMES)
            full_name = f"{first} {last}"
            station = stations[(i - 1) % len(stations)]
            rank = random.choices(cls.RANKS, weights=cls.RANK_WEIGHTS)[0]
            badge = f"BADGE-{station['district'][:3].upper()}-{1000 + i}"
            exp = random.randint(1, 30)
            spec = random.choice(OFFICER_SPECIALIZATIONS)
            phone = f"+91-9{random.randint(100000009, 999999999)}"
            email = f"{first.lower()}.{last.lower()}{i}@police.gov.in"
            
            officers.append({
                "officer_id": f"OFFICER-{i:05d}",
                "badge_number": badge,
                "full_name": full_name,
                "rank": rank,
                "police_station_id": station["station_id"],
                "station_name": station["station_name"],
                "experience_years": exp,
                "specialization": spec,
                "phone": phone,
                "email": email,
                "employment_status": "ACTIVE",
                "joining_date": (date.today() - timedelta(days=exp * 365)).isoformat(),
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat()
            })
        return officers


class UserRoleGenerator:
    ROLES = [
        {"role_id": "ROLE-01", "role_name": "ADMINISTRATOR", "hierarchy_level": 1, "description": "Full System Access"},
        {"role_id": "ROLE-02", "role_name": "STATION_INCHARGE", "hierarchy_level": 2, "description": "Station Master Access"},
        {"role_id": "ROLE-03", "role_name": "INVESTIGATING_OFFICER", "hierarchy_level": 3, "description": "Case Officer Access"},
        {"role_id": "ROLE-04", "role_name": "CONSTABLE", "hierarchy_level": 4, "description": "Read & Log Access"},
        {"role_id": "ROLE-05", "role_name": "FORENSIC_EXPERT", "hierarchy_level": 3, "description": "Evidence & Report Access"},
        {"role_id": "ROLE-06", "role_name": "ANALYST", "hierarchy_level": 3, "description": "Intelligence & Analytics Access"},
        {"role_id": "ROLE-07", "role_name": "AUDITOR", "hierarchy_level": 2, "description": "Compliance & Read-only Access"}
    ]

    @classmethod
    def generate(cls, officers: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        users = []
        # Generate user accounts for 200 officers + 50 system users = 250 users
        for i, off in enumerate(officers, 1):
            users.append({
                "user_id": f"USER-{i:05d}",
                "username": off["email"].split("@")[0],
                "email": off["email"],
                "password_hash": DEFAULT_PASSWORD_HASH,
                "full_name": off["full_name"],
                "role_id": "ROLE-03" if off["rank"] in ["INSPECTOR", "SUB_INSPECTOR"] else "ROLE-04",
                "officer_id": off["officer_id"],
                "station_id": off["police_station_id"],
                "is_active": True,
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat()
            })
        
        # Add 50 Admin/Analyst/Auditor users
        for j in range(201, 251):
            is_male = random.random() > 0.4
            first = random.choice(MALE_FIRST_NAMES if is_male else FEMALE_FIRST_NAMES)
            last = random.choice(LAST_NAMES)
            username = f"{first.lower()}.{last.lower()}{j}"
            role = random.choice(["ROLE-01", "ROLE-02", "ROLE-05", "ROLE-06", "ROLE-07"])
            users.append({
                "user_id": f"USER-{j:05d}",
                "username": username,
                "email": f"{username}@police.gov.in",
                "password_hash": DEFAULT_PASSWORD_HASH,
                "full_name": f"{first} {last}",
                "role_id": role,
                "officer_id": None,
                "station_id": officers[(j - 1) % len(officers)]["police_station_id"],
                "is_active": True,
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat()
            })
        return cls.ROLES, users


class PersonGenerator:
    @staticmethod
    def generate(count: int) -> List[Dict[str, Any]]:
        persons = []
        states_districts = [
            ("Maharashtra", "Mumbai"), ("Maharashtra", "Pune"),
            ("Delhi", "Central Delhi"), ("Karnataka", "Bangalore"),
            ("Tamil Nadu", "Chennai"), ("Uttar Pradesh", "Lucknow"),
            ("Gujarat", "Ahmedabad"), ("Rajasthan", "Jaipur"),
            ("West Bengal", "Kolkata"), ("Kerala", "Thiruvananthapuram")
        ]
        
        for i in range(1, count + 1):
            is_male = random.random() > 0.45
            gender = "MALE" if is_male else "FEMALE"
            first = random.choice(MALE_FIRST_NAMES if is_male else FEMALE_FIRST_NAMES)
            last = random.choice(LAST_NAMES)
            age = random.randint(18, 75)
            dob = (date.today() - timedelta(days=age * 365 + random.randint(0, 360))).isoformat()
            state, district = random.choice(states_districts)
            address = f"{random.randint(1, 999)}, MG Road, Sector {random.randint(1, 30)}, {district}, {state} - {random.randint(400001, 700000)}"
            phone = f"+91-9{random.randint(100000000, 999999999)}"
            email = f"{first.lower()}.{last.lower()}{i}@mail.com" if random.random() > 0.3 else None
            
            aadhar = f"{random.randint(2000, 9999)}-{random.randint(1000, 9999)}-{random.randint(1000, 9999)}"
            pan = f"{''.join(random.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ', k=5))}{random.randint(1000, 9999)}{random.choice('ABCDEFGHIJKLMNOPQRSTUVWXYZ')}"
            
            marks = [
                f"Mole on {random.choice(['left cheek', 'right shoulder', 'chin', 'forehead'])}",
                f"Scar on {random.choice(['left knee', 'right palm', 'forehead'])}"
            ] if random.random() > 0.5 else []

            persons.append({
                "person_id": f"PERSON-{i:06d}",
                "full_name": f"{first} {last}",
                "gender": gender,
                "date_of_birth": dob,
                "age": age,
                "address": address,
                "district": district,
                "state": state,
                "phone": phone,
                "email": email,
                "occupation": random.choice(OCCUPATIONS),
                "nationality": "Indian",
                "identification_marks": marks,
                "government_ids": [
                    {"id_type": "AADHAAR", "id_number": aadhar},
                    {"id_type": "PAN", "id_number": pan}
                ],
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat()
            })
        return persons


class CaseGenerator:
    CRIME_TYPES = [
        "MISSING_PERSON", "KIDNAPPING", "THEFT", "ROBBERY", "CYBER_CRIME",
        "FRAUD", "MURDER", "ASSAULT", "ACCIDENT", "DOMESTIC_VIOLENCE",
        "DRUG_OFFENCE", "FINANCIAL_CRIME", "OTHERS"
    ]
    PRIORITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
    STATUSES = ["REGISTERED", "UNDER_INVESTIGATION", "CHARGE_SHEET_FILED", "COURT_PROCEEDINGS", "CLOSED_SOLVED", "CLOSED_UNSOLVED"]

    @classmethod
    def generate(
        cls,
        count: int,
        stations: List[Dict[str, Any]],
        officers: List[Dict[str, Any]],
        users: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        cases = []
        start_year = 2024
        
        for i in range(1, count + 1):
            station = stations[(i - 1) % len(stations)]
            st_officers = [o for o in officers if o["police_station_id"] == station["station_id"]]
            if not st_officers:
                st_officers = officers
            assigned_officer = random.choice(st_officers)
            
            crime_type = random.choice(cls.CRIME_TYPES)
            priority = random.choices(cls.PRIORITIES, weights=[10, 25, 45, 20])[0]
            status = random.choices(cls.STATUSES, weights=[15, 40, 15, 10, 15, 5])[0]
            
            year = random.choice([2024, 2025, 2026])
            fir_no = f"FIR/{year}/{station['station_code']}/{i:05d}"
            case_id = f"CASE-{i:06d}"
            
            days_ago = random.randint(1, 500)
            inc_dt = datetime.now() - timedelta(days=days_ago, hours=random.randint(1, 12))
            reg_dt = inc_dt + timedelta(hours=random.randint(2, 48))
            
            sections = LEGAL_SECTIONS_MAP.get(crime_type, LEGAL_SECTIONS_MAP["OTHERS"])
            
            short_summary = f"Incident of {crime_type.lower().replace('_', ' ')} reported near {station['district']}."
            detailed_desc = (
                f"Detailed police incident report regarding {crime_type} under jurisdiction of "
                f"{station['station_name']}. Investigation initiated by Officer {assigned_officer['full_name']} "
                f"({assigned_officer['badge_number']}). Initial inspection conducted at incident location."
            )
            
            user = random.choice(users)

            cases.append({
                "case_id": case_id,
                "fir_number": fir_no,
                "police_station_id": station["station_id"],
                "station_name": station["station_name"],
                "assigned_officer_id": assigned_officer["officer_id"],
                "assigned_officer_name": assigned_officer["full_name"],
                "assigned_officer_badge": assigned_officer["badge_number"],
                "crime_category": "COGNIZABLE" if crime_type in ["MURDER", "KIDNAPPING", "ROBBERY"] else "NON_COGNIZABLE",
                "crime_type": crime_type,
                "priority": priority,
                "current_status": status,
                "registration_date": reg_dt.isoformat(),
                "incident_date": inc_dt.isoformat(),
                "location": {
                    "address": f"Near Landmark {random.randint(10, 99)}, {station['jurisdiction'].split(',')[0]}, {station['district']}",
                    "latitude": station["latitude"] + (random.uniform(-0.02, 0.02)),
                    "longitude": station["longitude"] + (random.uniform(-0.02, 0.02)),
                    "district": station["district"],
                    "state": station["state"]
                },
                "short_summary": short_summary,
                "detailed_description": detailed_desc,
                "applicable_sections": sections,
                "source": "WALK_IN",
                "created_by": user["user_id"],
                "updated_by": user["user_id"],
                "created_at": reg_dt.isoformat(),
                "updated_at": datetime.now().isoformat()
            })
        return cases


class CasePersonLinkGenerator:
    ROLES = ["VICTIM", "WITNESS", "SUSPECT", "COMPLAINANT", "GUARDIAN", "MISSING_PERSON"]

    @classmethod
    def generate(
        cls,
        cases: List[Dict[str, Any]],
        persons: List[Dict[str, Any]],
        target_link_count: int = 15000
    ) -> List[Dict[str, Any]]:
        links = []
        # Ensure every case has at least 2 persons (Complainant/Victim + Suspect/Witness)
        # And persons are reused across cases to represent realistic repeated entities
        link_id_counter = 1
        
        for case in cases:
            # 2 to 4 persons per case
            num_persons = random.randint(2, 4)
            chosen_persons = random.sample(persons, num_persons)
            
            # First person is COMPLAINANT or VICTIM
            role1 = "VICTIM" if case["crime_type"] in ["ACCIDENT", "ASSAULT", "MURDER"] else "COMPLAINANT"
            if case["crime_type"] == "MISSING_PERSON":
                role1 = "MISSING_PERSON"
                
            links.append({
                "case_person_id": f"CP-{link_id_counter:06d}",
                "case_id": case["case_id"],
                "fir_number": case["fir_number"],
                "person_id": chosen_persons[0]["person_id"],
                "person_name": chosen_persons[0]["full_name"],
                "role_in_case": role1,
                "is_primary": True,
                "created_at": case["registration_date"]
            })
            link_id_counter += 1
            
            # Second person is SUSPECT or WITNESS
            role2 = "SUSPECT" if case["crime_type"] not in ["MISSING_PERSON", "ACCIDENT"] else "WITNESS"
            links.append({
                "case_person_id": f"CP-{link_id_counter:06d}",
                "case_id": case["case_id"],
                "fir_number": case["fir_number"],
                "person_id": chosen_persons[1]["person_id"],
                "person_name": chosen_persons[1]["full_name"],
                "role_in_case": role2,
                "is_primary": False,
                "created_at": case["registration_date"]
            })
            link_id_counter += 1
            
            for extra_p in chosen_persons[2:]:
                extra_role = random.choice(["WITNESS", "GUARDIAN", "SUSPECT"])
                links.append({
                    "case_person_id": f"CP-{link_id_counter:06d}",
                    "case_id": case["case_id"],
                    "fir_number": case["fir_number"],
                    "person_id": extra_p["person_id"],
                    "person_name": extra_p["full_name"],
                    "role_in_case": extra_role,
                    "is_primary": False,
                    "created_at": case["registration_date"]
                })
                link_id_counter += 1
                
        # Fill remaining up to target_link_count if needed
        while len(links) < target_link_count:
            c = random.choice(cases)
            p = random.choice(persons)
            role = random.choice(cls.ROLES)
            links.append({
                "case_person_id": f"CP-{link_id_counter:06d}",
                "case_id": c["case_id"],
                "fir_number": c["fir_number"],
                "person_id": p["person_id"],
                "person_name": p["full_name"],
                "role_in_case": role,
                "is_primary": False,
                "created_at": c["registration_date"]
            })
            link_id_counter += 1
            
        return links[:target_link_count]


class NoteGenerator:
    @staticmethod
    def generate(
        count: int,
        cases: List[Dict[str, Any]],
        officers: List[Dict[str, Any]],
        case_persons: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        notes = []
        for i in range(1, count + 1):
            c = cases[(i - 1) % len(cases)]
            off = random.choice(officers)
            cp_matches = [cp for cp in case_persons if cp["case_id"] == c["case_id"]]
            p_name = cp_matches[0]["person_name"] if cp_matches else "Witness"
            
            tmpl = random.choice(NOTE_TEMPLATES)
            content = tmpl.format(
                location=c["location"]["address"],
                person_name=p_name,
                district=c["location"]["district"]
            )
            
            notes.append({
                "note_id": f"NOTE-{i:06d}",
                "case_id": c["case_id"],
                "fir_number": c["fir_number"],
                "author_officer_id": off["officer_id"],
                "author_name": off["full_name"],
                "note_type": random.choice(["INVESTIGATION", "SITE_VISIT", "INTERROGATION", "FORENSIC_LEAD"]),
                "content": content,
                "created_at": c["registration_date"]
            })
        return notes


class ActivityGenerator:
    @staticmethod
    def generate(count: int, cases: List[Dict[str, Any]], officers: List[Dict[str, Any]], case_persons: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        activities = []
        for i in range(1, count + 1):
            c = cases[(i - 1) % len(cases)]
            off = random.choice(officers)
            act_type, desc_tmpl = random.choice(ACTIVITY_TEMPLATES)
            
            cp_matches = [cp for cp in case_persons if cp["case_id"] == c["case_id"]]
            p_name = cp_matches[0]["person_name"] if cp_matches else "Individual"
            
            desc = desc_tmpl.format(
                station_name=c["station_name"],
                officer_name=off["full_name"],
                badge=off["badge_number"],
                person_name=p_name,
                status=c["current_status"]
            )
            
            activities.append({
                "activity_id": f"ACT-{i:06d}",
                "case_id": c["case_id"],
                "fir_number": c["fir_number"],
                "activity_type": act_type,
                "description": desc,
                "performed_by_officer_id": off["officer_id"],
                "timestamp": c["registration_date"]
            })
        return activities


class EvidenceGenerator:
    @staticmethod
    def generate(count: int, cases: List[Dict[str, Any]], officers: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        evidence_list = []
        types = ["PHYSICAL", "DIGITAL", "DOCUMENTARY", "BIOLOGICAL", "FORENSIC"]
        
        for i in range(1, count + 1):
            c = cases[(i - 1) % len(cases)]
            off = random.choice(officers)
            ev_type = random.choice(types)
            desc = random.choice(EVIDENCE_DESCRIPTIONS[ev_type])
            
            evidence_list.append({
                "evidence_id": f"EVID-{i:06d}",
                "case_id": c["case_id"],
                "fir_number": c["fir_number"],
                "evidence_number": f"EVID/{c['fir_number'].split('/')[-1]}/{i:04d}",
                "evidence_type": ev_type,
                "description": desc,
                "collected_by_officer_id": off["officer_id"],
                "collection_location": c["location"]["address"],
                "storage_location": f"Locker-{random.randint(1, 50)}, Malkhana {c['police_station_id']}",
                "chain_of_custody_status": "SECURED_IN_MALKHANA",
                "created_at": c["registration_date"]
            })
        return evidence_list


class DocumentGenerator:
    DOC_TYPES = ["FIR", "WITNESS_STATEMENT", "MEDICAL_REPORT", "INVESTIGATION_REPORT", "CLOSURE_REPORT", "COURT_ORDER"]

    @classmethod
    def generate(
        cls,
        count: int,
        cases: List[Dict[str, Any]],
        officers: List[Dict[str, Any]],
        case_persons: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        documents = []
        for i in range(1, count + 1):
            c = cases[(i - 1) % len(cases)]
            off = random.choice(officers)
            doc_type = cls.DOC_TYPES[(i - 1) % len(cls.DOC_TYPES)]
            
            cp_matches = [cp for cp in case_persons if cp["case_id"] == c["case_id"]]
            p_name = cp_matches[0]["person_name"] if cp_matches else "N/A"
            
            sections_str = ", ".join([f"{s['act']} {s['section']}" for s in c["applicable_sections"]])
            
            tmpl = DOCUMENT_CONTENT_TEMPLATES[doc_type]
            content = tmpl.format(
                station_name=c["station_name"],
                district=c["location"]["district"],
                fir_number=c["fir_number"],
                date=c["registration_date"][:10],
                summary=c["short_summary"],
                sections=sections_str,
                complainant_name=p_name,
                officer_name=off["full_name"],
                person_name=p_name,
                age=random.randint(20, 60),
                gender="MALE",
                address=c["location"]["address"],
                location=c["location"]["address"],
                closure_reason="Investigation Concluded",
                status=c["current_status"]
            )

            documents.append({
                "document_id": f"DOC-{i:06d}",
                "case_id": c["case_id"],
                "fir_number": c["fir_number"],
                "document_type": doc_type,
                "title": f"{doc_type.replace('_', ' ')} - {c['fir_number']}",
                "content_text": content,
                "author_officer_id": off["officer_id"],
                "created_at": c["registration_date"]
            })
        return documents


class AttachmentGenerator:
    @staticmethod
    def generate(count: int, cases: List[Dict[str, Any]], documents: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        attachments = []
        file_specs = [
            ("pdf", "application/pdf"),
            ("jpg", "image/jpeg"),
            ("png", "image/png"),
            ("mp4", "video/mp4"),
            ("mp3", "audio/mpeg")
        ]
        
        for i in range(1, count + 1):
            c = cases[(i - 1) % len(cases)]
            doc = documents[(i - 1) % len(documents)] if i <= len(documents) else None
            ext, mime = random.choice(file_specs)
            
            fname = f"ATTACH_{c['case_id']}_{i:04d}.{ext}"
            rel_path = f"sample_data/attachments/{c['case_id']}/{fname}"
            checksum = hashlib.sha256(f"{fname}-{i}".encode()).hexdigest()

            attachments.append({
                "attachment_id": f"ATT-{i:06d}",
                "case_id": c["case_id"],
                "document_id": doc["document_id"] if doc else None,
                "file_name": fname,
                "file_type": mime,
                "file_extension": ext,
                "file_size_bytes": random.randint(15000, 5000000),
                "storage_backend": "LOCAL",
                "storage_location": rel_path,
                "checksum_sha256": checksum,
                "created_at": c["registration_date"]
            })
        return attachments
