"""
Dataset Generation Engine Orchestrator.

Generates complete realistic synthetic police dataset:
- 20 Police Stations
- 200 Officers
- 7 Roles & ~250 Users
- 15,000 Persons
- 5,000 Cases
- 15,000 Case-Person relationships
- 7,000 Investigation Notes
- 10,000 Activities
- 5,000 Evidence Records
- 8,000 Documents
- 5,000 Attachments

Exports identical datasets across JSON, CSV, and Excel in sample_data/.
"""

import json
import logging
import time
from typing import Dict, List, Any, Optional

from src.dataset_generator.generators import (
    StationGenerator,
    OfficerGenerator,
    UserRoleGenerator,
    PersonGenerator,
    CaseGenerator,
    CasePersonLinkGenerator,
    NoteGenerator,
    ActivityGenerator,
    EvidenceGenerator,
    DocumentGenerator,
    AttachmentGenerator,
)
from src.dataset_generator.exporters import DatasetExporter
from src.config.database import DatabaseManager

logger = logging.getLogger(__name__)


class DatasetGeneratorEngine:
    def __init__(
        self,
        num_stations: int = 20,
        num_officers: int = 200,
        num_persons: int = 15000,
        num_cases: int = 5000,
        num_case_persons: int = 15000,
        num_notes: int = 7000,
        num_activities: int = 10000,
        num_evidence: int = 5000,
        num_documents: int = 8000,
        num_attachments: int = 5000,
        output_dir: str = "sample_data",
    ):
        self.num_stations = num_stations
        self.num_officers = num_officers
        self.num_persons = num_persons
        self.num_cases = num_cases
        self.num_case_persons = num_case_persons
        self.num_notes = num_notes
        self.num_activities = num_activities
        self.num_evidence = num_evidence
        self.num_documents = num_documents
        self.num_attachments = num_attachments
        self.output_dir = output_dir

        self.exporter = DatasetExporter(output_base_dir=output_dir)

    def generate_all(self) -> Dict[str, List[Dict[str, Any]]]:
        """
        Generate complete interconnected synthetic dataset in memory.
        """
        start_time = time.time()
        logger.info("Starting Synthetic Police Dataset Generation...")

        # 1. Stations
        logger.info(f"Generating {self.num_stations} Police Stations...")
        stations = StationGenerator.generate()[: self.num_stations]

        # 2. Officers
        logger.info(f"Generating {self.num_officers} Police Officers...")
        officers = OfficerGenerator.generate(self.num_officers, stations)

        # 3. Roles & Users
        logger.info("Generating System Roles & Users...")
        roles, users = UserRoleGenerator.generate(officers)

        # 4. Persons
        logger.info(f"Generating {self.num_persons} Person records...")
        persons = PersonGenerator.generate(self.num_persons)

        # 5. Cases
        logger.info(f"Generating {self.num_cases} Cases...")
        cases = CaseGenerator.generate(self.num_cases, stations, officers, users)

        # 6. Case-Person Links
        logger.info(f"Generating {self.num_case_persons} Case-Person relationships...")
        case_persons = CasePersonLinkGenerator.generate(
            cases, persons, target_link_count=self.num_case_persons
        )

        # 7. Investigation Notes
        logger.info(f"Generating {self.num_notes} Investigation Notes...")
        notes = NoteGenerator.generate(self.num_notes, cases, officers, case_persons)

        # 8. Activities
        logger.info(f"Generating {self.num_activities} Case Activities...")
        activities = ActivityGenerator.generate(
            self.num_activities, cases, officers, case_persons
        )

        # 9. Evidence
        logger.info(f"Generating {self.num_evidence} Evidence records...")
        evidence = EvidenceGenerator.generate(self.num_evidence, cases, officers)

        # 10. Documents
        logger.info(f"Generating {self.num_documents} Case Documents...")
        documents = DocumentGenerator.generate(
            self.num_documents, cases, officers, case_persons
        )

        # 11. Attachments
        logger.info(f"Generating {self.num_attachments} Attachment records...")
        attachments = AttachmentGenerator.generate(
            self.num_attachments, cases, documents
        )

        dataset = {
            "police_stations": stations,
            "officers": officers,
            "roles": roles,
            "users": users,
            "persons": persons,
            "cases": cases,
            "case_persons": case_persons,
            "case_notes": notes,
            "activities": activities,
            "evidence": evidence,
            "case_documents": documents,
            "attachments": attachments,
        }

        elapsed = time.time() - start_time
        logger.info(
            f"Synthetic Dataset Generation Complete in {elapsed:.2f} seconds!"
        )
        return dataset

    def generate_and_export(self) -> Dict[str, Any]:
        """
        Generates dataset and writes multi-format files to sample_data/.
        """
        dataset = self.generate_all()
        logger.info(f"Exporting dataset to {self.output_dir} (JSON, CSV, Excel)...")
        files = self.exporter.export_all(dataset)
        
        summary = {
            "counts": {k: len(v) for k, v in dataset.items()},
            "exported_files": files,
        }
        logger.info("Dataset Export Complete.")
        return summary

    async def seed_mongodb(
        self, dataset: Optional[Dict[str, List[Dict[str, Any]]]] = None
    ) -> Dict[str, int]:
        """
        Seeds MongoDB with the generated dataset.
        """
        if dataset is None:
            dataset = self.generate_all()

        db = DatabaseManager.get_database()
        inserted_counts = {}

        for coll_name, records in dataset.items():
            if not records:
                continue
            collection = db[coll_name]
            await collection.delete_many({})  # Clear existing
            result = await collection.insert_many(records)
            inserted_counts[coll_name] = len(result.inserted_ids)
            logger.info(f"Seeded collection '{coll_name}': {len(result.inserted_ids)} documents")

        return inserted_counts


def generate_synthetic_dataset(
    num_stations: int = 20,
    num_officers: int = 200,
    num_persons: int = 15000,
    num_cases: int = 5000,
    num_case_persons: int = 15000,
    num_notes: int = 7000,
    num_activities: int = 10000,
    num_evidence: int = 5000,
    num_documents: int = 8000,
    num_attachments: int = 5000,
    output_dir: str = "sample_data",
) -> Dict[str, Any]:
    engine = DatasetGeneratorEngine(
        num_stations=num_stations,
        num_officers=num_officers,
        num_persons=num_persons,
        num_cases=num_cases,
        num_case_persons=num_case_persons,
        num_notes=num_notes,
        num_activities=num_activities,
        num_evidence=num_evidence,
        num_documents=num_documents,
        num_attachments=num_attachments,
        output_dir=output_dir,
    )
    return engine.generate_and_export()


if __name__ == "__main__":
    import argparse
    from src.config.logging_config import setup_logging
    setup_logging()

    parser = argparse.ArgumentParser(description="PCIS Synthetic Dataset Generator Engine")
    parser.add_argument("--stations", type=int, default=20, help="Number of Police Stations")
    parser.add_argument("--officers", type=int, default=200, help="Number of Police Officers")
    parser.add_argument("--persons", type=int, default=15000, help="Number of Persons")
    parser.add_argument("--cases", type=int, default=5000, help="Number of Cases")
    parser.add_argument("--outdir", type=str, default="sample_data", help="Output Directory")
    
    args = parser.parse_args()
    
    print(f"Generating Synthetic Dataset with {args.cases} cases, {args.persons} persons, {args.officers} officers across {args.stations} stations...")
    summary = generate_synthetic_dataset(
        num_stations=args.stations,
        num_officers=args.officers,
        num_persons=args.persons,
        num_cases=args.cases,
        output_dir=args.outdir
    )
    print("\nDataset Generation Complete!")
    print(json.dumps(summary["counts"], indent=2))

