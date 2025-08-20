from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any

from ....schemas.user import UserCreate, UserLogin, UserResponse, Token
from ....services.auth_service import AuthService
from ....services.audit_service import AuditService
from ....models.audit_log import AuditActionType, SecurityLevel
from ....models.user import User
from ..deps import get_db, get_current_user

router = APIRouter()


def _get_device_info(request: Request) -> Dict[str, Any]:
    """Extract device information from request."""
    return {
        "ip_address": _get_client_ip(request),
        "user_agent": request.headers.get("User-Agent"),
        "device_type": "mobile" if "Mobile" in request.headers.get("User-Agent", "") else "web"
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


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    request: Request,
    user_create: UserCreate,
    db: AsyncSession = Depends(get_db)
):
    """Register a new user."""
    auth_service = AuthService(db)
    audit_service = AuditService(db)
    
    try:
        user, verification_token = await auth_service.create_user_with_verification(user_create)
        
        # Log successful registration
        await audit_service.log_from_request(
            request=request,
            action=AuditActionType.USER_CREATE,
            user=user,
            security_level=SecurityLevel.MEDIUM,
            details={"email": user.email, "requires_verification": True}
        )
        
        # TODO: Send verification email with verification_token
        
        return user
    except HTTPException as e:
        # Log failed registration attempt
        await audit_service.log_from_request(
            request=request,
            action=AuditActionType.USER_CREATE,
            security_level=SecurityLevel.MEDIUM,
            details={"email": user_create.email, "error": str(e.detail)},
            success="false",
            error_message=str(e.detail)
        )
        raise


@router.post("/login", response_model=Token)
async def login(
    request: Request,
    user_login: UserLogin,
    db: AsyncSession = Depends(get_db)
):
    """Login user and return access token."""
    auth_service = AuthService(db)
    audit_service = AuditService(db)
    
    try:
        user = await auth_service.authenticate_user(user_login.email, user_login.password)
        
        if not user:
            # Log failed login attempt
            await audit_service.log_login_attempt(
                request=request,
                email=user_login.email,
                success=False,
                error_message="Invalid credentials"
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        if not user.is_active:
            # Log login attempt on inactive user
            await audit_service.log_login_attempt(
                request=request,
                email=user_login.email,
                success=False,
                user=user,
                error_message="User account is inactive"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Inactive user"
            )
        
        if not user.is_verified:
            # Log login attempt on unverified user
            await audit_service.log_login_attempt(
                request=request,
                email=user_login.email,
                success=False,
                user=user,
                error_message="Email not verified"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Please verify your email before logging in"
            )
        
        # Create tokens with device tracking
        device_info = _get_device_info(request)
        tokens = await auth_service.create_user_tokens(user, device_info)
        
        # Log successful login
        await audit_service.log_login_attempt(
            request=request,
            email=user_login.email,
            success=True,
            user=user
        )
        
        return tokens
        
    except HTTPException:
        raise
    except Exception as e:
        # Log unexpected error
        await audit_service.log_login_attempt(
            request=request,
            email=user_login.email,
            success=False,
            error_message=f"Unexpected error: {str(e)}"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed due to server error"
        )


@router.post("/refresh", response_model=Token)
async def refresh_token(
    request: Request,
    refresh_token: str,
    db: AsyncSession = Depends(get_db)
):
    """Refresh access token using refresh token with rotation."""
    auth_service = AuthService(db)
    audit_service = AuditService(db)
    
    try:
        device_info = _get_device_info(request)
        tokens = await auth_service.refresh_access_token(refresh_token, device_info)
        
        # Log successful token refresh
        await audit_service.log_from_request(
            request=request,
            action=AuditActionType.TOKEN_REFRESH,
            security_level=SecurityLevel.LOW,
            details={"device_type": device_info.get("device_type")}
        )
        
        return tokens
        
    except HTTPException as e:
        # Log failed token refresh
        await audit_service.log_from_request(
            request=request,
            action=AuditActionType.TOKEN_REFRESH,
            security_level=SecurityLevel.MEDIUM,
            success="false",
            error_message=str(e.detail)
        )
        raise


@router.post("/logout")
async def logout(
    request: Request,
    refresh_token: str,
    db: AsyncSession = Depends(get_db)
):
    """Logout user by invalidating refresh token."""
    auth_service = AuthService(db)
    audit_service = AuditService(db)
    
    success = await auth_service.logout_user(refresh_token)
    
    # Log logout attempt
    await audit_service.log_from_request(
        request=request,
        action=AuditActionType.LOGOUT,
        security_level=SecurityLevel.LOW,
        success="true" if success else "false"
    )
    
    return {"message": "Logged out successfully"}


@router.post("/verify-email")
async def verify_email(
    request: Request,
    token: str,
    db: AsyncSession = Depends(get_db)
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
            error_message="Invalid verification token"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification token"
        )
    
    await audit_service.log_from_request(
        request=request,
        action=AuditActionType.EMAIL_VERIFICATION,
        security_level=SecurityLevel.MEDIUM,
        details={"token": token[:8] + "..."}  # Log partial token for tracking
    )
    
    return {"message": "Email verified successfully"}


@router.post("/forgot-password")
async def forgot_password(
    request: Request,
    email: str,
    db: AsyncSession = Depends(get_db)
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
        details={"email": email}
    )
    
    # TODO: Send reset email with reset_token
    
    # Always return success to prevent email enumeration
    return {"message": "If the email exists, a password reset link has been sent"}


@router.post("/reset-password")
async def reset_password(
    request: Request,
    token: str,
    new_password: str,
    db: AsyncSession = Depends(get_db)
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
                error_message="Invalid reset token"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset token"
            )
        
        await audit_service.log_from_request(
            request=request,
            action=AuditActionType.PASSWORD_RESET_SUCCESS,
            security_level=SecurityLevel.HIGH,
            details={"token": token[:8] + "..."}
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
            error_message=str(e)
        )
        raise


@router.get("/sessions")
async def get_user_sessions(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all active sessions for the current user."""
    auth_service = AuthService(db)
    sessions = await auth_service.get_user_sessions(current_user.id)
    return {"sessions": sessions}


@router.post("/logout-all-devices")
async def logout_all_devices(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
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
        details={"devices_logged_out": count}
    )
    
    return {"message": f"Logged out from {count} devices"}


@router.post("/validate-password")
async def validate_password_strength(
    password: str,
    db: AsyncSession = Depends(get_db)
):
    """Validate password strength."""
    auth_service = AuthService(db)
    validation = await auth_service.validate_password_requirements(password)
    return validation