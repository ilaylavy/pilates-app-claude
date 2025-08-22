"""
Redis caching service for frequently accessed data.
"""
import json
import pickle
from typing import Any, Optional, Union, Dict, List
from datetime import timedelta

import redis.asyncio as redis
from redis.asyncio import Redis

from .config import settings


class CacheService:
    """Async Redis cache service for performance optimization."""
    
    def __init__(self):
        self._redis_client: Optional[Redis] = None
        
    async def get_client(self) -> Redis:
        """Get or create Redis client."""
        if self._redis_client is None:
            self._redis_client = redis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=False,  # We handle encoding ourselves
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True,
                health_check_interval=30
            )
        return self._redis_client
    
    async def close(self):
        """Close Redis connection."""
        if self._redis_client:
            await self._redis_client.close()
            
    async def set(
        self, 
        key: str, 
        value: Any, 
        ttl: Optional[Union[int, timedelta]] = None,
        serialize_method: str = "json"
    ) -> bool:
        """
        Set a value in cache.
        
        Args:
            key: Cache key
            value: Value to cache
            ttl: Time to live in seconds or timedelta
            serialize_method: "json" or "pickle"
        """
        try:
            client = await self.get_client()
            
            # Serialize value
            if serialize_method == "json":
                serialized_value = json.dumps(value, default=str).encode("utf-8")
            elif serialize_method == "pickle":
                serialized_value = pickle.dumps(value)
            else:
                raise ValueError(f"Unknown serialize_method: {serialize_method}")
            
            # Convert ttl
            if isinstance(ttl, timedelta):
                ttl = int(ttl.total_seconds())
                
            return await client.set(key, serialized_value, ex=ttl)
        except Exception as e:
            # Log error but don't fail - graceful degradation
            print(f"Cache set error for key {key}: {e}")
            return False
    
    async def get(
        self, 
        key: str, 
        serialize_method: str = "json"
    ) -> Optional[Any]:
        """
        Get a value from cache.
        
        Args:
            key: Cache key
            serialize_method: "json" or "pickle"
        """
        try:
            client = await self.get_client()
            cached_value = await client.get(key)
            
            if cached_value is None:
                return None
                
            # Deserialize value
            if serialize_method == "json":
                return json.loads(cached_value.decode("utf-8"))
            elif serialize_method == "pickle":
                return pickle.loads(cached_value)
            else:
                raise ValueError(f"Unknown serialize_method: {serialize_method}")
                
        except Exception as e:
            # Log error but don't fail - graceful degradation
            print(f"Cache get error for key {key}: {e}")
            return None
    
    async def delete(self, key: str) -> bool:
        """Delete a key from cache."""
        try:
            client = await self.get_client()
            return bool(await client.delete(key))
        except Exception as e:
            print(f"Cache delete error for key {key}: {e}")
            return False
    
    async def delete_pattern(self, pattern: str) -> int:
        """Delete all keys matching a pattern."""
        try:
            client = await self.get_client()
            keys = await client.keys(pattern)
            if keys:
                return await client.delete(*keys)
            return 0
        except Exception as e:
            print(f"Cache delete pattern error for pattern {pattern}: {e}")
            return 0
    
    async def exists(self, key: str) -> bool:
        """Check if key exists in cache."""
        try:
            client = await self.get_client()
            return bool(await client.exists(key))
        except Exception as e:
            print(f"Cache exists error for key {key}: {e}")
            return False
    
    async def set_many(
        self, 
        data: Dict[str, Any], 
        ttl: Optional[Union[int, timedelta]] = None,
        serialize_method: str = "json"
    ) -> bool:
        """Set multiple key-value pairs."""
        try:
            client = await self.get_client()
            
            # Serialize all values
            serialized_data = {}
            for key, value in data.items():
                if serialize_method == "json":
                    serialized_data[key] = json.dumps(value, default=str).encode("utf-8")
                elif serialize_method == "pickle":
                    serialized_data[key] = pickle.dumps(value)
                else:
                    raise ValueError(f"Unknown serialize_method: {serialize_method}")
            
            # Use pipeline for atomic operation
            pipe = client.pipeline()
            for key, serialized_value in serialized_data.items():
                if isinstance(ttl, timedelta):
                    ttl_seconds = int(ttl.total_seconds())
                else:
                    ttl_seconds = ttl
                    
                pipe.set(key, serialized_value, ex=ttl_seconds)
                
            results = await pipe.execute()
            return all(results)
            
        except Exception as e:
            print(f"Cache set_many error: {e}")
            return False
    
    async def get_many(
        self, 
        keys: List[str], 
        serialize_method: str = "json"
    ) -> Dict[str, Any]:
        """Get multiple values by keys."""
        try:
            client = await self.get_client()
            values = await client.mget(keys)
            
            result = {}
            for key, value in zip(keys, values):
                if value is not None:
                    if serialize_method == "json":
                        result[key] = json.loads(value.decode("utf-8"))
                    elif serialize_method == "pickle":
                        result[key] = pickle.loads(value)
                    else:
                        raise ValueError(f"Unknown serialize_method: {serialize_method}")
                        
            return result
            
        except Exception as e:
            print(f"Cache get_many error: {e}")
            return {}


# Global cache instance
cache = CacheService()


# Cache key generators for common patterns
class CacheKeys:
    """Cache key generators for consistent naming."""
    
    @staticmethod
    def user_bookings(user_id: int, include_past: bool = False) -> str:
        """Generate cache key for user bookings."""
        past_suffix = "_with_past" if include_past else "_future"
        return f"user_bookings:{user_id}{past_suffix}"
    
    @staticmethod
    def class_instance(class_id: int) -> str:
        """Generate cache key for class instance."""
        return f"class_instance:{class_id}"
    
    @staticmethod
    def class_capacity(class_id: int) -> str:
        """Generate cache key for class capacity info."""
        return f"class_capacity:{class_id}"
    
    @staticmethod
    def user_packages(user_id: int) -> str:
        """Generate cache key for user packages."""
        return f"user_packages:{user_id}"
    
    @staticmethod
    def weekly_schedule(year: int, week: int) -> str:
        """Generate cache key for weekly class schedule."""
        return f"weekly_schedule:{year}:{week}"


# Cache decorators for common use cases
def cache_result(
    key_func,
    ttl: Union[int, timedelta] = 300,  # 5 minutes default
    serialize_method: str = "json"
):
    """Decorator to cache function results."""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            # Generate cache key
            cache_key = key_func(*args, **kwargs)
            
            # Try to get from cache
            cached_result = await cache.get(cache_key, serialize_method)
            if cached_result is not None:
                return cached_result
            
            # Execute function and cache result
            result = await func(*args, **kwargs)
            await cache.set(cache_key, result, ttl, serialize_method)
            
            return result
        return wrapper
    return decorator


async def invalidate_user_cache(user_id: int):
    """Invalidate all cache entries for a user."""
    patterns = [
        f"user_bookings:{user_id}*",
        f"user_packages:{user_id}*"
    ]
    
    for pattern in patterns:
        await cache.delete_pattern(pattern)


async def invalidate_class_cache(class_id: int):
    """Invalidate all cache entries for a class."""
    patterns = [
        f"class_instance:{class_id}*",
        f"class_capacity:{class_id}*"
    ]
    
    for pattern in patterns:
        await cache.delete_pattern(pattern)