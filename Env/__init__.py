"""
Env (환경 설정 패키지)
=====================
프로젝트 공통 환경 설정 로드. config.frontend / config.backend 로 접근.

[Dependencies]
=========
- 내부: Env.config.loader
"""

from Env.config import loader

config = loader.load_config()
