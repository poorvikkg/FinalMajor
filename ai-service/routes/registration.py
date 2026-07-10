from fastapi import APIRouter, File, UploadFile, Form, HTTPException
from schemas.api_schemas import RegisterUserResponse
from pipelines.registration_pipeline import register_user, RegistrationError

router = APIRouter(prefix="/register", tags=["Registration"])

@router.post("/", response_model=RegisterUserResponse)
async def api_register_user(
    user_id: str = Form(...),
    image: UploadFile = File(...)
):
    """
    Register a new user face into the FAISS index.
    Requires an image with exactly one face.
    """
    if not image.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image.")
        
    try:
        contents = await image.read()
        result = await register_user(contents, user_id)
        return result
    except RegistrationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")
