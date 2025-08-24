#!/usr/bin/env python3
"""
Seeding Manager - Central tool for managing different seeding scenarios.
Provides easy access to all seeding scripts and database management.
"""
import argparse
import asyncio
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path

# Add parent directory to path
sys.path.append(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.core.database import AsyncSessionLocal, engine


class SeedingManager:
    """Manager for database seeding operations."""
    
    def __init__(self):
        self.script_dir = Path(__file__).parent
        self.available_scripts = {
            "light": {
                "file": "seed_light.py",
                "description": "Minimal data for basic testing (3 users, 2 packages, 1 week)",
                "estimated_time": "< 30 seconds"
            },
            "medium": {
                "file": "seed_medium.py", 
                "description": "Comprehensive data for realistic testing (8 users, 5 packages, social features)",
                "estimated_time": "1-2 minutes"
            },
            "heavy": {
                "file": "seed_heavy.py",
                "description": "Large dataset for performance testing (200+ users, complex relationships)",
                "estimated_time": "5-10 minutes"
            },
            "custom": {
                "file": "seed_custom.py",
                "description": "Configurable scenarios with custom parameters",
                "estimated_time": "Variable"
            },
            "original": {
                "file": "seed_data.py",
                "description": "Original seeding script (basic functionality)",
                "estimated_time": "< 1 minute"
            }
        }
    
    async def get_database_status(self) -> dict:
        """Get current database statistics."""
        async with AsyncSessionLocal() as session:
            queries = {
                "users": "SELECT COUNT(*) FROM users",
                "packages": "SELECT COUNT(*) FROM packages", 
                "user_packages": "SELECT COUNT(*) FROM user_packages",
                "class_templates": "SELECT COUNT(*) FROM class_templates",
                "class_instances": "SELECT COUNT(*) FROM class_instances",
                "bookings": "SELECT COUNT(*) FROM bookings",
                "friendships": "SELECT COUNT(*) FROM friendships",
                "payments": "SELECT COUNT(*) FROM payments"
            }
            
            stats = {}
            for name, query in queries.items():
                try:
                    result = await session.execute(text(query))
                    stats[name] = result.scalar()
                except Exception as e:
                    stats[name] = f"Error: {e}"
            
            return stats
    
    async def clear_database(self, confirm: bool = False) -> bool:
        """Clear all data from database."""
        if not confirm:
            print("[WARN]  This will delete ALL data from the database!")
            response = input("Type 'yes' to confirm: ")
            if response.lower() != 'yes':
                print("[ERROR] Database clear cancelled.")
                return False
        
        print("[INFO] Clearing database...")
        
        async with AsyncSessionLocal() as session:
            # Disable foreign key checks temporarily
            await session.execute(text("SET session_replication_role = replica;"))
            
            # List of tables to clear (in dependency order)
            tables = [
                "bookings",
                "waitlist_entries", 
                "class_instances",
                "class_templates",
                "payment_approvals",
                "user_packages",
                "payments",
                "friendships",
                "class_invitations",
                "refresh_tokens",
                "audit_logs",
                "packages",
                "users"
            ]
            
            for table in tables:
                try:
                    await session.execute(text(f"TRUNCATE TABLE {table} RESTART IDENTITY CASCADE;"))
                    print(f"  [SUCCESS] Cleared {table}")
                except Exception as e:
                    print(f"  [WARN]  Warning: Could not clear {table}: {e}")
            
            # Re-enable foreign key checks
            await session.execute(text("SET session_replication_role = DEFAULT;"))
            await session.commit()
        
        print("[SUCCESS] Database cleared successfully!")
        return True
    
    def run_seeding_script(self, script_type: str, **kwargs) -> bool:
        """Run a seeding script with optional parameters."""
        if script_type not in self.available_scripts:
            print(f"❌ Unknown script type: {script_type}")
            return False
        
        script_info = self.available_scripts[script_type]
        script_path = self.script_dir / script_info["file"]
        
        if not script_path.exists():
            print(f"❌ Script file not found: {script_path}")
            return False
        
        print(f"[SEED] Running {script_type} seeding script...")
        print(f"[INFO] Description: {script_info['description']}")
        print(f"[TIME] Estimated time: {script_info['estimated_time']}")
        print(f"[START] Starting seeding process...\n")
        
        # Build command
        cmd = [sys.executable, str(script_path)]
        
        # Add custom arguments for custom script
        if script_type == "custom":
            for key, value in kwargs.items():
                if key == "scenario":
                    cmd.extend(["--scenario", str(value)])
                elif key == "students":
                    cmd.extend(["--students", str(value)])
                elif key == "instructors": 
                    cmd.extend(["--instructors", str(value)])
                elif key == "packages":
                    cmd.extend(["--packages", str(value)])
                elif key == "weeks":
                    cmd.extend(["--weeks", str(value)])
                elif key == "approval_pending":
                    cmd.extend(["--approval-pending", str(value)])
                elif key == "booking_rate":
                    cmd.extend(["--booking-rate", str(value)])
                elif key == "no_social":
                    if value:
                        cmd.append("--no-social")
                elif key == "no_payments":
                    if value:
                        cmd.append("--no-payments")
        
        # Run the script
        try:
            start_time = datetime.now()
            result = subprocess.run(cmd, capture_output=False, text=True)
            end_time = datetime.now()
            duration = end_time - start_time
            
            if result.returncode == 0:
                print(f"\n[SUCCESS] Seeding completed successfully in {duration.total_seconds():.1f} seconds!")
                return True
            else:
                print(f"\n❌ Seeding failed with return code {result.returncode}")
                return False
                
        except Exception as e:
            print(f"\n❌ Error running seeding script: {e}")
            return False
    
    def list_available_scripts(self):
        """List all available seeding scripts."""
        print("[LIST] Available Seeding Scripts:")
        print("=" * 50)
        
        for script_type, info in self.available_scripts.items():
            print(f"\n[SCRIPT] {script_type.upper()}")
            print(f"   Description: {info['description']}")
            print(f"   Estimated time: {info['estimated_time']}")
            print(f"   File: {info['file']}")
    
    async def show_database_status(self):
        """Display current database status."""
        print("[STATUS] Current Database Status:")
        print("=" * 30)
        
        stats = await self.get_database_status()
        
        for table, count in stats.items():
            print(f"  {table:.<20} {count}")
        
        total_records = sum(v for v in stats.values() if isinstance(v, int))
        print(f"\n  {'Total records':.<20} {total_records}")


async def main():
    """Main function with command line interface."""
    parser = argparse.ArgumentParser(description="Pilates Database Seeding Manager")
    
    # Main commands
    parser.add_argument("command", 
                       choices=["list", "status", "clear", "seed"],
                       help="Command to execute")
    
    # Seeding options
    parser.add_argument("--type",
                       choices=["light", "medium", "heavy", "custom", "original"],
                       help="Type of seeding script to run")
    
    parser.add_argument("--clear-first", action="store_true",
                       help="Clear database before seeding")
    
    parser.add_argument("--yes", action="store_true",
                       help="Skip confirmation prompts")
    
    # Custom seeding options
    parser.add_argument("--scenario",
                       choices=["balanced", "approval_testing", "social_testing", 
                               "booking_stress", "payment_testing", "minimal", "performance"],
                       help="Custom seeding scenario")
    
    parser.add_argument("--students", type=int, help="Number of students")
    parser.add_argument("--instructors", type=int, help="Number of instructors")
    parser.add_argument("--packages", type=int, help="Number of packages")
    parser.add_argument("--weeks", type=int, help="Number of weeks")
    parser.add_argument("--approval-pending", type=float, help="Approval pending rate")
    parser.add_argument("--booking-rate", type=float, help="Booking rate")
    parser.add_argument("--no-social", action="store_true", help="Disable social features")
    parser.add_argument("--no-payments", action="store_true", help="Disable payment history")
    
    args = parser.parse_args()
    
    manager = SeedingManager()
    
    if args.command == "list":
        manager.list_available_scripts()
        
    elif args.command == "status":
        await manager.show_database_status()
        
    elif args.command == "clear":
        await manager.clear_database(confirm=args.yes)
        
    elif args.command == "seed":
        if not args.type:
            print("❌ Please specify --type for seeding command")
            return
        
        # Clear database first if requested
        if args.clear_first:
            if not await manager.clear_database(confirm=args.yes):
                return
        
        # Prepare custom arguments
        custom_args = {}
        if args.type == "custom":
            if args.scenario:
                custom_args["scenario"] = args.scenario
            if args.students:
                custom_args["students"] = args.students  
            if args.instructors:
                custom_args["instructors"] = args.instructors
            if args.packages:
                custom_args["packages"] = args.packages
            if args.weeks:
                custom_args["weeks"] = args.weeks
            if args.approval_pending:
                custom_args["approval_pending"] = args.approval_pending
            if args.booking_rate:
                custom_args["booking_rate"] = args.booking_rate
            if args.no_social:
                custom_args["no_social"] = True
            if args.no_payments:
                custom_args["no_payments"] = True
        
        # Run seeding
        success = manager.run_seeding_script(args.type, **custom_args)
        
        if success:
            print("\n" + "="*50)
            await manager.show_database_status()


if __name__ == "__main__":
    asyncio.run(main())