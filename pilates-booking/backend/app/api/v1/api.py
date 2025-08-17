from fastapi import APIRouter

from .endpoints import auth, users, classes, bookings, packages

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(classes.router, prefix="/classes", tags=["classes"])
api_router.include_router(bookings.router, prefix="/bookings", tags=["bookings"])
api_router.include_router(packages.router, prefix="/packages", tags=["packages"])