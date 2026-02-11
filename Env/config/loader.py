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


def _get_config_path():
    """Env/config/config.json 경로 반환."""
    base = Path(__file__).resolve().parent
    project_root = base.parent.parent
    return project_root / "Env" / "config" / "config.json"


def load_config():
    """Env/config/config.json 만 로드. 없으면 예외 발생. 다른 경로/기본값 없음."""
    config_path = _get_config_path()
    if not config_path.is_file():
        raise FileNotFoundError(
            f'Env/config/config.json 이 없습니다. 경로: {config_path}\n'
            'config.json.example 을 복사하여 config.json 을 만들고 backend/frontend 값을 채우세요.'
        )
    with open(config_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return _dict_to_namespace(data)


def add_allowed_table(table_name):
    """
    backend.allowed_tables 에 테이블명을 추가하고 config.json 에 저장.
    이미 있으면 변경 없음. 리포트에서 '저장'으로 테이블 생성 시 자동 등록용.
    반환: (추가 여부, 오류 메시지). (True, None) 또는 (False, None) 또는 (False, "에러메시지")
    """
    if not table_name or not str(table_name).strip():
        return False, "테이블명이 비어 있습니다."
    table_name = str(table_name).strip()
    config_path = _get_config_path()
    if not config_path.is_file():
        return False, "Env/config/config.json 이 없습니다."
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        backend = data.get("backend")
        if not isinstance(backend, dict):
            return False, "config.backend 가 없거나 객체가 아닙니다."
        allowed = backend.get("allowed_tables")
        if not isinstance(allowed, list):
            return False, "backend.allowed_tables 가 배열이 아닙니다."
        if table_name in allowed:
            return False, None
        allowed.append(table_name)
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True, None
    except OSError as e:
        return False, str(e)
    except Exception as e:
        return False, str(e)
