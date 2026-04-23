"""
widget_board_server.constants (위젯 보드 상수)
==============================================
API·UI와 정합할 보드 설명 최대 길이.

[Main Functions]
===========
- BOARD_DSCRTN_MAX_LEN: board_dscrtn 허용 문자 수(운영 DB가 VARCHAR(n)이면 n과 동일하게 유지)

본문 `# N.` 없음(상수 전용 모듈).

[Dependencies]
=========
- 없음
"""

# DDL이 TEXT여도 상용 입력 상한. DB를 VARCHAR로 두는 경우 이 값과 맞출 것.
BOARD_DSCRTN_MAX_LEN = 1000
