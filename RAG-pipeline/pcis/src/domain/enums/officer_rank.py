"""Officer rank enumeration."""

from enum import Enum


class OfficerRank(str, Enum):
    """Indian Police Service rank hierarchy (descending authority)."""

    DGP = "DGP"
    ADGP = "ADGP"
    IGP = "IGP"
    DIGP = "DIGP"
    SP = "SP"
    ADDL_SP = "ADDL_SP"
    DSP = "DSP"
    INSPECTOR = "INSPECTOR"
    SUB_INSPECTOR = "SUB_INSPECTOR"
    ASI = "ASI"
    HEAD_CONSTABLE = "HEAD_CONSTABLE"
    CONSTABLE = "CONSTABLE"


class EmploymentStatus(str, Enum):
    """Officer employment status."""

    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"
    RETIRED = "RETIRED"
    TRANSFERRED = "TRANSFERRED"
    ON_LEAVE = "ON_LEAVE"
    DECEASED = "DECEASED"


class Specialization(str, Enum):
    """Officer specialization areas."""

    CYBER = "CYBER"
    FORENSICS = "FORENSICS"
    NARCOTICS = "NARCOTICS"
    TRAFFIC = "TRAFFIC"
    HOMICIDE = "HOMICIDE"
    ECONOMIC_OFFENSES = "ECONOMIC_OFFENSES"
    ANTI_TERRORISM = "ANTI_TERRORISM"
    WOMEN_AND_CHILD = "WOMEN_AND_CHILD"
    GENERAL = "GENERAL"
