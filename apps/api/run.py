import uvicorn
from vigilai_api.core.config import get_settings

settings = get_settings()

if __name__ == "__main__":
    uvicorn.run(
        "vigilai_api.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.ENVIRONMENT == "development",
        workers=1,
    )
