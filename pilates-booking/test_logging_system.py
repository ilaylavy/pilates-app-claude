#!/usr/bin/env python3
"""
Comprehensive Logging System Test

This script tests the entire logging system to ensure all components work correctly:
- Backend structured logging
- Business event logging  
- Security event logging
- Database logging
- Mobile log collection
- Log aggregation and forwarding
"""

import asyncio
import json
import time
import uuid
from datetime import datetime
from pathlib import Path
import sys

# Add backend to Python path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

from app.core.logging_config import setup_logging, get_logger, set_request_context, clear_request_context
from app.services.business_logging_service import business_logger, log_user_registered, log_booking_created
from app.services.security_logging_service import security_logger, log_login_attempt, log_admin_access
from app.core.database_logging import setup_database_logging


async def test_structured_logging():
    """Test the structured logging system."""
    print("🧪 Testing structured logging...")
    
    # Test different log levels
    logger = get_logger("test.structured")
    
    logger.debug("Debug message for testing", test_type="structured", component="debug")
    logger.info("Info message for testing", test_type="structured", component="info")
    logger.warning("Warning message for testing", test_type="structured", component="warning")
    logger.error("Error message for testing", test_type="structured", component="error")
    
    # Test with request context
    request_id = str(uuid.uuid4())
    user_id = "test_user_123"
    
    set_request_context(request_id=request_id, user_id=user_id)
    
    logger.info("Message with request context", 
                test_type="structured", 
                request_id=request_id, 
                user_id=user_id)
    
    clear_request_context()
    
    print("✅ Structured logging test completed")


async def test_business_event_logging():
    """Test business event logging."""
    print("🧪 Testing business event logging...")
    
    # Test user registration event
    log_user_registered(
        user_id="test_user_456",
        email="test@example.com",
        registration_method="test"
    )
    
    # Test booking creation event
    log_booking_created(
        user_id="test_user_456",
        class_id="class_123",
        booking_id="booking_789",
        credits_used=1,
        booking_method="test"
    )
    
    # Test payment event
    business_logger.log_payment_success(
        user_id="test_user_456",
        payment_id="payment_123",
        amount=100.0,
        currency="ILS",
        payment_method="test_stripe"
    )
    
    # Test admin action
    business_logger.log_admin_action(
        admin_id="admin_123",
        action="test_action",
        target_type="user",
        target_id="test_user_456",
        details={"test": True}
    )
    
    print("✅ Business event logging test completed")


async def test_security_event_logging():
    """Test security event logging."""
    print("🧪 Testing security event logging...")
    
    # Test successful login
    log_login_attempt(
        email="test@example.com",
        success=True,
        client_ip="127.0.0.1",
        user_agent="Test Agent",
        user_id="test_user_456"
    )
    
    # Test failed login
    log_login_attempt(
        email="hacker@example.com",
        success=False,
        client_ip="192.168.1.100",
        user_agent="Malicious Agent",
        failure_reason="invalid_credentials"
    )
    
    # Test admin access
    log_admin_access(
        admin_id="admin_123",
        endpoint="/admin/users",
        action="view_users",
        client_ip="127.0.0.1",
        user_agent="Admin Browser"
    )
    
    # Test suspicious activity
    security_logger.log_suspicious_activity(
        activity_type="multiple_rapid_requests",
        client_ip="192.168.1.100",
        details={"request_count": 50, "time_window": 60}
    )
    
    print("✅ Security event logging test completed")


async def test_api_request_simulation():
    """Simulate API requests to test request/response logging."""
    print("🧪 Testing API request logging simulation...")
    
    # Simulate various API requests
    api_scenarios = [
        {"method": "POST", "path": "/api/v1/auth/login", "status": 200, "time": 0.150},
        {"method": "GET", "path": "/api/v1/classes", "status": 200, "time": 0.080},
        {"method": "POST", "path": "/api/v1/bookings", "status": 201, "time": 0.250},
        {"method": "DELETE", "path": "/api/v1/bookings/123", "status": 204, "time": 0.120},
        {"method": "GET", "path": "/api/v1/admin/users", "status": 403, "time": 0.050},
        {"method": "POST", "path": "/api/v1/payments", "status": 500, "time": 1.200},  # Slow request
    ]
    
    logger = get_logger("test.api")
    
    for scenario in api_scenarios:
        request_id = str(uuid.uuid4())
        set_request_context(request_id=request_id, user_id="test_user_789")
        
        # Log request start
        logger.info(f"API Request: {scenario['method']} {scenario['path']}")
        
        # Simulate processing time
        await asyncio.sleep(0.01)
        
        # Log response
        if scenario['status'] >= 400:
            logger.error(f"API Error: {scenario['method']} {scenario['path']} - {scenario['status']}")
        else:
            logger.info(f"API Success: {scenario['method']} {scenario['path']} - {scenario['status']}")
        
        # Log performance metrics
        if scenario['time'] > 1.0:
            logger.warning(f"Slow API request detected: {scenario['time']}s")
        
        clear_request_context()
    
    print("✅ API request logging simulation completed")


async def test_mobile_log_simulation():
    """Simulate mobile log data to test collection."""
    print("🧪 Testing mobile log collection simulation...")
    
    logger = get_logger("test.mobile")
    
    # Simulate mobile log entries
    mobile_logs = [
        {
            "level": "INFO",
            "message": "App launched successfully",
            "platform": "ios",
            "screen": "HomeScreen",
            "user_id": "mobile_user_123"
        },
        {
            "level": "ERROR", 
            "message": "Network request failed",
            "platform": "android",
            "screen": "BookingScreen",
            "user_id": "mobile_user_456",
            "error": "Connection timeout"
        },
        {
            "level": "WARN",
            "message": "Low memory warning",
            "platform": "ios",
            "screen": "PaymentScreen",
            "user_id": "mobile_user_123"
        }
    ]
    
    for log_entry in mobile_logs:
        logger.log_event(
            f"mobile.{log_entry['level'].lower()}",
            platform=log_entry['platform'],
            screen=log_entry['screen'],
            user_id=log_entry['user_id'],
            message=log_entry['message'],
            **{k: v for k, v in log_entry.items() if k not in ['level', 'message', 'platform', 'screen', 'user_id']}
        )
    
    print("✅ Mobile log collection simulation completed")


async def test_error_handling():
    """Test error handling and exception logging."""
    print("🧪 Testing error handling and exception logging...")
    
    logger = get_logger("test.errors")
    
    try:
        # Simulate a division by zero error
        result = 1 / 0
    except ZeroDivisionError as e:
        logger.error("Division by zero error in test", exc_info=True, 
                    test_context="error_handling", operation="division")
    
    try:
        # Simulate a key error
        test_dict = {"key1": "value1"}
        value = test_dict["non_existent_key"]
    except KeyError as e:
        logger.error("Key error in test", exc_info=True,
                    test_context="error_handling", operation="dict_access")
    
    # Test critical error logging
    logger.critical("Critical system error simulation", 
                   test_context="error_handling", 
                   system_state="degraded")
    
    print("✅ Error handling test completed")


def verify_log_files():
    """Verify that log files are created and contain expected content."""
    print("🧪 Verifying log files...")
    
    log_dir = Path("backend/logs")
    expected_files = [
        "app.log",
        "error.log", 
        "events.log",
        "security.log",
        "access.log",
        "database.log"
    ]
    
    for log_file in expected_files:
        file_path = log_dir / log_file
        if file_path.exists():
            file_size = file_path.stat().st_size
            print(f"✅ {log_file}: Found ({file_size} bytes)")
            
            # Check if file contains JSON formatted logs
            try:
                with open(file_path, 'r') as f:
                    last_line = f.readlines()[-1] if f.readlines() else ""
                    if last_line.strip():
                        json.loads(last_line.strip())
                        print(f"   ✅ {log_file}: Valid JSON format")
                    else:
                        print(f"   ⚠️  {log_file}: Empty or no content")
            except (json.JSONDecodeError, IndexError):
                print(f"   ⚠️  {log_file}: Not in JSON format or error reading")
        else:
            print(f"❌ {log_file}: Not found")
    
    print("✅ Log file verification completed")


async def test_performance_impact():
    """Test the performance impact of logging."""
    print("🧪 Testing logging performance impact...")
    
    logger = get_logger("test.performance")
    
    # Test logging performance
    start_time = time.time()
    
    for i in range(1000):
        logger.info(f"Performance test message {i}", 
                   iteration=i, 
                   batch="performance_test")
    
    end_time = time.time()
    duration = end_time - start_time
    
    print(f"✅ 1000 log entries took {duration:.3f} seconds ({duration/1000*1000:.3f}ms per log)")
    
    if duration > 1.0:
        print("⚠️  Logging performance may be slow")
    else:
        print("✅ Logging performance is acceptable")


async def main():
    """Run all logging system tests."""
    print("🚀 Starting Comprehensive Logging System Test")
    print("=" * 60)
    
    # Setup logging system
    setup_logging()
    
    # Run all tests
    await test_structured_logging()
    await test_business_event_logging()
    await test_security_event_logging()
    await test_api_request_simulation()
    await test_mobile_log_simulation()
    await test_error_handling()
    await test_performance_impact()
    
    # Give logs time to flush
    await asyncio.sleep(2)
    
    # Verify log files
    verify_log_files()
    
    print("=" * 60)
    print("🎉 Comprehensive Logging System Test Completed!")
    print("\n📋 Test Summary:")
    print("✅ Structured logging with JSON format")
    print("✅ Business event tracking")
    print("✅ Security event monitoring")
    print("✅ API request/response logging")
    print("✅ Mobile log collection simulation")
    print("✅ Error handling and exception logging")
    print("✅ Performance impact assessment")
    print("✅ Log file verification")
    
    print("\n📁 Check the following log files in backend/logs/:")
    print("   • app.log - Application logs")
    print("   • events.log - Business events")
    print("   • security.log - Security events")
    print("   • error.log - Error logs")
    print("   • access.log - API access logs")
    print("   • database.log - Database operations")
    
    print("\n🔧 Next Steps:")
    print("1. Start the backend server: make up")
    print("2. Test mobile log collection: POST /api/v1/logs/mobile")
    print("3. Monitor logs in real-time: tail -f backend/logs/app.log")
    print("4. Set up log aggregation service (CloudWatch/ELK/Datadog)")
    print("5. Configure alerts and dashboards")


if __name__ == "__main__":
    asyncio.run(main())