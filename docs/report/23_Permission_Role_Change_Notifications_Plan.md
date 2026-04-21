# 23. 조직 역할·프로젝트 권한·ETL 자격 변경 알림(앱 내 + 이메일) 및 기존 회원 타부서 프로젝트 초대 이메일

**한 줄 요약**: 관리자가 **조직 역할(`user_info.user_dvsn`)**, **ETL 자격(`etl_yn`)**, **프로젝트 권한(`project_ptcpnt_info.pmssn_master_id`)**, **계정 정지·활성**을 변경할 때, **변경 대상 사용자**에게 **`notification_info` 앱 내 알림**과 **SMTP 이메일**을 함께 보낸다. DB 커밋 성공 이후 발송하며, 이메일 실패는 본 업무를 막지 않는다. **사용자 관리 일괄 변경**은 **역할 또는 ETL 또는 프로젝트 권한** 중 하나라도 바뀐 경우에만 알림한다. **추가로**, 이미 가입된 사용자에게 **타부서 경로로 `project_invite` 앱 알림을 보내는 경우**(`add_member`, `create_project_full` 외부 초대)에는 **동일 플로우에서 이메일까지 필수 발송**한다(가입 초대 `send_invite_email`과 별도 함수).

**요구 출처**: 사용자 요청(권한·역할 변경 인지), 기존 `notification_server`·`Backend/mail` 패턴 확장.

---

## 목차

| 구분 | 섹션 | 내용 |
|------|------|------|
| 메타 | [0. 문서 메타](#0-문서-메타) | 범위·교차 참조 |
| 분석 | [1. 배경·목표·용어](#1-배경목표용어) | 역할 vs 권한·현행 갭 |
| 분석 | [2. 현행 코드 확인 결과](#2-현행-코드-확인-결과) | 알림·이메일·차단 정책 |
| 설계 | [3. 알림 대상 액션 표](#3-알림-대상-액션-표) | noti_type·이메일·수신자 |
| 설계 | [4. 설계 원칙](#4-설계-원칙) | 트랜잭션·정지 시 예외 |
| 구현 | [5. Phase 1 — 공통 모듈](#5-phase-1--공통-모듈) | 헬퍼·이메일 템플릿 |
| 구현 | [6. Phase 2 — 호출 삽입](#6-phase-2--호출-삽입) | 서비스별 커밋 후 |
| 구현 | [7. Phase 3 — 프론트·문서](#7-phase-3--프론트문서) | 타입 표시·가이드 |
| 비범위 | [8. 비범위·추후 검토](#8-비범위추후-검토) | feature_flags 등 |
| 마무리 | [9. 검증 체크리스트](#9-검증-체크리스트) | 정합·SMTP 스킵 |
| 부록 | [10. 문서 이력](#10-문서-이력) | 유지보수 |

---

## 0. 문서 메타

**목적**  
권한·역할 변경은 보안·업무 연속성 측면에서 **대상 사용자가 즉시 인지**할 수 있어야 한다. 기존에 확립된 **`insert_notification`**(앱 내)과 **`send_email`**(SMTP 미설정 시 로그 폴백) 패턴을 재사용해 **이중 채널**을 제공한다.

**본 문서 범위**  
- 백엔드: `admin_server` 사용자·프로젝트 서비스의 **확정된 변경 지점**에 알림·이메일 후킹, 공통 헬퍼(신설), **`Backend/mail/outbound.py`(또는 분리 모듈)**에 **역할·권한 변경용** 및 **기존 회원 프로젝트 초대용** 발송 함수 추가  
- **필수 포함**: 타부서 **`project_invite`** 경로(`service_projects.add_member`의 `invite_sent`, `create_project_full`의 외부 초대로 `insert_notification` 하는 모든 분기)에서 **앱 알림과 동일 대상에게 이메일** 발송  
- 운영: `noti_type` 값 확장(컬럼 길이 **최대 30자** — `insert_notification`에서 `(noti_type or "")[:30]` 적용)

**범위 밖(1차)**  
- **프로젝트 `feature_flags` 변경**으로 인한 유효 권한 변동에 대한 **일괄 사용자 알림**(영향 범위·메시지 정의가 별도 합의 필요 → [8](#8-비범위추후-검토))  
- 실시간 WebSocket 푸시(현행은 목록 폴링·조회 기반 알림으로 충분한 전제)

**교차 참조**  
`docs/main/05_Permission_ARCHITECTURE.md`, `docs/main/04_DB_ARCHITECTURE.md`, `docs/report/22_System_Log_Development_Plan.md`(감사 로그와 병행), `Backend/notification_server/service.py`, `Backend/mail/`, `Backend/admin_server/service_users.py`, `Backend/admin_server/service_projects.py`, `Backend/admin_server/service_roles.py`

---

## 1. 배경·목표·용어

| 용어 | 의미 | 주요 저장 |
|------|------|-------------|
| **조직 역할(role)** | 부서 단위 이상의 사용자 구분 | `user_info.user_dvsn` (예: sa_dev, sa, a, o, u) |
| **프로젝트 권한(permission 배정)** | 특정 프로젝트에서의 기능 권한 묶음 | `project_ptcpnt_info.pmssn_master_id` → `pmssn_master.pmssn_list` |
| **권한 템플릿** | 부서 커스텀 `pmssn_master` 정의 | `pmssn_master` 행; 멤버에게 배정되면 상세 목록 변경 불가(절 2.3 참고) |

**목표**  
1. 위 표의 **역할·ETL·프로젝트 권한·정지·활성** 변경 시 **대상 사용자**에게 앱 내 알림 + 이메일(정책에 따라 예외)  
2. 기존 **프로젝트 멤버 추가·제거** 알림(`_notify_project_member_*`)은 유지·중복 최소화  
3. 구현은 **한 트랜잭션 커밋 성공 후** 부가 작업으로 수행  
4. **기존 회원 타부서 `project_invite`**: 앱 알림에 더해 **이메일 필수**(수락·거절 유도, 만료 초대 감소). `send_invite_email`(가입 URL)과 **분리된 전용 함수**로 구현

---

## 2. 현행 코드 확인 결과

### 2.1 `notification_server/service.py`

- **`insert_notification(conn, user_id, noti_type, noti_title, noti_content=None, *, autocommit=False)`**  
  - `noti_type`은 DB 저장 시 **30자로 절단**된다. 신규 타입은 **30자 이내**로 설계한다.  
- 기존 타입 예: `project_invite`, `project_invite_accepted`, `project_invite_rejected`, `widget_board_invite_*` 등.  
- **`user_display_label_for_notification(conn, user_id)`** — 제목에 실행자·관련자 표시 시 재사용 권장.

### 2.2 `Backend/mail/`

- **`smtp_transport.send_email`**, **`outbound.send_login_code_email`**, **`outbound.send_invite_email`**. SMTP 미설정 시 로그 폴백 패턴이 이미 있음.  
- **신규**: `outbound` 또는 전용 모듈에 `send_permission_change_email` 등 **제목·본문 조립 함수** 추가. `send_invite_email`과 동일하게 **try/except**, 실패 시 **logger.warning** 수준으로 본 업무 비차단.

### 2.3 `service_roles` — 권한 템플릿(`pmssn_list`) 수정

`Backend/admin_server/service_roles.py`의 **`update_custom_role`** 동작(코드 기준 확정):

- **시스템 기본 권한**: 수정 불가.  
- **`pmssn_list`가 실제로 바뀌는 경우**(`new_key != old_key`):  
  `project_ptcpnt_info`에 해당 `pmssn_master_id`가 **한 건이라도 있으면** `ValueError`로 **상세 권한 목록 변경을 거부**한다.  
  → **배정 사용 중인 커스텀 역할의 `pmssn_list` 수정으로 인한 “전 사용자 일괄 유효권한 변경” 시나리오는 발생하지 않는다.**  
- **권한명(`pmssn_name`)만 변경**은 사용 중이어도 허용되나, 멤버의 유효 권한 집합(플래그)은 동일하므로 **1차 알림 대상에서 제외**해도 된다.

**결론**: 본 기능에서 **`update_custom_role`에 대한 “영향 받은 전 멤버 알림”은 불필요**하다.

### 2.4 `service_projects` — 멤버·역할

- **멤버 추가·제거**: 기존 `_notify_project_member_added_pair` / `_notify_project_member_removed_pair` 등 **앱 내 양방향 알림** 패턴이 있다면 유지.  
- **`update_member_role`**: `pmssn_master_id` 변경 시 **대상 사용자에게** 앱 내 + 이메일 **신규 추가**(본 계획의 핵심).

### 2.5 `service_users` — 일괄 관리

- **`update_user_management`**: 프로젝트 배정 루프에서 `pmssn_master_id` 갱신 가능.  
- **알림 조건(확정)**: **`user_dvsn` 변경** 또는 **`etl_yn` 변경** 또는 **프로젝트별 `pmssn_master_id` 변경**이 하나라도 포함된 경우에만 발송. **부서만 변경**된 경우는 알림·이메일 없음.

### 2.6 기존 회원 타부서 `project_invite` (본 개발 **필수**)

- **현행**: `service_projects.add_member`에서 대상이 초대 부서 관리 트리 밖이면 `noti_type=project_invite`로 **`insert_notification`만** 수행한다. `create_project_full`의 외부 초대 목록도 동일 패턴이다. **이메일은 없음.**  
- **미가입 초대** `invite_user_by_email`는 **`send_invite_email`**(가입 URL)을 쓰며 **별도 플로우**다.  
- **본 개발에서 반드시 추가**: 위 **`project_invite`를 INSERT하는 모든 코드 경로**에서, 커밋 성공 직후 **대상 `user_email`로 “프로젝트 초대·로그인 후 수락/거절” 안내 + 앱 딥링크** 이메일을 발송한다. `send_invite_email`과 **함수 분리**. **실행자=초대 대상**이면 섹션 4 원칙 7과 동일하게 **이메일 생략**(해당 가드는 `invite_user_id` vs `target_uid`로 적용).

---

## 3. 알림 대상 액션 표

아래 **noti_type**은 예시이며, 구현 시 **30자 이하**·프론트 필터와 목록을 맞춘다.

| 구분 | 액션 | 코드 위치(예상) | noti_type (예) | 앱 내 알림 | 이메일 | 수신자 |
|------|------|-----------------|----------------|------------|--------|--------|
| 조직 역할 | `user_dvsn` 변경 | `set_user_dvsn_admin_user` | `org_role_changed` | O | O | 대상 사용자 |
| ETL 자격 | `etl_yn` 변경 | `set_user_etl_flag` | `etl_access_changed` | O | O | 대상 사용자 |
| 일괄 | 위 조건 충족 시만 | `update_user_management` | `user_mgmt_changed` | O | O | 대상 사용자 |
| 프로젝트 권한 | `pmssn_master_id` 변경 | `update_member_role` | `project_pmssn_changed` | O | O | 대상 사용자 |
| 정지 | `user_active_yn=N` | `suspend_user` | `user_suspended` | **X** | **O** | 대상 사용자 |
| 활성화 | `user_active_yn=Y` | `activate_user` | `user_activated` | O | O | 대상 사용자 |
| 프로젝트 초대(기존 회원·타부서) | `project_invite` INSERT | `add_member`(invite_sent), `create_project_full`(외부 초대) | `project_invite` | O(기존) | **O(필수·신규)** | 초대 대상 |

**본인 실행(실행자 = 변경 대상)**: API에서 본인 대상 변경이 **불가**한 경우가 많지만, 경로상 동일 `user_id`로 처리되는 경우가 있더라도 **앱 내 알림·이메일 모두 발송하지 않는다**(본인은 이미 조작 사실을 알고 있으므로). `change_notify` 공통 가드에서 `actor_user_id == target_user_id`이면 즉시 return.

**멤버 추가·제거**: 기존 알림 로직 유지. 본 표와 **중복되지 않도록** `update_user_management`에서 “신규 참여”와 “권한만 변경” 경로를 구분해 호출한다.

---

## 4. 설계 원칙

1. **커밋·알림·이메일 순서**: **이메일(SMTP·외부 I/O)** 은 **`conn.commit()` 성공 직후**만 호출한다(실패해도 DB 변경은 유지). **`notification_info` INSERT**는 현행 `service_projects.add_member` 등과 같이 **업무 DB와 동일 `conn`·`autocommit=False`로 트랜잭션 안**에서 호출해, **롤백 시 알림도 함께 롤백**되게 할 수 있다(권장). 신규 `change_notify`에서 앱 알림을 넣을 때도 **호출부 트랜잭션 경계**를 맞춘다. **커밋 후에만** `insert_notification`을 넣는 방식은 구현 가능하나, 그 사이 요청 실패 시 **알림 유실** 가능성을 인지할 것.  
2. **이메일 실패**: `try/except`, 로그만 남기고 **API 응답은 성공 유지**.  
3. **정지(`suspend_user`)**: 로그인 불가이므로 **앱 내 알림은 넣지 않고 이메일만**(사용자 확정 정책).  
4. **활성화(`activate_user`)**: **앱 내 + 이메일** 병행.  
5. **실행자 표시**: 제목 또는 `noti_content` JSON에 `actor_user_id` / 표시 라벨 포함. 시스템 로그(`emit_admin_system_log`)와 **문구 정합**을 위해 `business_action`과 키 이름을 문서화한다.  
6. **이메일 본문**: 개인정보 최소화(필요 시 프로젝트명·역할 코드·권한 표시명만). 상세는 감사 로그 조회로 보완(22번 계획과 역할 분담).  
7. **본인 실행 생략**: `actor_user_id`와 변경 대상 사용자 ID가 같으면 **앱 알림·이메일 모두 스킵**(정지·활성 포함).  
8. **`project_invite` 이메일**: 타부서 초대는 **앱 알림과 쌍으로 이메일 필수**. 본문·딥링크 URL 규약은 Phase 3에서 FE와 확정하고, 구현은 Phase 1 함수 + Phase 2 호출로 **Exit 기준에 포함**한다.

---

## 5. Phase 1 — 공통 모듈

| Step | 작업 | 산출물 |
|------|------|--------|
| P1-1 | `Backend/admin_server/change_notify.py`(가칭) 신설 | `notify_org_role_changed`, `notify_etl_access_changed`, `notify_user_mgmt_summary`, `notify_project_pmssn_changed`, `notify_user_suspended`, `notify_user_activated` 등 |
| P1-2 | 공통 내부: `actor_user_id == target_user_id`면 전체 스킵, `user_info`에서 대상 이메일 조회, 빈 이메일 시 이메일만 스킵 등 가드 | 재사용 함수 |
| P1-3 | `Backend/mail/outbound.py`(또는 `mail/permission_notify.py` 등)에 변경 알림용 발송 함수 | `send_*` + lines 조립 |
| P1-4 | `noti_content` JSON 스키마 초안 문서화(키: `actor_label`, `project_info_id`, `old_pmssn_name`, `new_pmssn_name`, `old_user_dvsn`, `new_user_dvsn` 등) | 구현 주석 또는 `03_API_GUIDE` 보강 |
| P1-5 | **`send_project_invite_existing_user_email`**(가칭): `send_invite_email`과 분리. 프로젝트명·초대자 라벨·만료 안내·**앱 딥링크**(알림함 또는 프로젝트 진입 — FE 합의) | `Backend/mail/outbound.py` 등 |

**의존성 주의**: `notification_server.service.insert_notification`는 **system_db `conn`**을 전제로 하는 기존 패턴과 동일하게 맞출 것. `admin_server`에서 연결이 분리되어 있으면 **동일 풀의 conn**을 넘기거나, 커밋 후 **별도 짧은 연결**으로만 INSERT(운영 트랜잭션 경계 합의).

---

## 6. Phase 2 — 호출 삽입

| 함수 | 트리거 조건 | 비고 |
|------|-------------|------|
| `set_user_dvsn_admin_user` | `user_dvsn` 실제 변경 시 | |
| `set_user_etl_flag` | `etl_yn` 실제 변경 시 | 이메일 포함 |
| `update_user_management` | 역할 또는 ETL 또는 프로젝트 `pmssn` 변경 시만 | 부서만 변경: 무알림 |
| `update_member_role` | `pmssn_master_id` 변경 시 | 멤버 추가와 중복 방지 |
| `suspend_user` | 성공 시 | **이메일만** |
| `activate_user` | 성공 시 | 앱 + 이메일 |
| `add_member` | **`outcome == invite_sent`** (`project_invite` INSERT 후 commit 성공) | **필수**: P1-5 이메일 호출(`invite_user_id == target_uid`면 스킵). `emit_admin_system_log` 직후 |
| `create_project_full` | 외부/타부서 초대로 **`project_invite`를 넣은 각 수신자** | commit 성공 후 **수신자별** 동일 이메일 |

각 위치에서 기존 **`emit_admin_system_log`** 호출과 **나란히** 또는 직후에 `change_notify.*` 호출. **`project_invite` 이메일(P1-5)** 은 `change_notify`가 아니라 **`Backend.mail` 직접 호출**로 두어도 되며(순환 import·레이어 분리), **반드시 해당 API의 `commit` 성공 이후**에만 실행한다.

---

## 7. Phase 3 — 프론트·문서

| Step | 작업 |
|------|------|
| P3-1 | 알림 목록 UI에서 신규 `noti_type`에 대한 **표시 라벨·아이콘**(선택) 매핑 |
| P3-2 | `docs/main/03_API_GUIDE.md` — 알림 타입 설명 한 절 추가(필요 시) |
| P3-3 | SMTP 설정·스테이징에서의 로그 폴백 확인 방법을 운영 체크리스트에 한 줄 |
| P3-4 | **`project_invite` 이메일 딥링크** 최종 URL(로그인 후 알림함·프로젝트 상세 등)을 FE와 확정하고 P1-5 본문에 반영 |

---

## 8. 비범위·추후 검토

| 항목 | 이유 |
|------|------|
| **`update_project`의 `feature_flags` 변경** | “유효 권한” 변화는 맞으나, 알림 대상 사용자 집합·메시지(위젯·ETL·대시보드 등) 정의가 제품 정책 의존. **별도 스펙** 후 Phase 4 후보. |
| **권한 템플릿 `pmssn_list` 일괄 변경 알림** | 사용 중 배정이 있으면 **수정 자체가 차단**되므로 본 계획에서 제외. |
| **다국어 이메일** | 1차 한국어 본문 고정, 추후 i18n. |

---

## 9. 검증 체크리스트

- [ ] `noti_type` 길이 **30자 이하**·DB 제약과 충돌 없음  
- [ ] SMTP 미설정 환경에서 **앱 알림만** 정상·이메일은 로그 폴백  
- [ ] `update_user_management`: **부서만 변경** 시 알림 0건  
- [ ] `suspend_user`: **`notification_info`에 행이 생기지 않음**; 실행자≠대상이면 이메일 1통(또는 스킵 로그), **실행자=대상이면 이메일도 생략**  
- [ ] `activate_user`: 앱 알림 + 이메일  
- [ ] `update_member_role`: 이전에 없던 알림이 **대상 사용자**에게만 생성(실행자≠대상일 때만; 실행자=대상이면 0건)  
- [ ] 실행자=대상 사용자일 때 **앱·이메일 모두 0건**(역할·ETL·권한·정지·활성 공통)  
- [ ] 기존 초대·멤버 추가 알림과 **중복 카운트** 없음  
- [ ] 타부서 `project_invite` 발송 후 **초대 대상 이메일 1통 필수**(SMTP 스킵 시 로그 폴백)·딥링크 동작; **초대자=피초대자**면 이메일 생략  
- [ ] `docs/main/05` 용어(역할 vs 권한)와 화면 문구 정합  

---

## 10. 문서 이력

| 일자 | 변경 |
|------|------|
| 2026-04-21 | SMTP·발송 메시지 구현을 **`Backend/mail`**로 이전; 문서 내 경로·2.2·P1-3·P1-5·Phase 6 문구를 `Backend.mail` 기준으로 정리. |
| 2026-04-21 | 검토 반영: 원칙 1을 **이메일=커밋 후** vs **`insert_notification`=동일 트랜잭션 내 허용(기존 패턴)**으로 분리; Phase 6에 `project_invite` 이메일은 `email_service` 직접 호출 가능 명시; 용어표 내부 링크 제거. |
| 2026-04-21 | 타부서 **`project_invite` 이메일**을 비범위·권장에서 **본 개발 필수**로 격상: 제목·한 줄 요약·범위·목표 4·섹션 2.6·액션 표·원칙 8·Phase P1-5·P2·P3-4·검증·섹션 8.1 제거. |
| 2026-04-21 | 섹션 8.1(초안): 기존 회원 타부서 `project_invite` 이메일 보강 초안. |
| 2026-04-21 | 본인 실행(`actor_user_id == target_user_id`) 시 앱·이메일 **전부 생략**으로 확정(섹션 3 표 하단, 섹션 4 원칙 7, P1-2, 섹션 9 체크리스트). |
| 2026-04-21 | 초안 작성. `service_roles.update_custom_role`의 사용 중 `pmssn_list` 변경 차단을 반영하여 권한 템플릿 일괄 알림을 비범위로 확정. 사용자 확정 정책(일괄 알림 조건, ETL 이메일, 정지 시 이메일만) 반영. |
