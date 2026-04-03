# docs 디렉터리

프로젝트 문서는 **현행 시스템 가이드**와 **보조·이력**으로 나뉜다.

## docs/main (단일 진실 소스 — 동작·구조)

| 파일 | 내용 |
|------|------|
| [00_PRD.md](main/00_PRD.md) | 제품 범위·아키텍처 요약·설정·기능 개요 |
| [01_FRONTEND_GUIDE.md](main/01_FRONTEND_GUIDE.md) | React 앱 구조·`app/*`·`packages/*`·패키지별 API 클라이언트·라우트 |
| [02_BACKEND_GUIDE.md](main/02_BACKEND_GUIDE.md) | FastAPI·auth/admin/project/notification·`query_studio_server`·`etl_server`·캠페인 대시보드·설정 |
| [03_AI_DEVELOP_GUIDE.md](main/03_AI_DEVELOP_GUIDE.md) | AI·온보딩용 아키텍처 지도, 레이어·DB 매트릭스, 작업 유형별 탐색 경로 |
| [04_DB_ARCHITECTURE.md](main/04_DB_ARCHITECTURE.md) | system_db 테이블·FK 트리 |
| [05_Permission_ARCHITECTURE.md](main/05_Permission_ARCHITECTURE.md) | 역할·권한·ETL 인프라·`require_permission` |
| [06_CUSTOMER_JOURNEY.md](main/06_CUSTOMER_JOURNEY.md) | 고객 여정·Phase별 흐름 |

위 파일들은 **지금 구현된 동작**만 다룬다. 로드맵·Phase·예정 기능은 적지 않는다.

## docs/log (작업 이력)

| 파일 | 내용 |
|------|------|
| [log.md](log/log.md) | 코드·설정·문서를 바꾼 작업의 목적·변경 파일(날짜 역순) |

## docs/report (보조 자료)

| 파일 | 내용 |
|------|------|
| [00_ReportIndex.md](report/00_ReportIndex.md) | 보고서·설계서 파일 목록·용도 |
| 기타 `*.md` | 배포(DEPLOY)·ETL 상세·JOIN·대시보드 설계 참고 등. **제품 동작 정의는 docs/main을 따른다.** |

## 저장소 루트 README

프로젝트 개요·실행 방법·요약 트리는 저장소 루트 **[../README.md](../README.md)** 를 본다.
