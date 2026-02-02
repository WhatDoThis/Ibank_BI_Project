"""
Env.config.loader (설정 로더)
=============================
config.json 로드 후 attribute 접근 가능한 객체로 변환.
환경 변수(.env)로 오버라이드 시 dotenv는 각 앱에서 로드.
"""

import json
import os
from pathlib import Path
from types import SimpleNamespace


def _dict_to_namespace(d):
    """중첩 dict를 attribute 접근 가능한 객체로 변환."""
    if isinstance(d, dict):
        return SimpleNamespace(**{k: _dict_to_namespace(v) for k, v in d.items()})
    if isinstance(d, list):
        return [_dict_to_namespace(x) for x in d]
    return d


def load_config():
    """Env/config/config.json 로드. config.backend / config.frontend 반환."""
    base = Path(__file__).resolve().parent
    config_path = base / "config.json"
    if not config_path.exists():
        return _dict_to_namespace({"backend": {}, "frontend": {}})
    with open(config_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return _dict_to_namespace(data)
