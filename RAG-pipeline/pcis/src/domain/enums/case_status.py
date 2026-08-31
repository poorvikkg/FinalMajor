"""Case status enumerations."""

from enum import Enum


class CaseStatus(str, Enum):
    """Current status of a case through its lifecycle."""

    REGISTERED = "REGISTERED"
    UNDER_INVESTIGATION = "UNDER_INVESTIGATION"
    CHARGE_SHEET_FILED = "CHARGE_SHEET_FILED"
    COURT_PROCEEDINGS = "COURT_PROCEEDINGS"
    CLOSED_SOLVED = "CLOSED_SOLVED"
    CLOSED_UNSOLVED = "CLOSED_UNSOLVED"
    REOPENED = "REOPENED"
    TRANSFERRED = "TRANSFERRED"
