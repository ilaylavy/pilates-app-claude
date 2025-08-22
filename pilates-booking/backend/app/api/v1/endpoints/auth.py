from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from ....core.logging_config import get_logger
from ....models.audit_log import AuditActionType, SecurityLevel
from ....models.user import User
from ....schemas.user import LogoutRequest, Token, TokenRefresh, UserCreate, UserLogin, UserResponse
from ....services.audit_service import AuditService
from ....services.auth_service import AuthService
from ....services.business_logging_service import business_logger
from ....services.security_logging_service import security_logger
from ..deps import get_current_user, get_db

router = APIRouter()
logger = get_logger("app.api.auth")


def _get_device_info(request: Request) -> Dict[str, Any]:
    """Extract device information from request."""
    return {
        "ip_address": _get_client_ip(request),
        "user_agent": request.headers.get("User-Agent"),
        "device_type": "mobile"
        if "Mobile" in request.headers.get("User-Agent", "")
        else "web",
    }


def _get_client_ip(request: Request) -> str:
    """Get the real client IP address."""
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()

    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip

    return request.client.host if request.client else "unknown"


@router.post(
    "/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED
)
async def register(
    request: Request, user_create: UserCreate, db: AsyncSession = Depends(get_db)
):
    """Register a new user."""
    auth_service = AuthService(db)
    audit_service = AuditService(db)

    client_ip = _get_client_ip(request)
    user_agent = request.headers.get("user-agent", "unknown")

    try:
        logger.info(
            "User registration attempt",
            email=user_create.email,
            client_ip=client_ip,
            user_agent=user_agent,
        )

        user, verification_token = await auth_service.create_user_with_verification(
            user_create
        )

        # Log successful registration with comprehensive logging
        business_logger.log_user_registered(
            user_id=str(user.id), email=user.email, registration_method="web"
        )

        await audit_service.log_from_request(
            request=request,
            action=AuditActionType.USER_CREATE,
            user=user,
            security_level=SecurityLevel.MEDIUM,
            details={"email": user.email, "requires_verification": True},
        )

        logger.info(
            "User registration successful",
            email=user.email,
            user_id=str(user.id),
            client_ip=client_ip,
            requires_verification=True,
        )

        # TODO: Send verification email with verification_token

        return user

    except HTTPException as e:
        # Log failed registration attempt
        logger.warning(
            "User registration failed",
            email=user_create.email,
            client_ip=client_ip,
            reason=str(e.detail),
        )

        await audit_service.log_from_request(
            request=request,
            action=AuditActionType.USER_CREATE,
            security_level=SecurityLevel.MEDIUM,
            details={"email": user_create.email, "error": str(e.detail)},
            success="false",
            error_message=str(e.detail),
        )
        raise
    except Exception as e:
        logger.error(
            "User registration failed with exception",
            exc_info=True,
            email=user_create.email,
            client_ip=client_ip,
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed",
        )


@router.post("/login", response_model=Token)
async def login(
    request: Request, user_login: UserLogin, db: AsyncSession = Depends(get_db)
):
    """Login user and return access token."""
    auth_service = AuthService(db)
    audit_service = AuditService(db)

    client_ip = _get_client_ip(request)
    user_agent = request.headers.get("user-agent", "unknown")

    try:
        logger.info(
            "Login attempt",
            email=user_login.email,
            client_ip=client_ip,
            user_agent=user_agent,
        )

        user = await auth_service.authenticate_user(
            user_login.email, user_login.password
        )

        if not user:
            # Log failed login attempt with security logging
            security_logger.log_login_attempt(
                email=user_login.email,
                success=False,
                client_ip=client_ip,
                user_agent=user_agent,
                failure_reason="invalid_credentials",
            )

            # Also log with audit service (gracefully handle failures)
            try:
                await audit_service.log_login_attempt(
                    request=request,
                    email=user_login.email,
                    success=False,
                    error_message="Invalid credentials",
                )
            except Exception as audit_error:
                logger.warning(
                    "Failed to log audit event for failed login",
                    email=user_login.email,
                    error=str(audit_error),
                )

            logger.warning(
                "Login failed - invalid credentials",
                email=user_login.email,
                client_ip=client_ip,
            )

            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if not user.is_active:
            # Log login attempt on inactive user with security logging
            security_logger.log_login_attempt(
                email=user_login.email,
                success=False,
                client_ip=client_ip,
                user_agent=user_agent,
                user_id=str(user.id),
                failure_reason="account_inactive",
            )

            try:
                await audit_service.log_login_attempt(
                    request=request,
                    email=user_login.email,
                    success=False,
                    user=user,
                    error_message="User account is inactive",
                )
            except Exception as audit_error:
                logger.warning(
                    "Failed to log audit event for inactive user login",
                    email=user_login.email,
                    error=str(audit_error),
                )

            logger.warning(
                "Login failed - user account inactive",
                email=user_login.email,
                user_id=str(user.id),
                client_ip=client_ip,
            )

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user"
            )

        if not user.is_verified:
            # Log login attempt on unverified user
            security_logger.log_login_attempt(
                email=user_login.email,
                success=False,
                client_ip=client_ip,
                user_agent=user_agent,
                user_id=str(user.id),
                failure_reason="email_not_verified",
            )

            try:
                await audit_service.log_login_attempt(
                    request=request,
                    email=user_login.email,
                    success=False,
                    user=user,
                    error_message="Email not verified",
                )
            except Exception as audit_error:
                logger.warning(
                    "Failed to log audit event for unverified user login",
                    email=user_login.email,
                    error=str(audit_error),
                )

            logger.warning(
                "Login failed - email not verified",
                email=user_login.email,
                user_id=str(user.id),
                client_ip=client_ip,
            )

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Please verify your email before logging in",
            )

        # Create tokens with device tracking
        device_info = _get_device_info(request)
        tokens = await auth_service.create_user_tokens(user, device_info)

        # Log successful login with comprehensive logging
        security_logger.log_login_attempt(
            email=user_login.email,
            success=True,
            client_ip=client_ip,
            user_agent=user_agent,
            user_id=str(user.id),
        )

        business_logger.log_event(
            "auth.login_success",
            user_id=str(user.id),
            email=user.email,
            client_ip=client_ip,
            device_type=device_info.get("device_type"),
            user_agent=user_agent,
        )

        try:
            await audit_service.log_login_attempt(
                request=request, email=user_login.email, success=True, user=user
            )
        except Exception as audit_error:
            logger.warning(
                "Failed to log audit event for successful login",
                email=user_login.email,
                error=str(audit_error),
            )

        logger.info(
            "Login successful",
            email=user_login.email,
            user_id=str(user.id),
            client_ip=client_ip,
            device_type=device_info.get("device_type"),
        )

        return tokens

    except HTTPException:
        raise
    except Exception as e:
        # Log unexpected error
        try:
            await audit_service.log_login_attempt(
                request=request,
                email=user_login.email,
                success=False,
                error_message=f"Unexpected error: {str(e)}",
            )
        except Exception as audit_error:
            logger.warning(
                "Failed to log audit event for unexpected login error",
                email=user_login.email,
                error=str(audit_error),
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed due to server error",
        )


@router.post("/refresh", response_model=Token)
async def refresh_token(
    request: Request, token_refresh: TokenRefresh, db: AsyncSession = Depends(get_db)
):
    """Refresh access token using refresh token with rotation."""
    auth_service = AuthService(db)
    audit_service = AuditService(db)

    try:
        device_info = _get_device_info(request)
        tokens = await auth_service.refresh_access_token(token_refresh.refresh_token, device_info)

        # Log successful token refresh
        await audit_service.log_from_request(
            request=request,
            action=AuditActionType.TOKEN_REFRESH,
            security_level=SecurityLevel.LOW,
            details={"device_type": device_info.get("device_type")},
        )

        return tokens

    except HTTPException as e:
        # Log failed token refresh
        await audit_service.log_from_request(
            request=request,
            action=AuditActionType.TOKEN_REFRESH,
            security_level=SecurityLevel.MEDIUM,
            success="false",
            error_message=str(e.detail),
        )
        raise


@router.post("/logout")
async def logout(
    request: Request, logout_request: LogoutRequest, db: AsyncSession = Depends(get_db)
):
    """Logout user by invalidating refresh token."""
    auth_service = AuthService(db)
    audit_service = AuditService(db)

    success = await auth_service.logout_user(logout_request.refresh_token)

    # Log logout attempt
    await audit_service.log_from_request(
        request=request,
        action=AuditActionType.LOGOUT,
        security_level=SecurityLevel.LOW,
        success="true" if success else "false",
    )

    return {"message": "Logged out successfully"}


@router.post("/verify-email")
async def verify_email(
    request: Request, token: str, db: AsyncSession = Depends(get_db)
):
    """Verify user email with verification token."""
    auth_service = AuthService(db)
    audit_service = AuditService(db)

    success = await auth_service.verify_email(token)

    if not success:
        await audit_service.log_from_request(
            request=request,
            action=AuditActionType.EMAIL_VERIFICATION,
            security_level=SecurityLevel.MEDIUM,
            success="false",
            error_message="Invalid verification token",
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid verification token"
        )

    await audit_service.log_from_request(
        request=request,
        action=AuditActionType.EMAIL_VERIFICATION,
        security_level=SecurityLevel.MEDIUM,
        details={"token": token[:8] + "..."},  # Log partial token for tracking
    )

    return {"message": "Email verified successfully"}


@router.post("/forgot-password")
async def forgot_password(
    request: Request, email: str, db: AsyncSession = Depends(get_db)
):
    """Request password reset token."""
    auth_service = AuthService(db)
    audit_service = AuditService(db)

    reset_token = await auth_service.generate_password_reset_token(email)

    # Log password reset request
    await audit_service.log_from_request(
        request=request,
        action=AuditActionType.PASSWORD_RESET_REQUEST,
        security_level=SecurityLevel.HIGH,
        details={"email": email},
    )

    # TODO: Send reset email with reset_token

    # Always return success to prevent email enumeration
    return {"message": "If the email exists, a password reset link has been sent"}


@router.post("/reset-password")
async def reset_password(
    request: Request, token: str, new_password: str, db: AsyncSession = Depends(get_db)
):
    """Reset password using reset token."""
    auth_service = AuthService(db)
    audit_service = AuditService(db)

    try:
        success = await auth_service.reset_password(token, new_password)

        if not success:
            await audit_service.log_from_request(
                request=request,
                action=AuditActionType.PASSWORD_RESET_SUCCESS,
                security_level=SecurityLevel.HIGH,
                success="false",
                error_message="Invalid reset token",
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset token",
            )

        await audit_service.log_from_request(
            request=request,
            action=AuditActionType.PASSWORD_RESET_SUCCESS,
            security_level=SecurityLevel.HIGH,
            details={"token": token[:8] + "..."},
        )

        return {"message": "Password reset successfully"}

    except HTTPException:
        raise
    except Exception as e:
        await audit_service.log_from_request(
            request=request,
            action=AuditActionType.PASSWORD_RESET_SUCCESS,
            security_level=SecurityLevel.HIGH,
            success="false",
            error_message=str(e),
        )
        raise


@router.get("/sessions")
async def get_user_sessions(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all active sessions for the current user."""
    auth_service = AuthService(db)
    sessions = await auth_service.get_user_sessions(current_user.id)
    return {"sessions": sessions}


@router.post("/logout-all-devices")
async def logout_all_devices(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Logout user from all devices."""
    auth_service = AuthService(db)
    audit_service = AuditService(db)

    count = await auth_service.logout_all_devices(current_user.id)

    # Log force logout from all devices
    await audit_service.log_from_request(
        request=request,
        action=AuditActionType.FORCE_LOGOUT_ALL,
        user=current_user,
        security_level=SecurityLevel.HIGH,
        details={"devices_logged_out": count},
    )

    return {"message": f"Logged out from {count} devices"}


@router.post("/validate-password")
async def validate_password_strength(password: str, db: AsyncSession = Depends(get_db)):
    """Validate password strength."""
    auth_service = AuthService(db)
    validation = await auth_service.validate_password_requirements(password)
    return validation
