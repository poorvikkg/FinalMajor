# Police Case Intelligence Platform (PCIS) — Synthetic Dataset Generation & Data Ingestion System

Production-Ready **Synthetic Dataset Generation Engine** and **Modular Data Ingestion Framework** built with Python 3.12, FastAPI, Pydantic, Pandas, OpenPyXL, and MongoDB.

---

## System Architecture

The project follows **Clean Architecture** and **SOLID principles**, separating domain logic, data ingestion pipelines, synthetic dataset engines, database persistence layers, REST API controllers, and the AI Intelligence Layer.

```
pcis/
├── src/
│   ├── config/                      # Application settings, logging, database configuration

│   │   ├── database.py
│   │   ├── logging_config.py
│   │   └── settings.py
│   ├── domain/                      # Pydantic models & domain entities for 11 collections
│   │   ├── entities/                # Station, Officer, Case, Person, Document, Evidence, Note, Activity, Attachment, User, Role
│   │   ├── enums/                   # CrimeCategory, CrimeType, CasePriority, CaseStatus, PersonRole, OfficerRank
│   │   ├── exceptions/              # Custom domain & ingestion exceptions
│   │   └── value_objects/           # Location, Address, GovernmentID
│   ├── infrastructure/              # Database repositories & MongoDB index definitions
│   │   └── database/
│   │       └── mongodb/
│   │           ├── base_repository.py
│   │           ├── indexes.py
│   │           └── repositories.py
│   ├── dataset_generator/           # Part 1: Synthetic Dataset Generation Engine
│   │   ├── engine.py                # Pipeline controller & CLI entry point
│   │   ├── seed_data.py             # Realistic Indian names, stations, legal sections (IPC/BNS), templates
│   │   ├── generators.py            # Entity generators for 11 collections
│   │   └── exporters.py             # Multi-format Exporters (JSON, CSV, Excel .xlsx)
│   ├── ingestion/                   # Part 2: Data Ingestion Framework
│   │   ├── pipeline.py              # Ingestion pipeline orchestrator (Parse -> Validate -> Normalize -> Dedup -> Store)
│   │   ├── importers/               # Source Importers (BaseImporter, CSV, Excel, JSON, PDF)
│   │   ├── validators/              # Schema & Business Rule Validators
│   │   ├── normalizers/             # Field Mapping & Canonical Schema Normalizers
│   │   ├── duplicate_checker/       # Cross-Collection Deduplication Engine
│   │   └── reporter.py              # Import Summary & Log Generator
│   ├── api/                         # FastAPI REST Endpoints & Routes
│   │   ├── app.py
│   │   └── routes/
│   │       ├── ingestion_routes.py  # File import endpoints & report retrieval
│   │       ├── dataset_routes.py    # Synthetic dataset generator endpoints
│   │       ├── case_routes.py
│   │       ├── person_routes.py
│   │       └── resource_routes.py
│   ├── ai/                          # Part 3: AI Intelligence Layer (RAG Pipeline)
│   │   ├── embeddings/              # Embedding generator & CSV chunking
│   │   ├── vectorstore/             # FAISS store
│   │   ├── retrievers/              # Mongo, Vector, and Hybrid retrievers
│   │   ├── workflow/                # LangGraph StateGraph pipeline
│   │   ├── planner/                 # Query intent & filter extraction
│   │   ├── context_builder/         # Context building
│   │   ├── llm/                     # Groq LLM integration
│   │   ├── services/                # RAG Service (cache, orchestration)
│   │   ├── routers/                 # AI API routes (/query, /stream, /chat)
│   │   └── utils/                   # Cache, Audit Logger, Memory, Token Counter
├── sample_data/                     # Generated multi-format synthetic datasets
│   ├── json/                        # JSON collection files & all_collections.json
│   ├── csv/                         # CSV collection files
│   └── excel/                       # Excel collection files & police_master_dataset.xlsx
├── logs/                            # Audit Logs & Import Execution Reports
├── tests/                           # Unit & Integration Pytest Suite
└── README.md
```

---

## Architectural & Process Diagrams

### 1. System Architecture Diagram

```mermaid
graph TD
    Client[Client / REST API Consumer] --> API[FastAPI Web Application]
    
    subgraph "API Layer"
        API --> IngestRoutes["/import/csv, /import/excel, /import/json"]
        API --> GenRoutes["/dataset/generate, /dataset/download, /dataset/reset"]
    end
    
    subgraph "Part 1: Dataset Generation Engine"
        GenRoutes --> GenEngine[DatasetGeneratorEngine]
        GenEngine --> SeedData[Realistic Indian Seed Pool]
        GenEngine --> Generators[Entity Generators]
        Generators --> MultiExporter[DatasetExporter]
        MultiExporter --> SampleJSON["sample_data/json/"]
        MultiExporter --> SampleCSV["sample_data/csv/"]
        MultiExporter --> SampleXLS["sample_data/excel/"]
    end

    subgraph "Part 2: Data Ingestion Framework"
        IngestRoutes --> Pipeline[IngestionPipeline]
        Pipeline --> Importer[CSV / Excel / JSON / PDF Importer]
        Importer --> Normalizer[CanonicalNormalizer]
        Normalizer --> Validator[RecordValidator]
        Validator --> Deduplicator[Cross-Collection Deduplicator]
        Deduplicator --> MongoRepo[MongoDB Repositories]
        Pipeline --> Reporter[ImportReporter]
        Reporter --> Logs["logs/import_report_*.json"]
    end

    MongoRepo --> MongoDB[(MongoDB Database)]
```

---

### 2. Data Flow Diagram

```mermaid
flowchart LR
    SourceData[Source Dataset File] --> ImporterParser[Format Importer Parser]
    ImporterParser --> RawDicts[Raw Records Dict]
    RawDicts --> AliasNormalizer[Field Alias & Date Normalizer]
    AliasNormalizer --> CanonicalRecord[Canonical PCIS Record]
    CanonicalRecord --> SchemaValidator[Type & Constraint Validator]
    SchemaValidator -->|Valid| DedupEngine[Duplicate Checker Engine]
    SchemaValidator -->|Invalid| ErrorLogger[Log Validation Error]
    DedupEngine -->|Unique| MongoWriter[MongoDB Repository Writer]
    DedupEngine -->|Duplicate| SkipLogger[Log Duplicate Record]
    MongoWriter --> Database[(MongoDB Collections)]
    ErrorLogger --> ReportGenerator[Import Reporter]
    SkipLogger --> ReportGenerator
    ReportGenerator --> AuditReport[JSON Report in logs/]
```

---

### 3. Import Workflow Diagram

```mermaid
flowchart TD
    A[Start Import Job] --> B{Source File Format}
    B -->|CSV| C1[CSVImporter]
    B -->|Excel| C2[ExcelImporter]
    B -->|JSON| C3[JSONImporter]
    B -->|PDF| C4[PDFImporter]
    
    C1 & C2 & C3 & C4 --> D[Extract Raw Dict Records]
    D --> E[Map Field Aliases to Canonical PCIS Schema]
    E --> F[Normalize Datetime, Phone Numbers & Strings]
    F --> G{Validate Record}
    G -->|Failed| H[Record Validation Error to Report]
    G -->|Passed| I{Check Duplicates}
    I -->|Duplicate Found| J[Record Skipped & Count Increment]
    I -->|New Record| K[Store into MongoDB Collection]
    
    H & J & K --> L{More Records?}
    L -->|Yes| E
    L -->|No| M[Generate Execution Summary Report]
    M --> N[Write Report JSON to logs/ & Return Response]
```

---

### 4. Dataset Generation Workflow Diagram

```mermaid
flowchart TD
    A[Trigger Dataset Generation] --> B[Load Indian Seed Names & Station Templates]
    B --> C[Generate 20 Police Stations]
    C --> D[Generate 200 Officers & Assign Ranks/Stations]
    D --> E[Generate System Roles & 250 Users]
    E --> F[Generate 15,000 Person Records]
    F --> G[Generate 5,000 Case Records with Legal Sections]
    G --> H[Generate 15,000 Case-Person Links with Roles]
    H --> I[Generate 7,000 Investigation Notes]
    I --> J[Generate 10,000 Case Activities Timeline]
    J --> K[Generate 5,000 Evidence Records]
    K --> L[Generate 8,000 Case Documents]
    L --> M[Generate 5,000 Attachment Metadata Records]
    M --> N[Export Identical Data to JSON, CSV, and Excel]
    N --> O[Save files in sample_data/ & Optional Seed to MongoDB]
```

---

### 5. Class Diagram

```mermaid
classDiagram
    class BaseImporter {
        +string collection_name
        +RecordValidator validator
        +CanonicalNormalizer normalizer
        +Deduplicator deduplicator
        +parse(source_path)* List~dict~
        +map_fields(raw_record) dict
        +validate(record) List~str~
        +deduplicate(record) bool
        +store(record, repository) str
        +run(source_path, repository) dict
    }

    class CSVImporter {
        +parse(source_path) List~dict~
    }
    class ExcelImporter {
        +string sheet_name
        +parse(source_path) List~dict~
    }
    class JSONImporter {
        +parse(source_path) List~dict~
    }
    class PDFImporter {
        +parse(source_path) List~dict~
    }

    BaseImporter <|-- CSVImporter
    BaseImporter <|-- ExcelImporter
    BaseImporter <|-- JSONImporter
    BaseImporter <|-- PDFImporter

    class RecordValidator {
        +validate(record, collection_name) List~str~
    }

    class CanonicalNormalizer {
        +normalize(record, collection_name) dict
    }

    class Deduplicator {
        +Set seen_keys
        +is_duplicate(record, collection_name) bool
    }

    class ImportReporter {
        +string log_dir
        +generate_report(import_results) dict
        +get_report_by_id(import_id) dict
    }

    BaseImporter o-- RecordValidator
    BaseImporter o-- CanonicalNormalizer
    BaseImporter o-- Deduplicator
    IngestionPipeline o-- ImportReporter
    IngestionPipeline ..> BaseImporter
```

---

### 6. Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    actor User as Client / Admin
    participant API as FastAPI Router (/import/csv)
    participant Pipeline as IngestionPipeline
    participant Importer as CSVImporter
    participant Normalizer as CanonicalNormalizer
    participant Validator as RecordValidator
    participant Dedup as Deduplicator
    participant DB as MongoDB Repository
    participant Reporter as ImportReporter

    User->>API: POST /api/v1/import/csv (file.csv, collection="cases")
    API->>Pipeline: ingest_file(tmp_path, "cases", "csv")
    Pipeline->>Importer: run(tmp_path, repository)
    Importer->>Importer: parse(tmp_path)
    loop For Each Record in File
        Importer->>Normalizer: normalize(raw_record, "cases")
        Normalizer-->>Importer: canonical_record
        Importer->>Validator: validate(canonical_record, "cases")
        alt Validation Failed
            Validator-->>Importer: [error_messages]
            Importer->>Importer: log error & continue
        else Validation Passed
            Validator-->>Importer: None
            Importer->>Dedup: is_duplicate(canonical_record, "cases")
            alt Duplicate Record
                Dedup-->>Importer: True
                Importer->>Importer: increment total_duplicates & continue
            else Unique Record
                Dedup-->>Importer: False
                Importer->>DB: create(canonical_record)
                DB-->>Importer: inserted_id
            end
        end
    end
    Importer-->>Pipeline: import_results_dict
    Pipeline->>Reporter: generate_report(import_results_dict)
    Reporter-->>Pipeline: report_dict (saved in logs/)
    Pipeline-->>API: report_dict
    API-->>User: 200 OK (JSON Report)
```

---

## Setup & Running Guide

### 1. Environment Setup
Create virtual environment and install dependencies:
```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Run Synthetic Dataset Generator Engine CLI
Generate full 5,000 cases synthetic police ecosystem across JSON, CSV, and Excel:
```bash
python -m src.dataset_generator.engine --stations 20 --officers 200 --persons 15000 --cases 5000
```
Exported files will be generated under `sample_data/`:
- `sample_data/json/`
- `sample_data/csv/`
- `sample_data/excel/` (`police_master_dataset.xlsx` & individual collection workbooks)

### 3. Launch FastAPI Application
```bash
python -m src.main
```
Access interactive OpenAPI documentation at: `http://localhost:8000/docs`

### 4. Run Pytest Test Suite
```bash
python -m pytest tests/ -v
```

---

## Core API Endpoints

- `POST /api/v1/import/csv` — Import CSV dataset file into target collection.
- `POST /api/v1/import/excel` — Import Excel dataset file into target collection.
- `POST /api/v1/import/json` — Import JSON dataset file into target collection.
- `GET /api/v1/imports/history` — List history of import execution runs.
- `GET /api/v1/imports/report/{import_id}` — Retrieve detailed validation/duplicate report.
- `POST /api/v1/dataset/generate` — Trigger synthetic dataset generation via REST API.
- `GET /api/v1/dataset/download` — Download generated JSON, CSV, or Excel dataset files.
- `POST /api/v1/dataset/reset` — Reset database collections and clear sample dataset files.

---

## AI Intelligence Layer Endpoints (RAG Pipeline)

For detailed information, see `src/ai/README.md`.
- `POST /api/v1/ai/query` — Unified RAG query using Groq LLM with intent-based prompt routing.
- `POST /api/v1/ai/stream` — Streaming LLM response via SSE (token-by-token).
- `POST /api/v1/ai/chat` — Multi-turn conversational AI with memory (`session_id`).
- `POST /api/v1/ai/similar` — Find top-K semantically similar documents.
- `POST /api/v1/ai/statistics` — Fetch crime statistics context without full LLM generation.
- `POST /api/v1/ai/summarize` — Summarize a case or dataset.
- `POST /api/v1/ai/compare` — Compare two entities or regions.
- `POST /api/v1/ai/index/build` — Trigger background FAISS index build.
- `GET /api/v1/ai/index/status` — Get status of FAISS index build.
- `GET /api/v1/ai/health` — Get health status of AI components.
