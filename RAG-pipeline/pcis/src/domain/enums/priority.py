"""Priority level enumeration."""

from enum import Enum


class Priority(str, Enum):
    """Case priority levels."""

    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
