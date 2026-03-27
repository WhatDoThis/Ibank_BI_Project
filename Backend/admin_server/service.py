"""
Backend.admin_server.service (어드민 도메인 진입점)
================================================
비즈니스는 service_users, service_roles, service_projects, service_tables 로 분리.
본 모듈은 패키지 역할만 명시.

[Main Functions]
===========
- (라우터는 service_* 모듈을 직접 호출)

[Dependencies]
=========
- Backend.admin_server.service_users
- Backend.admin_server.service_roles
- Backend.admin_server.service_projects
- Backend.admin_server.service_tables
"""

# 분리 파일을 라우터에서 직접 import 하도록 유지한다.
