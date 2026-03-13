"""
Backend.new_dash_server2.mappings (코드→라벨 매핑 및 컬럼 헬퍼)
==============================================================
성별·연령대·매장카테고리·채널 상수 및 age_range_columns, gender_columns, normalize_age_range_value.

[Main Functions]
================
1. age_range_columns: prefix 기반 연령대 (컬럼명, 라벨) 리스트
2. gender_columns: prefix 기반 성별 (컬럼명, 라벨) 리스트
3. normalize_age_range_value: "30s" → "30", "over_70s" → "over_70" 등 정규화
"""

GENDER_MAP = {"m": "남자", "f": "여자", "n": "알수없음"}

AGE_RANGE_MAP = {
    "10": "10대",
    "20": "20대",
    "30": "30대",
    "40": "40대",
    "50": "50대",
    "60": "60대",
    "over_70": "70대 이상",
}

STORE_CATEGORY_MAP = {"ss": "매장", "sb": "음료", "sf": "음식"}

CHANNEL_MAP = {
    0: "Email",
    1: "SMS",
    41: "iOS",
    42: "Android",
    121: "Kakao",
}

_AGE_SUFFIXES = ["10", "20", "30", "40", "50", "60", "over_70"]


# 1.
def age_range_columns(prefix: str):
    """prefix 기반 연령대 컬럼명-라벨 리스트. [(prefix_10, 10대), ...]."""
    return [(f"{prefix}_{s}", AGE_RANGE_MAP[s]) for s in _AGE_SUFFIXES]


# 2.
def gender_columns(prefix: str):
    """prefix 기반 성별 컬럼명-라벨 리스트."""
    return [
        (f"{prefix}_male", "남자"),
        (f"{prefix}_female", "여자"),
    ]


# 3.
def normalize_age_range_value(val):
    """DB 값 '30s', 'over_70s' 등 trailing 's' 제거 후 AGE_RANGE_MAP 키로 사용 가능하게."""
    if val is None or not isinstance(val, str):
        return val
    v = val.strip()
    if not v:
        return v
    if v.endswith("s") and v != "s":
        return v[:-1]
    return v
