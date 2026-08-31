"""Crime type and category enumerations."""

from enum import Enum


class CrimeType(str, Enum):
    """Primary crime classification."""

    MISSING_PERSON = "MISSING_PERSON"
    KIDNAPPING = "KIDNAPPING"
    THEFT = "THEFT"
    ROBBERY = "ROBBERY"
    CYBER_CRIME = "CYBER_CRIME"
    FRAUD = "FRAUD"
    MURDER = "MURDER"
    ASSAULT = "ASSAULT"
    ACCIDENT = "ACCIDENT"
    DOMESTIC_VIOLENCE = "DOMESTIC_VIOLENCE"
    DRUG_OFFENSE = "DRUG_OFFENSE"
    SEXUAL_OFFENSE = "SEXUAL_OFFENSE"
    EXTORTION = "EXTORTION"
    ARSON = "ARSON"
    HUMAN_TRAFFICKING = "HUMAN_TRAFFICKING"
    OTHER = "OTHER"


class CrimeCategory(str, Enum):
    """Legal classification of crime."""

    COGNIZABLE = "COGNIZABLE"
    NON_COGNIZABLE = "NON_COGNIZABLE"
    BAILABLE = "BAILABLE"
    NON_BAILABLE = "NON_BAILABLE"
