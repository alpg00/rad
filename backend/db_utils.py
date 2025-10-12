"""Database operations with retry mechanism"""
import asyncio
from functools import wraps
import logging
from typing import Callable, Any
import snowflake.connector as sf

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def with_retry(max_retries: int = 3, initial_delay: float = 1.0):
    """Decorator for retrying database operations"""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> Any:
            delay = initial_delay
            last_exception = None
            
            for attempt in range(max_retries):
                try:
                    if asyncio.iscoroutinefunction(func):
                        return await func(*args, **kwargs)
                    return func(*args, **kwargs)
                except sf.errors.OperationalError as e:
                    last_exception = e
                    if attempt < max_retries - 1:
                        logger.warning(f"Database operation failed, attempt {attempt + 1}/{max_retries}: {e}")
                        await asyncio.sleep(delay)
                        delay *= 2  # Exponential backoff
                    continue
                except Exception as e:
                    logger.error(f"Unexpected error in database operation: {e}")
                    raise
            
            logger.error(f"All retries failed for database operation: {last_exception}")
            raise last_exception
        
        return wrapper
    return decorator