"""
Env.config.loader (설정 로더)
=============================
config.json 로드 후 attribute 접근 가능한 객체로 변환.

[Main Functions]
===========
- load_config: Env/config/config.json 로드, config.backend / config.frontend 반환
- _dict_to_namespace: 중첩 dict → SimpleNamespace 변환

[Dependencies]
=========
- json, pathlib, types.SimpleNamespace
"""

import json
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
    """Env/config/config.json 만 로드. 없으면 예외 발생. 다른 경로/기본값 없음."""
    base = Path(__file__).resolve().parent
    project_root = base.parent.parent
    config_path = project_root / "Env" / "config" / "config.json"
    if not config_path.is_file():
        raise FileNotFoundError(
            f'Env/config/config.json 이 없습니다. 경로: {config_path}\n'
            'config.json.example 을 복사하여 config.json 을 만들고 backend/frontend 값을 채우세요.'
        )
    with open(config_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return _dict_to_namespace(data)
