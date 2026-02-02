"""
Env.config (설정 로더)
=====================
config.json 로드 후 config.frontend / config.backend 객체로 노출.

[Main Exports]
===========
- load_config: loader.load_config

[Dependencies]
=========
- Env.config.loader
"""

from Env.config.loader import load_config

__all__ = ['load_config']
