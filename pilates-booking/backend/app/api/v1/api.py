from fastapi import APIRouter

from .endpoints import (admin, auth, bookings, classes, device_tokens, emails, logs, notifications, notification_testing, packages, payments,
                        social, users, webhooks)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(classes.router, prefix="/classes", tags=["classes"])
api_router.include_router(bookings.router, prefix="/bookings", tags=["bookings"])
api_router.include_router(packages.router, prefix="/packages", tags=["packages"])
api_router.include_router(payments.router, prefix="/payments", tags=["payments"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(social.router, tags=["social"])
api_router.include_router(webhooks.router, prefix="/webhooks", tags=["webhooks"])
api_router.include_router(logs.router, prefix="/logs", tags=["logging"])
api_router.include_router(emails.router, prefix="/emails", tags=["emails"])
api_router.include_router(device_tokens.router, prefix="/device-tokens", tags=["device-tokens"])
api_router.include_router(notification_testing.router, prefix="/notification-testing", tags=["notification-testing"])
