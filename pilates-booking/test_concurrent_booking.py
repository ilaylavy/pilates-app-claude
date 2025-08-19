#!/usr/bin/env python3
"""
Concurrent booking test to ensure no double-booking occurs under race conditions.

This script simulates multiple users trying to book the same class simultaneously
to test the atomic transaction and locking mechanisms.

Usage: python test_concurrent_booking.py
"""

import asyncio
import aiohttp
import json
import time
from datetime import datetime, timedelta
from typing import Dict, List, Any
import logging

# Configuration
BASE_URL = "http://localhost:8000/api/v1"
NUM_CONCURRENT_USERS = 10
TEST_CLASS_ID = 1  # Adjust based on your test data

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ConcurrentBookingTester:
    def __init__(self):
        self.session = None
        self.test_users = []

    async def setup_test_environment(self):
        """Setup test environment with multiple users."""
        self.session = aiohttp.ClientSession()
        
        logger.info("Setting up test environment...")
        
        # Create test users and authenticate them
        for i in range(NUM_CONCURRENT_USERS):
            user = await self._create_test_user(i)
            if user:
                self.test_users.append(user)
        
        logger.info(f"Created {len(self.test_users)} test users")

    async def _create_test_user(self, user_index: int) -> Dict[str, Any]:
        """Create and authenticate a test user."""
        email = f"test_user_{user_index}@concurrent.test"
        password = "testpassword123"
        
        # Try to register user
        register_data = {
            "email": email,
            "password": password,
            "first_name": f"Test",
            "last_name": f"User{user_index}",
            "phone": f"+123456789{user_index}"
        }
        
        async with self.session.post(f"{BASE_URL}/auth/register", json=register_data) as response:
            if response.status not in [201, 400]:  # 400 might mean user already exists
                logger.warning(f"Failed to register user {user_index}: {response.status}")
        
        # Login user
        login_data = {"email": email, "password": password}
        async with self.session.post(f"{BASE_URL}/auth/login", json=login_data) as response:
            if response.status == 200:
                data = await response.json()
                return {
                    "user_index": user_index,
                    "email": email,
                    "access_token": data["access_token"],
                    "headers": {"Authorization": f"Bearer {data['access_token']}"}
                }
        
        return None

    async def _ensure_user_has_credits(self, user: Dict[str, Any]) -> bool:
        """Ensure user has at least 1 credit for booking."""
        
        # Check current balance
        async with self.session.get(
            f"{BASE_URL}/packages/credit-balance", 
            headers=user["headers"]
        ) as response:
            if response.status == 200:
                data = await response.json()
                if data["credit_balance"] >= 1:
                    return True
        
        # Get available packages
        async with self.session.get(
            f"{BASE_URL}/packages/", 
            headers=user["headers"]
        ) as response:
            if response.status == 200:
                packages = await response.json()
                if packages:
                    # Purchase the first available package
                    package = packages[0]
                    async with self.session.post(
                        f"{BASE_URL}/packages/purchase",
                        headers=user["headers"],
                        params={"package_id": package["id"], "payment_method": "credit_card"}
                    ) as purchase_response:
                        return purchase_response.status == 201
        
        return False

    async def _get_class_capacity(self, class_id: int) -> int:
        """Get the capacity of a class."""
        if not self.test_users:
            return 0
            
        async with self.session.get(
            f"{BASE_URL}/classes/{class_id}",
            headers=self.test_users[0]["headers"]
        ) as response:
            if response.status == 200:
                data = await response.json()
                return data.get("template", {}).get("capacity", 0)
        
        return 0

    async def _clear_existing_bookings(self, class_id: int):
        """Clear any existing bookings for the test class."""
        logger.info("Clearing existing bookings...")
        
        for user in self.test_users:
            # Get user's bookings
            async with self.session.get(
                f"{BASE_URL}/bookings/my-bookings",
                headers=user["headers"]
            ) as response:
                if response.status == 200:
                    bookings = await response.json()
                    
                    # Cancel bookings for the test class
                    for booking in bookings:
                        if (booking["class_instance_id"] == class_id and 
                            booking["status"] == "confirmed" and 
                            booking.get("can_cancel", False)):
                            
                            async with self.session.delete(
                                f"{BASE_URL}/bookings/{booking['id']}/cancel",
                                headers=user["headers"]
                            ) as cancel_response:
                                if cancel_response.status == 200:
                                    logger.info(f"Cancelled booking {booking['id']} for user {user['user_index']}")

    async def _book_class_for_user(self, user: Dict[str, Any], class_id: int) -> Dict[str, Any]:
        """Attempt to book a class for a user."""
        start_time = time.time()
        
        try:
            async with self.session.post(
                f"{BASE_URL}/bookings/book/{class_id}",
                headers=user["headers"]
            ) as response:
                end_time = time.time()
                result = {
                    "user_index": user["user_index"],
                    "status_code": response.status,
                    "response_time_ms": int((end_time - start_time) * 1000),
                    "success": False,
                    "booking_status": None,
                    "error": None
                }
                
                if response.status == 201:
                    data = await response.json()
                    result.update({
                        "success": True,
                        "booking_status": data.get("status"),
                        "available_spots": data.get("available_spots"),
                        "waitlist_position": data.get("waitlist_position")
                    })
                else:
                    error_data = await response.json()
                    result["error"] = error_data.get("detail", "Unknown error")
                
                return result
                
        except Exception as e:
            return {
                "user_index": user["user_index"],
                "status_code": 500,
                "response_time_ms": int((time.time() - start_time) * 1000),
                "success": False,
                "error": str(e)
            }

    async def test_concurrent_booking(self, class_id: int, num_users: int = None) -> Dict[str, Any]:
        """Test concurrent booking with multiple users."""
        if num_users is None:
            num_users = len(self.test_users)
        
        users_to_test = self.test_users[:num_users]
        
        logger.info(f"Testing concurrent booking with {len(users_to_test)} users for class {class_id}")
        
        # Ensure all users have credits
        for user in users_to_test:
            has_credits = await self._ensure_user_has_credits(user)
            if not has_credits:
                logger.error(f"Could not ensure credits for user {user['user_index']}")
                return {"error": "Could not setup user credits"}
        
        # Get class capacity
        class_capacity = await self._get_class_capacity(class_id)
        logger.info(f"Class capacity: {class_capacity}")
        
        # Clear existing bookings
        await self._clear_existing_bookings(class_id)
        
        # Wait a moment for any async operations to complete
        await asyncio.sleep(1)
        
        # Create concurrent booking tasks
        logger.info("Starting concurrent booking attempts...")
        start_time = time.time()
        
        tasks = [
            self._book_class_for_user(user, class_id) 
            for user in users_to_test
        ]
        
        # Execute all booking attempts simultaneously
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        end_time = time.time()
        total_time = end_time - start_time
        
        # Process results
        successful_bookings = []
        waitlisted_users = []
        failed_attempts = []
        
        for result in results:
            if isinstance(result, Exception):
                failed_attempts.append({
                    "user_index": "unknown",
                    "error": str(result)
                })
            elif result["success"]:
                if result["booking_status"] == "confirmed":
                    successful_bookings.append(result)
                elif result["booking_status"] == "waitlisted":
                    waitlisted_users.append(result)
            else:
                failed_attempts.append(result)
        
        # Analyze results
        analysis = {
            "test_summary": {
                "total_users": len(users_to_test),
                "class_capacity": class_capacity,
                "total_test_time_ms": int(total_time * 1000),
                "successful_bookings": len(successful_bookings),
                "waitlisted_users": len(waitlisted_users),
                "failed_attempts": len(failed_attempts)
            },
            "results": {
                "successful_bookings": successful_bookings,
                "waitlisted_users": waitlisted_users,
                "failed_attempts": failed_attempts
            },
            "validation": {
                "no_double_booking": len(successful_bookings) <= class_capacity,
                "expected_successful": min(len(users_to_test), class_capacity),
                "expected_waitlisted": max(0, len(users_to_test) - class_capacity),
                "race_condition_handled": len(successful_bookings) == min(len(users_to_test), class_capacity)
            }
        }
        
        # Performance metrics
        if successful_bookings:
            response_times = [r["response_time_ms"] for r in successful_bookings]
            analysis["performance"] = {
                "avg_response_time_ms": sum(response_times) // len(response_times),
                "min_response_time_ms": min(response_times),
                "max_response_time_ms": max(response_times),
                "total_concurrent_requests": len(users_to_test)
            }
        
        return analysis

    async def test_booking_and_cancellation_race(self, class_id: int) -> Dict[str, Any]:
        """Test booking and cancellation happening simultaneously."""
        if len(self.test_users) < 2:
            return {"error": "Need at least 2 users for this test"}
        
        logger.info("Testing booking and cancellation race condition...")
        
        # First user books the class
        user1 = self.test_users[0]
        await self._ensure_user_has_credits(user1)
        
        booking_result = await self._book_class_for_user(user1, class_id)
        if not booking_result["success"] or booking_result["booking_status"] != "confirmed":
            return {"error": "Could not establish initial booking"}
        
        # Get the booking ID (we'd need to implement this in the API response)
        # For now, we'll get it from the user's bookings
        async with self.session.get(
            f"{BASE_URL}/bookings/my-bookings",
            headers=user1["headers"]
        ) as response:
            if response.status == 200:
                bookings = await response.json()
                test_booking = next((b for b in bookings if b["class_instance_id"] == class_id), None)
                if not test_booking:
                    return {"error": "Could not find booking to test cancellation"}
                booking_id = test_booking["id"]
            else:
                return {"error": "Could not retrieve bookings"}
        
        # Ensure second user has credits
        user2 = self.test_users[1]
        await self._ensure_user_has_credits(user2)
        
        # Simultaneously cancel first booking and try to book with second user
        start_time = time.time()
        
        cancel_task = self.session.delete(
            f"{BASE_URL}/bookings/{booking_id}/cancel",
            headers=user1["headers"]
        )
        book_task = self._book_class_for_user(user2, class_id)
        
        cancel_response, book_result = await asyncio.gather(cancel_task, book_task)
        
        end_time = time.time()
        
        # Process cancellation result
        cancel_success = cancel_response.status == 200
        if cancel_success:
            cancel_data = await cancel_response.json()
        
        return {
            "test_type": "booking_cancellation_race",
            "total_time_ms": int((end_time - start_time) * 1000),
            "cancellation": {
                "success": cancel_success,
                "status_code": cancel_response.status
            },
            "booking_attempt": book_result,
            "race_condition_handled": cancel_success and book_result["success"]
        }

    async def cleanup(self):
        """Cleanup test environment."""
        if self.session:
            await self.session.close()

    async def run_all_tests(self) -> Dict[str, Any]:
        """Run all concurrent booking tests."""
        results = {}
        
        try:
            await self.setup_test_environment()
            
            if not self.test_users:
                return {"error": "No test users available"}
            
            # Test 1: Basic concurrent booking
            logger.info("\n=== Test 1: Basic Concurrent Booking ===")
            results["concurrent_booking"] = await self.test_concurrent_booking(TEST_CLASS_ID)
            
            # Test 2: Booking with different user counts
            logger.info("\n=== Test 2: Booking with Limited Users ===")
            results["limited_users"] = await self.test_concurrent_booking(TEST_CLASS_ID, 3)
            
            # Test 3: Booking and cancellation race
            logger.info("\n=== Test 3: Booking/Cancellation Race ===")
            results["booking_cancellation_race"] = await self.test_booking_and_cancellation_race(TEST_CLASS_ID)
            
            # Overall analysis
            results["overall_analysis"] = self._analyze_overall_results(results)
            
        finally:
            await self.cleanup()
        
        return results

    def _analyze_overall_results(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze overall test results."""
        analysis = {
            "tests_passed": 0,
            "total_tests": 0,
            "issues_found": [],
            "performance_summary": {}
        }
        
        # Analyze concurrent booking test
        if "concurrent_booking" in results:
            test = results["concurrent_booking"]
            analysis["total_tests"] += 1
            
            if test.get("validation", {}).get("no_double_booking", False):
                analysis["tests_passed"] += 1
            else:
                analysis["issues_found"].append("Double booking detected in concurrent test")
            
            if "performance" in test:
                analysis["performance_summary"]["concurrent_booking"] = test["performance"]
        
        # Analyze limited users test
        if "limited_users" in results:
            test = results["limited_users"]
            analysis["total_tests"] += 1
            
            if test.get("validation", {}).get("race_condition_handled", False):
                analysis["tests_passed"] += 1
            else:
                analysis["issues_found"].append("Race condition not properly handled")
        
        # Analyze booking/cancellation race
        if "booking_cancellation_race" in results:
            test = results["booking_cancellation_race"]
            analysis["total_tests"] += 1
            
            if test.get("race_condition_handled", False):
                analysis["tests_passed"] += 1
            else:
                analysis["issues_found"].append("Booking/cancellation race condition not handled")
        
        analysis["success_rate"] = (analysis["tests_passed"] / analysis["total_tests"]) if analysis["total_tests"] > 0 else 0
        
        return analysis


async def main():
    """Main function to run concurrent booking tests."""
    logger.info("🚀 Starting Concurrent Booking Tests")
    logger.info("=" * 50)
    
    tester = ConcurrentBookingTester()
    results = await tester.run_all_tests()
    
    # Print results
    print("\n" + "=" * 50)
    print("📊 CONCURRENT BOOKING TEST RESULTS")
    print("=" * 50)
    
    if "error" in results:
        print(f"❌ Test setup failed: {results['error']}")
        return
    
    # Print overall analysis
    if "overall_analysis" in results:
        analysis = results["overall_analysis"]
        print(f"\n📈 Overall Results:")
        print(f"   Tests Passed: {analysis['tests_passed']}/{analysis['total_tests']}")
        print(f"   Success Rate: {analysis['success_rate']:.1%}")
        
        if analysis["issues_found"]:
            print(f"\n⚠️  Issues Found:")
            for issue in analysis["issues_found"]:
                print(f"   - {issue}")
        else:
            print(f"\n✅ No issues found!")
    
    # Print detailed results
    for test_name, test_results in results.items():
        if test_name == "overall_analysis":
            continue
            
        print(f"\n📋 {test_name.replace('_', ' ').title()}:")
        
        if "test_summary" in test_results:
            summary = test_results["test_summary"]
            print(f"   Users: {summary['total_users']}, Capacity: {summary['class_capacity']}")
            print(f"   Successful: {summary['successful_bookings']}, Waitlisted: {summary['waitlisted_users']}")
            print(f"   Failed: {summary['failed_attempts']}, Time: {summary['total_test_time_ms']}ms")
        
        if "validation" in test_results:
            validation = test_results["validation"]
            print(f"   No Double Booking: {validation.get('no_double_booking', 'N/A')}")
            print(f"   Race Condition Handled: {validation.get('race_condition_handled', 'N/A')}")
        
        if "performance" in test_results:
            perf = test_results["performance"]
            print(f"   Avg Response: {perf['avg_response_time_ms']}ms")
            print(f"   Response Range: {perf['min_response_time_ms']}-{perf['max_response_time_ms']}ms")
    
    # Final verdict
    if "overall_analysis" in results:
        success_rate = results["overall_analysis"]["success_rate"]
        if success_rate == 1.0:
            print(f"\n🎉 ALL TESTS PASSED! The booking system handles concurrent access correctly.")
        elif success_rate >= 0.8:
            print(f"\n⚠️  Most tests passed ({success_rate:.1%}), but some issues need attention.")
        else:
            print(f"\n❌ CRITICAL ISSUES FOUND! Success rate: {success_rate:.1%}")
    
    print("\n" + "=" * 50)


if __name__ == "__main__":
    asyncio.run(main())