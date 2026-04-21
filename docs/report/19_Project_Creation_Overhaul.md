# 프로젝트 생성 전면 개편 (구현 명세·단계)

**요약**: 시스템 기본 `pmssn_master` 자동 배정(`default_manager_pmssn_master_id`) 제거. 생성 시 **생성자가 선택한 `creator_pmssn_master_id`** 로 `project_ptcpnt_info` 등록. 단일 트랜잭션으로 `project_info` + `table_project_mapping` + 부서 내 멤버 + 타부서 알림 초대 처리. 수락은 `/api/projects/{project_info_id}/accept-invite`. 고객 여정 **Phase 6**은 `docs/main/06_CUSTOMER_JOURNEY.md`에 동기화됨.

**근거 문서**: 사용자가 전달한 구현 명세서, `docs/main/04_DB_ARCHITECTURE.md`(table_project_mapping·notification_info), `docs/main/05_PERMISSION_GUIDE.md`(pmssn·기능 ID), `docs/report/03_AI_DEVELOP_GUIDE.md`(허용 테이블 = 매핑).

**주의**: `project_info`에 **`feature_flags` jsonb**(`query`,`dash`,`widget`)로 프로젝트 단위 페이지 on/off를 저장한다. `table_master.del_yn` 컬럼은 현재 코드베이스에 없음 — 목록 API는 전체 행 기준, 필요 시 DDL 추가 후 필터.

---

## Phase 1 (백엔드 핵심) — 완료 목표

| 항목 | 내용 |
|------|------|
| `service_projects` | `default_manager_pmssn_master_id` 삭제. `create_project_full` 추가(단일 트랜잭션). |
| `schemas` | `ProjectCreateBody` 확장: `creator_pmssn_master_id`, `feature_flags`(query·dash·widget), `table_master_ids`, `members`, `external_invites`. |
| `admin_server/router` | `POST /api/admin/projects` → `create_project_full`. |
| `service_tables` | 테이블 마스터 목록 정렬 모드 `sort=project_create` (dash→main, update_dtm DESC NULLS LAST, table_name ASC). |
| `admin_server/router` | `GET /api/admin/tables?sort=project_create`. |
| `service_users` | `list_users_dept_tree_for_project_create` + `GET /api/admin/users?scope=dept_tree` (생성자 제외·활성만). |
| `project_server` | `POST /api/projects/{project_info_id}/accept-invite` + `accept_project_invite` 서비스. |
| 회귀 | 기존 `add_member`·목록 API 동작 유지. |

---

## Phase 2 (프론트)

| 항목 | 내용 |
|------|------|
| `AdminProjectsPage.jsx` | 생성 모달 전면: 필드 길이·체크박스·테이블 매핑 스크롤·부서 내/외 참여자·제출 검증. |
| `adminClient.js` | `postAdminProject` 바디 확장, 모달용 `getAdminUsersDeptTree` 등. |
| `authClient.js` | `postAcceptProjectInvite` — `/api/projects/{id}/accept-invite`. |
| `NotificationBell` / 알림 UI | `project_invite` JSON 수락 버튼 → accept API. |
| `admin-pages.css` (`ap__modal--create-wide`) | 생성 모달 가로 폭(약 1040~1200px 상한). 배경 클릭으로 닫지 않음. |

---

## Phase 3 (정합·문서)

| 항목 | 내용 |
|------|------|
| `docs/main/06_CUSTOMER_JOURNEY.md` | Phase 6: `create_project_full` 단일 POST + `accept-invite` 기준으로 갱신됨. |
| `docs/log/log.md` | 구현 완료 로그. |

---

## API 요약 (명세 반영)

- `POST /api/admin/projects` — 바디: `project_name`, `project_dscrtn`, `creator_pmssn_master_id`(필수), `feature_flags`(`query`,`dash`,`widget`, 생략 시 전부 true), `table_master_ids`, `members[]`, `external_invites[]`.
- `POST /api/projects/{project_info_id}/accept-invite` — 바디: `{ "notification_info_id": N }` (로그인 사용자 = 초대 수신자).
- `GET /api/admin/tables?sort=project_create`
- `GET /api/admin/users?scope=dept_tree`
- `GET /api/admin/roles?scope=project_assignable` — 생성 모달·멤버 배정용(시스템+부서 커스텀).
- `GET /api/admin/users/search` — 전역 검색 시 **액터가 sa_dev가 아니고 소속 부서가 0이 아니면** `dptmt_info_id=0`(개발·시스템 부서) 소속 계정은 결과에서 제외. `POST /projects`·멤버 추가도 동일 정책으로 서버 검증.

---

## 공통 모듈 영향

- **`_assert_pmssn_for_project`**: 변경 없음. 신규 생성 직후에도 동일 규칙으로 역할 검증.
- **`list_roles_for_dept`**: 변경 없음.
- **`insert_notification`**: `create_project_full` 내부에서는 **커밋을 하지 않는** raw `INSERT`로 동일 트랜잭션 유지(기존 `insert_notification`은 자체 `commit` 있음 — 사용하지 않음).
