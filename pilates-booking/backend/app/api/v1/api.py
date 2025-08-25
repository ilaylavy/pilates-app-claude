from fastapi import APIRouter

from .endpoints import (admin, auth, bookings, classes, logs, packages, payments,
                        social, users, webhooks)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(classes.router, prefix="/classes", tags=["classes"])
api_router.include_router(bookings.router, prefix="/bookings", tags=["bookings"])
api_router.include_router(packages.router, prefix="/packages", tags=["packages"])
api_router.include_router(payments.router, prefix="/payments", tags=["payments"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(social.router, tags=["social"])
api_router.include_router(webhooks.router, prefix="/webhooks", tags=["webhooks"])
api_router.include_router(logs.router, prefix="/logs", tags=["logging"])
