import asyncio
import logging
from datetime import datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from ..core.config import settings
from ..core.database import get_db
from .credit_service import CreditService

logger = logging.getLogger(__name__)


class BackgroundTaskService:
    def __init__(self):
        # Create a separate async engine for background tasks
        self.engine = create_async_engine(
            settings.DATABASE_URL, echo=settings.DATABASE_ECHO, pool_pre_ping=True
        )
        self.SessionLocal = sessionmaker(
            self.engine, class_=AsyncSession, expire_on_commit=False
        )

    async def expire_packages_task(self):
        """Background task to expire packages."""
        logger.info("Starting package expiration task")

        async with self.SessionLocal() as db:
            credit_service = CreditService(db)

            try:
                result = await credit_service.expire_packages()

                if result["expired_packages"] > 0:
                    logger.info(
                        f"Expired {result['expired_packages']} packages, "
                        f"created {result['transactions_created']} transactions"
                    )
                else:
                    logger.info("No packages to expire")

            except Exception as e:
                logger.error(f"Error in package expiration task: {str(e)}")
                await db.rollback()
                raise

    async def run_scheduled_tasks(self):
        """Run all scheduled background tasks."""
        while True:
            try:
                # Run package expiration daily at 2 AM
                now = datetime.utcnow()
                next_run = now.replace(hour=2, minute=0, second=0, microsecond=0)

                # If it's already past 2 AM today, schedule for tomorrow
                if now.hour >= 2:
                    next_run += timedelta(days=1)

                # Calculate seconds until next run
                sleep_seconds = (next_run - now).total_seconds()

                logger.info(f"Next package expiration task scheduled for {next_run}")
                await asyncio.sleep(sleep_seconds)

                # Run the task
                await self.expire_packages_task()

                # Sleep for a day minus a few seconds to avoid drift
                await asyncio.sleep(24 * 60 * 60 - 10)

            except Exception as e:
                logger.error(f"Error in scheduled tasks loop: {str(e)}")
                # Wait 1 hour before retrying
                await asyncio.sleep(3600)


# Singleton instance
background_service = BackgroundTaskService()


async def start_background_tasks():
    """Start background tasks. This should be called during app startup."""
    try:
        asyncio.create_task(background_service.run_scheduled_tasks())
        logger.info("Background tasks started")
    except Exception as e:
        logger.error(f"Failed to start background tasks: {str(e)}")


async def stop_background_tasks():
    """Stop background tasks. This should be called during app shutdown."""
    try:
        # Cancel all running tasks
        tasks = [task for task in asyncio.all_tasks() if not task.done()]
        for task in tasks:
            task.cancel()

        # Wait for tasks to complete cancellation
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

        logger.info("Background tasks stopped")
    except Exception as e:
        logger.error(f"Error stopping background tasks: {str(e)}")
