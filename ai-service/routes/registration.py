from typing import List
from fastapi import APIRouter, File, UploadFile, Form, HTTPException
from schemas.api_schemas import RegisterUserResponse, BatchRegisterUserResponse
from pipelines.registration_pipeline import register_user, register_user_batch, RegistrationError

router = APIRouter(prefix="/register", tags=["Registration"])


@router.post("/batch/", response_model=BatchRegisterUserResponse)
async def api_register_user_batch(
    user_id: str = Form(...),
    images: List[UploadFile] = File(...),
):
    """
    Register a person using multiple photos (recommended).

    All images must each contain exactly ONE face.
    Images where no face / multiple faces are detected are skipped with a warning.
    All valid embeddings are averaged into one strong composite embedding
    stored in MongoDB + FAISS.
    """
    for img in images:
        if not img.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail=f"File '{img.filename}' is not an image.")

    try:
        images_bytes = [await img.read() for img in images]
        result = await register_user_batch(images_bytes, user_id)
        return result
    except RegistrationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")


@router.post("/", response_model=RegisterUserResponse)
async def api_register_user(
    user_id: str = Form(...),
    image: UploadFile = File(...),
):
    """
    Register a single image (backward-compatible).
    Prefer /register/batch/ when multiple photos are available.
    """
    if not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image.")

    try:
        contents = await image.read()
        result = await register_user(contents, user_id)
        return result
    except RegistrationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")
