"""
Mock Redis service for testing caching and rate limiting functionality.
"""

import time
from typing import Dict, Any, Optional, Union
from unittest.mock import MagicMock


class MockRedisService:
    """Mock implementation of Redis service for testing."""
    
    def __init__(self):
        self._data: Dict[str, Any] = {}
        self._expiry: Dict[str, float] = {}
        self._should_fail = False
        self._failure_reason = None
    
    def _is_expired(self, key: str) -> bool:
        """Check if a key has expired."""
        if key not in self._expiry:
            return False
        return time.time() > self._expiry[key]
    
    def _clean_expired(self, key: str):
        """Remove expired key."""
        if self._is_expired(key):
            self._data.pop(key, None)
            self._expiry.pop(key, None)
    
    def get(self, key: str) -> Optional[str]:
        """Mock Redis GET operation."""
        if self._should_fail:
            raise Exception(self._failure_reason or "Redis operation failed")
        
        self._clean_expired(key)
        return self._data.get(key)
    
    def set(
        self,
        key: str,
        value: str,
        ex: Optional[int] = None,
        px: Optional[int] = None,
        nx: bool = False,
        xx: bool = False
    ) -> bool:
        """Mock Redis SET operation."""
        if self._should_fail:
            raise Exception(self._failure_reason or "Redis operation failed")
        
        # Check NX (only set if key doesn't exist)
        if nx and key in self._data and not self._is_expired(key):
            return False
        
        # Check XX (only set if key exists)
        if xx and (key not in self._data or self._is_expired(key)):
            return False
        
        self._data[key] = value
        
        # Set expiry
        if ex is not None:
            self._expiry[key] = time.time() + ex
        elif px is not None:
            self._expiry[key] = time.time() + (px / 1000)
        else:
            self._expiry.pop(key, None)
        
        return True
    
    def delete(self, *keys: str) -> int:
        """Mock Redis DELETE operation."""
        if self._should_fail:
            raise Exception(self._failure_reason or "Redis operation failed")
        
        deleted_count = 0
        for key in keys:
            if key in self._data:
                self._data.pop(key)
                self._expiry.pop(key, None)
                deleted_count += 1
        
        return deleted_count
    
    def exists(self, *keys: str) -> int:
        """Mock Redis EXISTS operation."""
        if self._should_fail:
            raise Exception(self._failure_reason or "Redis operation failed")
        
        count = 0
        for key in keys:
            self._clean_expired(key)
            if key in self._data:
                count += 1
        
        return count
    
    def incr(self, key: str, amount: int = 1) -> int:
        """Mock Redis INCR operation."""
        if self._should_fail:
            raise Exception(self._failure_reason or "Redis operation failed")
        
        self._clean_expired(key)
        
        current_value = int(self._data.get(key, 0))
        new_value = current_value + amount
        self._data[key] = str(new_value)
        
        return new_value
    
    def decr(self, key: str, amount: int = 1) -> int:
        """Mock Redis DECR operation."""
        return self.incr(key, -amount)
    
    def expire(self, key: str, seconds: int) -> bool:
        """Mock Redis EXPIRE operation."""
        if self._should_fail:
            raise Exception(self._failure_reason or "Redis operation failed")
        
        if key not in self._data or self._is_expired(key):
            return False
        
        self._expiry[key] = time.time() + seconds
        return True
    
    def ttl(self, key: str) -> int:
        """Mock Redis TTL operation."""
        if self._should_fail:
            raise Exception(self._failure_reason or "Redis operation failed")
        
        self._clean_expired(key)
        
        if key not in self._data:
            return -2  # Key doesn't exist
        
        if key not in self._expiry:
            return -1  # Key exists but has no expiry
        
        remaining = self._expiry[key] - time.time()
        return max(0, int(remaining))
    
    def hset(self, key: str, mapping: Dict[str, Any]) -> int:
        """Mock Redis HSET operation."""
        if self._should_fail:
            raise Exception(self._failure_reason or "Redis operation failed")
        
        if key not in self._data:
            self._data[key] = {}
        
        if not isinstance(self._data[key], dict):
            self._data[key] = {}
        
        fields_added = 0
        for field, value in mapping.items():
            if field not in self._data[key]:
                fields_added += 1
            self._data[key][field] = str(value)
        
        return fields_added
    
    def hget(self, key: str, field: str) -> Optional[str]:
        """Mock Redis HGET operation."""
        if self._should_fail:
            raise Exception(self._failure_reason or "Redis operation failed")
        
        self._clean_expired(key)
        
        if key not in self._data or not isinstance(self._data[key], dict):
            return None
        
        return self._data[key].get(field)
    
    def hgetall(self, key: str) -> Dict[str, str]:
        """Mock Redis HGETALL operation."""
        if self._should_fail:
            raise Exception(self._failure_reason or "Redis operation failed")
        
        self._clean_expired(key)
        
        if key not in self._data or not isinstance(self._data[key], dict):
            return {}
        
        return self._data[key].copy()
    
    def sadd(self, key: str, *members: str) -> int:
        """Mock Redis SADD operation."""
        if self._should_fail:
            raise Exception(self._failure_reason or "Redis operation failed")
        
        if key not in self._data:
            self._data[key] = set()
        
        if not isinstance(self._data[key], set):
            self._data[key] = set()
        
        added_count = 0
        for member in members:
            if member not in self._data[key]:
                self._data[key].add(member)
                added_count += 1
        
        return added_count
    
    def smembers(self, key: str) -> set:
        """Mock Redis SMEMBERS operation."""
        if self._should_fail:
            raise Exception(self._failure_reason or "Redis operation failed")
        
        self._clean_expired(key)
        
        if key not in self._data or not isinstance(self._data[key], set):
            return set()
        
        return self._data[key].copy()
    
    def srem(self, key: str, *members: str) -> int:
        """Mock Redis SREM operation."""
        if self._should_fail:
            raise Exception(self._failure_reason or "Redis operation failed")
        
        if key not in self._data or not isinstance(self._data[key], set):
            return 0
        
        removed_count = 0
        for member in members:
            if member in self._data[key]:
                self._data[key].remove(member)
                removed_count += 1
        
        return removed_count
    
    def flushall(self):
        """Mock Redis FLUSHALL operation."""
        if self._should_fail:
            raise Exception(self._failure_reason or "Redis operation failed")
        
        self._data.clear()
        self._expiry.clear()
    
    def keys(self, pattern: str = "*") -> list:
        """Mock Redis KEYS operation."""
        if self._should_fail:
            raise Exception(self._failure_reason or "Redis operation failed")
        
        # Clean expired keys
        expired_keys = [k for k in self._expiry.keys() if self._is_expired(k)]
        for key in expired_keys:
            self._data.pop(key, None)
            self._expiry.pop(key, None)
        
        if pattern == "*":
            return list(self._data.keys())
        
        # Simple pattern matching (just support * at the end)
        if pattern.endswith("*"):
            prefix = pattern[:-1]
            return [k for k in self._data.keys() if k.startswith(prefix)]
        
        return [k for k in self._data.keys() if k == pattern]
    
    def set_failure_mode(self, should_fail: bool, reason: Optional[str] = None):
        """Set the mock to simulate Redis failures."""
        self._should_fail = should_fail
        self._failure_reason = reason
    
    def get_all_data(self) -> Dict[str, Any]:
        """Get all stored data (for testing purposes)."""
        return self._data.copy()
    
    def clear_all_data(self):
        """Clear all data and expiry info."""
        self._data.clear()
        self._expiry.clear()


def get_mock_redis_service() -> MockRedisService:
    """Get a configured mock Redis service."""
    return MockRedisService()