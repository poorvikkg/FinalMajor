"""
Import Reporter — saves detailed import execution summary logs into logs/.
"""

import json
import logging
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict

logger = logging.getLogger(__name__)


class ImportReporter:
    """
    Generates and persists import reports into the logs/ directory.
    """

    def __init__(self, log_dir: str = "logs"):
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(parents=True, exist_ok=True)

    def generate_report(self, import_results: Dict[str, Any]) -> Dict[str, Any]:
        import_id = f"IMP-{uuid.uuid4().hex[:8].upper()}"
        timestamp = datetime.now().isoformat()

        report = {
            "import_id": import_id,
            "timestamp": timestamp,
            "collection": import_results.get("collection"),
            "source_path": import_results.get("source_path"),
            "stats": import_results.get("stats", {}),
            "error_count": len(import_results.get("errors", [])),
            "errors": import_results.get("errors", [])
        }

        # Save JSON log report
        log_file = self.log_dir / f"import_report_{import_id}.json"
        with open(log_file, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2, default=str)

        # Also write summary entry to main import audit log file
        summary_log = self.log_dir / "imports_history.log"
        with open(summary_log, "a", encoding="utf-8") as f:
            stats = report["stats"]
            log_line = (
                f"[{timestamp}] ID={import_id} Coll={report['collection']} "
                f"Parsed={stats.get('total_parsed', 0)} Imported={stats.get('total_imported', 0)} "
                f"Dups={stats.get('total_duplicates', 0)} Errors={stats.get('total_errors', 0)} "
                f"Time={stats.get('processing_time_ms', 0)}ms File={report['source_path']}\n"
            )
            f.write(log_line)

        logger.info(f"Import report generated: '{log_file}'")
        return report

    def get_report_by_id(self, import_id: str) -> Dict[str, Any]:
        log_file = self.log_dir / f"import_report_{import_id}.json"
        if not log_file.exists():
            raise FileNotFoundError(f"Report '{import_id}' not found.")
        with open(log_file, "r", encoding="utf-8") as f:
            return json.load(f)

    def list_history(self, limit: int = 50) -> list:
        reports = []
        for file in sorted(self.log_dir.glob("import_report_*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
            if len(reports) >= limit:
                break
            with open(file, "r", encoding="utf-8") as f:
                data = json.load(f)
                reports.append({
                    "import_id": data.get("import_id"),
                    "timestamp": data.get("timestamp"),
                    "collection": data.get("collection"),
                    "stats": data.get("stats"),
                    "error_count": data.get("error_count")
                })
        return reports
