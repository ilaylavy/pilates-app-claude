from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import Request
from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.audit_log import AuditLog
from ..models.booking import Booking
from ..models.class_schedule import ClassInstance
from ..models.package import Package, UserPackage
from ..models.payment import Payment
from ..models.transaction import Transaction
from ..models.user import User, UserRole


class AdminService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def log_action(
        self,
        user: User,
        action: str,
        resource_type: str,
        resource_id: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None,
        request: Optional[Request] = None,
    ):
        """Log an admin action for audit purposes."""
        ip_address = None
        user_agent = None

        if request:
            ip_address = request.client.host if request.client else None
            user_agent = request.headers.get("user-agent")

        audit_log = AuditLog(
            user_id=user.id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details,
            ip_address=ip_address,
            user_agent=user_agent,
        )

        self.db.add(audit_log)
        await self.db.commit()

    async def get_users(
        self,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        role_filter: Optional[UserRole] = None,
        active_only: Optional[bool] = None,
    ) -> List[User]:
        """Get users with filters for admin management."""
        query = select(User).options(
            selectinload(User.user_packages), selectinload(User.bookings)
        )

        if search:
            search_filter = or_(
                User.first_name.ilike(f"%{search}%"),
                User.last_name.ilike(f"%{search}%"),
                User.email.ilike(f"%{search}%"),
            )
            query = query.where(search_filter)

        if role_filter:
            query = query.where(User.role == role_filter)

        if active_only is not None:
            query = query.where(User.is_active == active_only)

        query = query.order_by(User.created_at.desc()).offset(skip).limit(limit)

        result = await self.db.execute(query)
        return result.scalars().all()

    async def update_user(
        self,
        user_id: int,
        updates: Dict[str, Any],
        admin_user: User,
        request: Optional[Request] = None,
    ) -> User:
        """Update user details with audit logging."""
        stmt = select(User).where(User.id == user_id)
        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()

        if not user:
            raise ValueError("User not found")

        old_values = {key: getattr(user, key) for key in updates.keys()}

        for key, value in updates.items():
            if hasattr(user, key):
                setattr(user, key, value)

        await self.db.commit()
        await self.db.refresh(user)

        await self.log_action(
            admin_user,
            "UPDATE_USER",
            "User",
            user_id,
            {"old_values": old_values, "new_values": updates},
            request,
        )

        return user

    async def deactivate_user(
        self, user_id: int, admin_user: User, request: Optional[Request] = None
    ) -> User:
        """Deactivate a user account."""
        stmt = select(User).where(User.id == user_id)
        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()

        if not user:
            raise ValueError("User not found")

        user.is_active = False
        await self.db.commit()
        await self.db.refresh(user)

        await self.log_action(
            admin_user,
            "DEACTIVATE_USER",
            "User",
            user_id,
            {"email": user.email},
            request,
        )

        return user

    async def get_dashboard_analytics(self) -> Dict[str, Any]:
        """Get key metrics for admin dashboard."""
        # Total users
        total_users_stmt = select(func.count(User.id))
        total_users = await self.db.scalar(total_users_stmt)

        # Active users (last 30 days)
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        active_users_stmt = select(func.count(User.id)).where(
            User.created_at >= thirty_days_ago
        )
        active_users = await self.db.scalar(active_users_stmt)

        # Total bookings
        total_bookings_stmt = select(func.count(Booking.id))
        total_bookings = await self.db.scalar(total_bookings_stmt)

        # Total revenue (from payments)
        total_revenue_stmt = select(func.coalesce(func.sum(Payment.amount), 0))
        total_revenue = await self.db.scalar(total_revenue_stmt)

        # Monthly revenue (current month)
        first_of_month = datetime.utcnow().replace(
            day=1, hour=0, minute=0, second=0, microsecond=0
        )
        monthly_revenue_stmt = select(func.coalesce(func.sum(Payment.amount), 0)).where(
            Payment.created_at >= first_of_month
        )
        monthly_revenue = await self.db.scalar(monthly_revenue_stmt)

        # Popular packages
        popular_packages_stmt = (
            select(Package.name, func.count(UserPackage.id).label("purchase_count"))
            .join(UserPackage)
            .group_by(Package.id, Package.name)
            .order_by(desc("purchase_count"))
            .limit(5)
        )

        result = await self.db.execute(popular_packages_stmt)
        popular_packages = [
            {"name": row[0], "count": row[1]} for row in result.fetchall()
        ]

        return {
            "total_users": total_users,
            "new_users_last_30_days": active_users,
            "total_bookings": total_bookings,
            "total_revenue": float(total_revenue or 0),
            "monthly_revenue": float(monthly_revenue or 0),
            "popular_packages": popular_packages,
        }

    async def get_revenue_report(
        self, start_date: Optional[datetime] = None, end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Get detailed revenue report."""
        if not start_date:
            start_date = datetime.utcnow() - timedelta(days=30)
        if not end_date:
            end_date = datetime.utcnow()

        # Revenue by date
        revenue_by_date_stmt = (
            select(
                func.date(Payment.created_at).label("date"),
                func.sum(Payment.amount).label("revenue"),
            )
            .where(
                and_(Payment.created_at >= start_date, Payment.created_at <= end_date)
            )
            .group_by(func.date(Payment.created_at))
            .order_by("date")
        )

        result = await self.db.execute(revenue_by_date_stmt)
        revenue_by_date = [
            {"date": str(row[0]), "revenue": float(row[1])} for row in result.fetchall()
        ]

        # Revenue by package
        revenue_by_package_stmt = (
            select(
                Package.name,
                func.sum(Payment.amount).label("revenue"),
                func.count(Payment.id).label("count"),
            )
            .join(UserPackage)
            .join(Payment)
            .where(
                and_(Payment.created_at >= start_date, Payment.created_at <= end_date)
            )
            .group_by(Package.id, Package.name)
            .order_by(desc("revenue"))
        )

        result = await self.db.execute(revenue_by_package_stmt)
        revenue_by_package = [
            {"package": row[0], "revenue": float(row[1]), "sales_count": row[2]}
            for row in result.fetchall()
        ]

        # Total for period
        total_stmt = select(func.sum(Payment.amount)).where(
            and_(Payment.created_at >= start_date, Payment.created_at <= end_date)
        )
        total_revenue = await self.db.scalar(total_stmt)

        return {
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
            },
            "total_revenue": float(total_revenue or 0),
            "revenue_by_date": revenue_by_date,
            "revenue_by_package": revenue_by_package,
        }

    async def get_attendance_report(
        self, start_date: Optional[datetime] = None, end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Get attendance statistics."""
        if not start_date:
            start_date = datetime.utcnow() - timedelta(days=30)
        if not end_date:
            end_date = datetime.utcnow()

        # Bookings by date
        bookings_by_date_stmt = (
            select(
                func.date(Booking.created_at).label("date"),
                func.count(Booking.id).label("bookings"),
            )
            .where(
                and_(Booking.created_at >= start_date, Booking.created_at <= end_date)
            )
            .group_by(func.date(Booking.created_at))
            .order_by("date")
        )

        result = await self.db.execute(bookings_by_date_stmt)
        bookings_by_date = [
            {"date": str(row[0]), "bookings": row[1]} for row in result.fetchall()
        ]

        # Popular class times
        popular_times_stmt = (
            select(ClassInstance.start_time, func.count(Booking.id).label("bookings"))
            .join(Booking)
            .where(
                and_(Booking.created_at >= start_date, Booking.created_at <= end_date)
            )
            .group_by(ClassInstance.start_time)
            .order_by(desc("bookings"))
            .limit(10)
        )

        result = await self.db.execute(popular_times_stmt)
        popular_times = [
            {"time": str(row[0]), "bookings": row[1]} for row in result.fetchall()
        ]

        return {
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
            },
            "bookings_by_date": bookings_by_date,
            "popular_times": popular_times,
        }
