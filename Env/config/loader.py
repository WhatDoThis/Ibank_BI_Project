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
    # 프로젝트 루트 기준 경로 우선 (실행 위치와 무관하게 동일한 config 로드)
    project_root = base.parent.parent
    config_paths = [
        project_root / "Env" / "config" / "config.json",
        base / "config.json",
    ]
    for config_path in config_paths:
        if config_path.is_file():
            with open(config_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return _dict_to_namespace(data)
    return _dict_to_namespace({"backend": {}, "frontend": {}})
