# Face Recognition & Surveillance Management System (Sentinel)

Welcome to the **Face Recognition & Surveillance Management System** (Second version of Major Project / Final Major). This project is a comprehensive and real-time surveillance platform that integrates state-of-the-art AI-driven facial recognition, secure backend management, and an interactive frontend dashboard.

##  Features

- **Real-Time Face Recognition:** Leverages OpenCV, ONNXRuntime, and FAISS for fast and accurate face detection and matching.
- **Surveillance Dashboard:** Interactive UI built with React and Recharts for monitoring streams and viewing analytics.
- **Alert System:** Real-time notifications via Socket.IO and SMS alerts via Twilio.
- **Object & Video Storage:** Robust media storage powered by MinIO (S3-compatible).
- **Scalable Architecture:** Microservices-based design with an Express backend and a FastAPI Python service for AI tasks.
- **Background Jobs:** Powered by Redis and BullMQ for heavy processing and background tasks.

## 🏗️ System Architecture

The system is split into three main microservices and a containerized infrastructure:

1. **Frontend**: A modern React application bootstrapped with Vite, using Tailwind CSS for styling and Zustand for state management.
2. **Backend**: Node.js Express server handling API routing, authentication, business logic, real-time sockets, and MinIO object storage interactions.
3. **AI Service**: Python FastAPI application dedicated to computer vision tasks, embedding extraction, and FAISS vector search.
4. **Infrastructure (Docker)**: MongoDB (Database), Redis (Caching & Message Queue), and MinIO (Object Storage).

## 🔄 System Workflow (Data Flow)

The following describes how data moves through the Sentinel system from camera capture to user alert:

1. **Video Ingestion:** The frontend or an external camera source sends an RTSP stream link or a video file to the **Node.js Backend**.
2. **AI Processing Trigger:** The backend forwards the stream URL or video data to the **Python AI Service**.
3. **Face Detection & Tracking:** Inside the AI Service, OpenCV reads the frames. The `detector.py` model identifies faces, and `tracker.py` uses ByteTrack to assign consistent IDs across frames.
4. **Feature Extraction & Matching:** Facial embeddings are generated using ONNX models. These embeddings are immediately queried against the **FAISS Database** to find matches against registered suspects.
5. **Alert Generation:** If a match exceeds the confidence threshold, the AI service flags it and hits a webhook/endpoint on the **Node.js Backend**.
6. **Data Storage:** The backend saves the alert details to **MongoDB** and stores any captured face snapshots or video evidence into **MinIO** object storage.
7. **Real-time Notification:** The backend emits a real-time event via **Socket.IO**, which the **React Frontend** immediately displays as a toast notification or dashboard alert on the UI. Simultaneously, a background job via **Redis/BullMQ** can trigger a **Twilio SMS** to security personnel.

## 🛠️ Technologies Used

### Frontend
- **Framework:** React 19 + Vite
- **Styling:** Tailwind CSS + PostCSS
- **State Management:** Zustand, React Query (`@tanstack/react-query`)
- **Routing:** React Router DOM
- **Charts/Visualization:** Recharts
- **Real-time:** Socket.IO Client

### Backend (Node.js)
- **Framework:** Express.js + TypeScript
- **Database:** MongoDB (Mongoose)
- **Caching & Queues:** Redis (ioredis), BullMQ
- **Storage:** MinIO (AWS SDK S3 client)
- **Real-time:** Socket.IO
- **Others:** Twilio, PDFKit, JWT Authentication, Multer

### AI Service (Python)
- **Framework:** FastAPI, Uvicorn
- **AI/ML & Vision:** OpenCV, ONNXRuntime (GPU/CPU), Faiss (Vector Database)
- **Tracking:** LAPX (ByteTrack)
- **Others:** PyMongo, Pydantic, Scikit-image

## 📋 Prerequisites

Make sure you have the following installed on your machine:
- [Node.js](https://nodejs.org/) (v18+)
- [Python](https://www.python.org/) (3.10+)
- [Docker](https://www.docker.com/) & Docker Compose
- [Git](https://git-scm.com/)

## ⚙️ Installation & Setup

Follow these steps to get the development environment running.

### 1. Clone the repository
```bash
git clone <your-repository-url>
cd Major
```

### 🚀 Running All Services At Once (Recommended)

You can launch Docker, Backend, AI Service, and Frontend simultaneously with a single command from the project root:

```bash
python start_all.py
```
*(or run `start.bat` / `npm start`)*

---

### Alternative: Running Services Individually

If you prefer running services separately in individual terminals:

#### 1. Start Infrastructure (Docker)
```bash
docker-compose up -d
```

#### 2. Backend
```bash
cd backend
npm run dev
```

#### 3. AI Service
```bash
cd ai-service
venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

#### 4. Frontend
```bash
cd frontend
npm run dev
```

## 📂 Project Structure & Component Details

This project is divided into three major microservices. Below is a comprehensive breakdown of their internal folder structures and purposes.

### 1. Frontend (`/frontend`)
The frontend is a single-page application built with React, Vite, and Tailwind CSS. It serves as the primary user interface for the surveillance dashboard.

- **`/src/api`**: Contains Axios interceptors and API service calls to communicate with the Node.js backend.
- **`/src/assets`**: Static assets like images, icons, and global stylesheets.
- **`/src/components`**: Reusable React UI components (e.g., Buttons, Modals, Camera Cards, Charts) built using Tailwind CSS.
- **`/src/pages`**: Top-level route components representing full pages (e.g., Dashboard, Cameras View, Suspects List).
- **`/src/router`**: Application routing configuration using React Router DOM.
- **`/src/store`**: Global state management powered by Zustand. Manages application states like authentication, settings, and socket connections.
- **`/src/types`**: TypeScript interface definitions for props and data models to ensure strict type safety.

### 2. Backend (`/backend`)
The backend is a Node.js and Express RESTful API server. It manages the business logic, database operations, and real-time socket communications.

- **`/src/config`**: Configuration files for connecting to MongoDB, Redis, and MinIO storage.
- **`/src/controllers`**: Handles incoming HTTP requests, processes input, and delegates logic to services (e.g., Auth Controller, Camera Controller).
- **`/src/middlewares`**: Express middlewares for Request Validation (Zod), Authentication (JWT), Error Handling, and Rate Limiting.
- **`/src/models`**: Mongoose schemas defining the database structures (e.g., User, Camera, Suspect, Alert).
- **`/src/queues`**: BullMQ configuration for processing background jobs, such as sending emails, SMS alerts, or handling delayed tasks.
- **`/src/repositories`**: Data access layer. Encapsulates database queries to separate them from business logic.
- **`/src/routes`**: Defines all the Express API endpoints mapping to their respective controllers.
- **`/src/services`**: Core business logic (e.g., Recognition Service, Notification Service). Contains the heavy lifting that controllers rely on.
- **`/src/socket`**: Socket.IO event handlers and real-time communication logic for pushing alerts to the frontend.
- **`/src/utils`**: Helper functions, error classes, and common utilities used across the backend.
- **`/src/validators`**: Zod validation schemas to ensure request payloads are strictly typed and safe.

### 3. AI Service (`/ai-service`)
The AI Service is a Python-based FastAPI microservice dedicated entirely to computer vision tasks: face detection, feature extraction, and vector matching.

- **`/pipelines`**: The core logic pipelines for processing data. Includes:
  - `live_pipeline.py`: Real-time processing for RTSP camera streams.
  - `video_pipeline.py`: Batch processing for uploaded video files.
  - `registration_pipeline.py`: Pipeline for registering new suspect faces.
  - `recognition_pipeline.py`: Main logic tying detection, tracking, and matching together.
- **`/services`**: Modules responsible for specific AI tasks:
  - `detector.py`: Face detection logic using OpenCV/ONNX.
  - `faiss_manager.py`: Interacts with FAISS (Facebook AI Similarity Search) to perform high-speed vector matching of facial embeddings.
  - `tracker.py`: Implements object tracking (e.g., ByteTrack) to maintain face identities across consecutive video frames.
  - `model_manager.py`: Loads and manages the ONNX AI models for inference.
- **`/routes`**: FastAPI endpoints that the Node.js backend calls (e.g., register face, process video, start stream).
- **`/schemas`**: Pydantic models for strictly validating API request and response structures.

## 🔒 Environment Variables

Key environment variables required for the `backend/.env` file:
- `PORT`: Backend server port (default 5000)
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: Secret for JSON Web Tokens
- `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`: MinIO storage configurations
- `REDIS_URL`: Redis connection string

---
*Developed as the Final Major Project version 2.*