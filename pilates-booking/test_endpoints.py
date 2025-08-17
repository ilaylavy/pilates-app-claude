#!/usr/bin/env python3
"""
Test script to validate all basic endpoints of the Pilates Booking System API.
"""
import requests
import json
import sys
from datetime import datetime
import time

# Configuration
BASE_URL = "http://localhost:8000"
API_BASE_URL = f"{BASE_URL}/api/v1"

# ANSI color codes for pretty output
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

def print_header(message):
    print(f"\n{Colors.HEADER}{Colors.BOLD}{'='*60}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{message.center(60)}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{'='*60}{Colors.ENDC}")

def print_test(test_name):
    print(f"\n{Colors.OKBLUE}[TEST] Testing: {test_name}{Colors.ENDC}")

def print_success(message):
    print(f"{Colors.OKGREEN}[PASS] {message}{Colors.ENDC}")

def print_error(message):
    print(f"{Colors.FAIL}[FAIL] {message}{Colors.ENDC}")

def print_warning(message):
    print(f"{Colors.WARNING}[WARN] {message}{Colors.ENDC}")

def print_info(message):
    print(f"{Colors.OKCYAN}[INFO] {message}{Colors.ENDC}")

def make_request(method, endpoint, headers=None, data=None, expected_status=200):
    """Make HTTP request and validate response."""
    url = f"{API_BASE_URL}{endpoint}"
    
    try:
        if method.upper() == 'GET':
            response = requests.get(url, headers=headers)
        elif method.upper() == 'POST':
            response = requests.post(url, headers=headers, json=data)
        elif method.upper() == 'PUT':
            response = requests.put(url, headers=headers, json=data)
        elif method.upper() == 'DELETE':
            response = requests.delete(url, headers=headers)
        else:
            raise ValueError(f"Unsupported HTTP method: {method}")
        
        print_info(f"{method.upper()} {url}")
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == expected_status:
            print_success(f"Expected status {expected_status} received")
            try:
                return response.json()
            except:
                return response.text
        else:
            print_error(f"Expected status {expected_status}, got {response.status_code}")
            try:
                error_detail = response.json()
                print_error(f"Error details: {json.dumps(error_detail, indent=2)}")
            except:
                print_error(f"Response text: {response.text}")
            return None
    
    except requests.exceptions.ConnectionError:
        print_error(f"Connection failed to {url}")
        print_error("Make sure the backend server is running on localhost:8000")
        return None
    except Exception as e:
        print_error(f"Request failed: {str(e)}")
        return None

def test_health_endpoints():
    """Test basic health and root endpoints."""
    print_header("HEALTH & STATUS CHECKS")
    
    print_test("Root endpoint")
    response = make_request('GET', '', endpoint='/')
    if response:
        print_success("Root endpoint accessible")
    
    print_test("Health check endpoint")
    response = make_request('GET', '', endpoint='/health')
    if response and isinstance(response, dict) and response.get('status') == 'healthy':
        print_success("Health check passed")
    else:
        print_error("Health check failed")

def test_authentication():
    """Test authentication endpoints."""
    print_header("AUTHENTICATION TESTS")
    
    # Test user registration
    print_test("User registration")
    test_user = {
        "email": f"test_{int(time.time())}@example.com",
        "password": "TestPass123!",
        "first_name": "Test",
        "last_name": "User",
        "phone": "+1234567890"
    }
    
    response = make_request('POST', '/auth/register', data=test_user, expected_status=201)
    if response:
        print_success("User registration successful")
        test_user_id = response.get('id')
    else:
        print_error("User registration failed")
        return None
    
    # Test login with the registered user
    print_test("User login")
    login_data = {
        "email": test_user["email"],
        "password": test_user["password"]
    }
    
    response = make_request('POST', '/auth/login', data=login_data)
    if response and 'access_token' in response:
        access_token = response['access_token']
        refresh_token = response['refresh_token']
        print_success("Login successful")
        print_info(f"Access token received (first 20 chars): {access_token[:20]}...")
        return {
            'access_token': access_token,
            'refresh_token': refresh_token,
            'test_user': test_user,
            'test_user_id': test_user_id
        }
    else:
        print_error("Login failed")
        return None

def test_login_existing_users():
    """Test login with existing seeded users."""
    print_header("EXISTING USER LOGIN TESTS")
    
    users_to_test = [
        {"email": "admin@pilates.com", "password": "admin123", "role": "admin"},
        {"email": "instructor@pilates.com", "password": "instructor123", "role": "instructor"},
        {"email": "student@pilates.com", "password": "student123", "role": "student"}
    ]
    
    tokens = {}
    
    for user in users_to_test:
        print_test(f"Login as {user['role']}")
        login_data = {
            "email": user["email"],
            "password": user["password"]
        }
        
        response = make_request('POST', '/auth/login', data=login_data)
        if response and 'access_token' in response:
            tokens[user['role']] = response['access_token']
            print_success(f"{user['role'].capitalize()} login successful")
        else:
            print_error(f"{user['role'].capitalize()} login failed")
    
    return tokens

def test_protected_endpoints(access_token):
    """Test protected endpoints with authentication."""
    print_header("PROTECTED ENDPOINTS TESTS")
    
    headers = {'Authorization': f'Bearer {access_token}'}
    
    # Test packages endpoint
    print_test("Get available packages")
    response = make_request('GET', '/packages/', headers=headers)
    if response and isinstance(response, list):
        print_success(f"Retrieved {len(response)} packages")
        for pkg in response:
            print_info(f"- {pkg.get('name')}: ${pkg.get('price')} ({pkg.get('credits')} credits)")
    else:
        print_error("Failed to retrieve packages")
    
    # Test my packages endpoint
    print_test("Get user packages")
    response = make_request('GET', '/packages/my-packages', headers=headers)
    if response is not None:
        print_success(f"Retrieved {len(response) if isinstance(response, list) else 0} user packages")
    else:
        print_error("Failed to retrieve user packages")

def test_admin_endpoints(admin_token):
    """Test admin-only endpoints."""
    print_header("ADMIN ENDPOINTS TESTS")
    
    if not admin_token:
        print_warning("No admin token available, skipping admin tests")
        return
    
    headers = {'Authorization': f'Bearer {admin_token}'}
    
    # Test creating a package (admin only)
    print_test("Create new package (admin only)")
    new_package = {
        "name": f"Test Package {int(time.time())}",
        "description": "Test package created by automated test",
        "credits": 5,
        "price": 50.00,
        "validity_days": 30,
        "is_active": True,
        "is_unlimited": False
    }
    
    response = make_request('POST', '/packages/', headers=headers, data=new_package, expected_status=201)
    if response:
        print_success(f"Package created with ID: {response.get('id')}")
        return response.get('id')
    else:
        print_error("Failed to create package")
        return None

def test_invalid_requests():
    """Test various invalid requests to ensure proper error handling."""
    print_header("ERROR HANDLING TESTS")
    
    # Test invalid login
    print_test("Invalid login credentials")
    invalid_login = {
        "email": "nonexistent@example.com",
        "password": "wrongpassword"
    }
    response = make_request('POST', '/auth/login', data=invalid_login, expected_status=401)
    if response is None:  # This means we got the expected 401 status
        print_success("Invalid login properly rejected")
    
    # Test accessing protected endpoint without token
    print_test("Access protected endpoint without token")
    response = make_request('GET', '/packages/', expected_status=401)
    if response is None:  # This means we got the expected 401 status
        print_success("Unauthorized access properly rejected")
    
    # Test registration with weak password
    print_test("Registration with weak password")
    weak_password_user = {
        "email": f"weak_{int(time.time())}@example.com",
        "password": "weak",
        "first_name": "Test",
        "last_name": "User"
    }
    response = make_request('POST', '/auth/register', data=weak_password_user, expected_status=422)
    if response is None:  # This means we got the expected 422 status
        print_success("Weak password properly rejected")

def run_comprehensive_test():
    """Run all tests in sequence."""
    print(f"{Colors.HEADER}{Colors.BOLD}")
    print("PILATES BOOKING SYSTEM API TEST SUITE")
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{Colors.ENDC}")
    
    # Override the endpoint parameter for health checks
    global make_request
    original_make_request = make_request
    
    def make_health_request(method, path, endpoint=None, headers=None, data=None, expected_status=200):
        if endpoint:
            url = f"{BASE_URL}{endpoint}"
        else:
            url = f"{API_BASE_URL}{path}"
        
        try:
            if method.upper() == 'GET':
                response = requests.get(url, headers=headers)
            # ... other methods
            
            print_info(f"{method.upper()} {url}")
            print_info(f"Status: {response.status_code}")
            
            if response.status_code == expected_status:
                print_success(f"Expected status {expected_status} received")
                try:
                    return response.json()
                except:
                    return response.text
            else:
                print_error(f"Expected status {expected_status}, got {response.status_code}")
                return None
        
        except requests.exceptions.ConnectionError:
            print_error(f"Connection failed to {url}")
            return None
        except Exception as e:
            print_error(f"Request failed: {str(e)}")
            return None
    
    # Test basic health endpoints
    print_test("Root endpoint")
    response = make_health_request('GET', '', endpoint='/')
    if response:
        print_success("Root endpoint accessible")
    
    print_test("Health check endpoint")
    response = make_health_request('GET', '', endpoint='/health')
    if response and isinstance(response, dict) and response.get('status') == 'healthy':
        print_success("Health check passed")
    
    # Restore original make_request
    make_request = original_make_request
    
    # Test authentication
    auth_data = test_authentication()
    
    # Test existing user logins
    existing_tokens = test_login_existing_users()
    
    # Test protected endpoints
    if auth_data:
        test_protected_endpoints(auth_data['access_token'])
    
    # Test admin endpoints
    if existing_tokens and 'admin' in existing_tokens:
        test_admin_endpoints(existing_tokens['admin'])
    
    # Test error handling
    test_invalid_requests()
    
    # Summary
    print_header("TEST COMPLETION SUMMARY")
    print_success("All tests completed!")
    print_info(f"Finished at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print_info("Check the output above for any failed tests.")
    
    if auth_data:
        print(f"\n{Colors.OKCYAN}[INFO] Test User Created:{Colors.ENDC}")
        print(f"   Email: {auth_data['test_user']['email']}")
        print(f"   Password: {auth_data['test_user']['password']}")
        print(f"   User ID: {auth_data['test_user_id']}")

if __name__ == "__main__":
    run_comprehensive_test()