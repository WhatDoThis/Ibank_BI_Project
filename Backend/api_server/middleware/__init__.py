"""
Backend.api_server.middleware (ASGI 미들웨어)
===========================================
요청 단위 횡단 관심사(상관 ID 등).

[Main Functions]
===========
- (패키지 마커, CorrelationIdMiddleware 는 correlation 모듈에서 import)

[Dependencies]
=========
- Backend.api_server.middleware.correlation
"""

from Backend.api_server.middleware.correlation import CorrelationIdMiddleware

__all__ = ["CorrelationIdMiddleware"]
