"""
MongoDB Index Definitions.

Creates all recommended indexes for optimal query performance.
Run via: python -m scripts.create_indexes
"""

import logging
from pymongo import ASCENDING, DESCENDING, TEXT, GEO2DSPHERE
from src.config.database import get_db

logger = logging.getLogger(__name__)


async def create_all_indexes() -> None:
    """Create all indexes across all collections."""
    db = get_db()

    logger.info("Creating indexes...")

    # ── police_stations ──────────────────────────────────────────────
    stations = db["police_stations"]
    await stations.create_index("station_code", unique=True, name="idx_station_code_unique")
    await stations.create_index([("coordinates", GEO2DSPHERE)], name="idx_station_geo", sparse=True)
    await stations.create_index("district", name="idx_station_district")
    await stations.create_index("state", name="idx_station_state")
    logger.info("  ✓ police_stations indexes created")

    # ── officers ─────────────────────────────────────────────────────
    officers = db["officers"]
    await officers.create_index("badge_number", unique=True, name="idx_badge_unique")
    await officers.create_index("station_id", name="idx_officer_station")
    await officers.create_index("rank", name="idx_officer_rank")
    await officers.create_index("employment_status", name="idx_officer_status")
    await officers.create_index(
        [("display_name", TEXT)], name="idx_officer_name_text"
    )
    logger.info("  ✓ officers indexes created")

    # ── cases ────────────────────────────────────────────────────────
    cases = db["cases"]
    await cases.create_index("fir_number", unique=True, name="idx_fir_unique")
    await cases.create_index("police_station_id", name="idx_case_station")
    await cases.create_index("assigned_officer_id", name="idx_case_officer")
    await cases.create_index(
        [("crime_type", ASCENDING), ("current_status", ASCENDING)],
        name="idx_case_type_status",
    )
    await cases.create_index(
        [("current_status", ASCENDING), ("priority", ASCENDING)],
        name="idx_case_status_priority",
    )
    await cases.create_index("registration_date", name="idx_case_reg_date")
    await cases.create_index("incident_date", name="idx_case_incident_date")
    await cases.create_index(
        [("crime_type", ASCENDING), ("police_station_id", ASCENDING), ("current_status", ASCENDING)],
        name="idx_case_analytics",
    )
    await cases.create_index("tags", name="idx_case_tags")
    await cases.create_index(
        [("short_summary", TEXT), ("detailed_description", TEXT)],
        name="idx_case_text_search",
    )
    await cases.create_index(
        [("incident_location.coordinates", GEO2DSPHERE)],
        name="idx_case_geo",
        sparse=True,
    )
    logger.info("  ✓ cases indexes created")

    # ── persons ──────────────────────────────────────────────────────
    persons = db["persons"]
    await persons.create_index(
        [("display_name", TEXT), ("identification_marks", TEXT)],
        name="idx_person_text_search",
    )
    await persons.create_index("phone", name="idx_person_phone", sparse=True)
    await persons.create_index("date_of_birth", name="idx_person_dob", sparse=True)
    logger.info("  ✓ persons indexes created")

    # ── case_persons ─────────────────────────────────────────────────
    case_persons = db["case_persons"]
    await case_persons.create_index("case_id", name="idx_cp_case")
    await case_persons.create_index("person_id", name="idx_cp_person")
    await case_persons.create_index(
        [("case_id", ASCENDING), ("role_in_case", ASCENDING)],
        name="idx_cp_case_role",
    )
    await case_persons.create_index(
        [("case_id", ASCENDING), ("person_id", ASCENDING)],
        name="idx_cp_case_person",
    )
    logger.info("  ✓ case_persons indexes created")

    # ── case_documents ───────────────────────────────────────────────
    documents = db["case_documents"]
    await documents.create_index("case_id", name="idx_doc_case")
    await documents.create_index(
        [("case_id", ASCENDING), ("document_type", ASCENDING)],
        name="idx_doc_case_type",
    )
    await documents.create_index(
        [("ocr_text", TEXT), ("document_title", TEXT)],
        name="idx_doc_text_search",
    )
    logger.info("  ✓ case_documents indexes created")

    # ── attachments ──────────────────────────────────────────────────
    attachments = db["attachments"]
    await attachments.create_index("document_id", name="idx_att_document")
    await attachments.create_index("case_id", name="idx_att_case")
    await attachments.create_index("checksum_sha256", name="idx_att_checksum")
    logger.info("  ✓ attachments indexes created")

    # ── evidence ─────────────────────────────────────────────────────
    evidence = db["evidence"]
    await evidence.create_index("case_id", name="idx_evd_case")
    await evidence.create_index(
        [("case_id", ASCENDING), ("evidence_type", ASCENDING)],
        name="idx_evd_case_type",
    )
    await evidence.create_index("current_status", name="idx_evd_status")
    await evidence.create_index("collected_by", name="idx_evd_collector")
    await evidence.create_index(
        [("description", TEXT)], name="idx_evd_text_search"
    )
    logger.info("  ✓ evidence indexes created")

    # ── case_notes ───────────────────────────────────────────────────
    case_notes = db["case_notes"]
    await case_notes.create_index("case_id", name="idx_note_case")
    await case_notes.create_index(
        [("case_id", ASCENDING), ("confidentiality_level", ASCENDING)],
        name="idx_note_case_conf",
    )
    await case_notes.create_index(
        [("title", TEXT), ("content", TEXT)],
        name="idx_note_text_search",
    )
    logger.info("  ✓ case_notes indexes created")

    # ── activities ───────────────────────────────────────────────────
    activities = db["activities"]
    await activities.create_index(
        [("case_id", ASCENDING), ("timestamp", DESCENDING)],
        name="idx_act_case_time",
    )
    await activities.create_index(
        [("activity_type", ASCENDING), ("timestamp", DESCENDING)],
        name="idx_act_type_time",
    )
    await activities.create_index("performed_by", name="idx_act_performer")
    logger.info("  ✓ activities indexes created")

    # ── users ────────────────────────────────────────────────────────
    users = db["users"]
    await users.create_index("username", unique=True, name="idx_user_username_unique")
    await users.create_index("linked_officer_id", name="idx_user_officer", sparse=True)
    await users.create_index("email", unique=True, name="idx_user_email_unique", sparse=True)
    logger.info("  ✓ users indexes created")

    # ── roles ────────────────────────────────────────────────────────
    roles = db["roles"]
    await roles.create_index("role_name", unique=True, name="idx_role_name_unique")
    logger.info("  ✓ roles indexes created")

    logger.info("All indexes created successfully.")
