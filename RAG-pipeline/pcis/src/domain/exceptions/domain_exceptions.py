"""Domain-level exceptions for PCIS."""


class PCISBaseException(Exception):
    """Base exception for all PCIS errors."""

    def __init__(self, message: str, code: str = "PCIS_ERROR"):
        self.message = message
        self.code = code
        super().__init__(self.message)


# ── Case Exceptions ─────────────────────────────────────────────────────


class CaseNotFoundException(PCISBaseException):
    def __init__(self, identifier: str):
        super().__init__(f"Case not found: {identifier}", "CASE_NOT_FOUND")


class DuplicateFIRException(PCISBaseException):
    def __init__(self, fir_number: str):
        super().__init__(
            f"FIR number already exists: {fir_number}", "DUPLICATE_FIR"
        )


class InvalidCaseStatusTransition(PCISBaseException):
    def __init__(self, current: str, target: str):
        super().__init__(
            f"Invalid status transition: {current} → {target}",
            "INVALID_STATUS_TRANSITION",
        )


# ── Person Exceptions ───────────────────────────────────────────────────


class PersonNotFoundException(PCISBaseException):
    def __init__(self, identifier: str):
        super().__init__(f"Person not found: {identifier}", "PERSON_NOT_FOUND")


class DuplicatePersonException(PCISBaseException):
    def __init__(self, details: str):
        super().__init__(
            f"Duplicate person detected: {details}", "DUPLICATE_PERSON"
        )


# ── Officer Exceptions ──────────────────────────────────────────────────


class OfficerNotFoundException(PCISBaseException):
    def __init__(self, identifier: str):
        super().__init__(
            f"Officer not found: {identifier}", "OFFICER_NOT_FOUND"
        )


class DuplicateBadgeNumberException(PCISBaseException):
    def __init__(self, badge_number: str):
        super().__init__(
            f"Badge number already exists: {badge_number}",
            "DUPLICATE_BADGE_NUMBER",
        )


# ── Validation Exceptions ───────────────────────────────────────────────


class ValidationException(PCISBaseException):
    def __init__(self, message: str, errors: dict | None = None):
        self.errors = errors or {}
        super().__init__(message, "VALIDATION_ERROR")


class ReferentialIntegrityException(PCISBaseException):
    def __init__(self, message: str):
        super().__init__(message, "REFERENTIAL_INTEGRITY_ERROR")


# ── Authorization Exceptions ────────────────────────────────────────────


class AuthenticationException(PCISBaseException):
    def __init__(self, message: str = "Authentication failed"):
        super().__init__(message, "AUTHENTICATION_ERROR")


class AuthorizationException(PCISBaseException):
    def __init__(self, message: str = "Insufficient permissions"):
        super().__init__(message, "AUTHORIZATION_ERROR")


class AccountLockedException(PCISBaseException):
    def __init__(self, username: str):
        super().__init__(
            f"Account is locked: {username}", "ACCOUNT_LOCKED"
        )


# ── Evidence Exceptions ─────────────────────────────────────────────────


class EvidenceNotFoundException(PCISBaseException):
    def __init__(self, identifier: str):
        super().__init__(
            f"Evidence not found: {identifier}", "EVIDENCE_NOT_FOUND"
        )


# ── Document Exceptions ─────────────────────────────────────────────────


class DocumentNotFoundException(PCISBaseException):
    def __init__(self, identifier: str):
        super().__init__(
            f"Document not found: {identifier}", "DOCUMENT_NOT_FOUND"
        )
