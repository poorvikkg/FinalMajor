"""
Integration tests for FastAPI REST Endpoints.
"""

def test_health_endpoint(test_client):
    response = test_client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_dataset_generate_endpoint(test_client):
    payload = {
        "num_stations": 2,
        "num_officers": 4,
        "num_persons": 10,
        "num_cases": 5,
        "seed_db": False
    }
    response = test_client.post("/api/v1/dataset/generate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["counts"]["cases"] == 5


def test_import_history_endpoint(test_client):
    response = test_client.get("/api/v1/imports/history")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
