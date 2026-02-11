"""
Backend.api_server.pluralize (단수/복수 변환·부모 테이블 찾기)
=============================================================
리포트·쿼리 빌더에서 테이블명·컬럼명 처리. report 라우터에서 find_parent_table 사용.

[Main Functions]
===========
- pluralize: 단수 → 복수 변환 (workflow→workflows, company→companies 등, 자음+y→ies 규칙)
- find_parent_table: _id 컬럼명과 allowed_tables로 부모 테이블명 추론 (relationshipOptions용)

[Endpoints/Classes/Functions]
=======================
- (엔드포인트 없음. report 라우터에서 import하여 사용)

[Dependencies]
=========
- 표준 라이브러리만 사용 (외부 패키지 없음)
"""


def pluralize(word):
    """
    단수 → 복수 변환

    Examples:
        workflow → workflows
        company → companies
        box → boxes
    """
    word = word.lower()

    # 1. y → ies (자음 + y)
    if len(word) >= 2 and word.endswith("y") and word[-2] not in "aeiou":
        return word[:-1] + "ies"

    # 2. s, ss, x, z, ch, sh → es
    if word.endswith(("s", "ss", "x", "z", "ch", "sh")):
        return word + "es"

    # 3. 기본: +s
    return word + "s"


def find_parent_table(column_name, allowed_tables):
    """
    _id 컬럼명에서 부모 테이블 찾기

    Args:
        column_name: workflow_id, primary_workflow_id 등
        allowed_tables: ['workflows', 'campaigns', ...]

    Returns:
        부모 테이블명 또는 None

    Examples:
        find_parent_table('workflow_id', ['workflows'])
        → 'workflows'

        find_parent_table('primary_workflow_id', ['primary_workflows'])
        → 'primary_workflows'

        find_parent_table('campaign_id', ['Campaigns'])  # 대소문자 무관
        → 'Campaigns'
    """
    if not column_name.endswith("_id"):
        return None

    # _id 제거
    base = column_name[:-3].rstrip("_")
    if not base:
        return None

    allowed_set = {t.lower() for t in allowed_tables}

    # 1. 정확히 일치 (단수형)
    if base.lower() in allowed_set:
        for t in allowed_tables:
            if t.lower() == base.lower():
                return t

    # 2. 복수형 변환 (+s)
    plural = pluralize(base)
    if plural.lower() in allowed_set:
        for t in allowed_tables:
            if t.lower() == plural.lower():
                return t

    # 3. 복합 단어 처리
    # primary_workflow_id → primary_workflows
    parts = base.split("_")
    if len(parts) >= 2:
        last_word = parts[-1]
        plural_last = pluralize(last_word)
        compound = "_".join(parts[:-1] + [plural_last])

        if compound.lower() in allowed_set:
            for t in allowed_tables:
                if t.lower() == compound.lower():
                    return t

    return None
