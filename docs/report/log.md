# 작업 완료 로그 (Task Completion Log)

## 2026-02-23: source_table 'schema.table' 형식 검증 허용 — PK 모달 미리보기 오류 해결

### 현상
- PK 컬럼 설정 모달에서 "source_table에 허용되지 않은 문자가 있습니다: public.sample_test" 발생. 컬럼 목록이 불러와지지 않아 체크박스 대신 입력란만 노출됨.

### 원인
- source_table이 `public.sample_test` 등 'schema.table' 형식으로 저장·전달되는데, 미리보기·적재 경로에서 `_validate_identifier(source_table, "source_table")`를 사용함. 해당 함수는 영문·숫자·언더스코어만 허용해 점(.)에서 검증 실패.

### 완료 작업
1. **service._validate_source_table(value)** 추가: 'schema.table' 또는 'table' 형식 허용. 점이 있으면 스키마·테이블 부분을 각각 식별자 규칙으로 검증.
2. **preview_service._preview_db**: source_table 검증을 `_validate_identifier` → `_validate_source_table`로 변경.
3. **db_load_service.run_db_load**: source_table 검증을 `_validate_source_table`로 변경.

### 수정 파일
- Backend/etl_server/service.py
- Backend/etl_server/preview_service.py
- Backend/etl_server/db_load_service.py
- docs/report/log.md (본 로그)

---

## 2026-02-23: DB 연결 ETL PK 자동 설정 + PK 설정 모달 체크박스 우선

### 요청
- DB 연결로 ETL 목록에 등록한 경우 PK가 자동 설정되어야 하는데 되지 않음.
- PK 컬럼 설정 모달이 입력 방식이라 불편함 → 체크박스/셀렉트 방식 선호.

### 원인
- 프론트에서 소스 테이블을 `schema.table`(예: `public.mytable`) 형식으로 전달. 백엔드가 이를 테이블명으로만 사용해 information_schema 조회 시 `table_name = 'public.mytable'`로 조회하여 행이 없음 → PK 자동 조회 실패.
- 미리보기/적재 시에도 동일하게 `schema.table`를 분리하지 않아 컬럼·PK 조회·쿼리 실패 가능.

### 완료 작업
1. **service.parse_source_table_parts**: `source_table`이 `schema.table` 형식일 때 `(schema_or_db, table_name)` 반환하는 공용 함수 추가.
2. **create_etl_table**: PostgreSQL/MySQL PK 자동 조회 시 `parse_source_table_parts`로 스키마·테이블 분리 후 `_fetch_source_pk_columns` / `_fetch_pk_from_mysql`에 테이블명만 전달. Oracle은 기존대로 `OWNER.TABLE` 분기 유지.
3. **db_load_service.run_db_load**: 소스 컬럼·PK 조회 및 `quoted_src` 생성 시 `parse_source_table_parts` 적용.
4. **preview_service._preview_db**: 컬럼 조회 및 `quoted_src` 생성 시 `parse_source_table_parts` 적용.
5. **PkColumnsModal**: 컬럼을 불러올 수 없을 때만 사용하는 입력란임을 안내 문구로 명시.

### 수정 파일
- Backend/etl_server/service.py (parse_source_table_parts, create_etl_table PK 조회)
- Backend/etl_server/db_load_service.py (run_db_load 스키마/테이블 분리)
- Backend/etl_server/preview_service.py (_preview_db 스키마/테이블 분리)
- Frontend/react-app/src/packages/etl/components/PkColumnsModal.jsx (fallback 입력 안내)
- docs/report/log.md (본 로그)

### 결과
- DB 연결 ETL 등록 시 소스 DB에서 PK를 자동 조회해 `pk_columns`에 저장됨.
- 미리보기·적재가 `schema.table` 형식 소스에서 정상 동작.
- PK 설정 모달은 미리보기로 컬럼을 불러오면 체크박스로 선택, 불러오지 못할 때만 직접 입력 사용.

---

## 2026-02-23: ETL 파일 적재 2~3회 실패 후 성공 — 요청 프로세스에서 동기 실행으로 변경

### 현상
- 업로드 후 한참 지나서 실행해도 2~3번 실패한 뒤에야 실행이 시작됨.

### 원인
- 다중 워커(프로세스) 환경에서 업로드는 워커 A가, Job 실행은 백그라운드 스레드가 워커 B/C에서 수행됨. 업로드 디렉터리가 워커별로 다르면(또는 컨테이너별 로컬) 워커 B/C는 해당 파일을 찾지 못함. 여러 번 실행 시 우연히 업로드한 워커가 Job을 처리할 때만 성공.

### 완료 작업
1. **run_table_load**: 소스가 **파일**인 경우, Job을 pending이 아닌 **running**으로 생성한 뒤 **이 요청을 받은 프로세스**에서 스레드로 `run_file_load` 직접 실행. 백그라운드 워커는 건드리지 않음. DB 소스·추가 적재(add-file)는 기존처럼 대기열 등록.
2. `_run_file_load_in_process(etl_table_id, job_id)` 헬퍼 추가.

### 수정 파일
- Backend/etl_server/router.py
- docs/report/log.md (본 로그)

---

## 2026-02-23: ETL 업로드 직후 실행 시 파일 미노출 — flush·fsync 추가

### 현상
- 업로드 후 곧바로 "실행"을 눌렀을 때 1~2회는 "파일을 찾을 수 없습니다"로 실패하고, 여러 번 실행해야 성공하는 경우가 있음.

### 원인
- 파일 쓰기 후 `close()`만 하면 OS/스토리지에 따라 버퍼가 아직 디스크에 반영되지 않았을 수 있음. 워커가 같은 경로를 열 때 아직 파일이 보이지 않을 수 있음(특히 NFS·다중 프로세스 환경).

### 완료 작업
1. **router._save_upload**: `f.write(content)` 후 `f.flush()` 및 `os.fsync(f.fileno())` 호출. 반환 전에 디스크에 반영되도록 함.

### 수정 파일
- Backend/etl_server/router.py
- docs/report/log.md (본 로그)

---

## 2026-02-23: ETL "파일을 찾을 수 없습니다" 원인 분석 및 경로 폴백 처리

### 현상
- 리눅스 서버에서 파일 업로드는 성공하고 `Backend/etl_server/uploads/` 에 파일이 존재함.
- 실행(Job) 시 `에러: 파일을 찾을 수 없습니다: /root/report/Backend/etl_server/uploads/0753220ab73e4dfb8851e22060162c3f_...xlsx` 발생.

### 원인 분석
1. **경로 저장**: 업로드 시 `router._save_upload()` 이 `Path(__file__).resolve().parent / "uploads"` 기준으로 절대 경로를 만들어 DB(etl_tables.file_path, etl_jobs.add_file_path)에 저장함.
2. **경로 사용**: Job 실행 시 `load_service.run_file_load` / `run_file_upsert` 가 DB의 경로를 그대로 사용해 `os.path.isfile(file_path)` / `_read_file()` 호출.
3. **가능한 원인** (파일은 있는데 못 찾는 경우):
   - **프로세스/워커 분리**: API와 ETL 워커가 서로 다른 프로세스(또는 컨테이너)에서 동작할 때, 한쪽에서 저장한 절대 경로가 다른 쪽의 파일시스템과 다르게 마운트/해석될 수 있음.
   - **실행 디렉터리/배포 경로 차이**: 예전 배포 경로로 저장된 경로가 DB에 남아 있고, 현재 앱은 다른 경로에서 실행되는 경우(예: /opt/report vs /root/report).
   - **권한/SELinux**: 워커 프로세스가 해당 경로를 읽지 못하는 경우(일반적으로는 PermissionError로 나옴).

### 완료 작업
1. **load_service.py**: `UPLOAD_DIR`(etl_server/uploads)와 `_resolve_upload_path(file_path)` 추가. DB에서 읽은 경로에 파일이 없으면 `uploads/파일명` 으로 재해석해 사용하도록 함.
2. `run_file_load`·`run_file_upsert` 에서 `file_path` / `add_file_path` 사용 전에 `_resolve_upload_path` 적용.

### 수정 파일
- Backend/etl_server/load_service.py
- docs/report/log.md (본 로그)

### 운영 점검 권장
- API와 워커가 **동일 프로세스 내 스레드**로 동작하는지 확인(현재 run.py back → 단일 프로세스 + start_background_worker 스레드).
- systemd 등에서 **WorkingDirectory** 와 실제 코드/업로드 디렉터리 일치 여부 확인.
- DB의 `etl_tables.file_path` 값이 서버의 실제 업로드 디렉터리와 같은지 확인.

---

## 2026-02-23: ETL 파일 업로드 드래그앤드롭 영역 가시성 개선 (CSS)

### 완료 작업
1. **FileUploadForm.jsx**: 드롭존에 `etl-file-form__drop-zone--has` 클래스 추가(파일 선택/드롭 시). 드래그 오버 시 문구를 "여기에 놓으세요"로 변경, 파일 있을 때 버튼 문구 "다른 파일 선택"으로 변경. "선택된 파일" 뱃지 요소 추가(파일 있을 때만 표시).
2. **etl.css**: `--over` 상태 강화 — 테두리 3px·box-shadow·scale(1.02)·전환 효과. `--has` 상태 추가 — 실선 테두리·녹색(#059669)·연한 녹색 배경·외곽 그림자. `.etl-file-form__drop-badge` 스타일(뱃지). 선택된 파일일 때 드롭 텍스트 색·굵기·줄바꿈 처리.

### 수정 파일
- Frontend/react-app/src/packages/etl/components/FileUploadForm.jsx
- Frontend/react-app/src/packages/etl/etl.css
- docs/report/log.md (본 로그)

---

## 2026-02-23: ETL 파일 업로드 413 (Request Entity Too Large) 대응 — Nginx client_max_body_size

### 배경
- https://ajo.sdev-ibank.co.kr/ibank-bi/etl 에서 파일 업로드 시 브라우저 콘솔에 `413 (Request Entity Too Large)` 발생.
- ETL 업로드 요청은 프론트에서 API(api_base_url)로 전송되며, Nginx가 `/report_api/` → 8500 백엔드로 프록시함.

### 원인
- **Nginx 기본값** `client_max_body_size`가 **1m**. 이 값을 설정하지 않으면 요청 본문이 1MB를 초과할 때 Nginx가 백엔드로 전달하지 않고 413을 반환함.
- docs/report/nginx_report.conf 에 해당 지시어가 없어 기본 1m이 적용되고 있었음.

### 완료 작업
1. **nginx_report.conf**: `location /report_api/` 블록에 `client_max_body_size 100m;` 추가. ETL 대용량 파일 업로드 허용.
2. 상단 주석에 413 발생 시 원인 및 대응( client_max_body_size ) 안내 추가.

### 수정 파일
- docs/report/nginx_report.conf
- docs/report/log.md (본 로그)

### 배포 시 참고
- 리눅스 서버에서 이 설정을 반영한 후 **Nginx 재로드** 필요: `sudo nginx -t && sudo systemctl reload nginx` (또는 해당 서버의 Nginx 재시작 방식).

---

## 2026-02-13: ETL 가이드 문서 정리·09 통합

### 완료 작업
1. **08_ETL_Phase_Implement_Guide.md**: 보관·확인에 필요한 내용만 남기고 간략화. 로그성·중복·장황한 설명 제거. §1~12 재구성(요약·시스템 개요·config·메타·모듈·Job 확인·재실행·파일/DB 요약·Phase·ZIP·ETL 목록 버튼).
2. **09_ETL_DB_Connection_Flow.md** 내용을 08로 이전: **§9 DB 연결 실패 시 점검**으로 통합(연결 구조·실패 지점 표·예외별 메시지·3306/5432·점검 순서·구현 위치). 특정 IP 예시·mermaid·장문 절은 제거하고 표·번호 목록으로 정리.
3. **09_ETL_DB_Connection_Flow.md** 삭제.
4. **00_ReportIndex.md**: 09 행 제거, 08 설명에 DB 연결 점검·09 통합 반영.

### 수정·삭제 파일
- docs/report/08_ETL_Phase_Implement_Guide.md (전면 정리·09 통합)
- docs/report/09_ETL_DB_Connection_Flow.md (삭제)
- docs/report/00_ReportIndex.md
- docs/report/log.md (본 로그)

---

## 2026-02-13: ETL 타겟 테이블명 중복 검사 — 등록 시 기존 테이블/메타 충돌 방지 (증분 시 기존 테이블 허용)

### 배경·현재 동작
- **기존**: 타겟 테이블명은 식별자 형식만 검증. 동일 이름이 이미 etl_tables에 있거나 메인 DB에 있어도 등록됨 → 실행 시 full 모드면 DROP 후 재생성(기존 데이터 삭제), 증분이면 같은 물리 테이블에 두 ETL이 겹쳐질 수 있음.
- **실행 시**: full = DROP TABLE IF EXISTS 후 CREATE; incremental = 테이블 없으면 CREATE, 있으면 Upsert.

### 완료 작업
1. **create_etl_table (etl_server/service.py)**  
   - 등록 직후 `target_table`에 대해 (1) **etl_tables에 동일 target_table 존재 여부** 조회. 있으면 `ValueError("이미 등록된 타겟 테이블명입니다. 다른 이름을 사용하거나 기존 ETL을 삭제한 후 등록하세요.")`.  
   - (2) **메인 DB에 해당 테이블 존재 여부**: **전체(Full) 모드일 때만** 거부. **증분(Incremental) 모드일 때는** 메인 DB에 테이블이 이미 있어도 등록 허용(파일 업로드로 만든 테이블에 DB 연결 증분 ETL을 추가하는 경우 대비).  
   - 라우터가 `ValueError`를 400 + detail로 반환하므로 프론트에서 `createError`로 메시지 표시됨.

### 수정 파일
- Backend/etl_server/service.py (create_etl_table)
- docs/report/log.md (본 로그)

---

## 2026-02-13: DB 연결(etl-page__panel) UI 개선 — 2열 그리드·가독성·카드 배치

### 완료 작업
1. **DbConnectionForm.jsx**: "연결 추가" 폼을 2열 그리드(etl-db-form__grid etl-db-form__grid--2)로 재구성. 라벨 상단·필드 단위(etl-db-form__field), 포트/스키마 등 짧은 필드는 etl-db-form__field--short. 버튼은 etl-db-form__actions로 묶음. "등록된 연결" 제목 하단에 부가 설명(etl-db-form__subtitle), 연결 항목에 etl-db-form__conn-info 클래스. "ETL 테이블 등록"도 동일 2열 그리드·설명/힌트 full width(etl-db-form__field--full)·동기화 모드 라벨 설명 정리·액션 영역으로 등록 버튼 배치. 테이블 등록 성공 후 폼 리셋 시 syncMode를 incremental로 설정하도록 수정(setSyncMode('incremental')).
2. **etl.css**: etl-page__panel 배경 #fff·패딩 24px·border-radius 12px·얕은 그림자. etl-db-form max-width 100%. etl-db-form__section--card(연결 추가·등록된 연결·ETL 테이블 등록) 카드 스타일(배경 #f8fafc·테두리·radius 10px·패딩). etl-db-form__grid, etl-db-form__grid--2(2열·gap 16px 24px), 720px 이하 1열. etl-db-form__field, etl-db-form__field--short, etl-db-form__field--full. etl-db-form__actions·etl-db-form__subtitle·etl-db-form__conn-info 추가. 제목(etl-db-form__heading) 크기·색상 강화. input/select padding 10px 12px·font-size 0.95rem·border #cbd5e1·focus 링 3px·placeholder 색상. 연결 목록 max-width 100%·항목 hover·마지막 항목 margin 제거.

### 수정 파일
- Frontend/react-app/src/packages/etl/components/DbConnectionForm.jsx
- Frontend/react-app/src/packages/etl/etl.css
- docs/report/log.md (본 로그)

---

## 2026-02-19: README 업데이트·requirements 점검·두 리모트 푸시

### 완료 작업
1. **README.md**: 개발문서(PRD·01·02) 기반으로 전면 정리. ETL 섹션 추가(파일·DB 소스, 동기화 모드·기본 증분, 목록·Job·ZIP), 접속 경로에 /etl, 설정에 system_db·etl_limits, 프로젝트 구조에 etl_server·packages/etl, 사용 흐름에 ETL, 문서표 02_BACKEND_GUIDE로 통일.
2. **requirements.txt**: ETL .xls 지원용 **xlrd>=2.0.0** 추가. 그 외 패키지 제거·추가 없음(필요 패키지 모두 유지).
3. **Git**: origin·ibank 두 리모트 모두 main 푸시(커밋 726c915).

### 수정 파일
- README.md, requirements.txt, docs/report/log.md

---

## 2026-02-19: 메인 문서 자체 완결 — 리포트 참조 제거·필수 내용 가이드 반영

### 완료 작업
1. **방침**: 대외 시스템 소개 시 리포트 문서 없이 **docs/main(PRD·01·02)만** 사용. PRD는 요약, 01·02 가이드는 상세 명세.
2. **02_BACKEND_GUIDE.md**: §3.2 메타 테이블 4개 용도 표 반영. §3.3 etl_limits 키·의미·파일/DB 동작 반영. §3.4 ETL 배치·실행 시점(배치=한 번 실행 시, 스케줄 없음, 실행=버튼만) 추가. §6.2 DB 지원 현황 표(PostgreSQL/MySQL/Oracle). §6.3 외부 DB 연결 구조·경유 IP·실패 시 점검 순서. §6.4 Job 확인 방법(터미널 로그·시스템 DB·수동 정리). §6.5 재실행 시 동작(파일/DB full·incremental). §6.6 모듈 의존. "08·09 참고" 문구 제거.
3. **01_FRONTEND_GUIDE.md**: §4.5 etl 확장. 목록 열 의미·상태(draft/error/done)별 미리보기/실행/데이터 추가/삭제 동작. 배치·실행 시점 안내. 파일 3일 보관. DB 연결 실패 시 Backend 호스트 IP·방화벽. ZIP 다중 파일·건너뛴 파일(skipped_files) 목록. "08 참고" 제거.
4. **00_PRD.md**: 문서 정보에 "대외 소개 시 PRD·01·02만 사용" 명시. ETL·설정·API·DB 연결·설정 상세 참조를 모두 **01·02 가이드**로 통일(docs/report 08·09 참조 제거). §7 "개발 요구사항·대외 소개는 docs/main만 사용".

### 수정 파일
- docs/main/02_BACKEND_GUIDE.md
- docs/main/01_FRONTEND_GUIDE.md
- docs/main/00_PRD.md
- docs/report/log.md (본 로그)

---

## 2026-02-19: 01_FRONTEND_GUIDE·02_BACKEND_GUIDE 업데이트 (PRD·ReportIndex 기반)

### 완료 작업
1. **01_FRONTEND_GUIDE.md**: PRD·00_ReportIndex 반영. 패키지에 etl 추가(§1.1·§1.2). 접속 경로에 .../etl. §3 디렉터리 트리에 packages/etl 및 components(SourceTypeSelector, FileUploadForm, DbConnectionForm, ETLTableList, JobHistoryPanel, JobLogPanel, AddFileModal, PkColumnsModal, PreviewModal). **§4.5 etl** 신설(ETLPage·컴포넌트·API·08 참고). §4.6 shared로 번호 이동·api/client.js에 ETL API·joinOrder·saveQueryAsTable 명시. §7 문서표 02_BACKEND_GUIDE.md로 변경·docs/report 08·09 참고.
2. **02_BACKEND_GUIDE.md**: 마이그레이션 플랜만 있던 문서를 **가이드 명세서**로 전면 개편. §1 개요(역할·기술 스택·실행), §2 아키텍처·디렉토리(api_server·etl_server), §3 설정(config·system_db·etl_limits), §4 API 엔드포인트(health·report·dashboard·dashboard2·ETL 표), §5 api_server 상세(main·db·dependencies·schemas·routers·dashboard_service), §6 etl_server 상세(역할·모듈 의존·08·09 참고), §7 문서 구성. **부록 A**: Flask→FastAPI 전환 계획 참고(Phase 요약·롤백).
3. **00_PRD.md**: §2.1·§5.2·§5.2 하단 참고를 02_BACKEND_GUIDE.md·§4·§5로 통일. §8 변경 이력 행 추가.
4. **docs/report/00_ReportIndex.md**: 백엔드 참조를 02_BACKEND_GUIDE.md로 변경, 전환 계획은 부록 A 참고 명시.

### 수정 파일
- docs/main/01_FRONTEND_GUIDE.md
- docs/main/02_BACKEND_GUIDE.md (전면 개편)
- docs/main/00_PRD.md
- docs/report/00_ReportIndex.md
- docs/report/log.md (본 로그)

---

## 2026-02-19: PRD(00_PRD.md) report·log 반영 정리

### 완료 작업
1. **목적**: docs/report/00_ReportIndex.md·log.md 및 목록 내 report 파일(08·09 등) 내용을 00_PRD.md에 최소·요약만 반영(코드 제외).
2. **반영 내용**: §1.2 ETL 문단(파일·DB, PG·MySQL 적재·Oracle 목록·미리보기·PK, 전체/증분, 배치·실행 시점). §2.1 Frontend etl 패키지·Backend etl_server, §2.2 경로. §3.2 system_db·etl_limits. §4·§5 ETL 패키지·API(/api/etl). **§6.3 ETL** 신설: 목적·소스 유형(파일 3일 보관·DB 지원 표)·DB 연결(테스트·09 참고)·동기화 모드·배치·실행 시점(수동만)·목록 열(연결·배치·동기화)·파일 ETL·Job 큐·설정·08 참고. 기존 §6.3 공통 → §6.4로 번호 이동. §7 docs/report에 08·09 참고 문구. §8 변경 이력 행 추가(2026-02-19).

### 수정 파일
- docs/main/00_PRD.md
- docs/report/log.md (본 로그)

---

## 2026-02-19: 배치·실행 시점 안내 문서·UI 보강

### 완료 작업
1. **요청**: 배치 크기/인터벌은 보이지만 "매일 몇 시에 증분 진행되는지" 없음. draft 상태에서도 해당 시간에 자동 증분되는지 알고 싶음.
2. **현재 동작 정리**: (1) 배치 크기·배치 간 대기는 **한 번의 실행** 안에서만 적용(스트리밍 행 수, 배치 간 쉬는 초). (2) **매일 몇 시 자동 실행** 스케줄은 **미구현** — 실행은 "실행" 버튼으로만 대기열 등록. (3) **draft여도 자동 실행 없음** — 스케줄러가 없으므로 증분도 수동 "실행"만 가능.
3. **08_ETL_Phase_Implement_Guide.md**: §3.4 "배치 설정·실행 시점" 추가. 배치 크기/대기 의미, 매일 몇 시 미지원, 실행 시점, draft와 자동 실행 없음 표로 정리.
4. **ETLTableList 도움말(?)**: "배치·실행 시점 안내" 섹션 추가. 배치 크기/대기=한 번 실행 시 적용, 매일 몇 시 미지원, 실행=버튼만, draft여도 자동 증분 없음.

### 수정 파일
- docs/report/08_ETL_Phase_Implement_Guide.md (§3.4)
- Frontend/react-app/src/packages/etl/components/ETLTableList.jsx (도움말 모달)
- docs/report/log.md (본 로그)

---

## 2026-02-19: DB 적재 MySQL 지원(Phase 2) — 플랜 정리·구현 완료

### 플랜(08 문서 §3.3 반영)
- **Phase 1(완료)**: 소스 테이블 목록·PK 자동 조회 MySQL·Oracle
- **Phase 2(완료)**: run_db_load에서 **MySQL** 소스 지원(연결·컬럼·PK·SELECT·메인 DB 적재)
- **Phase 3(예정)**: run_db_load에서 Oracle 소스 지원

### Phase 2 완료 작업
1. **db_load_service**: MySQL 분기. _fetch_source_columns_mysql, _pg_type_from_mysql. run_db_load에서 stype별 src_conn(PostgreSQL/MySQL), src_schema, columns·source_pk_list·quoted_src(backtick)·select_list·where_clause·type_mapper·row_type. 배치/전체 경로에서 tuple→dict 변환, type_mapper로 컬럼 타입 매핑.
2. **queue_worker·router**: mysql일 때 run_db_load/run API 허용.
3. **preview_service**: _preview_db에서 MySQL 분기(연결·컬럼·SELECT 10행).
4. **Frontend**: ETLTableList에서 postgresql·mysql·oracle 소스 시 실행/미리보기 버튼 표시.
5. **08_ETL_Phase_Implement_Guide.md**: §3.3 페이즈 표, 구현 현황에 MySQL 적재 ✅.

### 수정 파일
- Backend/etl_server/db_load_service.py, queue_worker.py, router.py, preview_service.py
- Frontend/react-app/src/packages/etl/components/ETLTableList.jsx
- docs/report/08_ETL_Phase_Implement_Guide.md, log.md

---

## 2026-02-19: 소스 테이블 목록 조회 MySQL·Oracle 지원

### 완료 작업
1. **문제**: list_source_tables가 PostgreSQL만 지원하고, table_schema = 'public' 등으로 조회. MySQL에서는 TABLE_SCHEMA가 데이터베이스명이라 'public'으로 조회하면 0건.
2. **PostgreSQL**: 기존 유지. table_schema = connection.schema_name (기본 'public'), table_type = 'BASE TABLE'.
3. **MySQL**: 분기 추가. TABLE_SCHEMA = connection.database_name(연결한 DB명), TABLE_TYPE = 'BASE TABLE'. information_schema.TABLES 사용. 반환 형식 동일 (table_schema, table_name).
4. **Oracle**: 분기 추가. connection.schema_name이 있으면 ALL_TABLES WHERE OWNER = UPPER(schema_name); 없으면 USER FROM DUAL + USER_TABLES로 현재 사용자 테이블. 반환 (table_schema=OWNER, table_name).

### 수정 파일
- Backend/etl_server/service.py (list_source_tables 전면 분기, 상단 설명)
- Backend/etl_server/router.py (list_connection_tables 주석)
- docs/report/log.md (본 로그)

---

## 2026-02-19: ETL 목록에 연결(서버 구분)·동기화 모드 표시

### 완료 작업
1. **연결 열**: 소스 유형과 소스 사이에 **연결** 열 추가. DB 소스일 때 `connection_name` 표시(등록 시 입력한 연결 이름으로 서버/환경 구분). 파일 소스는 "—". 헤더 title "연결 이름 (서버/환경 구분)".
2. **동기화 열**: 배치와 상태 사이에 **동기화** 열 추가. DB 소스일 때 sync_mode: "전체"(full) / "증분"(incremental). 파일 소스는 "—". 헤더 title "전체: DROP+CREATE+INSERT, 증분: last_synced_at 이후만 Upsert", 셀 title로 상세 설명.
3. **스타일**: 연결 열 max-width 10em, ellipsis. 동기화 열 nowrap, width 1%.

### 수정 파일
- Frontend/react-app/src/packages/etl/components/ETLTableList.jsx (연결·동기화 열 및 표시 로직, 상단 설명)
- Frontend/react-app/src/packages/etl/etl.css (연결·동기화 열 스타일)
- docs/report/log.md (본 로그)

---

## 2026-02-19: ETL 목록에 배치 크기·대기 시간 표시

### 완료 작업
1. **요청**: 소스 연결(DB) ETL의 배치 크기·대기 시간을 설정할 수 있으나 목록에서 확인 불가.
2. **수정**: ETL 테이블 목록에 **배치** 열 추가. DB 소스(postgresql/mysql/oracle)일 때만 표시: "5,000행 / 1초", "5,000행", "전체 / 1초", "전체" 등. 파일 소스는 "—". 셀 title로 "배치 크기: N행/전체, 대기: N초/없음" 툴팁.
3. **스타일**: .etl-table-list__th-batch, .etl-table-list__cell-batch (nowrap, max-width 8em).

### 수정 파일
- Frontend/react-app/src/packages/etl/components/ETLTableList.jsx (배치 열·표시 로직, 상단 설명)
- Frontend/react-app/src/packages/etl/etl.css (배치 열 스타일)
- docs/report/log.md (본 로그)

---

## 2026-02-19: ETL incremental 모드 — 트랜잭션 중단 후 CREATE TABLE 실패 수정

### 완료 작업
1. **원인**: incremental 모드에서 타겟 테이블 존재 여부를 `SELECT 1 FROM ... LIMIT 1`로 확인할 때, 테이블이 없으면 `UndefinedTable` 예외 발생. PostgreSQL은 한 문장이라도 실패하면 트랜잭션이 aborted 상태가 되어, 같은 연결로 ROLLBACK 전에 다음 명령을 실행하면 `InFailedSqlTransaction` 발생.
2. **수정**: `db_load_service.run_db_load`의 incremental 분기에서, 위 SELECT 예외 처리 시 `conn_main.rollback()` 후에 `CREATE TABLE` 실행하도록 추가.

### 수정 파일
- Backend/etl_server/db_load_service.py (incremental 분기 except 블록에 rollback)
- docs/report/log.md (본 로그)

---

## 2026-02-19: Excel(xlsx/xls) 미리보기·로드 속도 개선

### 완료 작업
1. **원인**: CSV는 `read_csv(..., nrows=N)`으로 처음 N행만 읽는데, Excel은 `read_excel(file_path)`로 시트 전체를 메모리에 로드한 뒤 `head(nrows)`로 자르고 있어, 미리보기·PK 컬럼 선택 시에도 전체 파일 파싱으로 유독 느렸음.
2. **수정**: `load_service._read_file`에서 Excel 처리 시 `pd.read_excel(file_path, nrows=nrows)` 사용. `max_rows`가 있으면(미리보기 10행 등) 해당 행 수만 읽어 CSV와 비슷하게 동작.

### 수정 파일
- Backend/etl_server/load_service.py (_read_file Excel 분기)
- docs/report/log.md (본 로그)

---

## 2026-02-19: ETL DB 로드 시 COUNT(*) 결과 접근 오류 수정

### 완료 작업
1. **원인**: `_connect_postgres`가 `cursor_factory=RealDictCursor`로 연결해 행이 딕셔너리로 반환되는데, `run_db_load`에서 배치 모드 시 `cur_count.fetchone()[0]`로 접근해 `KeyError: 0` 발생.
2. **수정**: `db_load_service.run_db_load`에서 COUNT(*) 결과를 `row.values()`가 있으면 첫 번째 값, 없으면 `row[0]`으로 취하도록 변경(튜플/딕셔너리 모두 지원).

### 수정 파일
- Backend/etl_server/db_load_service.py (run_db_load 내 total_from_src 추출 방식)
- docs/report/log.md (본 로그)

---

## 2026-02-13: PK 자동 조회 MySQL·Oracle 확장

### 완료 작업
1. **Backend**: ETL 테이블 등록 시 PK 자동 조회를 **MySQL·Oracle**까지 확장. `service.py`에 `_fetch_pk_from_mysql`(information_schema.KEY_COLUMN_USAGE), `_fetch_pk_from_oracle`(all_constraints/user_constraints + all_cons_columns/user_cons_columns) 추가. `create_etl_table`에서 source_type별로 postgresql → db_load_service, mysql → _connect_mysql + _fetch_pk_from_mysql, oracle → _connect_oracle + _fetch_pk_from_oracle 호출 후 pk_columns 자동 설정.
2. **문서/주석**: service.py 상단 [Helpers]에 _fetch_pk_from_mysql·_fetch_pk_from_oracle 설명 추가.

### 수정 파일
- Backend/etl_server/service.py (_fetch_pk_from_mysql, _fetch_pk_from_oracle, create_etl_table 확장, 상단 설명)
- docs/report/log.md (본 로그)

---

## 2026-02-13: DB 연결 섹션 PK 컬럼 입력 제거·소스 DB 자동 반영

### 완료 작업
1. **Backend**: ETL 테이블 등록 시 DB 소스(PostgreSQL)이고 `pk_columns`가 비어 있으면, 소스 DB information_schema에서 PK 컬럼을 조회해 자동 설정. `create_etl_table`에서 `get_connection_for_etl`·`db_load_service._get_source_connection`·`_fetch_source_pk_columns` 사용, 예외 시 경고 로그 후 등록은 진행.
2. **Frontend**: DB 연결 폼에서 PK 컬럼 입력란 제거. 대신 안내 문구만 표시: "DB 소스인 경우 PK는 소스 DB에서 자동으로 가져옵니다. (incremental 시 사용)". 등록 시 `pk_columns`는 null로 전달하여 백엔드 자동 채우기 유도.
3. **문서/주석**: DbConnectionForm.jsx 상단 설명에 PK 자동 반영 문구 반영.

### 수정 파일
- Backend/etl_server/service.py (create_etl_table 내 PK 자동 조회)
- Frontend/react-app/src/packages/etl/components/DbConnectionForm.jsx (PK 입력 제거, 안내 문구, 상단 설명)
- docs/report/log.md (본 로그)

---

## 2026-02-13: ETL DB 연결 구조·실패 지점 문서(09번) 작성

### 완료 작업
1. **docs/report/09_ETL_DB_Connection_Flow.md** 신규 작성. ETL에서 외부 DB(49.247.47.206) 연결 시 어디서 어떻게 fail이 나는지, 경유 IP가 무엇인지 정리.
2. **연결 구조**: 브라우저 → API 서버(Backend) → TCP로 49.247.47.206:5432. 브라우저는 DB에 직접 연결하지 않음.
3. **경유 IP**: 49.247.47.206 쪽에 보이는 접속 출발지 = Backend가 실행 중인 호스트의 IP(로컬 run.py back이면 그 PC의 IP).
4. **실패 지점**: router → service.test_connection → get_connection_for_etl(선택) → _connect_postgres(psycopg2.connect). 대부분 _connect_postgres 내 TCP/인증 단계에서 fail. 예외별 한글 메시지·hint 표로 정리.
5. **모식도**: Mermaid flowchart로 전체 흐름·경유 IP 설명.
6. **점검 순서**: Backend 실행 위치 확인, 터미널 로그(error_type/error), DB 서버 방화벽·pg_hba.conf·Backend 호스트 IP 허용, psql/telnet 테스트.

### 수정/추가 파일
- docs/report/09_ETL_DB_Connection_Flow.md (신규)
- docs/report/00_ReportIndex.md (09번 항목 추가)
- docs/report/log.md (본 로그)

---

## 2026-02-13: ETL 목록 문서 통합·Frontend packages 상단 주석 정리

### 완료 작업
1. **문서 통합**: docs/report/10_ETL_목록_동작_정리.md 내용을 08_ETL_Phase_Implement_Guide.md §12로 이관 후 10번 파일 삭제. 00_ReportIndex.md에서 10번 항목 제거, 08번 설명에 §12 ETL 목록 동작 정리 반영.
2. **Frontend packages 상단 주석 정리**: packages/etl, report, dashboard, dashboard2, widgetboard 내 코드 파일을 구조 순서대로 점검·통일.
   - **etl**: index.jsx [Main] 통일. PreviewModal [Components]/[Dependencies] 추가. JobHistoryPanel [Main Functions] 추가. SourceTypeSelector 'history' 탭 반영·[Components] 추가.
   - **report**: index.jsx [Main]만 유지([Endpoints/Classes/Functions] 제거).
   - **dashboard/dashboard2**: index.jsx [Main], [Dependencies]만 유지.
   - **widgetboard**: index.jsx 전체 형식 추가. Dashboard3Page.jsx [Main Functions]/[Dependencies] 보강. dataUtils.js [Main Functions]/[Dependencies] 추가. widgetboard.css 상단 블록 주석 추가.

### 수정/삭제 파일
- docs/report/08_ETL_Phase_Implement_Guide.md (§12 추가)
- docs/report/00_ReportIndex.md (10번 제거, 08 설명 갱신)
- docs/report/10_ETL_목록_동작_정리.md (삭제)
- Frontend/react-app/src/packages/etl/index.jsx, components/PreviewModal.jsx, JobHistoryPanel.jsx, SourceTypeSelector.jsx
- Frontend/react-app/src/packages/report/index.jsx
- Frontend/react-app/src/packages/dashboard/index.jsx
- Frontend/react-app/src/packages/dashboard2/index.jsx
- Frontend/react-app/src/packages/widgetboard/index.jsx, Dashboard3Page.jsx, utils/dataUtils.js, widgetboard.css
- docs/report/log.md (본 로그)

---

## 2026-02-13: Backend api_server·etl_server 상단 설명 주석(docstring) 업데이트

### 완료 작업
1. **api_server**: `__init__.py` — 패키지 설명에 ETL REST API 포함, app 설명 정리. `main.py` — etl_router 설명에 add-file·add-files-zip 명시, Dependencies에 Backend.etl_server.router 추가. `db.py` — 상단 Functions 목록에서 get_db_connection / get_db_connection_system 순서·중복 정리, 라인 번호 제거(유지보수 시 밀림 방지), 메인/시스템 DB·ETL 타겟 조회 역할 문구 보강.
2. **etl_server**: `service.py` — _connect_postgres 설명에 connect_timeout·로깅 적용 반영. `router.py` — add_files_zip_to_table·cleanup_expired_uploads 라인 번호를 실제 정의 위치(480, 626)로 수정.

### 수정 파일
- Backend/api_server/__init__.py, main.py, db.py
- Backend/etl_server/service.py, router.py
- docs/report/log.md (본 로그)

---

## 2026-02-13: ETL 압축(ZIP) 다중 파일 추가 적재

### 완료 작업
1. **설계 문서**: docs/report/08_ETL_Phase_Implement_Guide.md에 **§11 추가 구현: 압축(zip) 다중 파일 추가 적재** 추가. 흐름(업로드 → 압축 해제 → 파일명 자연 정렬 → Job 순차 등록), **건너뛴 파일 목록 제공**(API 응답 skipped_files, UI 표시·복사·텍스트 다운로드), **다중 사용자 동시 업로드**(요청별 `uploads/zip_<uuid>/` 사용으로 넘버링·경로 충돌 방지) 정리.
2. **Backend**: `POST /api/etl/tables/{etl_table_id}/add-files-zip` 추가. ZIP 수신 → `uploads/zip_<uuid>/`에 압축 해제 → 지원 확장자(.csv, .xlsx, .xls, .parquet)·max_file_size_mb 이하만 유효 → 파일명 자연 정렬 후 순서대로 insert_job → 응답에 job_ids, enqueued_count, skipped_files(filename, reason) 반환. _natural_sort_key, _file_type_from_ext 헬퍼 추가. _cleanup_expired_uploads에서 zip_* 디렉터리 만료 시 전체 삭제.
3. **Frontend**: 데이터 추가 모달에 "단일 파일" / "ZIP (여러 파일, 파일명 순서대로 적재)" 모드. ZIP 모드 시 etlAddFilesZipToTable 호출, 성공 시 결과 화면에 메시지·건너뛴 파일 목록(사유 표시)·목록 복사·텍스트로 다운로드 버튼 제공.
4. **API 클라이언트**: etlAddFilesZipToTable(etlTableId, file) 추가.

### 수정/추가 파일
- docs/report/08_ETL_Phase_Implement_Guide.md (§11 추가)
- Backend/etl_server/router.py (add-files-zip, _natural_sort_key, _file_type_from_ext, cleanup zip_*)
- Frontend/react-app/src/shared/api/client.js (etlAddFilesZipToTable)
- Frontend/react-app/src/packages/etl/components/AddFileModal.jsx (모드 선택, ZIP 결과·건너뛴 파일 UI)
- Frontend/react-app/src/packages/etl/etl.css (모드·결과·건너뛴 목록 스타일)
- docs/report/log.md (본 로그)

---

## 2026-02-13: _validate_identifier 통일·도움말 모달 상태별 안내·동작 컬럼 너비

### 완료 작업
1. **_validate_identifier 통일**: load_service, db_load_service에 있던 동일 함수 제거 후, service._validate_identifier 한 곳만 사용하도록 변경. load_service·db_load_service는 etl_service._validate_identifier 호출, preview_service는 db_load_service에서 _validate_identifier import 제거 후 etl_service._validate_identifier 사용. transform_rules_service·service는 기존대로 etl_service/내부 _validate_identifier 사용.
2. **도움말 모달(?)**: 단순 버튼 목록이 아니라 **상태별** 안내로 재구성. draft / error / done / 실행 중·대기 중 섹션으로 나누어, 각 상태에서 어떤 버튼이 활성·비활성인지와 동작을 설명.
3. **동작 컬럼 너비**: 동작 컬럼 헤더에 ? 추가 후 좌우폭이 좁아지던 문제 해결. `.etl-table-list__th-actions`, `.etl-table-list__cell-actions`에 min-width: 320px 적용, 동작 셀에 클래스 부여.

### 수정 파일
- Backend/etl_server/load_service.py, db_load_service.py (로컬 _validate_identifier 제거, etl_service._validate_identifier 사용)
- Backend/etl_server/preview_service.py (db_load_service에서 _validate_identifier 제거, etl_service._validate_identifier 사용)
- Frontend/react-app/src/packages/etl/components/ETLTableList.jsx (도움말 모달 상태별 섹션, 동작 td에 etl-table-list__cell-actions)
- Frontend/react-app/src/packages/etl/etl.css (동작 컬럼 min-width, cell-actions)
- docs/report/log.md (본 로그)

---

## 2026-02-13: PK 설정 모달 — 컬럼 선택(체크박스) 방식으로 변경

### 완료 작업
1. **요구**: PK 설정 시 텍스트 입력 대신 컬럼을 선택할 수 있도록 변경.
2. **구현**: PkColumnsModal에서 열릴 때 `GET /api/etl/tables/:id/preview`로 컬럼 목록 로드 후, 체크박스로 PK로 쓸 컬럼 선택. 선택 순서는 테이블 컬럼 순서로 전송. API는 기존대로 `PATCH /api/etl/tables/:id` (pk_columns 쉼표 구분 문자열).
3. **폴백**: 미리보기 실패 또는 컬럼 없음 시 안내 문구 + 직접 입력용 텍스트 필드 유지.

### 수정 파일
- Frontend/react-app/src/packages/etl/components/PkColumnsModal.jsx (etlPreviewTable 연동, 체크박스 UI)
- Frontend/react-app/src/packages/etl/etl.css (.etl-pk-modal__columns, __checkbox-wrap, __checkbox, __selected-hint, __loading)
- docs/report/log.md (본 로그)

---

## 2026-02-13: Backend/etl_server 상단 설명 라인 번호 정정

### 완료 작업
1. **문제**: 각 .py 파일 상단 docstring의 "LINE - 함수/클래스명" 형식 라인 번호가 실제 코드 위치와 불일치(추가/삭제로 인한 밀림).
2. **조치**: `^def |^async def |^class ` 기준으로 현재 라인 번호를 grep으로 재확인 후, 다음 9개 파일의 상단 설명만 수정(코드 변경 없음).
   - router.py (Pydantic Models, Helpers, Endpoints)
   - service.py (Helpers, Connections, ETL Tables, Jobs)
   - db_load_service.py, load_service.py (Helpers, Main)
   - preview_service.py, queue_worker.py, transform_engine.py, transform_rules_service.py, schema_infer.py
3. **미수정**: etl_limits.py(22 - get_etl_limits), __init__.py(17 - router)는 이미 일치하여 변경 없음.

### 수정 파일
- Backend/etl_server/router.py, service.py, db_load_service.py, load_service.py
- Backend/etl_server/preview_service.py, queue_worker.py, transform_engine.py, transform_rules_service.py, schema_infer.py
- docs/report/log.md (본 로그)

---

## 2026-02-13: 파일/DB 적재 시 PK 설정·선택 반영

### 완료 작업
1. **파일 업로드 적재**: ETL에 `pk_columns`가 설정되어 있으면 CREATE TABLE 시 `PRIMARY KEY (col1, ...)` 추가. 설정 없으면 기존처럼 PK 없이 생성. 컬럼명은 파일 컬럼과 일치해야 하며, 없으면 실패 메시지 반환.
2. **DB full 모드**: 소스 테이블의 PRIMARY KEY를 information_schema로 조회(`_fetch_source_pk_columns`)해, 타겟 CREATE TABLE에 자동으로 `PRIMARY KEY (...)` 추가. 소스에 PK 없으면 PK 없이 생성.
3. **PK 설정 UI**: 등록된 ETL 목록에 "PK 설정" 버튼 추가 → 모달에서 PK 컬럼(쉼표 구분) 입력·저장. `PATCH /api/etl/tables/:id` (body: `pk_columns`) 및 `update_etl_table(etl_table_id, pk_columns)` 추가.

### 수정/추가 파일
- Backend/etl_server/load_service.py (pk_columns 있으면 CREATE TABLE에 PRIMARY KEY 추가)
- Backend/etl_server/db_load_service.py (_fetch_source_pk_columns, full 모드 CREATE 시 PK 반영)
- Backend/etl_server/service.py (update_etl_table)
- Backend/etl_server/router.py (UpdateTableBody, PATCH /tables/{id})
- Frontend/react-app/src/shared/api/client.js (etlUpdateTable)
- Frontend/react-app/src/packages/etl/components/PkColumnsModal.jsx (신규)
- Frontend/react-app/src/packages/etl/components/ETLTableList.jsx (PK 설정 버튼·모달)
- Frontend/react-app/src/packages/etl/etl.css (.etl-pk-modal, .etl-table-list__pk-set)
- docs/report/log.md (본 로그)

---

## 2026-02-13: 등록된 ETL 목록에 행만 삭제(X) 버튼 추가 (테이블 유지)

### 완료 작업
1. **요구**: 동일 테이블에 대한 업로드 건이 중복으로 들어갈 때, 테이블은 유지하고 해당 행과 업로드 파일만 삭제하는 버튼 필요.
2. **Backend**: `delete_etl_table_row_only(etl_table_id)` 추가. 메인 DB 타겟 테이블은 DROP하지 않고, 해당 ETL 행의 file_path·관련 job의 add_file_path 파일 삭제 후 etl_transform_rules·etl_jobs·etl_tables에서 삭제. `DELETE /api/etl/tables/{id}/row` 엔드포인트 추가.
3. **Frontend**: `etlDeleteTableRow(etlTableId)` API, ETLTableList에서 삭제 버튼 옆에 × 버튼(.etl-table-list__delete-row). 클릭 시 "해당 ETL 등록 건만 삭제합니다. 업로드 파일은 삭제되며, 메인 DB의 타겟 테이블은 유지됩니다. 진행할까요?" 컨펌 후 호출.

### 수정 파일
- Backend/etl_server/service.py (delete_etl_table_row_only)
- Backend/etl_server/router.py (DELETE /tables/{id}/row)
- Frontend/react-app/src/shared/api/client.js (etlDeleteTableRow)
- Frontend/react-app/src/packages/etl/components/ETLTableList.jsx (X 버튼)
- Frontend/react-app/src/packages/etl/etl.css (.etl-table-list__delete-row)
- docs/report/log.md (본 로그)

---

## 2026-02-13: Job 삭제 시 업로드 파일 함께 삭제·확장자/용량 안내 추가

### 완료 작업
1. **Job 삭제 시 add_file_path 파일 삭제**: `etl_service.delete_job(job_id)` 실행 시, 해당 job에 `add_file_path`가 있으면 DELETE 전에 경로를 읽어 두고, DB 삭제 성공 후 해당 경로의 파일이 존재하면 `os.remove`로 삭제. (추가 적재용 업로드 파일이 job과 함께 제거됨.)
2. **확장자·제한용량 안내**: 파일 업로드 드래그앤드롭 영역(FileUploadForm)과 데이터 추가 모달(AddFileModal)의 파일 선택/드롭존 아래에 "지원 형식: CSV, Excel(.xlsx/.xls), Parquet / 최대 100MB" 안내 문구 추가. FileUploadForm에는 `.etl-file-form__accept` 스타일 추가.

### 수정 파일
- Backend/etl_server/service.py (delete_job에서 add_file_path 조회 후 파일 삭제, os import)
- Frontend/react-app/src/packages/etl/components/FileUploadForm.jsx (__accept 문구)
- Frontend/react-app/src/packages/etl/components/AddFileModal.jsx (__accept 문구)
- Frontend/react-app/src/packages/etl/etl.css (.etl-file-form__accept)
- docs/report/log.md (본 로그)

---

## 2026-02-13: 실행목록 패널에 Job 단건 삭제(X) 버튼 추가

### 완료 작업
1. **실행목록(Job 결과 패널)** 각 패널 오른쪽 끝에 **해당 job만 삭제**하는 X 버튼 추가. 클릭 시 "해당 job을 지우겠습니까?" 컨펌 후 확인 시 `DELETE /api/etl/jobs/{job_id}` 호출 및 목록에서 제거.
2. **JobLogPanel**: `onDeleteJob(job_id)` prop 추가, 헤더에 `__head-actions`(닫기 + job 삭제 X) 배치. job 삭제 버튼은 빨간 테두리/글자로 구분.
3. **ETLPage**: `etlDeleteJob` import, `handleDeleteJob(jobId)` (confirm → API → handleCloseResult) 추가, JobLogPanel에 `onDeleteJob` 전달.

### 수정 파일
- Frontend/react-app/src/packages/etl/components/JobLogPanel.jsx (onDeleteJob, X 버튼)
- Frontend/react-app/src/packages/etl/ETLPage.jsx (etlDeleteJob, handleDeleteJob)
- Frontend/react-app/src/packages/etl/etl.css (.etl-job-log__head-actions, .etl-job-log__delete-job)
- docs/report/log.md (본 로그)

---

## 2026-02-13: 데이터 추가 모달 UI 개선 (드래그앤드롭·여백·디자인)

### 완료 작업
1. **텍스트 정리**: 긴 설명 문단 제거. 타겟 테이블은 칩 형태로, 한 줄 힌트("같은 테이블에 추가합니다. PK 일치 시 업데이트, 없으면 삽입됩니다.")만 표시해 여백 확보.
2. **드래그앤드롭**: 모달 내 파일 드롭존 추가. 영역 클릭 시 파일 선택, 드래그 오버/드롭 처리, 선택된 파일명 표시. FileUploadForm 패턴과 동일한 방식(useRef, onDragOver/Leave/Drop).
3. **스타일**: 모달 패딩·타이틀·닫기 버튼, 드롭존(점선 테두리·호버/드래그오버 시 teal 강조), 지원 포맷 안내(CSV, Excel, Parquet), 액션 버튼 여백·border-radius 조정. 빽빽한 인상 해소.

### 수정 파일
- Frontend/react-app/src/packages/etl/components/AddFileModal.jsx (드롭존·짧은 복사·파일 상태)
- Frontend/react-app/src/packages/etl/etl.css (add-file 모달: __info, __target, __hint, __drop, __drop--over, __drop--has, __accept 등)
- docs/report/log.md (본 로그)

---

## 2026-02-13: ETL 미리보기 수정·실행 전 테이블 존재 컨펌

### 완료 작업
1. **미리보기**: `load_service._read_file`이 `(DataFrame, data_verification_needed)` 튜플을 반환하는데 미리보기에서 DataFrame만 기대해 오류 발생. `preview_service._read_file_preview`에서 튜플을 풀어 DataFrame만 반환하도록 수정.
2. **실행 전 컨펌**: 타겟 테이블이 메인 DB에 이미 있으면 "동일한 테이블명이 있습니다. 실행 시 기존 테이블이 삭제되고 새로 적재됩니다. 진행하시겠습니까?" 컨펌 표시. 백엔드 `api_server.db.table_exists_in_schema`, `GET /api/etl/tables/{etl_table_id}/target-exists` 추가. 프론트 `handleRun`에서 target-exists 조회 후 exists 시 confirm, 취소 시 실행 안 함.

### 수정/추가 파일
- Backend/etl_server/preview_service.py (_read_file_preview에서 튜플 언패킹)
- Backend/api_server/db.py (table_exists_in_schema)
- Backend/etl_server/router.py (GET target-exists)
- Frontend/react-app/src/shared/api/client.js (etlTargetExists)
- Frontend/react-app/src/packages/etl/ETLPage.jsx (handleRun 내 target-exists + confirm)
- docs/report/10_ETL_목록_동작_정리.md, log.md

---

## 2026-02-13: ETL 동일 테이블 데이터 추가(업서트) — 분할 파일 50+50+40MB → 한 테이블

### 완료 작업
1. **요구사항**: 140MB 파일을 50/50/40MB로 나눠 올려도 모두 동일 타겟 테이블로 들어가도록, 등록된 ETL에 "데이터 추가" 가능. 추가 파일은 PK 검증 후 업서트(INSERT ... ON CONFLICT DO UPDATE).
2. **백엔드**: api_server.db에 get_primary_key_columns(table_name) 추가(메인 DB information_schema). etl_jobs에 add_file_path, add_file_type 컬럼 사용(INSERT/SELECT). load_service.run_file_upsert(etl_table_id, job_id): Job의 add_file_path 파일 읽기 → etl_tables.pk_columns 또는 메인 DB PK 사용 → 타겟 테이블에 배치 업서트. router: POST /api/etl/tables/{etl_table_id}/add-file (파일 업로드, PK·컬럼 검증, Job 등록). queue_worker: add_file_path 있으면 run_file_upsert 호출.
3. **프론트**: AddFileModal(파일 선택 → 추가 적재), ETLTableList에 "데이터 추가" 버튼(파일 ETL만), ETLPage에서 모달 상태·onSuccess 시 jobResults에 Job 추가.
4. **DB 마이그레이션**(명령만): system_db의 etl_jobs에 컬럼 추가 후 사용.
   - `ALTER TABLE etl_jobs ADD COLUMN IF NOT EXISTS add_file_path TEXT;`
   - `ALTER TABLE etl_jobs ADD COLUMN IF NOT EXISTS add_file_type VARCHAR(20);`
5. **사용 조건**: 타겟 테이블에 PRIMARY KEY가 있거나, ETL 설정에 pk_columns를 넣어 두어야 함. (첫 적재로 만든 테이블은 PK가 없을 수 있으므로, 필요 시 메인 DB에서 `ALTER TABLE ... ADD PRIMARY KEY (컬럼);` 실행.)

### 수정/추가 파일
- Backend/api_server/db.py (get_primary_key_columns)
- Backend/etl_server/service.py (insert_job에 add_file_path/add_file_type, list_jobs/get_job SELECT)
- Backend/etl_server/load_service.py (run_file_upsert)
- Backend/etl_server/router.py (POST add-file, _normalize_column_name_for_check)
- Backend/etl_server/queue_worker.py (add_file_path 시 run_file_upsert)
- Frontend/react-app/src/shared/api/client.js (etlAddFileToTable)
- Frontend/react-app/src/packages/etl/components/AddFileModal.jsx (신규)
- Frontend/react-app/src/packages/etl/components/ETLTableList.jsx (onAddFile, 데이터 추가 버튼)
- Frontend/react-app/src/packages/etl/ETLPage.jsx (addFileModal 상태, AddFileModal, onSuccess)
- Frontend/react-app/src/packages/etl/etl.css (add-file 모달·버튼)
- docs/report/log.md (본 로그)

---

## 2026-02-13: CSV 폴백 사용 시 "데이터 확인이 필요합니다" 안내 표시

### 완료 작업
1. **백엔드**: CSV를 폴백(EOF 문자 제거)으로 읽은 경우 `etl_jobs.notice`에 "데이터 확인이 필요합니다." 저장. `update_job(..., notice=...)`, `list_jobs`/`get_job`에 `notice` 컬럼 반환 추가.
2. **DB**: `etl_jobs`에 `notice` 컬럼 추가(이미 적용). 앞으로 컬럼 추가 등은 SQL 파일 없이 명령어만 안내.
3. **프론트**: 실행 결과 패널(JobLogPanel) 아래에 `notice`가 있으면 완료/취소 시 해당 문구 표시(.etl-job-log__notice). ETLPage에서 폴링·초기 로드 시 `notice` 포함, 완료된 Job도 패널에 유지해 안내 노출.

### 수정/추가 파일
- Backend/etl_server/service.py (update_job에 notice 인자, list_jobs/get_job SELECT에 j.notice)
- Backend/etl_server/load_service.py (완료 시 notice 저장)
- Frontend/react-app/src/packages/etl/ETLPage.jsx (notice 매핑, 완료 Job 삭제하지 않고 유지)
- Frontend/react-app/src/packages/etl/components/JobLogPanel.jsx (notice 표시)
- Frontend/react-app/src/packages/etl/etl.css (.etl-job-log__notice)
- docs/report/log.md (본 로그)

---

## 2026-02-13: CSV 적재 시 "unexpected end of data" 에러 대응

### 완료 작업
1. **원인**: pandas read_csv 시 파일 내 EOF 문자(`\x1a`, Ctrl+Z) 또는 따옴표 불균형 등으로 ParserError "unexpected end of data" 발생 시 적재 실패(처리 건수 0).
2. **대응**: `load_service._read_csv_robust`에서 해당 예외 발생 시, 파일을 바이너리로 읽어 `\x1a`를 공백으로 치환한 뒤 StringIO로 다시 read_csv 시도하는 폴백 추가.
3. **수정 파일**: Backend/etl_server/load_service.py (io import, _read_csv_robust 폴백 로직), docs/report/log.md.

---

## 2026-02-13: ETL 실행 결과 여러 개 표시·진행 중/대기 중 UI 구분

### 완료 작업
1. **실행 결과 오락가락 해소**: 단일 lastRunResult 대신 jobResults(job_id → 결과) 맵 사용. 실행할 때마다 해당 job을 맵에 추가하고, 2초마다 running/pending인 모든 job을 폴링해 갱신. 실행 결과 영역에 job별 패널을 **아래로** 나열해 각각 표시.
2. **패널별 동작**: 각 패널에 닫기(×) 버튼, running/pending일 때만 해당 패널에 "실행 취소" 버튼 표시.
3. **진행 중/대기 중 구분**: 목록 테이블에서 해당 행 배경색(실행 중: 연한 파랑, 대기 중: 연한 노랑), 상태 셀 글자(실행 중: 파랑 굵게, 대기 중: 주황 굵게). 실행 결과 패널에서 running은 연한 파랑 배경·테두리, pending은 연한 노랑 배경·테두리. 완료/실패/취소는 기존처럼 녹/빨강/주황 유지.
4. **가독성**: 패널 제목에 타겟 테이블명 포함, 헤더·닫기 버튼 정렬, 취소 버튼 영역 구분.

### 수정 파일
- Frontend/react-app/src/packages/etl/ETLPage.jsx (jobResults, 폴링, resultEntries, JobLogPanel 여러 개)
- Frontend/react-app/src/packages/etl/components/JobLogPanel.jsx (result, onCancel, onClose, --running/--pending, 닫기·취소 버튼)
- Frontend/react-app/src/packages/etl/components/ETLTableList.jsx (lastRunResult 제거, 행/상태 클래스 및 statusText)
- Frontend/react-app/src/packages/etl/etl.css (etl-job-results, --running/--pending, 행·상태 스타일, 패널 head/close/actions)
- docs/report/log.md (본 로그)

---

## 2026-02-13: ETL 예상 완료 시간(ETA) — total_rows·남은 시간·예상 완료 시각

### 완료 작업
1. **etl_jobs.total_rows**: 스키마에 total_rows 컬럼 추가. 서비스에 set_job_total_rows(job_id, total_rows) 추가.
2. **파일 적재**: run_file_load에서 파일 읽기 후 비어 있지 않으면 set_job_total_rows(job_id, len(df)) 호출.
3. **DB 적재**: 스트리밍 경로는 실행 전 동일 WHERE로 COUNT(*) 조회 후 set_job_total_rows(상한 적용). fetchall 경로는 fetch 후 set_job_total_rows(job_id, len(rows_data)).
4. **API**: list_jobs·get_job SELECT에 j.total_rows 포함.
5. **프론트**: ETLPage 폴링 시 lastRunResult에 total_rows 반영. JobLogPanel에서 total_rows·rows_processed·경과로 예상 남은 시간(초→분/시간 표기)·예상 완료 시각 계산 표시. 처리 건수에 "N / total" 형식 표시.

### 수정/추가 파일
- Backend/etl_server/service.py (set_job_total_rows, list_jobs/get_job에 total_rows)
- Backend/etl_server/load_service.py (set_job_total_rows 호출)
- Backend/etl_server/db_load_service.py (스트리밍 COUNT·fetchall 후 set_job_total_rows)
- Frontend/react-app/src/packages/etl/ETLPage.jsx (폴링 시 total_rows)
- Frontend/react-app/src/packages/etl/components/JobLogPanel.jsx (예상 남은 시간·예상 완료 시각·처리 건수 N/total)
- docs/report/log.md (본 로그)

---

## 2026-02-13: ETL 목록 큐 상태·실행 결과 패널 개선

### 완료 작업
1. **목록 행별 상태**: 실행 버튼을 큐 기준으로 표시. 해당 ETL이 running → "실행 중", pending → "대기 중", 없으면 "실행". 실행/대기 중일 때만 비활성화, 나머지는 언제든 클릭 가능(대기열 등록).
2. **큐 폴링**: GET /api/etl/jobs 로 2초마다 조회 후 running/pending Job을 etl_table_id별로 매핑해 행별 버튼 문구 갱신.
3. **실행 결과 패널**: Job ID 외에 **타겟 테이블**, **시작 시각**, **경과 시간**(running/pending 시 1초마다 갱신), 처리 건수 표시.
4. **Backend**: list_jobs·get_job 응답에 target_table 포함(etl_tables JOIN). run 응답에 etl_table_id, target_table 포함.

### 수정/추가 파일
- Backend/etl_server/service.py (list_jobs, get_job — target_table JOIN)
- Backend/etl_server/router.py (run 응답에 target_table, etl_table_id)
- Frontend/react-app/src/shared/api/client.js (etlListJobs)
- Frontend/react-app/src/packages/etl/components/ETLTableList.jsx (queueStatus, loadQueueStatus, 행별 runLabel/runDisabled)
- Frontend/react-app/src/packages/etl/ETLPage.jsx (lastRunResult에 target_table, started_at 등 유지)
- Frontend/react-app/src/packages/etl/components/JobLogPanel.jsx (타겟 테이블, 시작 시각, 경과 시간)
- Frontend/react-app/src/packages/etl/etl.css (.etl-table-list__run--busy)
- docs/report/log.md (본 로그)

---

## 2026-02-13: ETL config 한도(etl_limits) 적용 — 램 오버 방지

### 완료 작업
1. **config 한도**: `backend.etl_limits` 에 max_file_size_mb, max_rows_per_load, max_batch_size 정의 시 해당 값으로 잘라서 처리.
2. **etl_limits 모듈**: `Backend/etl_server/etl_limits.py` — get_etl_limits() 로 config 조회, 없으면 0(한도 미적용).
3. **파일 적재**: 파일 크기 > max_file_size_mb 이면 실패. CSV는 nrows=max_rows_per_load, Excel/Parquet는 읽은 뒤 head(max_rows_per_load).
4. **DB 적재**: max_batch_size로 사용자 batch_size 상한. effective_batch_size > 0 이면 배치 단위 스트리밍(fetch → 변환 → 적재 반복, 메모리에 전체 미적재). effective_batch_size == 0 이면 SELECT에 LIMIT max_rows_per_load 적용.

### 수정/추가 파일
- Backend/etl_server/etl_limits.py (신규)
- Backend/etl_server/load_service.py (get_etl_limits, 파일 크기 검사, _read_file max_rows)
- Backend/etl_server/db_load_service.py (get_etl_limits, effective_batch_size, limit_sql, 배치 스트리밍 경로)
- docs/report/08_ETL_Phase_Implement_Guide.md (§3.2 etl_limits)
- docs/report/log.md (본 로그)

---

## 2026-02-13: ETL 문서 통합 (08번으로 합침)

### 완료 작업
1. **ETL 관련 문서 통합**: 08·09·10·11·12번 중 이미 적용된 세부 구현 내용 제거, 참조·운영에 유용한 정보만 남겨 **08_ETL_Phase_Implement_Guide.md** 하나로 통합.
2. **삭제한 문서**: 09_ETL_System_Connectivity_Check.md, 10_ETL_Job_확인_방법.md, 11_ETL_예상완료시간_재실행동작_검토.md, 12_ETL_파일_DB_동작_검증.md.
3. **08 통합본 구성**: 목적·범위·요구사항 요약, 시스템 개요, 전제 조건·config, 메타 테이블·DDL 참조, 모듈·의존 관계, Job 확인 방법(운영), 재실행·ETA, 파일/DB 동작 검증 요약, Phase 순서·공통 주의·확장.
4. **인덱스 갱신**: 00_ReportIndex.md에서 09·10·11·12 항목 제거, 08 설명 갱신.

### 수정/삭제 파일
- docs/report/08_ETL_Phase_Implement_Guide.md (통합본으로 전면 교체)
- docs/report/09_ETL_System_Connectivity_Check.md (삭제)
- docs/report/10_ETL_Job_확인_방법.md (삭제)
- docs/report/11_ETL_예상완료시간_재실행동작_검토.md (삭제)
- docs/report/12_ETL_파일_DB_동작_검증.md (삭제)
- docs/report/00_ReportIndex.md (08 설명 갱신, 09~12 제거)
- docs/report/log.md (본 로그)

---

## 2026-02-13: ETL 목록 삭제 버튼 (DROP 테이블·파일 삭제·컨펌)

### 완료 작업
1. **ETL 테이블 1건 삭제**: 목록에 행별 "삭제" 버튼 추가. 클릭 시 컨펌창(타겟 테이블 DROP·파일 삭제 안내) 확인 후 DELETE /api/etl/tables/{id} 호출.
2. **백엔드**: delete_etl_table(etl_table_id) — 메인 DB 타겟 테이블 DROP, etl_transform_rules·etl_jobs·etl_tables 행 삭제, file_path 반환. 라우터에서 업로드 디렉터리 내 파일 삭제.
3. **프론트**: etlDeleteTable(etlTableId), ETLTableList 삭제 버튼·window.confirm, onDelete 시 목록 새로고침.

### 수정/추가 파일
- Backend/etl_server/service.py (delete_etl_table)
- Backend/etl_server/router.py (DELETE /tables/{etl_table_id}, 파일 삭제)
- Frontend/react-app/src/shared/api/client.js (etlDeleteTable)
- Frontend/react-app/src/packages/etl/components/ETLTableList.jsx (삭제 버튼·컨펌·onDelete)
- Frontend/react-app/src/packages/etl/ETLPage.jsx (onDelete={handleRefresh})
- Frontend/react-app/src/packages/etl/etl.css (.etl-table-list__actions, .etl-table-list__delete)
- docs/report/log.md (본 로그)

---

## 2026-02-13: batch 컬럼 가정으로 코드 롤백

### 완료 작업
1. **컬럼 추가는 사용자가 DB에서 수행**: batch_size, batch_interval_seconds 추가용 SQL만 안내.
2. **service.py 롤백**: list_etl_tables, create_etl_table, get_etl_table에서 "컬럼 없을 때 폴백" 제거. 항상 batch_size, batch_interval_seconds 컬럼이 있다고 가정하는 코드로 복원.

### 수정 파일
- Backend/etl_server/service.py (list_etl_tables, create_etl_table, get_etl_table — try/except 폴백 제거)
- docs/report/log.md (본 로그)

---

## 2026-02-13: ETL 취소·연결 해제·배치 크기/시간·검토 문서

### 완료 작업
1. **예상 완료/남은 시간 검토**: docs/report/11_ETL_예상완료시간_재실행동작_검토.md 작성. 가능하나 진행률(processed/total) 갱신·배치 처리 선행 필요. 배치 적용 시 ETA 계산 가능.
2. **실행 중 취소**: POST /api/etl/jobs/{job_id}/cancel. 워커가 100건마다 is_job_cancelled 확인, 취소 시 DROP TABLE(파일/Full), job=cancelled, etl_table=error. 프론트: running/pending 시 "실행 취소" 버튼.
3. **DB 연결 해제**: DELETE /api/etl/connections/{id}. 해당 연결의 모든 ETL 타겟 테이블을 메인 DB에서 DROP 후 etl_tables·etl_connections 삭제. DbConnectionForm에 "등록된 연결" 목록·연결 해제 버튼 추가.
4. **재실행 동작 정리**: 11번 문서에 명시. 파일/DB full = 전체 교체, DB incremental = 업서트.
5. **배치 크기·배치 시간**: etl_tables에 batch_size, batch_interval_seconds 컬럼. DB 적재 시 batch_size>0이면 서버 사이드 커서로 fetchmany(batch_size), 배치 간 sleep(batch_interval_seconds). DbConnectionForm에 배치 크기·배치 간 대기(초) 입력 추가.

### 수정/추가 파일
- Backend/etl_server/service.py (is_job_cancelled, delete_connection, list_etl_tables_by_connection, create_etl_table batch 인자, list/get_etl_table batch 컬럼)
- Backend/etl_server/router.py (POST /jobs/{id}/cancel, DELETE /connections/{id}, CreateTableBody batch 필드)
- Backend/etl_server/load_service.py (취소 시 100건마다 확인, 취소 시 DROP TABLE)
- Backend/etl_server/db_load_service.py (취소 확인, batch_size/batch_interval_seconds 적용 시 fetchmany·sleep)
- Frontend: ETLPage.jsx (취소 버튼·handleCancelJob), JobLogPanel (cancelled 스타일), DbConnectionForm (연결 해제·배치 입력), shared/api/client (etlCancelJob, etlDeleteConnection), etl.css (취소·연결 목록 스타일)
- docs/report/08_ETL_Phase_Implement_Guide.md (§5.3 배치 컬럼)
- docs/report/11_ETL_예상완료시간_재실행동작_검토.md (신규)
- docs/report/00_ReportIndex.md (11번 추가)
- docs/report/log.md (본 로그)

---

## 2026-02-13: ETL 라벨명 필드 추가·타겟 테이블명 자동 채움

### 완료 작업
1. **라벨명 필드**: FileUploadForm·DbConnectionForm에 "라벨명 (선택, 추후 테이블 마스터에서 관리)" 입력 추가. 백엔드 upload·CreateTableBody에서 `label_name` 수신만 하고 저장/처리 없음.
2. **타겟 테이블명 자동 채움**: 파일 업로드 폼에서 파일 선택 시 타겟 테이블명에 파일명(확장자 제외) 자동 입력. 필요 시 사용자가 수정 가능.

### 수정 파일
- Frontend/react-app/src/packages/etl/components/FileUploadForm.jsx (labelName state·input, onFileChange에서 파일명→targetTable, label_name 전송)
- Frontend/react-app/src/packages/etl/components/DbConnectionForm.jsx (labelName state·input, etlCreateTable에 label_name)
- Backend/etl_server/router.py (upload에 label_name Form, CreateTableBody에 label_name 필드)
- docs/report/log.md (본 로그)

---

## 2026-02-13: ETL 워커 — etl_jobs 미존재 시 로그 스팸 방지

### 완료 작업
1. **queue_worker**: `etl_jobs` 등 ETL 메타 테이블이 system_db에 없을 때 매 2초마다 반복되던 traceback 로그 제거.
2. **조치**: "does not exist" 예외 시 한 번만 WARNING 로그 출력("ETL meta tables (e.g. etl_jobs) not found in system_db. Create them to enable the queue. Worker idle."), 이후 동일 예외는 로그 생략. 그 외 예외는 기존처럼 logger.exception 유지.

### 수정 파일
- Backend/etl_server/queue_worker.py (_etl_tables_missing_logged 플래그, _worker_loop 예외 분기)
- docs/report/log.md (본 로그)

---

## 2026-02-02: ETL Phase 6 완료 (큐·모니터링·정리)

### 완료 작업
1. **Job 큐**: POST /api/etl/tables/{id}/run → pending 등록 후 즉시 반환. 백그라운드 워커가 pending을 수거해 실행(동시 2건 제한).
2. **서비스**: insert_job(etl_table_id, "pending") 시 started_at NULL. set_job_running(job_id), list_jobs(etl_table_id?, limit), get_job(job_id), fetch_pending_jobs(limit), count_running_jobs() 추가.
3. **load_service / db_load_service**: run_file_load(etl_table_id, job_id=None), run_db_load(etl_table_id, job_id=None). job_id 있으면 해당 Job 사용(워커 호출 시).
4. **queue_worker**: run_worker_iteration, start_background_worker. MAX_CONCURRENT=2, POLL_INTERVAL=2초. main.py startup에서 워커 기동.
5. **API**: GET /api/etl/jobs (etl_table_id, limit 쿼리), GET /api/etl/jobs/{job_id}. 라우터 안내에 jobs 엔드포인트 추가.
6. **프론트**: etlGetJob(jobId) 추가. 실행 후 status=pending이면 job_id로 2초 간격 폴링해 completed/failed 시 결과 표시.
7. **재시도(6.3)**: 추후 etl_jobs에 retry_count 컬럼 추가 시 재시도 로직 확장 가능. 본 Phase에서는 미적용.
8. **경쟁 방지**: claim_next_pending_job() 추가 — SELECT FOR UPDATE SKIP LOCKED 후 UPDATE로 1건 선점. queue_worker가 fetch_pending_jobs 대신 claim_next_pending_job 루프 사용. 라우터 안내 endpoints 들여쓰기 수정.

### 수정/추가 파일
- Backend/etl_server/service.py (list_jobs, get_job, fetch_pending_jobs, count_running_jobs, set_job_running, claim_next_pending_job, insert_job pending 시 started_at NULL)
- Backend/etl_server/load_service.py (run_file_load job_id 옵션)
- Backend/etl_server/db_load_service.py (run_db_load job_id 옵션)
- Backend/etl_server/queue_worker.py (신규, claim_next_pending_job 사용으로 경쟁 방지)
- Backend/etl_server/router.py (run → pending 등록, GET /jobs, GET /jobs/{job_id})
- Backend/api_server/main.py (startup 시 ETL 워커 기동)
- Frontend/react-app/src/shared/api/client.js (etlGetJob)
- Frontend/react-app/src/packages/etl/ETLPage.jsx (pending 시 폴링)
- docs/report/log.md (본 로그)

---

## 2026-02-02: ETL 시스템 연결·로직 점검

### 완료 작업
1. **의존도 순 점검**: Backend router → load_service/db_load_service → service, transform_rules_service, transform_engine, schema_infer. Frontend ETLPage ↔ components ↔ shared/api/client ETL API.
2. **라우터↔서비스**: 모든 엔드포인트별 호출 함수·인자·반환 구조 일치 확인.
3. **파이프라인**: 파일 적재(정규화→변환→CREATE/INSERT), DB 적재(Full/Incremental·변환) 연동 로직 확인.
4. **수정**: router run_table_load에서 404가 500으로 덮이지 않도록 `except HTTPException: raise` 추가.
5. **보고서**: docs/report/09_ETL_System_Connectivity_Check.md 작성, 00_ReportIndex.md 갱신.

### 수정/추가 파일
- Backend/etl_server/router.py (HTTPException 재발생 처리)
- docs/report/09_ETL_System_Connectivity_Check.md (신규)
- docs/report/00_ReportIndex.md (09 항목 추가)
- docs/report/log.md (본 로그)

---

## 2026-02-02: ETL Phase 5 보강·검증 (ETL 페이지 UI)

### 완료 작업
1. **파일 점검**: ETLPage, SourceTypeSelector, FileUploadForm, DbConnectionForm, ETLTableList, JobLogPanel, etl.css, shared/api/client ETL API — 구조·연동 확인.
2. **DbConnectionForm 보강**: 연결 등록 시 `source_type: 'postgresql'` 전달. 등록 후 폼 리셋에 `schema_name`, `source_type` 포함(defaultConn 재사용).
3. **API 에러 메시지**: shared/api/client `request()` 및 `etlUploadFile()`에서 FastAPI 응답 `detail`(문자열·배열) 파싱 후 Error 메시지로 통일.
4. **JobLogPanel**: `job_id`가 null일 때 항목 비표시, `status` null 시 '—' 표시.
5. **검증**: 프론트엔드 `npm run build` 성공.

### 수정 파일
- Frontend/react-app/src/packages/etl/components/DbConnectionForm.jsx
- Frontend/react-app/src/packages/etl/components/JobLogPanel.jsx
- Frontend/react-app/src/shared/api/client.js
- docs/report/log.md (본 로그)

---

## 2026-02-02: ETL Phase 4 완료 (변환 T 1차)

### 완료 작업
1. **변환 룰 메타**: etl_transform_rules CRUD — transform_rules_service (list/create/get/update/delete), 라우터 GET /api/etl/tables/{etl_table_id}/transform-rules, POST/PUT/DELETE /api/etl/transform-rules.
2. **변환 엔진**: transform_engine.apply_rules(df, rules) — cleansing(TRIM, empty_to_null, default_value), type_cast(date/timestamp/integer/numeric/text, on_error), code_map(mappings, default), derived(concat, year_minus), masking(right_n/left_n/email_domain).
3. **파이프라인 연동**: load_service.run_file_load — 컬럼 정규화 후 변환 룰 적용 후 CREATE/INSERT. db_load_service.run_db_load — 추출 결과 DataFrame으로 변환 후 변환 룰 적용, 변환된 스키마로 CREATE/INSERT·Upsert.
4. **정리**: transform_engine _apply_type_cast 미사용 return 제거.

### 수정/추가 파일
- Backend/etl_server/transform_rules_service.py (Phase 4 변환 룰 CRUD)
- Backend/etl_server/transform_engine.py (apply_rules, 룰 타입별 적용·타입 캐스트 정리)
- Backend/etl_server/load_service.py (변환 룰 적용 연동)
- Backend/etl_server/db_load_service.py (변환 룰 적용·_pg_type_from_pandas)
- Backend/etl_server/router.py (transform-rules 엔드포인트)
- docs/report/log.md (본 로그)

---

## 2026-02-02: ETL Phase 3 완료 (DB 연동 E/L)

### 완료 작업
1. **연결 API·서비스**: POST /api/etl/connections, GET /api/etl/connections, POST /api/etl/connections/test, GET /api/etl/connections/{connection_id}/tables — service.create_connection, list_connections, test_connection, list_source_tables 반영.
2. **ETL 테이블 정의 확장**: POST /api/etl/tables body에 pk_columns, incremental_column, sync_mode 추가. list_etl_tables SELECT에 pk_columns, incremental_column, last_synced_at, sync_mode 포함.
3. **DB 적재 로직**: db_load_service.run_db_load(etl_table_id) — Full Load(소스 전체 → DROP+CREATE+INSERT), Incremental(증분 컬럼 > last_synced_at → Upsert, last_synced_at 갱신). 메인 DB 커서/연결 try/finally로 정리.
4. **run 분기**: POST /api/etl/tables/{etl_table_id}/run — source_type=file이면 run_file_load, postgresql+connection_id+source_table이면 run_db_load 호출.
5. **기타**: list_connections 응답에 created_at ISO 직렬화 추가.

### 수정/추가 파일
- Backend/etl_server/service.py (list_etl_tables Phase 3 필드 추가)
- Backend/etl_server/router.py (list_connections created_at 직렬화)
- Backend/etl_server/db_load_service.py (try/finally로 커서·연결 정리, 들여쓰기 수정)
- docs/report/log.md (본 로그)

---

## 2026-02-02: ETL Phase 0 완료 (폴더·라우터·프론트 패키지·의존성)

### 완료 작업
1. **Backend/etl_server**: `__init__.py`, `router.py` 생성. prefix `/api/etl`, GET `/api/etl` 서비스 안내 응답.
2. **Backend/api_server/main.py**: etl_router 등록. app.include_router(etl_router).
3. **Frontend packages/etl**: `ETLPage.jsx`, `index.jsx`, `etl.css` 생성. ETL 페이지 골격 표시.
4. **App.jsx**: `/etl` 라우트, 네비 "ETL" 링크 추가.
5. **requirements.txt**: ETL용 pandas, openpyxl, pyarrow 추가 (Phase 2 파일 파싱 대비).

### 수정/추가 파일
- Backend/etl_server/__init__.py (신규)
- Backend/etl_server/router.py (신규)
- Backend/api_server/main.py
- Frontend/react-app/src/packages/etl/ETLPage.jsx (신규)
- Frontend/react-app/src/packages/etl/index.jsx (신규)
- Frontend/react-app/src/packages/etl/etl.css (신규)
- Frontend/react-app/src/App.jsx
- requirements.txt
- docs/report/log.md (본 로그)

---

## 2026-02-02: README 갱신·대시보드1 미사용 코드 정리

### 완료 작업
1. **README.md**: 대시보드 섹션에 비교 모드(일간/주간/월간/연간)·디멘션별 비교(B)/요약 보기(A)·X축 단일 차원(일자 제외)·위젯 기간 선택 반영. 대시보드2·위젯보드 섹션 및 접속 경로·프로젝트 구조(dashboard2, widgetboard, routers) 추가. 사용 흐름에 대시보드2·위젯보드 안내 추가.
2. **requirements.txt**: 점검 완료. FastAPI·uvicorn·psycopg2-binary·requests 유지(변경 없음).
3. **대시보드1**: **DashboardFilters.jsx** 삭제 — DashboardPage에서 사용하지 않음(필터·집계 기준·정렬은 DashboardHeader에 통합됨).
4. **docs/main/01_FRONTEND_GUIDE.md**: 디렉터리 구조 및 §4.2에서 DashboardFilters 참조 제거.

### 수정/삭제 파일
- README.md
- docs/main/01_FRONTEND_GUIDE.md
- Frontend/react-app/src/packages/dashboard/components/DashboardFilters.jsx (삭제)
- docs/report/log.md (본 로그)

---

## 2026-02-02: docs/main 문서 정리·보강 (최종 검토 반영)

### 완료 작업
1. **00_PRD.md**: §6.2.2 위젯보드 중복 블록 제거(하나로 통합). 변경 이력 2026-02-02 항목 2줄 → 1줄로 통합.
2. **01_FRONTEND_GUIDE.md**: §4.4 widgetboard에 localStorage 키(widgetboard_layout, widgetboard_widget_configs)·index.jsx·widgetboard.css 설명 보강.
3. **02_BACKEND_FASTAPI_MIGRATION_PLAN.md**: API 목록(join-order, save-query-as-table, status) 이미 반영 확인. 수정 없음.

### 수정 파일
- docs/main/00_PRD.md
- docs/main/01_FRONTEND_GUIDE.md
- docs/report/log.md (본 로그)

---

## 2026-02-02: docs/main 문서 최신화 (PRD·프론트 가이드·백엔드 계획)

### 완료 작업
1. **00_PRD.md**: 위젯보드 패키지·/widgetboard 라우트·접속 경로 반영. 대시보드1 비교 모드(일간/주간/월간/연간)·디멘션별 비교(B)/요약 보기(A)·기준별 발송 X축 단일 차원(일자 제외)·periodCompare. 대시보드2 일간/연간 비교·디멘션별 비교/요약·X축 단일 차원(일자 제외)·채널 도넛 기준/비교 구분. §6.2.2 위젯보드 추가. API 엔드포인트에 join-order·save-query-as-table·status 반영. 변경 이력 2026-02-02 항목 추가.
2. **01_FRONTEND_GUIDE.md**: 패키지에 widgetboard 추가. 디렉터리 구조에 dashboard/utils/periodCompare.js·widgetboard 패키지(Dashboard3Page·dataUtils·widgetboard.css) 반영. §4.2 dashboard: 비교 모드·디멘션별 비교/요약·AggregatedBarChart X축 단일 차원(일자 제외)·periodCompare.js. §4.3 dashboard2: 일간/연간 비교·디멘션별 비교/요약·getPrimaryDimensionForChart(일자 제외)·buildMergedCompareDataSingleDimension·AggregatedDataTable2 CompareMerged/Summary·필터 툴바. §4.4 widgetboard 신설. §4.5 shared(기존 4.4). 스타일에 widgetboard.css·dashboard2 상세 보완.
3. **02_BACKEND_FASTAPI_MIGRATION_PLAN.md**: §1.3 API 엔드포인트에 POST /api/join-order·POST /api/save-query-as-table·GET /api/save-query-as-table/status/{job_id} 추가. 전환 완료 상태 문구에서 구체적 날짜 제거.

### 수정 파일
- docs/main/00_PRD.md
- docs/main/01_FRONTEND_GUIDE.md
- docs/main/02_BACKEND_FASTAPI_MIGRATION_PLAN.md
- docs/report/log.md (본 로그)

---

## 2026-02-02: 기간 비교 시 X축 단일 차원에서 일자(date) 제외

### 완료 작업
1. **문제**: 복수 차원 시 X축 단일 차원을 "가장 분류가 많은 하나"로 선택하다 보니 일자(date)가 선택되면, 차트가 일자별 막대로 나와 기간 비교(기준 vs 비교) 의미가 사라짐.
2. **해결**: `getPrimaryDimensionForChart`에서 **일자를 후보에서 제외**. X축 후보는 캠페인·워크플로우·채널만 사용. 일자+캠페인만 선택된 경우에도 캠페인 하나를 반환하도록 `dims.length <= 1` → `dims.length === 0`일 때만 null 반환으로 변경.
3. **적용 파일**: Dashboard2Page.jsx, DashboardPage.jsx, AggregatedBarChart2.jsx, AggregatedBarChart.jsx (4곳).

### 수정 파일
- Frontend/react-app/src/packages/dashboard2/Dashboard2Page.jsx
- Frontend/react-app/src/packages/dashboard/DashboardPage.jsx
- Frontend/react-app/src/packages/dashboard2/components/AggregatedBarChart2.jsx
- Frontend/react-app/src/packages/dashboard/components/AggregatedBarChart.jsx
- docs/report/log.md (본 로그)

---

## 2026-02-02: 기준별 발송 현황 복수 차원 시 X축 단일 차원 적용 (레이블 겹침 방지)

### 완료 작업
1. **문제**: 캠페인별+워크플로우별 등 복수 차원 선택 시 X축 레이블이 "캠페인 / 워크플로우" 형태로 길어져 겹침.
2. **해결**: 활성 차원이 2개 이상일 때 **가장 분류가 많은 하나**만 X축에 사용하고, 해당 차원 기준으로 합산하여 차트에 표시.
3. **Dashboard2Page.jsx**
   - `getPrimaryDimensionForChart(baseRows, compareRows, groupBy)`: base+compare 합쳐서 각 차원별 distinct 개수 계산 후 최대인 차원 반환.
   - `buildMergedCompareDataSingleDimension(...)`: 단일 차원 키로 기준/비교 각각 합산 후 머지한 행 배열 반환.
   - `mergedChartData`: `activeDimensionKeys.length >= 2`이면 위 단일 차원 머지 결과를 사용, 아니면 기존 `mergedCompareData` 사용.
4. **AggregatedBarChart2.jsx**
   - `getPrimaryDimensionForChart(data, groupBy)`, `aggregateByPrimaryDimension(rows, primaryDim)` 추가.
   - `BarChartBlock`: `dimCount >= 2`일 때 primary 차원으로 합산 후 상위 N건만 차트 데이터로 사용, X축 name은 해당 차원 값만 표시.
5. **DashboardPage.jsx (D1)**  
   - 동일하게 `getPrimaryDimensionForChart`, `buildMergedCompareDataSingleDimension` 추가 및 `mergedChartData`에서 복수 차원 시 단일 차원 소스 사용.
6. **AggregatedBarChart.jsx (D1)**  
   - 동일하게 `getPrimaryDimensionForChart`, `aggregateByPrimaryDimension` 및 BarChartBlock 복수 차원 시 단일 차원 집계 적용.

### 수정 파일
- Frontend/react-app/src/packages/dashboard2/Dashboard2Page.jsx
- Frontend/react-app/src/packages/dashboard2/components/AggregatedBarChart2.jsx
- Frontend/react-app/src/packages/dashboard/DashboardPage.jsx
- Frontend/react-app/src/packages/dashboard/components/AggregatedBarChart.jsx
- docs/report/log.md (본 로그)

---

## 2026-02-02: 대시보드1 기준별 발송 현황·집계 테이블 디멘션별 비교/요약 보기 토글 적용

### 완료 작업
1. **DashboardPage (D1)**  
   - 중복 `showCompareSummary` state 제거.  
   - `buildMergedCompareData`·`buildSummaryCompareData` 및 `mergedCompareData`·`summaryCompareData`·`mergedChartData`·`summaryChartData` useMemo는 기 적용 상태 유지.  
   - 기준별 발송 현황·집계 데이터 테이블 섹션에 **디멘션별 비교 (B) / 요약 보기 (A)** 토글 및 버튼 아래 기간 라벨(`dashboard-compare-period-label--below-toggle`) 적용 상태 유지.
2. **AggregatedBarChart (D1)**  
   - `compareView`·`mergedChartData`·`summaryChartData` 지원 및 MergedBarChart/SummaryBarChart 렌더는 기 적용 상태 유지.
3. **AggregatedDataTable (D1)**  
   - `compareTableMode === 'merged'`·`'summary'`일 때 **정렬 행 + 필터 툴바 + CompareMergedTable/CompareSummaryTable** 조기 반환 추가.  
   - `renderSortRow`·`renderToolbar(options, filteredCount)` 도입, merged/summary 시 필터 적용·건수 표시.
4. **dashboard.css (D1)**  
   - `.dashboard-compare-view-toggle`, `__btn`, `__btn--active`, `.dashboard-compare-period-label--below-toggle` 스타일 추가.

### 수정 파일
- Frontend/react-app/src/packages/dashboard/DashboardPage.jsx
- Frontend/react-app/src/packages/dashboard/components/AggregatedDataTable.jsx
- Frontend/react-app/src/packages/dashboard/dashboard.css
- docs/report/log.md (본 로그)

---

## 2026-02-02: 비교 모드·캠페인/워크플로우+일자 집계 시 디멘션별 비교 의미 있게 변경

### 완료 작업
- **문제**: 캠페인(또는 워크플로우/채널)+일자 집계 시 디멘션별 비교가 (캠페인, 일자) 키로 매칭되어 비교 기간에 같은 일자가 없으면 비교 컬럼이 전부 0으로 나옴.
- **적용**: 집계에 **일자+그 외 차원**이 함께 있을 때(`hasDateAndOther`) **일자 제외 키**로 기준/비교 기간 각각 **합산** 후 머지. 구분(라벨)은 캠페인/워크플로우/채널만, 값은 기간 내 해당 디멘션 전체 합계. `keyOfNoDate`, `aggregateByKeyNoDate` 추가.
- **대상**: Dashboard2Page.jsx, DashboardPage.jsx 동일 로직 적용.

### 수정 파일
- Frontend/react-app/src/packages/dashboard2/Dashboard2Page.jsx
- Frontend/react-app/src/packages/dashboard/DashboardPage.jsx
- docs/report/log.md (본 로그)

---

## 2026-02-02: 대시보드1 디멘션별 비교/요약 보기 토글 정리

### 완료 작업
- 대시보드1에는 이미 **기준별 발송 현황**·**집계 데이터 테이블** 섹션에 **디멘션별 비교 (B) / 요약 보기 (A)** 토글, 버튼→기간 라벨 순서, `compareView`/`compareTableMode`·`mergedChartData`/`summaryChartData`·`mergedTableData`/`summaryTableData` 전달이 적용되어 있음.
- **DashboardPage.jsx**: `buildMergedCompareData`·`buildSummaryCompareData` 함수가 중복 정의되어 있던 부분 제거(후자 정의만 유지).

### 수정 파일
- Frontend/react-app/src/packages/dashboard/DashboardPage.jsx
- docs/report/log.md (본 로그)

---

## 2026-02-02: 대시보드1 비교분석 UI 반영 및 대시보드2 집계 테이블 필터 유지

### 완료 작업
1. **대시보드1 채널별 분석 (ChannelDonutCharts)**
   - 기준/비교 블록 배경·테두리: donut-period-block--base(#eff6ff), donut-period-block--compare(#fff7ed). 비교 시 도넛 색상: 기준 연한색, 비교 짙은색(동일 팔레트). 비교 기간 데이터 없을 때 "해당 기간 데이터가 없습니다." 표시.
2. **대시보드1 기준별 발송 현황 (AggregatedBarChart)**
   - 기준 기간 블록: aggregated-bar-chart__period-block--base, 비교 기간 블록: --compare 배경·테두리 적용.
3. **대시보드1 집계 데이터 테이블**
   - 비교 시 기준/비교 테이블을 dashboard-aggregated-table-period-block--base/--compare 래퍼로 감싸 배경·테두리 구분.
4. **대시보드1 dashboard.css**
   - donut-period-block--base/--compare, donut-period-block__empty-msg, aggregated-bar-chart__period-block--base/--compare, dashboard-aggregated-table-period-block--base/--compare 스타일 추가.
5. **대시보드2 집계 테이블 비교 모드 필터 유지**
   - 디멘션별 비교(merged)·요약 보기(summary) 시에도 정렬 기준 행·필터 툴바 노출. getMergedColumnOptions/getSummaryColumnOptions, getCellValueMerged/getCellValueSummary, rowMatchesFiltersWithGetCell로 merged/summary 데이터에 필터 적용. 필터 적용 건수 표시.

### 수정 파일
- Frontend/react-app/src/packages/dashboard/components/ChannelDonutCharts.jsx
- Frontend/react-app/src/packages/dashboard/components/AggregatedBarChart.jsx
- Frontend/react-app/src/packages/dashboard/DashboardPage.jsx
- Frontend/react-app/src/packages/dashboard/dashboard.css
- Frontend/react-app/src/packages/dashboard2/components/AggregatedDataTable2.jsx
- docs/report/log.md (본 로그)

---

## 2026-02-02: 집계 데이터 테이블 디멘션별 비교 오픈률·클릭률 및 rate 셀 채우기

### 완료 작업
1. **CompareMergedTable(디멘션별 비교)**
   - **오픈률·클릭률 컬럼 추가**: 기준 오픈률, 비교 오픈률, 기준 클릭률, 비교 클릭률 4개 컬럼 추가. 기존 데이터에 기준_open_rate, 비교_open_rate, 기준_click_rate, 비교_click_rate 포함되어 있음.
   - **rate 셀 채우기**: 성공률·오픈률·클릭률(기준/비교 각 6컬럼)에 cell-fill-wrap·cell-fill·cell-fill-text 적용, minWidth: 80px로 가로 스크롤 시에도 가독성 유지.
2. **CompareSummaryTable(요약 보기)**
   - 성공률·오픈률·클릭률 컬럼에 동일한 셀 채우기 막대 적용.

### 수정 파일
- Frontend/react-app/src/packages/dashboard2/components/AggregatedDataTable2.jsx
- docs/report/log.md (본 로그)

---

## 2026-02-02: 채널별 분석 기준/비교 구분 및 비교 기간 데이터 없음 문구

### 완료 작업
1. **기준·비교 블록 시각 구분**
   - 기준 기간 블록: `dashboard2-donut-period-block--base` — 배경 `#eff6ff`, 테두리 `#bfdbfe`.
   - 비교 기간 블록: `dashboard2-donut-period-block--compare` — 배경 `#fff7ed`, 테두리 `#fed7aa`.
   - 도넛 색상: 기준은 BASE_CHART_COLORS(파랑·하늘), 비교는 COMPARE_CHART_COLORS(주황·앰버)로 구분.
2. **비교 기간 데이터 없음**
   - getDistributionTotal로 비교 기간 발송/성공 합계 계산. 합계 0이면 도넛 대신 "해당 기간 데이터가 없습니다." 문구 표시(role="status").

### 수정 파일
- Frontend/react-app/src/packages/dashboard2/components/ChannelDonutCharts2.jsx
- Frontend/react-app/src/packages/dashboard2/dashboard2.css
- docs/report/log.md (본 로그)

---

## 2026-02-02: 대시보드2 집계 테이블 디멘션별 비교 컬럼 배경 구분

### 완료 작업
1. **집계 데이터 테이블 섹션**
   - 버튼→기간 순서·패딩·라인 맞춤은 기존 적용과 동일하게 유지(동일 클래스 사용).
2. **디멘션별 비교 시 컬럼 배경 구분**
   - `ThWithDef`에 `className` prop 추가.
   - `CompareMergedTable`에서 기준 컬럼에 `__th--base`/`__td--base`, 비교 컬럼에 `__th--compare`/`__td--compare` 적용.
   - CSS: 기준 컬럼 `#eff6ff`, 비교 컬럼 `#fff7ed` 배경으로 시각 구분.

### 수정 파일
- Frontend/react-app/src/packages/dashboard2/components/AggregatedDataTable2.jsx
- Frontend/react-app/src/packages/dashboard2/dashboard2.css
- docs/report/log.md (본 로그)

---

## 2026-02-02: 대시보드2 비교 뷰 레이아웃·차트 색상 개선

### 완료 작업
1. **버튼 / 기간 div 순서**
   - 기준별 발송 현황·집계 데이터 테이블 섹션에서 **디멘션별 비교(B)·요약 보기(A) 버튼**을 먼저 두고, **기준 기간 / 비교 기간** 표시 div를 버튼 아래로 이동.
2. **패딩·라인 맞춤**
   - `.dashboard2-compare-view-toggle`에 `margin: 20px 20px 16px 20px`, `gap: 10px`, 버튼 `padding: 10px 18px` 적용해 좌·위·아래 여백 및 라인 정렬.
   - 버튼 아래 기간 라벨에 `.dashboard2-compare-period-label--below-toggle` 추가, `margin: 0 20px 16px 20px`로 좌우 라인 맞춤.
3. **차트 색상 (MergedBarChart)**
   - 기준 묶음: 파란 계열 — 기준 발송 요청 `#2563eb`, 기준 발송 성공 `#0ea5e9`.
   - 비교 묶음: 주황 계열 — 비교 발송 요청 `#ea580c`, 비교 발송 성공 `#f97316`.
   - 기준/비교 그룹이 보색에 가깝게 구분되도록 변경.

### 수정 파일
- Frontend/react-app/src/packages/dashboard2/Dashboard2Page.jsx
- Frontend/react-app/src/packages/dashboard2/dashboard2.css
- Frontend/react-app/src/packages/dashboard2/components/AggregatedBarChart2.jsx
- docs/report/log.md (본 로그)

---

## 2026-02-02: 대시보드1에 비교 기능 적용 (일간/주간/월간/연간, 위젯은 기간 선택)

### 완료 작업
1. **dashboard/utils/periodCompare.js**
   - 대시보드2와 동일한 일/주/월/연 기간 계산 유틸 추가 (getWeekRange, getPreviousWeekRange, getMonthRange, getPreviousMonthRange, getPreviousDay, getYearRange, getPreviousYearRange).
2. **DashboardHeader (대시보드1)**
   - 보기 라디오 순서: **일반 → 일간 비교 → 주간 비교 → 월간 비교 → 연간 비교**. view_mode, compare_base_day/week/month/year, compare_day/week/month/year 추가. 모드별 기준·비교 입력(날짜/주/월/연).
3. **DashboardPage (대시보드1)**
   - filters에 view_mode·compare_* 필드 추가. compareData state, loadData에서 비교 모드 시 getDashboardData 2회(기준·비교). compareRange useMemo, formatRangeLabel. sortedCompareAggregatedData. KPI·채널 도넛·막대·집계 테이블에 기준/비교 라벨 및 compareData/compareKpi 반영. 집계 테이블은 비교 시 기준 기간/비교 기간 테이블 2개 렌더.
4. **위젯 생성·위젯 생성 (beta)**
   - 비교 모드일 때 **기준 기간 / 비교 기간**을 동시에 표시하지 않고, **차트 기간** 셀렉트박스(기준 기간 | 비교 기간)로 선택한 기간의 데이터만 차트에 반영. widgetPeriodChoice state, effectiveWidgetFilters/effectiveWidgetData로 선택 기간만 ChartWidget·ChartWidget2에 전달.
5. **KPICards (대시보드1)**
   - compareKpi prop 추가. getComparePct, "±n% vs 비교기간" 한 줄 표시. kpi-card__compare 스타일.
6. **ChannelDonutCharts·AggregatedBarChart (대시보드1)**
   - compareKpi/compareData 지원. 기준 기간·비교 기간 블록 각각 표시(도넛 period block, 막대 BarChartBlock).
7. **dashboard.css**
   - compare period label, view-mode 라디오, kpi-card__compare, donut-period-block, aggregated-bar-chart__period-block, dashboard-aggregated-table-period-title, dashboard-widget-period-select-wrap 스타일 추가.

### 수정/추가 파일
- Frontend/react-app/src/packages/dashboard/utils/periodCompare.js (신규)
- Frontend/react-app/src/packages/dashboard/components/DashboardHeader.jsx
- Frontend/react-app/src/packages/dashboard/DashboardPage.jsx
- Frontend/react-app/src/packages/dashboard/components/KPICards.jsx
- Frontend/react-app/src/packages/dashboard/components/ChannelDonutCharts.jsx
- Frontend/react-app/src/packages/dashboard/components/AggregatedBarChart.jsx
- Frontend/react-app/src/packages/dashboard/dashboard.css
- docs/report/log.md (본 로그)

---

## 2026-02-02: 비교 라디오 순서 및 비교 모드 시 전체 섹션 적용

### 완료 작업
1. **보기 라디오 순서**
   - 순서를 **일반 → 일간 비교 → 주간 비교 → 월간 비교 → 연간 비교** 로 통일 (Dashboard2Header).
2. **비교 적용 범위**
   - 비교 모드(일/주/월/연) 선택 시 **기준 기간 vs 비교 기간**이 KPI뿐 아니라 아래 섹션 전부에 적용되도록 수정.
   - **주요 지표**: 기존과 동일하게 기준/비교 라벨 + compareKpi.
   - **채널별 분석**: 기준/비교 기간 라벨 표시. ChannelDonutCharts2에 compareKpi 전달 → 기준 기간·비교 기간 도넛 블록 각각 표시.
   - **기준별 발송 현황**: 기준/비교 라벨 표시. AggregatedBarChart2에 compareData 전달 → 기준 기간·비교 기간 막대 차트 각각 표시.
   - **집계 데이터 테이블**: 기준/비교 라벨 표시. compareRange 시 기준 기간 테이블·비교 기간 테이블 두 개 렌더 (key="base" / key="compare").
   - **위젯 생성**: 기준/비교 라벨 표시. compareRange 시 기준 기간용 chartData·비교 기간용 compareChartData 각각 조회 후 EChartsChart 두 개(기준 기간 / 비교 기간) 렌더.
3. **데이터·차트**
   - sortedCompareAggregatedData(compareData?.aggregated_data 정렬) 추가.
   - compareChartData·compareChartDataLoading state 및 compareRange 기준 getDashboard2ChartData 호출 useEffect 추가.
4. **스타일**
   - 도넛/막대/테이블/위젯용 기간 블록 제목(.dashboard2-donut-period-title, .dashboard2-aggregated-bar-chart__period-title, .dashboard2-aggregated-table-period-title, .dashboard2-chart-period-title) 추가.

### 수정 파일
- Frontend/react-app/src/packages/dashboard2/components/Dashboard2Header.jsx
- Frontend/react-app/src/packages/dashboard2/Dashboard2Page.jsx
- Frontend/react-app/src/packages/dashboard2/components/ChannelDonutCharts2.jsx
- Frontend/react-app/src/packages/dashboard2/components/AggregatedBarChart2.jsx
- Frontend/react-app/src/packages/dashboard2/dashboard2.css
- docs/report/log.md (본 로그)

---

## 2026-02-02: 대시보드2 일간 비교·연간 비교 추가

### 완료 작업
1. **periodCompare.js**
   - `getPreviousDay(anchorDate)`: 기준일의 전일 [date, date] (YYYY-MM-DD) 반환.
   - `getYearRange(year)`: 해당 연도 1/1~12/31 [start, end] 반환.
   - `getPreviousYearRange(year)`: 전년 [start, end] 반환.
2. **Dashboard2Header**
   - 보기 모드 라디오에 **일간 비교**, **연간 비교** 추가.
   - filters에 `compare_base_day`, `compare_day`, `compare_base_year`, `compare_year` 추가. 일반/주간/월간 전환 시 위 필드 초기화.
   - 일간 비교: 기준 일(date)·비교 일(date) 입력. 비어두면 비교 일은 전일.
   - 연간 비교: 기준 연도(number)·비교 연도(number) 입력. 비어두면 비교 연도는 전년.
   - 라벨: "기준 일" / "비교 일", "기준 연도" / "비교 연도".
3. **Dashboard2Page**
   - 초기 filters에 `compare_base_day`, `compare_day`, `compare_base_year`, `compare_year` 추가.
   - loadData: `day_compare` 시 date_range=[기준일, 기준일], compareRange=비교일 있으면 [비교일, 비교일] else getPreviousDay(기준일). `year_compare` 시 date_range=getYearRange(기준연도), compareRange=비교연도 있으면 getYearRange(비교연도) else getPreviousYearRange(기준연도).
   - isCompare에 `day_compare`, `year_compare` 포함. compareRange useMemo에 일간/연간 분기 추가.

### 수정 파일
- Frontend/react-app/src/packages/dashboard2/utils/periodCompare.js
- Frontend/react-app/src/packages/dashboard2/components/Dashboard2Header.jsx
- Frontend/react-app/src/packages/dashboard2/Dashboard2Page.jsx
- docs/report/log.md (본 로그)

---

## 2026-02-02: docs/main 갱신 및 코드 파일 설명 주석 전수검사·보강

### 완료 작업
1. **docs/main**
   - 00_PRD, 01_FRONTEND_GUIDE, 02_BACKEND_FASTAPI_MIGRATION_PLAN: 대시보드2 패키지·API·주간/월간 비교·KPI·집계 테이블·rate 채우기·위젯 rate Y축·info 버튼 등 이미 반영됨 확인. 추가 수정 없음.
2. **백엔드 코드 파일 설명 주석 (user rule 포맷)**
   - pluralize.py: [Dependencies] 섹션 추가.
   - routers/health.py, report.py, dashboard.py, dashboard2.py: [Endpoints], [Dependencies] 섹션 보강.
   - schemas.py: [Endpoints/Classes/Functions](Pydantic 모델 목록), [Dependencies] 정리.
3. **프론트엔드 코드 파일 설명 주석**
   - dashboard2/utils/periodCompare.js: [Main Functions] 정리, [Dependencies] 추가.
   - Dashboard2Page.jsx: 보기 모드·기준/비교 주·월, compareRange, loadData 반영. [Main Functions], [Dependencies] 보강.
   - EChartsChart.jsx: customChartData·metricKey·rate형 소수점 둘째자리 반영. [Main Functions], [Dependencies] 보강.
   - Dashboard2Header.jsx, AggregatedDataTable2.jsx: [Main Functions], [Dependencies] 또는 설명문 보강(컬럼 순서·rate 채우기·내부 테두리).
   - dashboard/components/AggregatedDataTable.jsx: 컬럼 순서·rate 채우기·내부 테두리·[Main Functions], [Dependencies] 보강.

### 수정 파일
- Backend/api_server/pluralize.py, schemas.py, routers/health.py, routers/report.py, routers/dashboard.py, routers/dashboard2.py
- Frontend/react-app/src/packages/dashboard2/utils/periodCompare.js, Dashboard2Page.jsx, components/EChartsChart.jsx, Dashboard2Header.jsx, AggregatedDataTable2.jsx
- Frontend/react-app/src/packages/dashboard/components/AggregatedDataTable.jsx
- docs/report/log.md (본 로그)

---

## 2026-02-02: 주간/월간 비교 시 비교 주·비교 월 선택 기능

### 완료 작업
1. **비교 주/비교 월 선택 UI (Dashboard2Header)**
   - 주간 비교: “비교 주(날짜)” 입력 추가. 비어두면 **전 주**가 비교 기간(디폴트). 날짜 선택 시 해당 주가 비교 기간.
   - 월간 비교: “비교 월” 입력(YYYY-MM) 추가. 비어두면 **전 월** 디폴트. 선택 시 해당 월이 비교 기간.
   - filters에 `compare_week`, `compare_month` 추가. 모드 전환 시 둘 다 초기화.
2. **데이터 조회·라벨 (Dashboard2Page)**
   - loadData: `compare_week` 있으면 getWeekRange(compare_week), 없으면 getPreviousWeekRange(compare_base_week). `compare_month` 있으면 getMonthRange, 없으면 getPreviousMonthRange.
   - 비교 기간 라벨: “비교: … (전 주)” / “(선택 주)” / “(전 월)” / “(선택 월)” 로 구분 표시.
3. **플랜 문서**: 05_대시보드2_주간월간_비교리포팅_플랜.md 5.1절에 비교 주/비교 월 선택·디폴트 설명 반영.

### 수정 파일
- Frontend/react-app/src/packages/dashboard2/components/Dashboard2Header.jsx
- Frontend/react-app/src/packages/dashboard2/Dashboard2Page.jsx
- docs/report/05_대시보드2_주간월간_비교리포팅_플랜.md
- docs/report/log.md (본 로그)

---

## 2026-02-02: 집계 테이블 컬럼 순서 및 rate 컬럼 채우기 막대

### 완료 작업
1. **집계 테이블 컬럼 순서 통일 (대시보드1·2)**
   - 컬럼 순서: **발송요청 → 발송성공 → 성공률 → 오픈 → 클릭 → 오픈률 → 클릭률** (7개).
   - `getColumnOptions`·thead·tbody 순서를 위와 같이 수정. (AggregatedDataTable.jsx, AggregatedDataTable2.jsx)
2. **rate 컬럼(성공률, 오픈률, 클릭률) 채우기 막대 표시**
   - 셀 내 회색(#e5e7eb) 가로 막대를 값(0~100%)에 비례한 너비로 표시. 숫자는 기존 포맷(formatRate + %) 유지, 오른쪽 정렬로 막대 위에 표시.
   - 구조: `td` → `cell-fill-wrap`(relative) → `cell-fill`(absolute, width: value%) + `cell-fill-text`.
   - dashboard.css / dashboard2.css에 `*__cell-rate`, `*__cell-fill-wrap`, `*__cell-fill`, `*__cell-fill-text` 스타일 추가.
3. **집계 테이블 내부 테두리선 (외곽선 없음)**
   - 테이블 자체는 `border: none`. 셀마다 `border-right`, `border-bottom` 1px solid #e5e7eb 적용. 마지막 행·마지막 열은 해당 방향 border 제거하여 외곽선 없이 그리드만 보이도록 처리.

### 수정 파일
- Frontend/react-app/src/packages/dashboard/components/AggregatedDataTable.jsx
- Frontend/react-app/src/packages/dashboard2/components/AggregatedDataTable2.jsx
- Frontend/react-app/src/packages/dashboard/dashboard.css
- Frontend/react-app/src/packages/dashboard2/dashboard2.css
- docs/report/log.md (본 로그)

---

## 2026-02-02: 대시보드2 주간/월간 비교 리포팅 (Phase 1~5)

### 완료 작업
1. **플랜 보완 (05_대시보드2_주간월간_비교리포팅_플랜.md)**
   - 다중 이전 주·이전기간 평균(이미지 스타일) 구현 가능 여부 명시. Phase 6으로 N주 트렌드+미니 차트 추가 권장.
2. **Phase 1**: `dashboard2/utils/periodCompare.js` — getWeekRange, getPreviousWeekRange, getMonthRange, getPreviousMonthRange (ISO 주 월~일, 월 1일~말일).
3. **Phase 2**: Dashboard2Header — 보기 모드(일반/주간 비교/월간 비교), 주간 시 기준 주 날짜 선택·월간 시 기준 월(YYYY-MM) 선택, 선택 시 date_range 자동 계산.
4. **Phase 3**: Dashboard2Page — view_mode, compare_base_week, compare_base_month, compareData state. 비교 모드 시 기준 기간 1회·비교 기간 1회 getDashboard2Data 호출.
5. **Phase 4**: KPICards2 — compareKpi prop 시 카드에 이전 기간 값·"±n% vs 이전기간" 표시(전비 계산, rate/건수 구분).
6. **Phase 5**: 비교 모드 시 "기준: YYYY.MM.DD ~ ... (이번 주/이번 달) / 비교: ... (이전 주/이전 달)" 라벨 표시.

### 수정/추가 파일
- docs/report/05_대시보드2_주간월간_비교리포팅_플랜.md
- Frontend/react-app/src/packages/dashboard2/utils/periodCompare.js (신규)
- Frontend/react-app/src/packages/dashboard2/components/Dashboard2Header.jsx
- Frontend/react-app/src/packages/dashboard2/components/KPICards2.jsx
- Frontend/react-app/src/packages/dashboard2/Dashboard2Page.jsx
- Frontend/react-app/src/packages/dashboard2/dashboard2.css
- docs/report/log.md (본 로그)

---

## 2026-02-02: 레이더 차트 내부 수치값 복원(바깥 링 제외·각도 분산)

### 완료 작업
1. **반지름축 숫자 일부 복원 (ChartWidget2.jsx)**
   - **배경**: 사용자 요청 — "대략적인 수치값도 있으면 좋을 것 같다". 이전에 겹침/순서 이슈로 `tick={false}` 적용해 전부 제거했음.
   - **적용**: 바깥쪽 링(dataMax)은 레이블 미표시. **내부 4단계만** 숫자 표시: `ticks=[0, dataMax/4, dataMax/2, 3*dataMax/4]`.
   - **겹침 방지**: Recharts 기본은 한 각도에만 틱을 그려 겹침 발생. 커스텀 `RadarRadiusAxisTickInner`로 각 틱을 서로 다른 각도(270°, 342°, 54°, 126°)에 배치.
   - **구현**: `RadarChartCenterContext`·`RadarChartWithCenter`(cx,cy 측정)·`RadarRadiusAxisTickInner` 추가. 부동소수점 비교는 epsilon으로 처리.
2. **문서**: 04_레이더차트_변경이력_데이터.md에 회차 3 반영, 최적 속성·적용 요약 갱신.

### 수정 파일
- Frontend/react-app/src/packages/dashboard/components/ChartWidget2.jsx
- docs/report/04_레이더차트_변경이력_데이터.md, docs/report/log.md (본 로그)

---

## 2026-02-02: 레이더 차트 변경 이력 데이터화 및 최적 속성 적용

### 완료 작업
1. **변경 이력 데이터화 (docs/report/04_레이더차트_변경이력_데이터.md)**
   - 회차별 변경 요소·적용값·결과를 표로 정리. Recharts PolarRadiusAxis 동작(한 각도에만 틱 렌더 → 겹침/순서 이슈) 정리.
   - 분석 결론: 반지름축 숫자 비표시, 각도축 기본 유지, 범례는 상단 legendRow만, margin으로 하단 여유 확보.
2. **최적 속성 적용 (ChartWidget2.jsx)**
   - **PolarRadiusAxis**: `tick={false}` 로 반지름축 숫자 레이블 비표시(겹침·순서 문제 제거). `domain={[0, dataMax]}` 유지. 툴팁에서만 값 확인.
   - **margin**: `{ top: 64, right: 64, bottom: 72, left: 64 }` (각도 레이블·하단 여유).
   - 차트 내부 Legend 미사용(기존 유지). 코드에 04_레이더차트_변경이력_데이터.md 참조 주석 추가.
3. **인덱스·로그**: 00_ReportIndex.md에 04_레이더차트_변경이력_데이터.md 추가. 본 로그 갱신.

### 수정/추가 파일
- docs/report/04_레이더차트_변경이력_데이터.md (신규)
- Frontend/react-app/src/packages/dashboard/components/ChartWidget2.jsx
- docs/report/00_ReportIndex.md, docs/report/log.md (본 로그)

---

## 2026-02-02: 레이더 차트 Recharts 기본 구성으로 재세팅 (이후 데이터 기반 추가 수정 있음)

### 완료 작업
1. **레이더 차트 단순화 (ChartWidget2.jsx)**
   - **제거**: `RadarChartCenterContext`, `RadarChartWithCenter`(ResizeObserver·중심 계산), `RadarAngleAxisTick`, `RadarRadiusAxisTick` 커스텀 틱 컴포넌트 전부. 차트 내부 `<Legend />` 제거.
   - **적용**: Recharts 기본 `PolarAngleAxis`·`PolarRadiusAxis`만 사용. `PolarRadiusAxis`에 `domain={[0, dataMax]}`만 지정(커스텀 ticks 배열 제거). 반지름축 숫자 순서·겹침 이슈는 당시 미해결 → 04_레이더차트_변경이력_데이터.md 기반으로 `tick={false}` 적용으로 해결.
2. **검수**: 수정 파일 린트 오류 없음.

### 수정 파일
- Frontend/react-app/src/packages/dashboard/components/ChartWidget2.jsx
- docs/report/log.md (본 로그)

---

## 2025-02-02: 주요 지표·채널별 분석 섹션 상단 기간 표시 (단일일/기간)

### 완료 작업
1. **성과지표 핵심 요소인 "언제부터 언제까지" 기간 명시**
   - **shared/utils/dateRange.js**: `formatDateRangeLabel(dateRange)` 추가. [시작일, 종료일] → 표시 문자열(단일일이면 "YYYY.MM.DD (단일일)", 기간이면 "YYYY.MM.DD ~ YYYY.MM.DD"). `toDisplayDate` 보조 함수(YYYY-MM-DD → YYYY.MM.DD).
   - **shared/components/PeriodLabel.jsx** (신규): 필터에서 선택한 기간을 뱃지 형태로 표시. 캘린더 아이콘 + "기준일:" / "기간:" 접두어. Reporting period 패턴 패러디.
   - **대시보드1**: "주요 지표"·"채널별 분석" CollapsibleSection 본문 최상단에 `<PeriodLabel dateRange={filters.date_range} className="dashboard-period-label" />` 추가.
   - **대시보드2**: 동일하게 "주요 지표"·"채널별 분석" 섹션 상단에 `PeriodLabel` (className="dashboard2-period-label") 추가.
   - **스타일**: dashboard.css / dashboard2.css에 `.dashboard-period-label`, `.dashboard2-period-label` — 연한 파란 배경·테두리·둥근 모서리·아이콘·텍스트 간격.

2. **검수**
   - 수정·추가 파일 린트 오류 없음.

### 수정/추가 파일
- Frontend/react-app/src/shared/utils/dateRange.js
- Frontend/react-app/src/shared/components/PeriodLabel.jsx (신규)
- Frontend/react-app/src/packages/dashboard/DashboardPage.jsx, dashboard.css
- Frontend/react-app/src/packages/dashboard2/Dashboard2Page.jsx, dashboard2.css
- docs/report/log.md (본 로그)

---

## 2025-02-02: Frontend 코드 파일 상단 설명 정리 (React·현재 구조 반영)

### 완료 작업
1. **Backend와 동일하게 Frontend 전체 코드 파일 상단 설명을 현재 시스템·구성에 맞게 수정**
   - **패키지 진입점**: `packages/dashboard`, `packages/dashboard2`, `packages/report` index.jsx — 플레이스홀더/과거 문구 제거, React 패키지·Export·Backend API 경로 명시.
   - **페이지**: DashboardPage.jsx, Dashboard2Page.jsx, ReportPage.jsx — React 페이지·주요 기능·의존성(shared/api, dateRange, components) 정리.
   - **헤더/컴포넌트**: DashboardHeader, Dashboard2Header — 기간·조회·필터 설명, @/shared 의존성 통일. DashboardFilters — @/shared/utils/dateRange. dashboard2 컴포넌트(CollapsibleSection2, AggregatedBarChart2, ChannelDonutCharts2, TargetContextSection, KPICards2, AggregatedDataTable2) — "Phase 0/1/3" 문구 제거, 현재 역할만 기술.
   - **report**: joinRules.js, safetyCheck.js, constants.js, helpers.js, sqlBuilder.js — 경로·주요 함수·의존성 블록 통일. Sidebar.jsx, MainArea.jsx — [의존성]에 joinRules/constants/helpers 반영.
   - **shared**: dateRange.js — React 대시보드·Backend 전송 전 사용 명시.

2. **검수**
   - 수정한 Frontend 파일들 린트 오류 없음.

### 수정 파일 (Frontend)
- src/App.jsx, main.jsx, shared/api/client.js, shared/config/api.js, shared/utils/dateRange.js
- packages/dashboard/index.jsx, DashboardPage.jsx, components/DashboardHeader.jsx, DashboardFilters.jsx
- packages/dashboard2/index.jsx, Dashboard2Page.jsx, components/Dashboard2Header.jsx, CollapsibleSection2.jsx, AggregatedBarChart2.jsx, ChannelDonutCharts2.jsx, TargetContextSection.jsx, KPICards2.jsx, AggregatedDataTable2.jsx
- packages/report/index.jsx, ReportPage.jsx, utils/joinRules.js, safetyCheck.js, constants.js, helpers.js, sqlBuilder.js, components/Sidebar.jsx, MainArea.jsx
- docs/report/log.md (본 로그)

---

## 2025-02-02: 대시보드2 기능 대시보드(1) 동기화 + 문서·Git

### 완료 작업
1. **대시보드(1)에 대시보드2와 동일 기능 적용 (코드 이중 유지)**
   - **목표·컨텍스트 섹션**: `dashboard/components/TargetContextSection.jsx` 신규. 기간 유형·지표·목표값 저장/로드/삭제. localStorage `dashboard_targets`. 클래스명 `dashboard-target-context-*`. `dashboard.css`에 목표 섹션·삭제 버튼 스타일 추가.
   - **DashboardPage.jsx**: targets state, loadTargetsFromStorage/saveTargetsToStorage, mergeTarget, targetMatchesPeriod, METRIC_HIGHER_IS_BETTER, getTargetStatusByKey, targetStatusByKey useMemo, handleSaveTarget, handleDeleteTarget. TargetContextSection 렌더, KPICards에 targetStatusByKey 전달. 신호등 안내 문구(.dashboard-kpi-section-hint).
   - **KPICards.jsx**: targetStatusByKey prop, formatRatioPct, STATUS_STYLE. 카드별 달성/주의/미달 뱃지·테두리 색상. `.kpi-card__badge`, `--ok`/`--warning`/`--fail` 스타일 추가.
   - 캠페인·워크플로우·채널 "전체" 옵션·워크플로우 수·채널 수·rate 00.00%·표시 지표 선택은 이전 작업에서 이미 대시보드1에 반영됨.

2. **검수**
   - Lint 오류 없음. 목표 저장·삭제·기간 매칭·신호등 표시 로직은 대시보드2와 동일 구조.

3. **문서 업데이트 (대시보드1 기준)**
   - **docs/main/00_PRD.md**: §6.2 대시보드에 목표 섹션·전체 옵션·표시 지표 선택·신호등 반영.
   - **docs/main/01_FRONTEND_GUIDE.md**: §4.2 dashboard에 TargetContextSection, 목표 저장·신호등·전체 옵션, §3 디렉터리 트리에 TargetContextSection.jsx 추가.
   - **README.md**: 대시보드에 목표(저장·신호등) 문구 추가.

4. **Git**
   - 위 변경 + 이전 미커밋 변경 일괄 커밋·푸시.

### 수정/추가 파일
- Frontend/react-app/src/packages/dashboard/components/TargetContextSection.jsx (신규)
- Frontend/react-app/src/packages/dashboard/DashboardPage.jsx
- Frontend/react-app/src/packages/dashboard/components/KPICards.jsx
- Frontend/react-app/src/packages/dashboard/dashboard.css
- docs/main/00_PRD.md, 01_FRONTEND_GUIDE.md
- README.md
- docs/report/log.md (본 로그)

---

## 2025-02-02: 주요 지표 표시 선택 + 컬럼 셀렉트 "전체" 옵션

### 완료 작업
1. **주요 지표 표시할 것만 선택 (접이식 체크박스 + localStorage)**
   - **KPICards2.jsx**: "표시할 지표 선택 ▼/▲" 버튼 클릭 시 체크박스 목록 펼침. 체크된 지표만 카드로 표시. `storageKey` prop 기본값 `dashboard2_kpi_visible`. loadVisibleKeys/saveVisibleKeys로 localStorage 저장·로드. 추후 대시보드 테이블 시 동일 JSON 배열을 컬럼에 저장하면 됨.
   - **KPICards.jsx**: 동일 기능, `storageKey` 기본값 `dashboard_kpi_visible`.
   - **dashboard2.css / dashboard.css**: selector-wrap, selector-trigger, selector-checkboxes, selector-label 스타일 추가.

2. **캠페인·워크플로우·채널 셀렉트에 "전체" 옵션 (디폴트)**
   - **Dashboard2Header.jsx**, **DashboardHeader.jsx**: 각 multi-select 첫 번째 옵션으로 `<option value="__all__">전체</option>` 추가. `campaign_ids`/`workflow_ids`/`channels`가 빈 배열이면 value에 `['__all__']` 사용해 "전체"가 선택된 상태로 표시. onChange에서 "전체"만 선택된 경우 빈 배열로 설정, 그 외에는 `__all__` 제외 후 ID/코드만 전달. 집계 기준에서 해당 컬럼을 선택하기 전에는 디폴트로 전체(필터 없음)로 동작.

3. **기타**
   - Dashboard2Page: METRIC_HIGHER_IS_BETTER에 workflow_count, channel_count 추가.
   - TargetContextSection: TARGET_METRIC_OPTIONS에 워크플로우 수·채널 수 추가.

### 수정 파일
- Frontend/react-app/src/packages/dashboard2/components/KPICards2.jsx
- Frontend/react-app/src/packages/dashboard2/dashboard2.css
- Frontend/react-app/src/packages/dashboard/components/KPICards.jsx
- Frontend/react-app/src/packages/dashboard/dashboard.css
- Frontend/react-app/src/packages/dashboard2/components/Dashboard2Header.jsx
- Frontend/react-app/src/packages/dashboard/components/DashboardHeader.jsx
- Frontend/react-app/src/packages/dashboard2/Dashboard2Page.jsx
- Frontend/react-app/src/packages/dashboard2/components/TargetContextSection.jsx
- docs/report/log.md (본 로그)

### 검수 결과
- Lint 오류 없음. 주요 지표는 선택한 것만 표시·localStorage 유지. 캠페인/워크플로우/채널 셀렉트 기본 "전체" 선택.

---

## 2025-02-02: 주요 지표 섹션 개선 — rate 00.00% 포맷·워크플로우 수·채널 수

### 완료 작업
1. **rate 지표(성공률·실패률·오픈률·클릭률) 표시**
   - KPICards2.jsx·KPICards.jsx: `formatRateDisplay(n)` 추가 — 소수 둘째 자리 반올림, 정수여도 `minimumFractionDigits: 2`로 00.00% 형식 표시. `unit === '%'`인 카드에만 적용.

2. **워크플로우 수·채널 수 추가**
   - Backend dashboard_service._calculate_kpi: KPI 쿼리에 `COUNT(DISTINCT workflow_id) AS workflow_count`, `COUNT(DISTINCT delivery_channel) AS channel_count` 추가. 반환 객체에 `workflow_count`, `channel_count` 포함.
   - KPICards2.jsx: CARD_CONFIG에 워크플로우 수(workflow_count), 채널 수(channel_count) 카드 추가(캠페인 수 다음, 정의·아이콘·색상 포함).
   - KPICards.jsx: 동일하게 워크플로우 수·채널 수 카드 및 rate 포맷 적용(대시보드1 동기화).

### 수정 파일
- Backend/api_server/dashboard_service.py
- Frontend/react-app/src/packages/dashboard2/components/KPICards2.jsx
- Frontend/react-app/src/packages/dashboard/components/KPICards.jsx
- docs/report/log.md (본 로그)

### 검수 결과
- Lint 오류 없음. 성공률~클릭률은 00.00% 형식, 캠페인 수·워크플로우 수·채널 수가 주요 지표에 표시됨.

---

## 2025-02-02: docs/main 문서 업데이트 (report 반영·대시보드2 미반영)

### 완료 작업
1. **00_PRD.md**
   - 대시보드2 관련 문구 전부 제거(§1.2 핵심 가치, §2.1 패키지, §2.2 접속 경로, §6.2, §8 변경 이력).
   - 리포트(§6.1): JOIN 규칙·안전성 반영 — joinRules(canAddTableByColumn, findIntermediateParent, isTableAvailable), safetyCheck(detectCircularReference, detectManyToMany, validateJoinPath, canAddTableSafely), joinMode·joinConfigs(LEFT/INNER/RIGHT·복합 조건·AND/OR), generateDistinctPivotSQL.

2. **01_FRONTEND_GUIDE.md**
   - 대시보드2 제거: §1.1 패키지·§1.2 접속 경로, §3 디렉터리 트리(dashboard2 폴더·라우트), §4.3 dashboard2 절 전체·대시보드2 기능 요약. 차트 스택에서 ECharts(대시보드2) 제거.
   - report(§4.1) 상세 반영: ReportPage 상태(joinMode, relationshipOptions, joinConditions, joinConfigs, tableRelationships 등), utils/sqlBuilder(generateDistinctPivotSQL·joinConfigs 옵션), utils/joinRules, utils/safetyCheck, utils/constants·helpers, __tests__ (sqlBuilder.test.js, joinRules.test.js). 디렉터리 트리에 utils·__tests__ 추가. shared 절 번호 4.4→4.3.

3. **02_BACKEND_FASTAPI_MIGRATION_PLAN.md**
   - 대시보드2 언급 없음 확인. 수정 없음.

### 수정 파일
- docs/main/00_PRD.md
- docs/main/01_FRONTEND_GUIDE.md
- docs/report/log.md (본 로그)

### 검수 결과
- docs/main 기준 패키지: report, dashboard, shared만 명시. 대시보드2는 테스트용으로 본 문서에 반영하지 않음.

---

## 2025-02-02: Phase 4 신호등 표시 (목표 대비 달성 여부)

### 완료 작업
1. **목표·기간 매칭 및 실적/목표 비율 계산 (Dashboard2Page.jsx)**
   - `targetMatchesPeriod(target, dateRange)`: 목표의 periodType(년도/월/기간)과 현재 필터 기간(date_range) 일치 여부 판별.
   - `METRIC_HIGHER_IS_BETTER`: 지표별 “높을수록 좋음” 여부(total_failed, failed_rate는 낮을수록 좋음).
   - `getTargetStatusByKey(targets, dateRange, kpi)`: 매칭된 목표별로 실적/목표 비율 계산. 높을수록 좋은 지표는 ratio = actual/target×100, 낮을수록 좋은 지표는 ratio = target/actual×100. 구간 ≥100% → ok, 80~100% → warning, <80% → fail.
   - `targetStatusByKey` useMemo로 계산 후 KPICards2에 전달.

2. **KPICards2 신호등 UI**
   - `targetStatusByKey` prop 추가. 매칭된 목표가 있는 카드에 대해: 테두리·배경 색상(초록/노랑/빨강), 뱃지 “달성 105%”/“주의 85%”/“미달 70%” 표시. 뱃지에 `title`로 목표 대비 비율 툴팁.
   - dashboard2.css: `.dashboard2-kpi-card__badge`, `__badge--ok`, `__badge--warning`, `__badge--fail` 스타일 추가.

### 수정 파일
- Frontend/react-app/src/packages/dashboard2/Dashboard2Page.jsx
- Frontend/react-app/src/packages/dashboard2/components/KPICards2.jsx
- Frontend/react-app/src/packages/dashboard2/dashboard2.css
- docs/report/log.md (본 로그)

### 검수 결과
- Lint 오류 없음. 목표 저장 후 해당 기간·지표로 조회 시 주요 지표 카드에 달성/주의/미달 뱃지 및 테두리 색상 표시.

---

## 2025-02-02: 목표 섹션 간소화(리포트 기간 제거) + Phase 3 지표 정의 툴팁

### 완료 작업
1. **목표 저장 섹션에서 리포트 기간 제거**
   - TargetContextSection: "리포트 기간: YYYY-MM-DD ~ YYYY-MM-DD" 표시 블록 및 `reportPeriodLabel` 변수 제거. 기간은 상단 필터에 이미 있으므로 중복 제거, 저장 섹션 간결화.

2. **Phase 3: 지표 정의 툴팁**
   - **KPICards2.jsx**: CARD_CONFIG 각 항목에 `definition` 문자열 추가(캠페인 수, 발송 요청/성공/실패, 오픈/클릭, 성공률/실패률/오픈률/클릭률의 정의·계산식). 카드 라벨 옆에 "?" 아이콘 추가, 호버 시 `title` 툴팁으로 정의 표시. `dashboard2-kpi-card__def-trigger` 스타일 추가.
   - **AggregatedDataTable2.jsx**: TABLE_HEADER_DEFINITIONS 상수(캠페인/일자/워크플로우/채널·발송요청·발송성공·오픈·클릭·성공률·오픈률·클릭률 정의) 추가. ThWithDef 컴포넌트로 헤더 셀 + "?" 툴팁 렌더링. thead 모든 헤더를 ThWithDef로 교체. `dashboard2-aggregated-data-table__th-inner`, `__th-def` 스타일 추가.

### 수정 파일
- Frontend/react-app/src/packages/dashboard2/components/TargetContextSection.jsx
- Frontend/react-app/src/packages/dashboard2/components/KPICards2.jsx
- Frontend/react-app/src/packages/dashboard2/components/AggregatedDataTable2.jsx
- Frontend/react-app/src/packages/dashboard2/dashboard2.css
- docs/report/log.md (본 로그)

### 검수 결과
- Lint 오류 없음. 대시보드2 목표 섹션에서 리포트 기간 미표시. 주요 지표 카드·집계 테이블 헤더에서 "?" 호버 시 지표 정의 툴팁 표시.

---

## 2025-02-02: 주요 지표 확장(성공률/실패률/오픈률/클릭률) + Phase 2

### 완료 작업
1. **주요 지표에 비율 지표 추가**
   - **Backend dashboard_service._calculate_kpi**: 반환 객체에 `success_rate`, `failed_rate`, `open_rate`, `click_rate` 추가. 성공률=total_success/total_send*100, 실패률=total_failed/total_send*100, 오픈률=total_open/total_success*100, 클릭률=total_click/total_success*100 (소수 둘째 자리).
   - **Frontend KPICards.jsx, KPICards2.jsx**: 카드 설정에 성공률·실패률·오픈률·클릭률 4개 추가(단위 %, 아이콘·색상 지정). 주요 지표 10개 표시.
   - **TargetContextSection.jsx**: 목표 지표 옵션에 `failed_rate`(실패률) 추가.

2. **Phase 2: 기간 표시 명시화 + Executive Summary**
   - 리포트 기간 라벨("리포트 기간: YYYY-MM-DD ~ YYYY-MM-DD")은 Phase 1에서 이미 적용됨.
   - **TargetContextSection**: Executive Summary 한 줄 요약 입력 필드 추가(로컬 state, placeholder "한 줄 요약 문구 (로컬 입력)").
   - **dashboard2.css**: `.dashboard2-target-context__summary-wrap`, `__summary-input` 스타일 추가.

### 수정/추가 파일
- Backend/api_server/dashboard_service.py
- Frontend/react-app/src/packages/dashboard/components/KPICards.jsx
- Frontend/react-app/src/packages/dashboard2/components/KPICards2.jsx, TargetContextSection.jsx
- Frontend/react-app/src/packages/dashboard2/dashboard2.css
- docs/report/log.md (본 로그)

### 검수 결과
- Lint 오류 없음. 대시보드1·2 주요 지표에 10개 카드(건수 6 + 비율 4) 표시. 대시보드2 목표·컨텍스트 섹션에 Executive Summary 입력란 표시.

---

## 2025-02-02: 대시보드2 전용 백엔드 라우터 분리 및 프론트 연동

### 완료 작업
1. **Backend/api_server/routers/dashboard2.py 신규**
   - prefix `/api/dashboard2`, tags `dashboard2`. dashboard_service·schemas 동일 사용.
   - POST /data, GET /filter-options/{table_id}, GET /tables, GET /required-columns, POST /chart-data (기존 dashboard와 동일 로직, DEV용 분리).

2. **main.py, routers/__init__.py**
   - dashboard2_router import 및 `app.include_router(dashboard2_router)` 등록.

3. **Frontend shared/api/client.js**
   - getDashboard2Tables, getDashboard2FilterOptions, getDashboard2Data, getDashboard2RequiredColumns, getDashboard2ChartData 추가 (/api/dashboard2/* 호출).

4. **Dashboard2Page.jsx, Dashboard2Header.jsx**
   - getDashboardTables → getDashboard2Tables, getDashboardFilterOptions → getDashboard2FilterOptions, getDashboardData → getDashboard2Data, getChartData → getDashboard2ChartData, getDashboardRequiredColumns → getDashboard2RequiredColumns 로 변경하여 테이블 조회·데이터 로드가 대시보드2 전용 API로 연결되도록 수정.

### 수정/추가 파일
- Backend/api_server/routers/dashboard2.py (신규)
- Backend/api_server/routers/__init__.py, main.py
- Frontend/react-app/src/shared/api/client.js
- Frontend/react-app/src/packages/dashboard2/Dashboard2Page.jsx, components/Dashboard2Header.jsx
- docs/report/log.md (본 로그)

### 검수 결과
- Lint 오류 없음. 대시보드2 페이지에서 테이블 선택 시 /api/dashboard2/tables, /api/dashboard2/data 등 호출로 데이터 로드 확인 권장.

---

## 2025-02-02: 대시보드2 Phase 1 — 목표·컨텍스트 섹션 + localStorage 저장/로드

### 완료 작업
1. **TargetContextSection.jsx 신규**
   - 기간 유형(년도/월/기간), 지표(캠페인 수·발송 요청·성공·실패·오픈·클릭·성공률·오픈률·클릭률), 년도·월/기간(시작·종료), 목표값 입력·저장.
   - 저장 시 동일 periodType+metric+year+month/range 조합이 있으면 덮어쓰기, 없으면 추가. 목표값 실수만 허용 유효성 검사.
   - 저장된 목표 테이블 표시(기간 라벨·지표·목표값), 삭제 버튼. 리포트 기간 라벨( dateRange ) 표시.

2. **Dashboard2Page.jsx**
   - `TARGETS_STORAGE_KEY = 'dashboard2_targets'`. 마운트 시 localStorage에서 목표 배열 로드.
   - `handleSaveTarget`: mergeTarget 후 localStorage 저장 및 setTargets. `handleDeleteTarget`: 인덱스 삭제 후 저장.
   - 본문 상단(주요 지표 위)에 TargetContextSection 배치, dateRange=filters.date_range, targets, onSave, onDelete 전달.

3. **dashboard2.css**
   - 목표·컨텍스트 섹션 스타일: dashboard2-target-context-section, 폼·테이블·삭제 버튼.

### 수정/추가 파일
- Frontend/react-app/src/packages/dashboard2/components/TargetContextSection.jsx (신규)
- Frontend/react-app/src/packages/dashboard2/Dashboard2Page.jsx (targets state, localStorage, TargetContextSection 연동)
- Frontend/react-app/src/packages/dashboard2/dashboard2.css (목표·컨텍스트 스타일)
- docs/report/log.md (본 로그)

### 검수 결과
- Lint: 오류 없음. 저장 후 새로고침 시 목표 유지(localStorage) 확인 권장.

---

## 2025-02-02: 대시보드2 Phase 0 — 대시보드1 구성 복사(공유 없음)

### 완료 작업
1. **dashboard2 전용 컴포넌트 신규 생성** (dashboard 패키지 참조 제거)
   - `dashboard2/components/CollapsibleSection2.jsx`: 접기/펼치기 섹션
   - `dashboard2/components/Dashboard2Header.jsx`: 테이블 선택·기간·집계 기준·정렬·필터·필수 컬럼 모달
   - `dashboard2/components/KPICards2.jsx`: KPI 카드 6종
   - `dashboard2/components/ChannelDonutCharts2.jsx`: 채널별 도넛(발송 요청·발송 성공)
   - `dashboard2/components/AggregatedBarChart2.jsx`: 기준별 발송 현황 막대 차트(상위 10건)
   - `dashboard2/components/AggregatedDataTable2.jsx`: 집계 데이터 테이블(페이징·테이블 내 검색)

2. **dashboard2.css**
   - Phase 0용 스타일 추가: collapsible, header, modal, KPI 카드, 채널 도넛, 막대 차트, 집계 테이블

3. **Dashboard2Page.jsx 재구성**
   - `../dashboard` import 제거. Dashboard2Header, CollapsibleSection2, KPICards2, ChannelDonutCharts2, AggregatedBarChart2, AggregatedDataTable2 로컬 import.
   - 본문 순서: 주요 지표(KPI) → 채널별 분석 → 기준별 발송 현황 → 집계 데이터 테이블 → 차트 생성(ECharts). 섹션 접기/펼치기 상태(sectionOpen) 추가.

4. **플랜 문서**
   - 목표 저장: DEV용 localStorage 사용으로 적용 결정 반영. Phase 1 설명을 localStorage 기준으로 수정.

### 수정/추가 파일
- Frontend/react-app/src/packages/dashboard2/components/CollapsibleSection2.jsx (신규)
- Frontend/react-app/src/packages/dashboard2/components/Dashboard2Header.jsx (신규)
- Frontend/react-app/src/packages/dashboard2/components/KPICards2.jsx (신규)
- Frontend/react-app/src/packages/dashboard2/components/ChannelDonutCharts2.jsx (신규)
- Frontend/react-app/src/packages/dashboard2/components/AggregatedBarChart2.jsx (신규)
- Frontend/react-app/src/packages/dashboard2/components/AggregatedDataTable2.jsx (신규)
- Frontend/react-app/src/packages/dashboard2/dashboard2.css (스타일 추가)
- Frontend/react-app/src/packages/dashboard2/Dashboard2Page.jsx (재구성)
- docs/report/03_대시보드2_성과리포트_개선_플랜.md (Phase 1 localStorage 반영)
- docs/report/log.md (본 로그)

### 검수 결과
- Lint: dashboard2 패키지 오류 없음. dashboard 패키지 참조 없음.

---

## 2025-02-02: docs/main 문서–코드 동기화 및 PRD 간결화·01/02 정밀화

### 완료 작업
1. **문서–코드 동기화**
   - 실제 구현 기준으로 개발문서(docs/main) 점검: 빠진 내용 추가, 달라진 내용 수정, 시스템에서 제거된 내용은 문서에서 삭제 반영 (이전 세션에서 00_PRD·01_FRONTEND_GUIDE 반영 완료).

2. **02_BACKEND_FASTAPI_MIGRATION_PLAN.md**
   - §1.1: routes.py 제거, 현재 구조(routers/, dependencies.py, schemas.py) 표로 정리.
   - §1.2: config 사용처 routes.py → routers/report.py, "전환 시" → "현재" 문구로 수정.
   - §1.3: chart-data에 "LIMIT 없음·전건 반환" 명시, 라우터 구분(health/report/dashboard) 추가.
   - Phase 3·4: "완료" 상태로 요약, 산출물 routes.py 삭제·routers 적용 명시.
   - 진행 순서 요약표: routes.py → routers/. 롤백 참고: routes.py/main.py → main·routers 복원 안내로 수정.

3. **00_PRD.md 간결화**
   - §2.1: 전체 디렉터리 트리 → 요약 불릿으로 축약, 상세는 01·02 참조 명시.
   - §4: 프론트 요약만 유지, 상세는 01 참조.
   - §5.2·§5.3: 엔드포인트·구성 상세 → 02 §1.3·§1.1·Phase 3·4 참조로 통합.
   - 변경 이력: PRD 간결화·02 routes→routers 반영 항목 추가.

### 수정 파일
- docs/main/02_BACKEND_FASTAPI_MIGRATION_PLAN.md
- docs/main/00_PRD.md
- docs/report/log.md (본 로그)

### 검수 결과
- 00_PRD에 언급된 프론트/백엔드 내용이 01_FRONTEND_GUIDE·02_BACKEND_FASTAPI_MIGRATION_PLAN에 정밀하게 반영됨. PRD는 간결·참조 위주로 정리됨.

---

## 2025-02-02: 차트 데이터 LIMIT 제거 (차트 신뢰성)

### 완료 작업
1. **차트 전용 API에서 LIMIT 제거**
   - `dashboard_service.get_chart_data`: 차트는 기간·디멘션에 해당하는 **전체** 데이터를 반환하도록 SQL에서 `LIMIT` 절 제거. (표 테이블용 페이지네이션 LIMIT 50은 별도 유지.)
   - docstring: "한 축당 상위 limit건" → "차트는 데이터 신뢰성을 위해 LIMIT 없이 전건 반환"으로 수정.

2. **API·프론트 정리**
   - `ChartDataRequest`: `limit` 필드 제거.
   - `routers/dashboard.py`: 차트 요청 시 `limit` 전달 제거.
   - `ChartWidget.jsx`: `getChartData` 호출 시 `limit: 50` 제거.

### 수정 파일
- Backend/api_server/dashboard_service.py (get_chart_data LIMIT 제거)
- Backend/api_server/routers/dashboard.py (limit 미전달)
- Backend/api_server/schemas.py (ChartDataRequest limit 제거)
- Frontend/react-app/src/packages/dashboard/components/ChartWidget.jsx (limit 미전달)

### 검수 결과
- Lint: 수정 파일 오류 없음.

---

## 2025-02-02: 차트 디멘션 셀렉트 안내 문구 추가 (3개 이상 집계 시 정의 반영)

### 완료 작업
- **ChartWidget.jsx**
  - Dimension 셀렉트 왼쪽 안내: 선택 디멘션별 문구 + 집계 기준 2개 이상일 때 "나머지는 합산" 명시. 예: "일자별 집계 결과가 반영됨. (캠페인·워크플로우는 합산)".
  - 섹션 설명 문구: "Dimension(X축): 집계 기준 중 선택한 1개만 축으로 사용하고, 나머지 집계 기준은 합산하여 표시"로 디멘션·메트릭 관계 정의. "상위 50건" 제거(차트 LIMIT 없음 반영).

### 수정 파일
- Frontend/react-app/src/packages/dashboard/components/ChartWidget.jsx

### 검수 결과
- Lint: 오류 없음.

---

## 2025-02-02: 백엔드 Flask → FastAPI 전면 전환 완료

### 완료 작업
1. **구조 변경 (FastAPI에 맞게 효율화)**
   - 단일 `routes.py`를 **routers/** 로 분리: `health.py`(/, /api, /health), `query.py`(쿼리 빌더 API), `dashboard.py`(대시보드 API)
   - **dependencies.py**: `get_db`(요청 단위 DB 연결, yield 후 자동 close), `get_config`(config.backend 주입)
   - **schemas.py**: POST 요청 바디 Pydantic 모델 (DescribeTableRequest, ExecuteQueryRequest, ExplainSqlRequest 등) — 검증·문서화

2. **main.py**
   - FastAPI 앱, CORSMiddleware, health/query/dashboard 라우터 등록, 404/500 JSON 예외 핸들러, uvicorn 기동
   - config 로드는 기존과 동일 (`Env/config/config.json` → config.backend)

3. **기존 파일**
   - **db.py**, **dashboard_service.py**: 변경 없음 (프레임워크 무관)
   - **routes.py**: 삭제 (라우터로 이전 완료)

4. **문서·의존성**
   - requirements.txt: flask/flask-cors 제거, fastapi·uvicorn[standard] 명시
   - run.py: ModuleNotFoundError 시 fastapi/uvicorn 안내
   - README.md, docs/main/00_PRD.md: 백엔드 구조를 FastAPI·routers 기준으로 수정

5. **버그 수정**
   - routers/query.py: `Query` import 추가 (table_relationships의 mode 파라미터용)

### 수정/삭제/추가 파일
- Backend/api_server/main.py (FastAPI 전환)
- Backend/api_server/dependencies.py (신규)
- Backend/api_server/schemas.py (신규)
- Backend/api_server/routers/__init__.py, health.py, query.py, dashboard.py (신규)
- Backend/api_server/routes.py (삭제)
- requirements.txt, run.py, README.md, docs/main/00_PRD.md
- docs/report/log.md (본 로그)

### 검수 결과
- API 경로·요청/응답 형식 기존과 동일 유지 → 프론트 수정 없음.
- Lint: query.py 등 수정 파일 오류 없음.

---

## 2025-02-02: 차트 가독성 개선 (ECharts 참고·기존 대시보드 반영)

### 완료 작업
1. **보고서 작성**
   - `docs/report/01_ChartReadability.md`: 디멘션·메트릭 불명확 시 가독성 저하 원인, ECharts 참고 요소(yAxis min/max, axisLabel, dataZoom, stack, label), 기존 dashboard(ChartWidget Y축 Nice Numbers·Rate 구간 확대, AggregatedBarChart TOP_N·복합 라벨) 적용 사항, EChartsChart 개선 방안 정리

2. **EChartsChart.jsx 개선 (dashboard2)**
   - Y축 데이터 구간 확대: 값이 좁은 구간에 몰려 있을 때(range/dataMax < 0.2) yAxis.min/max를 데이터 구간+패딩으로 설정, nice 눈금 적용. 안내 문구 "Y축이 데이터 구간으로 확대되었습니다." 표시
   - 스택 막대: 복수 메트릭 막대 템플릿(bar_both, bar_all)에 `stack: 'total'` 적용
   - dataZoom: 카테고리 20개 초과 시 X축 slider·inside dataZoom으로 초기 20건만 표시
   - 막대 데이터 라벨: 카테고리 15개 이하일 때 막대 위에 값 표시(한글 포맷)

### 수정/추가 파일
- docs/report/01_ChartReadability.md (신규)
- docs/report/00_ReportIndex.md (01_ChartReadability.md 목록 추가)
- Frontend/react-app/src/packages/dashboard2/components/EChartsChart.jsx (Y축 구간 확대, 스택, dataZoom, 라벨)

### 검수 결과
- Lint: 해당 파일 오류 없음.

---

## 2025-02-02: dashboard2 패키지 추가 (템플릿 ECharts 대시보드, 경로 /dashboard2)

### 완료 작업
1. **dashboard2 패키지 구성**
   - `Frontend/react-app/src/packages/dashboard2/` 생성: index.jsx, Dashboard2Page.jsx, dashboard2.css
   - 동일한 헤더/필터/데이터 조회: getDashboardTables, getDashboardFilterOptions, getDashboardData, DashboardHeader 재사용, 정렬·집계 기준·필터 동일

2. **템플릿 선택 + ECharts 차트**
   - `dashboard2/components/EChartsChart.jsx`: CHART_TEMPLATES(막대/선 템플릿 7종), aggregated_data → ECharts option 구성, echarts.init/setOption/resize/dispose 라이프사이클 처리
   - 템플릿: 일자별 발송 성공/요청, 발송 요청·성공, 오픈/클릭, 오픈·클릭, 전 메트릭 막대 등

3. **라우팅·의존성**
   - App.jsx: /dashboard2 라우트 및 네비 "대시보드2" 추가
   - echarts 패키지 npm 설치

### 수정/추가 파일
- Frontend/react-app/src/packages/dashboard2/index.jsx (신규)
- Frontend/react-app/src/packages/dashboard2/Dashboard2Page.jsx (신규)
- Frontend/react-app/src/packages/dashboard2/dashboard2.css (신규)
- Frontend/react-app/src/packages/dashboard2/components/EChartsChart.jsx (신규)
- Frontend/react-app/src/App.jsx (라우트·네비 추가)
- package.json (echarts 의존성 추가)

### 검수 결과
- Lint: 수정·추가 파일 오류 없음.

---

## 2025-02-02: Y축 Nice Numbers 전면 개편 (Chart.js 스타일)

### 완료 작업
1. **기존 Y축 함수 제거**
   - `calculateNiceStepSize`, `calculateYAxisMax`, `calculateYAxisMin`, `calculateNiceStepSizeLineArea` 삭제.

2. **새 알고리즘 적용**
   - `niceNum(range, round)`: 1, 2, 5, 10 계열 nice 숫자 반환.
   - `calculateYAxisScale(dataMin, dataMax, options)`: minTicks, maxTicks, paddingRatio, includeZero 옵션으로 min/max/stepSize/ticks/tickCount 반환.
   - `calculateYAxisScaleForLineArea`: 선형/영역용 (minTicks 6, maxTicks 12, paddingRatio 0.05).
   - `calculateYAxisScaleForBar`: 막대용 (includeZero: true, paddingRatio 0.1, minTicks 5, maxTicks 8).

3. **yDomain 연동**
   - 막대: `calculateYAxisScaleForBar` → [scale.min, scale.max].
   - 선형/영역: `calculateYAxisScaleForLineArea` → [scale.min, scale.max].

### 수정 파일
- Frontend/react-app/src/packages/dashboard/components/ChartWidget.jsx

### 검수 결과
- Lint: 해당 파일 오류 없음.

---

## 2025-02-02: recharts-surface·Y축 Max 잘림 방지 (막대·선형·영역 공통)

### 완료 작업
1. **overflow로 인한 잘림 제거**
   - `.chart-widget__y-axis-fixed`: `overflow: hidden` → `overflow: visible` (Y축 상단/하단 레이블 잘림 방지).
   - `.chart-widget__chart-scroll`: `overflow-y: visible` 명시.
   - `.chart-widget__chart-wrap`: `overflow-y: visible` 추가.
   - `.chart-widget__chart-block`: `overflow: visible` 추가.
   - `.recharts-responsive-container`, `.recharts-wrapper`, `.recharts-surface`: `overflow: visible !important` (캔버스 잘림 방지).

2. **Y축 레이블·여백**
   - `formatYAxisTick`: 1e12 이상은 "Ne12", 1e9~1e12 "Ne9", 1e6~1e9 "Ne6" 등으로 축약해 좁은 영역에서도 잘리지 않도록 적용 (100000000000 → "100e9" 등).
   - Y축 고정 영역 너비 56px → 80px, margin top 40 → 48, bottom 24 → 28로 상하 여유 확대.

### 수정 파일
- Frontend/react-app/src/packages/dashboard/components/ChartWidget.jsx
- Frontend/react-app/src/packages/dashboard/dashboard.css

### 검수 결과
- Lint: 해당 파일 오류 없음.

---

## 2025-02-02: 차트 Y축 도메인 버퍼·숫자 파싱·범례 상단 배치

### 완료 작업
1. **Y축 도메인과 데이터 일치**
   - `parseChartNumber(v)`: API/프롭 값이 문자열(쉼표 포함)이어도 숫자로 안전 파싱. 차트 데이터 저장 시와 yDomain 계산 시 동일 함수 사용.
   - yMax 버퍼: `minBuffer = max(dataMax * 10%, 1)` 로 두고, 막대/선형/영역 모두 `yMax >= dataMax + minBuffer` 로 상단 여유 확보.

2. **범례 위치**
   - 범례를 Y축 옆이 아닌 **차트 블록 전체 상단 한 줄**로 이동. `chart-widget__chart-block`(flex column)으로 범례 행 + 차트 영역(Y축 고정 | 스크롤) 세로 배치. `.chart-widget__legend-top` 스타일 추가.

### 수정 파일
- Frontend/react-app/src/packages/dashboard/components/ChartWidget.jsx
- Frontend/react-app/src/packages/dashboard/dashboard.css

### 검수 결과
- Lint: 해당 파일 오류 없음.

---

## 2025-02-02: 차트 범례 recharts-surface 상단 배치 및 막대 Y축 nice number 강제

### 완료 작업
1. **범례 위치**
   - 범례를 Y축 열이 아닌 **recharts-surface 상단**으로 이동. 스크롤 영역(`chart-scroll`) 내부 맨 위에 `chart-widget__legend-strip`을 두어 차트 캔버스 바로 위에 표시. 고정 Y축 열에는 같은 높이의 `chart-widget__legend-strip-spacer` 추가해 세로 정렬 유지.

2. **막대 차트 Y축 nice number**
   - 도메인 계산 시 메트릭 값을 `Number()`로 확실히 숫자화.
   - 막대용 `yMax`: `dataMax + stepSize` 후 step 단위로 올림해 눈금에 맞춤 (`Math.ceil(rawMax / stepSize) * stepSize`).
   - Recharts가 데이터로 domain을 넓히지 않도록 Y축(고정·스크롤 공통)에 `allowDataOverflow` 적용.

### 수정 파일
- Frontend/react-app/src/packages/dashboard/components/ChartWidget.jsx
- Frontend/react-app/src/packages/dashboard/dashboard.css

### 검수 결과
- Lint: 해당 파일 오류 없음.

---

## 2025-02-02: 차트 위젯 범례 간격 및 막대 Y축 max 보정

### 완료 작업
1. **범례 위치**
   - 범례가 Y축과 겹치지 않도록 상단 여유 확대. `.chart-widget__legend-fixed`에 `padding-top: 12px`, `padding-bottom: 8px` → `padding-bottom: 20px` 적용해 차트와 충분히 간격 확보.

2. **막대 차트 Y축 max**
   - 막대도 `y축 max = data max + 간격` 적용. 기존: `dataMax === dataMin`일 때 `dataMax + 1`만 사용해 막대가 상단에 붙는 문제.
   - 변경: 막대는 항상 `yMax = dataMax + Math.max(stepSize, 1)`. 단일 값일 때는 `stepSize = calculateNiceStepSize(0, dataMax)`로 데이터 크기에 맞는 간격 사용.

### 수정 파일
- Frontend/react-app/src/packages/dashboard/components/ChartWidget.jsx
- Frontend/react-app/src/packages/dashboard/dashboard.css

### 검수 결과
- Lint: 해당 파일 오류 없음.

---

## 2025-02-02: 차트 위젯 범례 고정 및 Y축 Nice number 적용

### 완료 작업
1. **범례 고정**
   - 범례를 Y축과 동일하게 스크롤 영역 밖으로 이동. `chart-widget__legend-fixed`로 차트 상단에 고정 행 추가(메트릭명+색상 블록). Recharts `<Legend />` 제거, 고정 영역만 사용.

2. **Y축 Nice number 적용**
   - 스크롤 영역의 LineChart/AreaChart/BarChart에 `domain={yDomain}`이 반영되도록 숨김 YAxis(`<YAxis domain={yDomain} hide width={0} />`) 추가. 기존에는 왼쪽 고정 BarChart에만 domain이 있어 실제 그리기 스케일은 자동 도메인 사용 → 스크롤 차트에도 동일 domain 적용.
   - `calculateNiceStepSizeLineArea`: 구간 4개 이상을 위해 `maxStep = dataRange/2` → `dataRange/4`로 변경.

### 수정 파일
- Frontend/react-app/src/packages/dashboard/components/ChartWidget.jsx
- Frontend/react-app/src/packages/dashboard/dashboard.css

### 검수 결과
- Lint: 해당 파일 오류 없음.

---

## 2025-02-02: 차트 위젯 하단 삭제 버튼 제거

### 완료 작업
1. **삭제 버튼 중복 제거**
   - 디멘션·메트릭·차트 타입 셀렉트 옆에 있던 하단 "삭제" 버튼 제거. 상단(저장 버튼 옆) 삭제 버튼만 유지.

### 수정 파일
- Frontend/react-app/src/packages/dashboard/components/ChartWidget.jsx

### 검수 결과
- Lint: 해당 파일 오류 없음.

---

## 2025-02-02: 차트 생성 막대 차트 좌우 폭 확대 및 Y축 고정

### 완료 작업
1. **좌우 폭 확대**
   - `.chart-widget__chart-wrap`의 max-width를 980px → 1200px로 변경해 차트가 보이는 영역을 넓힘.

2. **가로 스크롤 시 Y축 고정**
   - 막대 차트만 왼쪽에 Y축 전용 영역을 두고, 오른쪽만 가로 스크롤되도록 분리.
   - 왼쪽: 고정 너비(56px)로 Y축만 표시하는 BarChart(동일 domain·높이).
   - 오른쪽: `chart-widget__chart-scroll`에서 overflow-x: auto로 X축·막대만 스크롤.
   - 클래스 `chart-widget__chart-wrap--y-fixed`로 flex 레이아웃 적용.

3. **선형·영역 차트에 bar와 동일 구성 적용**
   - 선형/영역도 고정 Y축 + 스크롤 영역 분리, minWidth(LABEL_SLOT_WIDTH×건수)로 X축 간격 확보 후 가로 스크롤.
   - X축 레이블은 막대와 동일하게 `XAxisTickTruncate` 적용해 잘림·겹침 방지. bar/line/area 동일 정형 구성.

### 수정 파일
- Frontend/react-app/src/packages/dashboard/dashboard.css: chart-widget__chart-wrap max-width, y-fixed 레이아웃
- Frontend/react-app/src/packages/dashboard/components/ChartWidget.jsx: 막대 차트 시 Y축 고정 + 스크롤 영역 분리

### 검수 결과
- Lint: 해당 파일 오류 없음.

---

## 2025-02-02: 차트 생성 삭제 버튼 스타일 및 docs/main 최신화

### 완료 작업
1. **차트 생성 섹션 삭제 버튼**
   - 연한 빨간 배경(#f87171), 흰색 글씨. hover 시 #ef4444. 클래스 `.chart-widget__delete-btn` 추가(dashboard.css), ChartWidget.jsx 두 곳 적용.

2. **docs/main 최신화**
   - 00_PRD.md: 차트 생성 전용 API(chart-data), 차트 생성 위젯(전용 조회·Y축 고정·막대/선형/영역 동일), CollapsibleSection 반영. API 엔드포인트·dashboard_service 함수 목록 보강.
   - 01_FRONTEND_GUIDE.md: ADVANCED_FEATURES.md 참조 제거. CollapsibleSection, ChartWidget( getChartData·Y축 고정·삭제 버튼 스타일), getChartData API, DashboardHeader/Filters 최신 설명 반영.

### 수정 파일
- Frontend/react-app/src/packages/dashboard/dashboard.css, ChartWidget.jsx
- docs/main/00_PRD.md, 01_FRONTEND_GUIDE.md

### Git
- 커밋 후 origin/main 푸시 완료.

---

## 2025-02-02: 차트 생성 전용 별도 조회 API (디멘션·메트릭 방식)

### 완료 작업
1. **원인**
   - 차트 생성이 대시보드 메인 집계 데이터(일자별 등)를 그대로 사용해, 캠페인/워크플로우 디멘션 선택 시 카디널리티가 높아져 X축 레이블 겹침·가독성 저하 발생.

2. **Adobe Analytics / Google Analytics 참고**
   - **Adobe**: Report Builder에서 디멘션(비수치·분류)과 메트릭(수치)을 요청 단위로 정의하고, 데이터 블록은 “한 요청 = 한 테이블”로 생성. 디멘션별·메트릭별 전용 요청으로 시각화 가독성 확보.
   - **GA**: Bar/Column 차트는 “한 디멘션 + 다중 메트릭” 또는 “두 디멘션 + 단일 메트릭” 구성 권장. 디멘션/메트릭을 Setup에서 명확히 설정 후 시각화.

3. **백엔드**
   - `dashboard_service.get_chart_data(req)`: 단일 디멘션·단일 메트릭으로 별도 SQL 집계. `dimension`(delivery_date/campaign_label/workflow_label/channel_name), `metric`, 동일 필터(date_range, campaign_ids, workflow_ids, channels), `limit`(기본 50) 지원.
   - `POST /api/dashboard/chart-data` 라우트 추가.

4. **프론트엔드**
   - `getChartData(body)` API 클라이언트 추가.
   - ChartWidget: `tableId`, `filters` 전달 시 `getChartData`로 차트 데이터 조회. 없으면 기존처럼 `data` prop으로 폴백.
   - SingleWidget: API 조회 중 “차트 데이터 조회 중...” 표시.

### 수정·추가 파일
- Backend/api_server/dashboard_service.py: get_chart_data, CHART_DIMENSION_KEYS, CHART_METRIC_KEYS
- Backend/api_server/routes.py: POST /api/dashboard/chart-data
- Frontend/react-app/src/shared/api/client.js: getChartData
- Frontend/react-app/src/packages/dashboard/components/ChartWidget.jsx: tableId, filters, getChartData 연동
- Frontend/react-app/src/packages/dashboard/DashboardPage.jsx: ChartWidget에 tableId, filters 전달

### 검수 결과
- Lint: 해당 파일 오류 없음.

---

## 2025-02-02: 차트 생성 막대 차트 X축 레이블 겹침 수정

### 완료 작업
1. **레이블 간격 확보(차트 생성 막대 차트)**
   - 막대 차트 영역에 `minWidth: max(280, chartData.length * LABEL_SLOT_WIDTH)` 적용. 슬롯당 100px(LABEL_SLOT_WIDTH) 확보로 recharts-cartesian-axis-tick(g) 겹침 제거.
   - `.chart-widget__chart-wrap`에 `overflow-x: auto` 추가. 필요 폭이 980px 초과 시 가로 스크롤로 전체 표시.

2. **막대·간격 조절**
   - `barCategoryGap="8%"`로 막대 간 간격 확보.
   - `maxBarSize`: 고정 75 → `Math.min(75, LABEL_SLOT_WIDTH * 0.55)`(약 55px)로 제한해 슬롯 내 여백 확보.

### 수정 파일
- Frontend/react-app/src/packages/dashboard/components/ChartWidget.jsx
- Frontend/react-app/src/packages/dashboard/dashboard.css

### 검수 결과
- Lint: ChartWidget.jsx 오류 없음.

---

## 2025-02-02: 차트 생성 섹션 레이아웃·안내 문구·버튼 패딩 조정

### 완료 작업
1. **차트 폭을 기준별 발송 현황과 동일하게 맞춤**
   - ChartWidget 내 SingleWidget 차트 영역을 `.chart-widget__chart-wrap`으로 감싸고, CSS에서 `max-width: 980px`, `margin: 0 auto` 적용(기준별 발송 현황의 `.aggregated-bar-chart__chart-wrap`과 동일).
   - 막대 차트의 `minWidth: chartData.length * LABEL_SLOT_WIDTH` 제거하여 차트가 섹션 폭을 넘어 과도하게 늘어나지 않도록 함.

2. **안내 문구 위치·패딩**
   - "Dimension: 집계 기준에서 선택한 항목만 표시. 두 개 이상이면 그중 선택 가능. Metric: 실수형 지표만. Y축은 선택한 Metric에 맞게 자동 조정." 문구를 섹션 헤더(접기/펼치기 제목) 바로 아래로 이동(ChartWidget 내 첫 번째 요소로 배치).
   - `.chart-widget__desc`에 `padding: 10px 0 0 10px`(상·좌 10px) 적용.

3. **차트 생성 버튼 우측 여백**
   - `.chart-widget__header`에 `padding-right: 30px` 적용하여 섹션 내 우측 여백 확보.

### 수정 파일
- Frontend/react-app/src/packages/dashboard/dashboard.css: chart-widget 영역 스타일 수정·추가
- Frontend/react-app/src/packages/dashboard/components/ChartWidget.jsx: 안내 문구 순서 변경, 차트 래퍼에 chart-widget__chart-wrap 적용

### 검수 결과
- Lint: ChartWidget.jsx, dashboard.css 오류 없음.

---

## 2025-02-02: 대시보드 정렬 기준 UI (멀티 정렬·적용 문구)

### 완료 작업
1. **정렬 기준 행 추가 (DashboardHeader)**
   - 집계 기준 아래에 동일 포맷의 "정렬 기준" 행 추가. 일자·발송수·성공수·오픈수·클릭수 버튼.
   - 클릭 시: 1회=내림차순, 2회=오름차순, 3회=정렬 해제. 먼저 누른 항목이 1순위인 멀티 정렬.
   - 적용된 정렬을 버튼 div 오른쪽에 표시: "1. 일자 - 오름차순 2. 발송수 - 내림차순" 형식.

2. **정렬 로직 (DashboardPage)**
   - sortOrder 상태: `[{ key, order: 'asc'|'desc' }, ...]`. sortAggregatedData(rows, sortOrder)로 정렬 후 sortedAggregatedData 를 AggregatedBarChart·AggregatedDataTable·ChartWidget 에 전달.

3. **스타일 (dashboard.css)**
   - .dashboard-header__sort-row, .dashboard-header__sort-label, .dashboard-header__sort-buttons, .dashboard-header__sort-btn(--desc/--asc), .dashboard-header__sort-applied 추가.

### 비고
- 백엔드 기본 ORDER BY(success_count DESC 등)는 유지. 프론트에서 정렬 기준이 있으면 그 순서로 덮어서 표시.

---

## 2025-02-02: docs/main 문서 분리 — 01_FRONTEND_GUIDE 생성·ADVANCED_FEATURES 통합 후 삭제

### 완료 작업
1. **01_FRONTEND_GUIDE.md 생성**
   - 00_PRD.md·ADVANCED_FEATURES.md 의 프론트 관련 내용을 통합. 참고 포맷: Chart_Gen 02_Frontend_Guide.md (카테고리만 참고, 우리 시스템에 맞게 구성).
   - 개요·접속 경로·기술 스택·아키텍처(디렉토리 구조)·패키지별 구성(report·dashboard·shared)·추가 기능(Claude 해석·페이지네이션)·스타일링·문서 구성 수록. 코드 블록은 최소화하고 구조·역할·동작 위주로 기술.

2. **00_PRD.md 수정**
   - 섹션 4(프론트엔드): 상세 제거, 한 단락 요약 + "상세는 01_FRONTEND_GUIDE.md 참고" 로 정리.
   - 섹션 7(문서 구성): 00_PRD.md, 01_FRONTEND_GUIDE.md 로 갱신. ADVANCED_FEATURES.md 제거.
   - 변경 이력: 문서 분리(프론트 상세 이관·ADVANCED_FEATURES 통합 후 삭제) 항목 추가.

3. **ADVANCED_FEATURES.md 삭제**
   - 내용 전부 01_FRONTEND_GUIDE.md 로 이관 완료 후 삭제.

4. **README.md**
   - 상세 명세 참조: "00_PRD.md, 01_FRONTEND_GUIDE.md" 로 수정.

### 비고
- docs/main: 00_PRD(요약·코드 세부 없음), 01_FRONTEND_GUIDE(프론트 전용 상세).

---

## 2025-02-02: docs/main 문서 정리 — PRD 통합·CURSOR_SPEC 삭제·ADVANCED_FEATURES 갱신

### 완료 작업
1. **PRD.md 유지·검토**
   - CURSOR_SPEC.md, CURSOR_SPEC_V2_SIMPLIFIED.md 의 유효 내용은 이미 PRD로 통합된 상태로 유지. 한 줄씩 검토하여 현재 시스템과 일치함을 확인.

2. **CURSOR_SPEC.md, CURSOR_SPEC_V2_SIMPLIFIED.md 삭제**
   - 두 파일 삭제 완료. 요구사항·아키텍처·설정·기능 요약은 docs/main/PRD.md 만 참조.

3. **ADVANCED_FEATURES.md 전면 수정**
   - 기존 HTML/CSS/JavaScript 코드 블록 전부 제거 (과거 바닐라 구현 기준이었음).
   - 현재 구현 기준으로 재작성: 프론트 React(Vite), Claude 해석은 백엔드 `/api/explain-sql` (API 키는 config.backend), 페이지네이션은 COUNT 쿼리 + LIMIT/OFFSET, ReportPage/MainArea·client.js 기준으로 동작·UI 개요만 기술.

4. **README.md 수정**
   - 상세 명세 참조를 "PRD.md, CURSOR_SPEC.md 등" → "PRD.md, ADVANCED_FEATURES.md" 로 변경.
   - 접속 URL 안내: 웹 `http://localhost:8080/ibank-bi/`, 리포트 `/ibank-bi/report`, 대시보드 `/ibank-bi/dashboard` 명시.

### 비고
- docs/main 문서 구성: PRD.md(요구사항·아키텍처·설정), ADVANCED_FEATURES.md(Claude 해석·페이지네이션 등 추가 기능 명세).

---

## 2025-02-02: 대시보드 필수 컬럼 타입 검증·금지 키워드 문맥 검사(CREATE 등 오탐 제거)

### 완료 작업
1. **대시보드: 필수 컬럼에 데이터 타입 검증 추가**
   - **db.py**: `get_table_columns_with_types(table_name)` 추가 — information_schema에서 column_name, data_type 반환.
   - **dashboard_service.py**: `DASHBOARD_REQUIRED_COLUMNS`를 (컬럼명, 허용 data_type 목록) 구조로 변경. `get_aggregatable_tables()`는 `get_table_columns_with_types()`로 컬럼·타입 조회 후, 이름 존재 여부와 실제 타입이 허용 타입 목록에 있는지 검사. `get_required_columns()`는 `[{ name, allowed_types }, ...]` 형태로 반환.
   - **DashboardHeader.jsx**: info 모달 오픈 시 `getDashboardRequiredColumns()` 호출하여 필수 컬럼 목록 로드, 컬럼명과 허용 타입(예: `delivery_date (date | timestamp without time zone)`)을 함께 표시. 안내 문구에 "이름과 타입 모두 일치" 필요하다고 명시.
   - **dashboard.css**: `.dashboard-modal__column-type` 스타일 추가(타입 표시용).

2. **리포트: 금지 키워드 검사를 문맥 기반으로 통일 (CREATE·UPDATE 등 오탐 제거)**
   - **routes.py** `_contains_dangerous_sql()`: 기존 `\bCREATE(?!\w)\s+\bTABLE(?!\w)` 등 전체 검색 방식을 제거. **세미콜론으로 분리한 각 문장**만 검사하여, **문장 시작**에서만 위험 구문(DROP TABLE, CREATE TABLE, DELETE FROM, UPDATE 등)으로 시작할 때만 금지 처리.
   - 이에 따라 `SELECT created_at ...`, `SELECT * FROM some_table`, 문자열 리터럴 내 'create table' 등은 더 이상 "금지된 키워드"로 잡히지 않음. 메시지 출처는 백엔드 `/api/execute-query` 등 400 응답의 `error` 필드이며, 프론트는 해당 메시지를 toast(우하단)에 표시.

### 검수 결과
- Lint: db.py, dashboard_service.py, routes.py, DashboardHeader.jsx, dashboard.css 오류 없음.

### 비고
- 백엔드 재시작 후 대시보드 테이블 목록·필수 컬럼 API 동작 확인 권장. 리포트에서 created_at/updated_at/some_table 등 사용 시 금지 키워드 오탐 없음 확인.

---

## 2025-02-02: 대시보드 테이블 필터 강화·금지 키워드(updated_at) 오탐 수정·base 경로 확인

### 완료 작업
1. **대시보드: 필수 컬럼 없는 테이블 제외 로직 강화 (dashboard_service.py)**
   - `get_aggregatable_tables()`: 컬럼명을 `str(c).strip().lower()`로 정규화, 필수 컬럼 개수 미달(`len(col_set) < required_count`)이거나 `required.issubset(col_set)`이 아니면 해당 테이블 제외.
   - 필수 컬럼을 모두 가진 테이블만 대시보드 테이블 셀렉트에 노출되도록 명시적 검사 유지.

2. **리포트: 금지 키워드 검사에서 updated_at 오탐 방지 (routes.py)**
   - `_contains_dangerous_sql()`: UPDATE 검사를 `\bUPDATE\s`에서 **문맥 기반**으로 변경.
   - **쿼리 맨 앞** 또는 **세미콜론 직후**에 오는 `UPDATE ` 만 금지하도록 정규식 적용: `^\s*UPDATE\s`, `\s;\s*UPDATE\s`.
   - `SELECT ... updated_at ...` 등 컬럼명 `updated_at`은 매칭되지 않아 "금지된 키워드: UPDATE" 알림이 더 이상 발생하지 않음.

3. **base 경로 확인**
   - Vite `base: '/ibank-bi/'`, static_server에서 `/ibank-bi` 요청을 dist 기준으로 서빙하도록 이미 적용됨.
   - 접속 URL: `http://127.0.0.1:8080/ibank-bi/` (report/report 중복 없음).

### 검수 결과
- Lint: routes.py, dashboard_service.py 오류 없음.

### 비고
- 백엔드 수정 반영을 위해 API 서버 재시작 필요. 대시보드 테이블 목록 갱신을 위해 프론트 재빌드 후 확인 권장.

---

## 2025-02-02: 대시보드 Info 버튼 노출·집계 테이블 필터 검수·리포트 헤더 제거·버튼 이동

### 완료 작업
1. **대시보드 Info 버튼 노출**
   - 테이블 셀렉트와 같은 줄이 아닌, **테이블 div 아래 한 줄**로 배치. `dashboard-header__table-cell`을 flex column으로 변경, `dashboard-header__table-input-row`(라벨+셀렉트) 아래에 `dashboard-header__info-btn-wrap`(info 버튼) 배치.

2. **집계 가능 테이블 필터 검수**
   - Backend `get_aggregatable_tables()`: 컬럼명 비교 시 **대소문자 무시** (`c.lower()`, `required.issubset(col_set)`) 적용. DB가 대문자/혼합 컬럼명을 주어도 집계 가능 테이블이 누락되지 않도록 함.
   - 서버에 최신 코드 반영 후 `report-api` 재시작 시 셀렉트에는 필수 컬럼을 가진 테이블만 노출됨.

3. **리포트 페이지**
   - **header class div 삭제**: `Header` 컴포넌트를 ReportPage에서 제거(렌더링·import 제거). 제목·초기화·실행이 있던 상단 헤더 영역 제거.
   - **nav 상하 폭**: App.jsx `app-nav` padding을 `8px 16px` → **`14px 16px`** 로 변경.
   - **초기화·실행 버튼**: filter-order-bar **우측 상단**으로 이동. MainArea에 `onClearAll` prop 추가, `filter-order-bar__actions-row`(우측 정렬) 안에 `filter-order-bar__actions`(초기화·실행 버튼) 배치. report.css에 `.filter-order-bar__actions-row`, `.btn-report-secondary` 스타일 추가.

### 비고
- 대시보드에서 여전히 모든 테이블이 보이면, 배포 서버에서 `report-api` 재시작 및 프론트 `npm run build` 후 `report-front` 재시작 필요.

---

## 2025-02-02: 대시보드 집계 가능 테이블만 셀렉트·info 모달·class 기반 CSS

### 완료 작업
1. **Backend: 집계 가능 테이블만 셀렉트에 노출**
   - `db.get_table_columns(table_name)`: information_schema 기반 컬럼명 목록 반환.
   - `dashboard_service.DASHBOARD_REQUIRED_COLUMNS`: delivery_date, campaign_id, campaign_label, workflow_id, workflow_label, delivery_channel, total_count, success_count, failed_count, open_count, click_count.
   - `get_aggregatable_tables()`: allowed_tables 중 위 필수 컬럼을 모두 가진 테이블만 반환.
   - `GET /api/dashboard/tables`: get_aggregatable_tables() 사용으로 변경. `GET /api/dashboard/required-columns`: 필수 컬럼 목록 반환(안내용).

2. **Frontend: 테이블 div 아래 info 버튼 + 모달**
   - DashboardHeader에 "info" 버튼 추가(테이블 셀렉트 옆). 클릭 시 모달 오픈.
   - 모달: "대시보드 조회를 위한 테이블 필수 컬럼" 제목, getDashboardRequiredColumns()로 목록 로드, 닫기 버튼·오버레이 클릭 시 닫힘.

3. **전체 div 기능별 class 부여 및 CSS 클래스 기반 적용**
   - DashboardPage: dashboard-page, dashboard-page__header-wrap, __error, __empty, __content.
   - DashboardHeader: dashboard-header, __table-row, __table-cell, __table-label, __table-select-wrap, dashboard-table-select, __info-btn-wrap, dashboard-info-btn, __date-cell, __date-label, __date-inputs, __load-btn, __group-by-row, __group-by-label, __group-by-checkboxes, __checkbox-label, __filter-row, __filter-cell, __filter-label, dashboard-modal-overlay, dashboard-modal, dashboard-modal__title/__body/__list/__close 등.
   - KPICards: kpi-cards-section, kpi-cards__title, kpi-grid, kpi-card, kpi-card__label/__value/__unit.
   - ChannelDonutCharts: channel-donut-charts__title, __row, donut-block__title, __total.
   - AggregatedBarChart: aggregated-bar-chart-section, __title, __chart-wrap.
   - AggregatedDataTable: aggregated-data-table-section, __toolbar, __title, __search-wrap, __search-input, __pagination-info, __table-wrap, __table, __thead, __tbody, __pagination, __pagination-btn, __pagination-label.
   - ChartWidget: chart-widget, chart-widget__header, __title, __add-btn, __desc, __grid.
   - dashboard.css: 위 클래스 기준으로 스타일 정리(인라인 제거 가능한 부분 class로 이전).

### 검수 결과
- Lint: Backend db/dashboard_service/routes, Frontend DashboardHeader/DashboardPage/ KPICards/ChannelDonutCharts/AggregatedBarChart/AggregatedDataTable/ChartWidget 대상 오류 없음.

### 비고
- 집계 불가 테이블은 셀렉트에 아예 노출되지 않음. 사용자는 info 모달로 필수 컬럼을 확인할 수 있음.

---

## 2025-02-02: Linux api_base_url 안내 및 Git 푸시

### 완료 작업
1. **DEPLOY_SERVER.md §6 추가**
   - Linux 서버에서 `frontend.api_base_url` 은 **백엔드 경로**여야 함을 명시.
   - 잘못된 예: `https://도메인/report` → API 요청이 프론트(3500)로 가서 실패.
   - 올바른 예: `https://도메인/report_api` → API 요청이 백엔드(8500)로 전달되어 정상 동작.
   - Nginx `location /report/`(프론트) vs `location /report_api/`(API) 구조에 따른 설정 가이드.

2. **기타 검수**
   - Backend api_server, Frontend react-app/src, static_server, Env: Lint 오류 없음.
   - 로컬 config.json은 개발용(8080, localhost:5001) 유지; Linux 서버 쪽 config는 서버에서 `report_api` 로 수정 후 재시작 필요.

3. **Git**
   - 변경사항 커밋 및 원격 푸시.

### 비고
- 리눅스에 `api_base_url: https://ajo.sdev-ibank.co.kr/report` 로 되어 있으면 `/report` 가 프론트 경로이므로 API 호출이 실패함. 서버 config.json 에서 `https://ajo.sdev-ibank.co.kr/report_api` 로 변경 필요.

---

## 2025-02-02: 로컬 쿼리 빌더( index 1 / app 1 / main 1 ) → React Report 적용

### 완료 작업
1. **Report CSS (report.css)**
   - `main 1.css` 및 `app 1.js` 인라인 스타일을 `Frontend/react-app/src/packages/report/report.css`로 통합.
   - 기준축/피벗/HAVING chip, 그리드 헤더(기준축 토글·제거·집계·날짜단위), 필터 문장형·드릴다운 스타일 반영.
   - ReportPage.jsx에서 `import './report.css'` 추가.

2. **상수·헬퍼 (report/utils)**
   - `constants.js`: OPERATOR_LABELS, AGG_FUNCTIONS export.
   - `helpers.js`: isDateColumn, isDateType, isDateTimeType, escapeSqlString, escapeLikePattern, formatWhereValue, isNumericValue export.

3. **sqlBuilder 확장**
   - `generateSQL` 8번째 인자 options: groupBy, dateGranularity, havings, pivot, pivotRowAggs 지원.
   - GROUP BY, 날짜 단위(TO_CHAR), 컬럼별 aggFunc, HAVING, 피벗(CASE WHEN) 모드 SELECT/COUNT 쿼리 생성.
   - `generateCountSQL` 5번째 인자 options 동일 지원 (GROUP BY 시 서브쿼리).
   - `generateDistinctPivotSQL`: 피벗 축 값 조회용 DISTINCT 쿼리 생성.

4. **ReportPage 상태·콜백**
   - 상태: groupBy, pivot, pivotRowAggs, dateGranularity, havings 추가.
   - gridColumns에 aggFunc 필드; syncAggFuncs, addColumn 시 groupBy 반영.
   - removeColumn: 해당 컬럼/테이블 제거 시 groupBy/havings/pivot/pivotRowAggs/orderBy 정리 및 orderBy columnIndex 재계산.
   - toggleGroupBy, setDateGranularityFor, changeAggFuncFor, addHaving, removeHaving, setPivotFromValues, fetchAndSetPivot, removePivotCallback, addPivotAgg, removePivotAgg 추가.
   - clearAll에 groupBy/pivot/pivotRowAggs/dateGranularity/havings 초기화 추가.
   - runExecuteQuery에서 generateSQL/generateCountSQL에 options 전달.

5. **MainArea UI**
   - filter-order-bar: 기준축(groupby-row), 피벗축(pivot-row), 행별집계(pivot-agg-row), HAVING(having-row), 조건(where-row), 정렬(order-row) 행 추가.
   - Chip 및 버튼: + 피벗 추가, + 집계 추가, + HAVING 추가, + 조건 추가, + 정렬 추가. OPERATOR_LABELS로 조건/HAVING 연산자 한글 표시.
   - 그리드 헤더: 기준축 토글(⊞/기준축 ×), 컬럼 제거(×), 날짜 단위(연/연월/연월일), 집계 드롭다운(AGG_FUNCTIONS, 기준축 활성 시).
   - 피벗 모드: groupBy + pivotRowAggs + pivot.values + 전체 컬럼 테이블 렌더링.
   - HAVING 추가 시 컬럼 선택 메뉴 → 연산자/값 팝업(필터 문장형 스타일).

### 검수 결과
- Lint: ReportPage.jsx, MainArea.jsx, sqlBuilder.js, constants.js, helpers.js 오류 없음.
- `npm run build` 성공.

### 비고
- 기존 React Report(addedTables, gridColumns, filters, orderBy) 호환 유지. orderBy는 columnIndex 기반으로 유지하고, sqlBuilder에서 집계 시 agg 표현식으로 ORDER BY 생성.

---

## 2025-02-02: 차트 생성 Dimension을 집계 체크박스 기준으로 연동

### 완료 작업
1. **Dimension 옵션 = 집계 체크박스 기준**
   - ChartWidget에 `groupBy`(filters.group_by) 전달. `getAvailableDimensions(groupBy)`로 사용 가능 Dimension 목록 계산(일자→캠페인→워크플로우→채널 순, 체크된 것만). 하나도 없으면 전체 노출.

2. **차트 생성 시 기본 Dimension**
   - 새 위젯 추가 시 `xKey` = availableDimensions[0] (집계에서 첫 번째로 체크된 항목). 예: 캠페인만 체크 시 기본 Dimension = 캠페인.

3. **두 개 이상 체크 시**
   - Dimension 드롭다운에 체크된 항목만 표시되어 그중 선택 가능. 선택한 Dimension에 맞게 X축·차트 데이터 표시.

4. **집계 변경 시 위젯 동기화**
   - useEffect로 groupBy/availableDimensions 변경 시, 위젯의 xKey가 목록에 없으면 첫 번째 Dimension으로 자동 변경.

### 검수 결과
- Lint: ChartWidget.jsx, DashboardPage.jsx 오류 없음.

### 비고
- 일자만 체크 시 Dimension 기본값 = 일자, 캠페인만 체크 시 = 캠페인 → X축 레이블이 집계 데이터와 일치하여 이상한 값 방지.

---

## 2025-02-02: 대시보드 최초 진입 시 집계 기준 일자별만 적용

### 완료 작업
1. **집계 체크박스 초기값 변경 (DashboardPage.jsx)**
   - 기존 defaultGroupBy: campaign true, date true, workflow false, channel true
   - 변경: **일자별만** 체크 — campaign false, date true, workflow false, channel false
   - 세션 유지 없이 페이지 로드 시 항상 이 초기값으로 진입.

### 비고
- 대시보드는 sessionStorage/localStorage를 사용하지 않으므로, 새로고침·재진입 시마다 이 초기값이 적용됨.

---

## 2025-02-02: 기준별 발송현황 차트 상위 10건 정렬 기준 명확화

### 완료 작업
1. **정렬 기준 통일: 발송성공 수(success_count)**
   - 기존: group_by.date 여부에 따라 delivery_date DESC 또는 total_count DESC만 적용되어 "상위 10건" 의미가 불명확했음.
   - 변경: 항상 **발송성공 수(success_count) DESC**를 1차 정렬로 적용. 일자 그룹 시 2차로 delivery_date DESC 추가하여 동일 성공 수 내에서는 최신 일자 순.

2. **Backend (dashboard_service.py)**
   - ORDER BY를 `success_count DESC` 고정 후, `group_by.date`일 때만 `delivery_date DESC` 추가.
   - 주석: "기준별 발송현황 차트 상위 N건: 발송성공 수(success_count) 기준으로 통일".

3. **Frontend (AggregatedBarChart.jsx)**
   - 차트 제목: "기준별 발송 현황 (상위 10건)" → **"기준별 발송 현황 (발송성공 수 상위 10건)"**으로 변경하여 사용자에게 정렬 기준 명시.
   - 데이터 표시 전 `[...data].sort((a,b) => (b.success_count ?? 0) - (a.success_count ?? 0))` 적용 후 slice(0, TOP_N)으로, 백엔드와 동일 기준을 프론트에서도 보장.

### 검수 결과
- Lint: AggregatedBarChart.jsx, dashboard_service.py 오류 없음.

### 비고
- 발송요청 수(total_count)가 아닌 발송성공 수(success_count)를 기준으로 한 이유: "발송 현황"에서 실제 전달된 양을 기준으로 상위를 보여주는 것이 더 직관적이라 판단.

---

## 2025-02-02: Git 커밋 및 푸시 (전체 변경사항 반영)

### 완료 작업
1. **스테이징**
   - `git add -A`로 수정·삭제·추가된 모든 파일 스테이징
   - Backend: dashboard_service.py 신규, main.py·routes.py 수정
   - Frontend: packages/dashboard·packages/report·shared 이동/추가, 삭제된 src/components·api·config·utils 반영
   - 기타: run.py, requirements.txt, static_server/main.py, vite.config.js, docs/report/log.md

2. **커밋**
   - 커밋 해시: d685c25
   - 메시지: feat: React 대시보드 통합 및 UI/UX 개선 (Backend 대시보드 API, Frontend 패키지 구조·대시보드·필터·페이징·검색·ChartWidget·Report 헤더 정리, static_server 포트 대체, run.py 빌드 연동)

3. **푸시**
   - `git push origin main` 성공
   - 원격: https://github.com/GwanHong/IBANK_TEST_PROJECT_001.git (3204bc1..d685c25 main -> main)

### 검수 결과
- 32 files changed, 2984 insertions(+), 371 deletions(-)
- rename/delete/add 모두 반영됨, 누락 없음

### 비고
- 한글 커밋 메시지가 터미널 출력에서 깨져 보일 수 있으나, 원격 저장소에는 UTF-8로 저장됨.

---

## 2025-02-02: 대시보드 폰트·X축 라벨·필터 연동·테이블 페이징·검색

### 완료 작업
1. **KPI 이하 폰트 2pt 증가**
   - KPICards: 제목 17px, 라벨 14px, 숫자 24px/15px
   - ChannelDonutCharts: 제목 16px, 범례 14px, 합계 13px
   - AggregatedBarChart: 제목 17px, 축/툴팁/범례 13~14px
   - AggregatedDataTable: 제목 17px, 테이블 14px, 셀 패딩 10px
   - ChartWidget: 제목 16~17px, 셀렉트/버튼 14~15px

2. **기준별 발송현황 X축: groupBy 전체 조합으로 중복 없이 라벨**
   - AggregatedBarChart: getXKey 단일 키 제거, getCompositeXLabel(row, groupBy) 추가
   - groupBy에 적용된 컬럼만 순서대로(일자→캠페인→워크플로우→채널) 조합해 "일자 / 채널" 등 고유 라벨 생성
   - 일자별+채널별 선택 시 "2026-02-04 / Email", "2026-02-04 / SMS" 형태로 X축에 중복 없이 표시

3. **필터 옵션 연동 (선택된 컬럼에 따라 다른 옵션만 표시)**
   - Backend: get_filter_options(table_id, campaign_ids, workflow_ids, channels) 추가, _build_where_and_params로 캠페인/워크플로우/채널 쿼리별 WHERE 적용(캠페인 목록은 워크플로우·채널 기준, 워크플로우는 캠페인·채널 기준, 채널은 캠페인·워크플로우 기준)
   - routes: GET filter-options 쿼리 파라미터 campaign_ids, workflow_ids, channels 파싱 후 전달
   - Frontend: getDashboardFilterOptions(tableId, filters) 호출 시 선택값 쿼리스트링으로 전달
   - DashboardPage: tableId 및 filters.campaign_ids/workflow_ids/channels 변경 시 필터 옵션 재조회, 옵션 목록에 없는 선택값은 setFilters로 제거(루프 방지 위해 길이 변경 시에만 setFilters)

4. **집계 데이터 테이블: 50건 페이징 + 테이블 내 검색**
   - PAGE_SIZE 50, page state, filteredData(useMemo로 검색어 필터), pageData = filteredData.slice(startIdx, startIdx+PAGE_SIZE)
   - 검색: rowMatchesFilter(row, filterText, groupBy)로 캠페인/일자/워크플로우/채널/숫자 컬럼 텍스트 매칭(해당 테이블에서만 적용, 다른 집계에는 미적용)
   - 상단에 "테이블 내 검색" 입력창, "N건 중 start-end (페이지 p/total)" 표시, 이전/다음 버튼
   - data.length 또는 groupBy 변경 시 page 1로 리셋

### 검수 결과
- Lint: AggregatedBarChart, AggregatedDataTable, DashboardPage, ChartWidget, KPICards, ChannelDonutCharts 대상 오류 없음
- Backend: dashboard_service get_filter_options, routes _parse_int_list 추가

### 비고
- 필터 연동으로 캠페인 C001 선택 시 워크플로우는 C001에 존재하는 것만 노출되어 "데이터가 없다" 조합 방지.

---

## 2025-02-02: 대시보드 스크롤·기본 일자·차트 위젯

### 완료 작업
1. **대시보드 스크롤**
   - App.jsx: 레이아웃을 flex 컨테이너(height 100vh)로 감싸고, nav는 flexShrink 0, main은 flex 1 + overflowY auto + minHeight 0으로 설정
   - 아래로 내려갈수록 스크롤 생성되어 전체 콘텐츠 확인 가능

2. **기본 일자**
   - DashboardPage getDefaultDateRange(): 시작일·종료일 모두 오늘 날짜로 반환하도록 변경 (기간이 아닌 최신일=오늘 기본)

3. **나만의 차트 위젯 (ChartWidget.jsx)**
   - 집계 데이터(aggregated_data) 기반으로 사용자가 차트를 추가·삭제·설정
   - X축: 일자·캠페인·워크플로우·채널 등 어떤 데이터 타입이든 선택 가능
   - Y축: 실수형만(발송요청·발송성공·오픈·클릭·성공률·오픈률·클릭률 등)
   - 차트 유형: 막대(bar)·선형(line)·영역(area) 선택, recharts BarChart/LineChart/AreaChart 사용
   - 위젯별 X/Y/차트유형 셀렉트 및 삭제 버튼, "차트 추가"로 위젯 추가
   - DashboardPage 하단에 ChartWidget 섹션 배치, chartWidgets state로 관리

### 검수 결과
- Lint: App.jsx, DashboardPage.jsx, ChartWidget.jsx 대상 오류 없음

### 비고
- 기존 KPI·채널 도넛·기준별 막대·집계 테이블은 그대로 두고, 가장 아래에 위젯 영역을 추가해 원하는 차트를 꾸며나가는 구조.

---

## 2025-02-02: 대시보드 UI 디자인 개선 (필터·KPI·차트 레이아웃)

### 완료 작업
1. **헤더 필터 UI 현대화 (DashboardHeader.jsx)**
   - 캠페인·워크플로우·채널 셀렉트 박스: 3열 그리드(1fr 1fr 1fr), minWidth 260px, width 100%로 텍스트 잘림 방지
   - 테이블/기간/조회: 패딩·폰트·버튼 스타일 정리, border-radius 8~10px, box-shadow 적용
   - 집계 기준 체크박스: 2행에 배치(테이블 라인과 컬럼 선택 라인 사이), width 100%, justifyContent flex-start로 좌측 정렬
   - 900px 이하에서 필터 3열 → 1열로 반응형 전환

2. **KPI 영역 전체 폭 사용 (KPICards.jsx + dashboard.css)**
   - 섹션에 kpi-cards-section, 그리드에 kpi-grid 클래스 적용
   - grid-template-columns: repeat(6, 1fr)로 6개 카드가 화면 좌우 꽉 채움
   - 1200px 이하 3열, 768px 이하 2열 미디어 쿼리

3. **채널 도넛 차트·막대 차트 잘림 방지**
   - ChannelDonutCharts: donut-row 그리드(auto-fit, minmax(320px,1fr)), donut-block minWidth 0, ResponsiveContainer height 240
   - dashboard.css: channel-donut-charts-section, aggregated-bar-chart에 width 100%, overflow visible

4. **대시보드 전용 스타일 (dashboard.css)**
   - .dashboard-page, .dashboard-header 전체 폭
   - 필터 셀렉트 클래스별 minWidth 260px, box-sizing border-box
   - DashboardPage.jsx에 dashboard.css import, 루트 div에 width/maxWidth 100%, boxSizing border-box

### 검수 결과
- Lint: DashboardHeader, KPICards, ChannelDonutCharts, DashboardPage 대상 오류 없음
- 집계 체크박스 해제 시 해당 셀렉트 비활성화·필터 초기화 로직은 기존 유지

### 비고
- 상단 필터는 3행 구조 유지(테이블 라인 → 집계 기준 라인 → 컬럼 선택 라인). 집계 기준은 2행에 좌측 정렬로 “테이블과 컬럼 선택 사이”에 명확히 배치.

---

## 2025-02-02: PRD 작성 및 아키텍처 재구성

### 완료 작업
1. **PRD 문서 작성**
   - docs/report/01_PRD.md 생성 (docs/main 기반)
   - 기본 아키텍처: Project / Frontend, Backend, Env 패키지, Env/config config.json (backend{}, frontend{})

2. **패키지 폴더 및 Env config**
   - Frontend/, Backend/, Env/ 패키지 생성
   - Env/config/config.json: backend (api_port, db_*, allowed_tables, claude_* 등), frontend (static_port, main_page, api_base_url)
   - Env/config/loader.py: config.json 로드 후 config.backend / config.frontend attribute 접근

3. **Backend api_server 분리 및 Env 연동**
   - Backend/api_server/main.py: Flask 앱, CORS, 라우트 등록, config.backend 로 host/port
   - Backend/api_server/db.py: get_db_connection, format_value, validate_*, config.backend 사용
   - Backend/api_server/routes.py: health, list-tables, describe-table, table-relationships, execute-query, explain-sql, get-column-values, query-stats
   - 각 모듈에서 Env config import 후 config.backend.xxx 사용

4. **Frontend static_server 및 HTML/CSS/JS 분리**
   - Frontend/static_server/main.py: config.frontend.static_port, main_page, DIR=Frontend 패키지 디렉터리
   - Frontend/index.html: 템플릿(구조만), link href="static/css/main.css", script src="static/js/app.js"
   - Frontend/static/css/main.css: 기존 인라인 스타일 분리
   - Frontend/static/js/app.js: 기존 인라인 스크립트 분리, API_BASE_URL은 window.APP_CONFIG?.apiBaseUrl 또는 기본값

5. **실행 스크립트**
   - start.bat: 프로젝트 루트에서 `python run.py back`, `python run.py front` 실행 (통합 진입점 run.py)

### 검수 결과
- Env config 로드 정상 (backend. api_port 5001, frontend.static_port 8080)
- Frontend serve: DIR=Frontend, index.html / static/css/main.css / static/js/app.js 존재 확인
- Lint: Backend, Env, Frontend static_server 대상 오류 없음

### 비고
- 루트 run.py는 API·웹 통합 진입점 (python run.py back | front). 실제 앱·라우트·DB는 Backend/api_server/, 정적 서빙은 Frontend/static_server/ 에만 있음.
- Backend 실행 시 Flask 등 의존성은 `pip install -r requirements.txt` 필요.

---

## 2025-02-02: 가상환경 설치 및 실행 테스트

### 순차 테스트 과정
1. **Python 가상환경 생성**  
   - `python -m venv .venv` (프로젝트 루트에 .venv 생성)

2. **의존성 설치**  
   - `.venv\Scripts\Activate.ps1` 후 `pip install -r requirements.txt`  
   - flask, flask-cors, psycopg2-binary, python-dotenv, requests 설치 완료

3. **Backend API 서버 실행**  
   - `python run.py back` (백그라운드, Backend.api_server.main 실행)  
   - 포트 5001 리스닝 확인  
   - `/health` 호출 시 DB 미설정으로 `unhealthy` 반환 (예상 동작)

4. **Frontend 웹 서버 실행**  
   - `python run.py front` (백그라운드, Frontend.static_server.main 실행)  
   - 포트 8080 리스닝 확인  
   - `http://localhost:8080/` 요청 시 Frontend/index.html 정상 응답 확인

5. **start.bat 수정**  
   - 새 창에서 `.venv\Scripts\activate` 후 API/웹 서버 실행하도록 변경

### 검증 결과
- 가상환경(.venv) 생성 및 requirements.txt 설치 성공
- API 서버(5001), 웹 서버(8080) 정상 기동
- 브라우저에서 **http://localhost:8080** 접속 시 쿼리 빌더 화면 표시 가능 (DB 설정 시 테이블 로드 등 API 연동 정상 동작)

---

## 2025-02-02: config.json 적용 설정 점검 및 로딩 정리

### 완료 작업
1. **Frontend static_server (main.py)**
   - 서빙 디렉터리를 config.frontend.static_dir 기준으로 변경: `DIR = project_root / static_dir` (기본값 'Frontend')
   - config.frontend.api_base_url 을 프론트에 주입하기 위해 `/api-config.js` 동적 응답 추가: `window.APP_CONFIG = { apiBaseUrl }` 반환

2. **Frontend index.html**
   - `api-config.js` 스크립트를 app.js 이전에 로드하여, config.json의 frontend.api_base_url 이 앱에서 사용되도록 함

3. **config.json 적용 현황**
   - backend: api_host, api_port → main.py / db_* → db.py / allowed_tables, table_schema → db.py / query_timeout_seconds, claude_api_key, claude_api_url → routes.py
   - frontend: static_port, main_page, static_dir, api_base_url → main.py (api_base_url 은 api-config.js 로 주입)

### 검수 결과
- Env/config/loader.py: project_root 기준 config.json 탐색 유지, 수정 없음
- Backend db/main/routes: 기존 config.backend 사용 유지
- Lint: Frontend/static_server/main.py 오류 없음

---

## 2025-02-02: api_server.py 배치 및 Backend 단일 구현 정리

### 완료 작업
1. **루트 run.py 배치 (구 api_server.py → run.py 로 변경)**
   - 위치: 프로젝트 루트 (최적). `python run.py` 한 줄로 실행 가능.
   - 역할: Backend 진입점(launcher)만 담당. sys.path에 프로젝트 루트 추가 후 runpy.run_path(Backend/api_server/main.py) 로 Backend 실행. 실제 앱·라우트·DB 로직 없음.

2. **연결 점검 (한 줄씩)**
   - run.py: sys.path 삽입 → runpy.run_path(Backend/api_server/main.py) → main 의 `if __name__ == '__main__'` 블록 실행.
   - Backend.api_server.main: Env config, db, routes import → register_routes(app) → host/port는 config.backend → app.run().
   - Backend.api_server.db: Env config 로드, get_db_config/get_allowed_tables/get_table_schema, get_db_connection, format_value, validate_table_name/validate_column_name.
   - Backend.api_server.routes: register_routes(app) 내부에서 db 사용, config.backend (query_timeout_seconds, claude_api_key, claude_api_url) 사용. 엔드포인트: /health, /api/list-tables, describe-table, table-relationships, execute-query, explain-sql, get-column-values, query-stats.

3. **Backend 하위 겹침 정리**
   - Backend/api_server/ 에만 구현 존재. main.py(Flask+CORS+/, /api+에러핸들러), db.py(DB+검증), routes.py(API 라우트). 겹치는 코드 없음. 루트 run.py는 호출만 담당.

4. **start.bat**
   - API 서버: `python run.py back`, 웹 서버: `python run.py front` 로 통일.

### 검수 결과
- `python run.py back` 실행 시 Backend.api_server.main 이 __main__ 으로 실행되어 동일 동작.
- Backend 내부: main → db, routes; routes → db, config. 단일 구현, 중복 없음.

---

## 2025-02-02: api_server.py → run.py 변경 및 의존 코드 수정

### 완료 작업
1. **루트 진입점 파일명 변경**
   - api_server.py 삭제, run.py 생성 (동일 로직: sys.path + runpy.run_path(Backend/api_server/main.py)).

2. **run.py 의존 코드 점검 및 수정**
   - start.bat: `python api_server.py` → `python run.py`
   - docs/report/log.md: 루트 진입점 관련 문구 api_server.py → run.py
   - docs/README.md: 실행 예시·파일 구조·트러블슈팅에서 api_server.py → run.py
   - docs/main/CURSOR_SPEC.md: api_server.py → run.py
   - README.md: 실행 예시·프로젝트 구조에서 api_server.py → run.py, 포트 5000 → 5001 안내 보강

### 검수 결과
- Backend/api_server/ 패키지명·모듈명은 유지 (Python 패키지 경로 변경 없음).
- run.py 실행 시 동작은 기존과 동일.

---

## 2025-02-02: serve.py 용도 정의·위치 검증 및 Frontend static_server 정리

### 용도 정의
- **루트 serve.py**: (이후 run.py 통합으로 제거됨) 프론트엔드 정적 서버 루트 진입점이었음.
- **Frontend/static_server/main.py**: **정적 HTTP 서버 진입점**. Env config.frontend(static_port, main_page, static_dir, api_base_url) 사용, Frontend 디렉터리 서빙, /api-config.js 동적 응답, / → main_page, favicon 204.

### 위치 검증
- **Frontend/static_server/main.py**: Frontend 패키지 내 static_server 에 두는 것이 적절. 서빙 대상(Frontend/index.html, static/)과 같은 패키지 하위에 있음. 이동 불필요.

### 완료 작업 (당시)
1. 루트 serve.py를 진입점으로 변경 후, run.py 통합 시 제거.
2. Frontend/static_server/main.py: api-config.js 응답 본문 생성 로직을 `_build_api_config_js(api_base_url)` 함수로 분리.

---

## 2025-02-02: run.py 통합 진입점 (api + serve)

### 완료 작업
1. **run.py와 serve.py를 하나로 통합**
   - run.py: 서브커맨드 `back` | `front` 지원. `python run.py` → 사용법 출력, `python run.py back` → Backend 실행, `python run.py front` → Frontend/static_server/main.py 실행.
   - (구 serve.py → main.py 로 파일명 변경됨.)

2. **start.bat**
   - `python run.py` → `python run.py back`, `python serve.py` → `python run.py front` 로 변경.

3. **진입점 패키지 미도입**
   - 진입점이 api·serve 두 가지뿐이고, 한 파일(run.py)로 충분하므로 별도 패키지(entry/ 등)는 두지 않음. 추후 서브커맨드가 많아지면 `python -m entry api|serve` 형태의 패키지로 분리 검토 가능.

---

## 2025-02-02: React 전환 Phase 1 — React 프로젝트 초기화 및 최소 셸

### 완료 작업
1. **Vite+React 프로젝트 생성**
   - `Frontend/react-app` 생성 (npm create vite@latest -- --template react)
   - package.json, vite.config.js, index.html(root), src/main.jsx, src/App.jsx

2. **전역 스타일 연동**
   - 기존 `Frontend/static/css/main.css` 내용을 `Frontend/react-app/src/styles/main.css`로 복사·연동
   - main.jsx에서 `import './styles/main.css'` 추가
   - index.css는 #root 높이만 지정하여 main.css가 전역으로 적용되도록 정리

3. **최소 셸 UI**
   - App.jsx: 헤더만 표시, 제목 "🔍 스타벅스 CRM 쿼리 빌더" (Backend 호출 없음)
   - index.html: title·lang "스타벅스 CRM 쿼리 빌더", lang="ko"

### 추가/변경된 파일
- **추가**: Frontend/react-app/ (전체), Frontend/react-app/src/styles/main.css
- **변경**: Frontend/react-app/src/App.jsx, src/main.jsx, src/index.css, index.html

### 검증 결과
- `npm run build` 성공 (dist/index.html, dist/assets/*.css, *.js 생성)
- Lint: App.jsx, main.jsx 오류 없음
- 의존성: Phase 1은 Backend 연동 없음(의존성 최소)

### 비고
- 정적 서빙(운영 시 React 빌드 결과 서빙)은 Phase 5에서 static_server 정리 시 반영 예정.
- 개발 시에는 `cd Frontend/react-app && npm run dev` 로 Vite dev server 사용 가능.

---

## 2025-02-02: React 전환 Phase 2 — API 클라이언트 및 설정 모듈

### 완료 작업
1. **계획서 경로 반영**
   - REACT_MIGRATION_PLAN.md는 docs/report 에 있음(사용자 이동). 해당 경로 기준 진행, 변경 이력에 반영.

2. **api_base_url 설정 모듈**
   - `Frontend/react-app/src/config/api.js`: getApiBase() — window.APP_CONFIG.apiBaseUrl(정적 서빙 시, config.json 기반) 또는 기본값 http://localhost:5001. (.env 미사용, 프로젝트 정책: Env/config/config.json)

3. **API 클라이언트 모듈**
   - `Frontend/react-app/src/api/client.js`: health, listTables, describeTable, tableRelationships, executeQuery, explainSql, getColumnValues, queryStats (fetch 래퍼, request() 공통)
   - 기존 Frontend/static/js/app.js 의 API 호출 패턴 참고하여 구현

4. **API 연결 테스트 UI**
   - App.jsx: API 연결 테스트 버튼 추가, health() 호출 후 결과 표시, getApiBase() 표시

### 추가/변경된 파일
- **추가**: Frontend/react-app/src/config/api.js, Frontend/react-app/src/api/client.js
- **변경**: Frontend/react-app/src/App.jsx, docs/report/REACT_MIGRATION_PLAN.md (변경 이력)

### 검증 결과
- `npm run build` 성공
- Lint: App.jsx, api/client.js, config/api.js 오류 없음
- API 클라이언트 단위로 Backend(5001) 호출 시: 브라우저에서 "API 연결 테스트" 클릭 시 health 응답 확인 가능

### Frontend 정리 (Phase 2 범위)
- 기존 Frontend/index.html, static/js/app.js, static/css/main.css 는 Phase 5에서 React 서빙 전환 시 제거·보관 예정. Phase 2에서는 API 로직만 React 쪽으로 이전·참고했으며, 레거시 파일 삭제 없음.
- docs/report/REACT_MIGRATION_PLAN.md 변경 이력에 "docs/report 로 이동" 명시.

---

## 2025-02-02: React 전환 Phase 3 — 레이아웃 및 독립 컴포넌트 (DB 상태·테이블 목록)

### 완료 작업
1. **환경·gitignore 정책 문서화**
   - docs/main/PRD.md 3.3 추가: .env 미사용, .gitignore는 프로젝트 루트에만 둠.

2. **레이아웃 컴포넌트**
   - Header.jsx: 앱 제목, API 연결 테스트(health)
   - Sidebar.jsx: DB 상태(health), 테이블 목록(list-tables), 테이블명 검색, 테이블 펼치기/접기, 컬럼 목록(describe-table)
   - MainArea.jsx: 플레이스홀더 (Phase 4에서 그리드·SQL 패널 연동)
   - App.jsx: Header + container(Sidebar + MainArea) 구성

3. **Sidebar 데이터 로드**
   - 마운트 시 health() → listTables() → 각 테이블 describeTable() 호출, 테이블·컬럼 상태 유지
   - 검색: 테이블명 필터, 펼치기/접기: tableExpanded 상태

### 추가/변경된 파일
- **추가**: Frontend/react-app/src/components/Header.jsx, Sidebar.jsx, MainArea.jsx
- **변경**: Frontend/react-app/src/App.jsx, docs/main/PRD.md (3.3 환경·gitignore 규칙)

### 검증 결과
- `npm run build` 성공
- Lint: App.jsx, Header.jsx, Sidebar.jsx, MainArea.jsx 오류 없음
- 화면: DB 상태·테이블 목록·검색·펼치기/접기·컬럼 목록 표시, Backend(health, list-tables, describe-table) 통신 정상

---

## 2025-02-02: React 전환 Phase 4 — 그리드·필터·SQL 패널·실행

### 완료 작업
1. **SQL 생성 유틸**
   - Frontend/react-app/src/utils/sqlBuilder.js: getJoinKey, generateSQL, generateCountSQL (tableRelationships, filters, orderBy, pagination 반영)

2. **App 상태·로드**
   - App.jsx: 데이터 로드(health, list-tables, describe-table, table-relationships) → tables, tableRelationships, dbStatus
   - 상태: gridColumns, addedTables, filters, orderBy, resultData, currentPage, pageSize, totalCount, executedSql, explanation, toast
   - 콜백: addColumn, moveColumn, runExecuteQuery, addFilter/removeFilter, addOrderBy/removeOrderBy, setPage/setPageSize, copySql, explainSql, clearAll
   - 컬럼 추가 시 자동 실행(useEffect), Header에 초기화·실행 버튼

3. **Sidebar (Phase 4 확장)**
   - tables, tableRelationships, addedTables를 props로 수신 (로드는 App에서 수행)
   - JOIN 가능 테이블만 활성화: isTableAvailable(tableName, addedTables, tableRelationships)
   - 컬럼 드래그: dataTransfer에 application/json으로 { table, column, type } 전달

4. **MainArea (그리드·필터·SQL·페이지네이션)**
   - 그리드 영역: 컬럼 드롭(onDrop → onAddColumn), 빈 상태 문구, 결과 테이블
   - 그리드 헤더: 드래그 재정렬(draggedColumnIndex, onMoveColumn)
   - WHERE/ORDER BY 칩 UI: 필터·정렬 추가/제거, 인라인 필터·ORDER BY 추가 폼
   - 페이지네이션: 처음/이전/다음/마지막, 페이지 표시, 페이지 크기 선택
   - SQL 패널: 실행된 SQL 표시, 복사, 🤖 해석(explain-sql), Claude 해석 영역

### 추가/변경된 파일
- **추가**: Frontend/react-app/src/utils/sqlBuilder.js
- **변경**: Frontend/react-app/src/App.jsx (상태·로드·콜백 통합), Header.jsx (onExecute, onClearAll), Sidebar.jsx (props 기반, JOIN 활성화, 드래그), MainArea.jsx (그리드·필터·ORDER BY·페이지네이션·SQL 패널)

### 검증 결과
- `npm run build` 성공
- Lint: App.jsx, Header, Sidebar, MainArea, utils/sqlBuilder 오류 없음
- 검수: 테이블 선택 → 컬럼 드래그 → 실행 → 결과·SQL 표시, Backend(execute-query, explain-sql) 통신 정상

---

## 2025-02-03: React 전환 Phase 5 — 스타일·에러 처리·정리 및 Frontend 전체 점검

### Phase 5 완료 작업
1. **에러/로딩 메시지**
   - App.jsx: 테이블 로드 실패 시 토스트 표시, cleanup 시 toastTimeout 해제
   - API 실패 시 기존 토스트·사이드바 메시지 유지

2. **static_server: React 빌드 서빙·SPA fallback**
   - config.frontend.static_dir: 기본값/예시를 `Frontend/react-app/dist` 로 변경 (config.json, config.json.example)
   - SPA fallback: 존재하지 않는 경로 요청 시 index.html 응답 (_path_under_dir로 path traversal 방지)
   - index.html 응답 시 api-config.js 스크립트 주입 (_inject_api_config_into_index) — 빌드 결과에 스크립트 미포함 대비

3. **레거시 보관**
   - Frontend/index.html, static/js/app.js, static/css/main.css → Frontend/legacy/ 로 이동 (이후 상용화 정리로 legacy 삭제)
   - Frontend/react-app/src/App.css 삭제 (미사용)

4. **react-app index.html**
   - api-config.js 스크립트 태그 제거 (Vite 번들 경고 방지, static_server 주입으로 대체)

### Frontend 전체 점검·정리
- **의존성**: App → Header, Sidebar, MainArea, api/client, utils/sqlBuilder. Sidebar → tables, tableRelationships, addedTables(prop). MainArea → gridColumns, filters, orderBy 등(prop). api/client → config/api. 연결 정상.
- **불필요 코드**: MainArea에서 미사용 prop tableRelationships 제거. App.css 삭제.
- **파일 정리**: Frontend/__init__.py 설명 갱신 (react-app·static_server). Frontend/static/ 하위 파일은 legacy로 이동 후, 상용화 정리 시 legacy 삭제.
- **에러 유발 요인**: Lint 오류 없음. 빌드 성공. static_server index 주입·SPA fallback 적용.

### 추가/변경/삭제된 파일
- **추가 후 삭제**: Frontend/legacy/ (Phase 5에서 보관, 상용화 정리 시 삭제)
- **변경**: Frontend/react-app/index.html, App.jsx, MainArea.jsx, static_server/main.py, Env/config/config.json, config.json.example, Frontend/__init__.py
- **삭제**: Frontend/index.html, Frontend/static/js/app.js, Frontend/static/css/main.css, Frontend/react-app/src/App.css

### 검증 결과
- `npm run build` 성공 (api-config.js 경고 제거 후 재빌드)
- Lint: Frontend/react-app/src, static_server/main.py 오류 없음
- 전체 플로우: React 빌드 → static_server(Frontend/react-app/dist) 서빙 → api-config.js 주입·SPA fallback 동작

---

## 2025-02-03: run.py front 통합·index.html 설명·Frontend 정리

### run.py front 통합
- `python run.py front` 실행 시 **한 번에**: (1) `Frontend/react-app`에서 `npm run build` 실행, (2) 빌드 성공 후 `Frontend/static_server/main.py` 기동
- 별도 `cd Frontend/react-app && npm run build` 후 `python run.py front` 할 필요 없음

### index.html 두 파일 존재 이유 (둘 다 필요, 중복 아님)
- **Frontend/react-app/index.html**: **소스(템플릿)**. Vite가 `npm run build` / `npm run dev` 시 참조하는 HTML 진입점. `<script src="/src/main.jsx">` 등이 있으며, Vite가 이 파일을 기반으로 **dist/index.html을 생성**함. 삭제하면 빌드·개발 불가.
- **Frontend/react-app/dist/index.html**: **빌드 결과물**. `npm run build` 시 Vite가 **자동 생성**하는 파일. 소스 index.html을 변환한 결과로, 해시된 JS/CSS 경로(`/assets/index-xxx.js`, `index-xxx.css`)가 들어감. static_server는 **dist/** 전체를 서빙하므로 이 파일을 응답함. .gitignore 대상이며, 다음 `npm run build` 시 다시 생성됨.
- **정리**: 소스(개발·빌드 입력) vs 빌드 결과(서빙용 출력) 관계이므로 **둘 다 유지**. 삭제 대상 없음.

### Frontend 정리
- **삭제**: 빈 폴더 `Frontend/static` (및 하위 static/js, static/css) — 레거시 파일을 legacy로 이동한 뒤 남은 빈 디렉터리.
- **유지**: react-app(소스·빌드), static_server(서빙), __init__.py. legacy는 상용화 정리로 삭제(참고용 보관 불필요).

---

## 2025-02-03: Frontend/legacy 삭제 (상용화 정리)

- **삭제**: Frontend/legacy/ 전체 (index.html, README.md, static/css/main.css, static/js/app.js). 구 HTML/CSS/JS 참고용 보관 불필요, 패키지 정리.
- **변경**: Frontend/__init__.py에서 legacy 언급 제거, docs/report/log.md Phase 5·정리 문구에 legacy 삭제 반영.
- **정책**: 사용되지 않을 코드·파일은 남기지 않음. 백업은 요청 시에만.

---

## 2025-02-03: README·requirements·docs/main 반영 및 Git 푸시

- **README.md**: 현재 구성 반영 (React 프론트엔드, run.py front 빌드 후 서버, 프로젝트 구조, config.json·static_dir, .env 미사용)
- **requirements.txt**: Backend 의존성 주석 추가 (flask, flask-cors, psycopg2-binary, requests)
- **docs/main/PRD.md**: 패키지 구조(Frontend/react-app, static_server), 실행 방식(run.py front 시 npm run build), frontend config(static_dir=Frontend/react-app/dist), Frontend 4.2·4.3, 변경 이력(React 전환) 반영
- **Git**: 모든 변경사항 커밋 후 origin main 푸시 완료 (c593353..705e16d)

---

## 2025-02-02: README·requirements·docs/main 현재 구성 재점검 및 명세서 React 참고 문구 추가

- **README.md / requirements.txt**: 이미 현재 구성(React 프론트엔드, run.py front 빌드·정적 서버, config.json·.env 미사용) 반영 확인, 수정 없음
- **docs/main**: PRD.md는 이미 React·static_server·config 반영 상태. 명세서 문서에 현재 구현 참고 문구 추가:
  - **ADVANCED_FEATURES.md**: 상단에 "현재 구현: React(Vite), Frontend/react-app, 본 문서는 기능 명세용" 문구 추가
  - **CURSOR_SPEC.md**, **CURSOR_SPEC_V2_SIMPLIFIED.md**: 프로젝트 개요 하단에 "현재 구현: React(Vite), Frontend/react-app, 아래 HTML/구조는 명세 참고용" 문구 추가
- **docs/report/log.md**: 본 작업 완료 로그 갱신
- **Git**: 변경사항 커밋 후 푸시

---

## 2025-02-02: Frontend 패키지화 — 리포트 패키지 분리·대시보드 플레이스홀더·라우팅

- **공용(shared)**: `src/shared/api/client.js`, `src/shared/config/api.js` — 리포트·대시보드 등 모든 페이지에서 사용하는 API 클라이언트·설정
- **리포트 패키지**: `src/packages/report/` — 쿼리 빌더 페이지. ReportPage.jsx, components(Header, Sidebar, MainArea), utils/sqlBuilder.js. shared API·config 사용, `@/shared/...` alias로 import
- **대시보드 패키지**: `src/packages/dashboard/` — DashboardPage.jsx 플레이스홀더. 추후 사용자 제공 코드로 교체
- **App.jsx**: BrowserRouter + 상단 네비(리포트 | 대시보드) + Routes: `/` → `/report`, `/report` → ReportPage, `/dashboard` → DashboardPage
- **vite.config.js**: resolve.alias `@` → `src` (ESM 호환: fileURLToPath로 __dirname 대체)
- **package.json**: react-router-dom 의존성 추가
- **삭제**: 기존 `src/api`, `src/config`, `src/components`(Header, Sidebar, MainArea), `src/utils/sqlBuilder.js` — report 패키지로 이전
- **유지**: `src/index.css`, `src/styles/main.css`, `src/main.jsx`, `src/App.jsx`, `src/assets` — 전역 스타일·앱 진입점
- **검증**: npm run build 성공, Lint 오류 없음

---

## 2025-02-02: 범용 대시보드 시스템 적용 (PRD 아키텍처 준수)

- **Backend (Flask·Env 연동, report와 분리)**  
  - **dashboard_service.py**: 대시보드 전용 비즈니스 로직. db.get_db_connection(), db.validate_table_name(), db.get_table_schema() 사용. GROUP BY(캠페인/일자/워크플로우/채널) 동적 생성, KPI·채널별 분포, get_filter_options.  
  - **routes.py**: POST /api/dashboard/data, GET /api/dashboard/filter-options/<table_id>, GET /api/dashboard/tables 등록. config·db만 사용, 기존 report 엔드포인트와 구분.  
  - **main.py**: API 안내에 대시보드 엔드포인트 추가.
- **Frontend (packages/dashboard, JSX·shared API)**  
  - **shared/api/client.js**: getDashboardData(body), getDashboardFilterOptions(tableId), getDashboardTables() 추가.  
  - **packages/dashboard**: DashboardPage.jsx(테이블 선택·필터·조회·KPI·집계 테이블), components/DashboardFilters.jsx, KPICards.jsx, AggregatedDataTable.jsx. 공용은 @/shared/api/client 사용, TypeScript·TanStack Query 미사용(useState/useEffect).  
- **검증**: Frontend npm run build 성공, Lint 오류 없음. Backend는 config.backend·allowed_tables 기준 테이블 검증.

---

## 2025-02-02: 대시보드 UI 구상 반영 (헤더 통합·추이/인사이트 미구현 명시)

- **1. 헤더에 테이블 셀렉트박스**: 대시보드로 볼 테이블을 여러 개 중 선택. DashboardHeader에 테이블 셀렉트 포함.
- **2. 전체 추이 그래프 삭제**: 여러 날짜 추이 그래프는 현재 미구현(추후 구현 예정). 코드에 해당 섹션 없음.
- **3. 인사이트 삭제**: 인사이트는 추후 AI 검토 예정. 코드에 인사이트 섹션 없음.
- **4. 헤더에 필터링 조건 통합**: 3번 참고 이미지처럼 헤더 한 블록에 테이블 선택 + 기간(날짜 범위) + 캠페인·워크플로우·채널 필터 + 집계 기준(GROUP BY) + 조회 버튼 배치. DashboardHeader.jsx 신규, DashboardPage에서 기존 테이블 행·DashboardFilters 카드 제거 후 DashboardHeader 사용. 필터 적용 시 해당 조건 데이터만 조회.
- **구성**: packages/dashboard/components/DashboardHeader.jsx 추가. DashboardPage는 헤더 → KPI 카드 → 집계 테이블만 표시. DashboardFilters.jsx는 유지(다른 뷰에서 사용 가능).

---

## 2025-02-02: 대시보드 시각 요소 추가 (차트·다이어그램)

- **목적**: KPI 숫자만이 아니라 차트·다이어그램으로 데이터 시각적 비교·분석 가능하도록 구성(참고 이미지 반영).
- **Recharts 추가**: package.json에 recharts 의존성 추가.
- **채널별 도넛 차트 (ChannelDonutCharts.jsx)**: KPI channel_distribution(발송 요청·발송 성공)을 도넛 차트로 표시. 채널별 비중·합계 표시, 툴팁·범례.
- **집계 막대 차트 (AggregatedBarChart.jsx)**: aggregated_data를 기준(일자/캠페인/채널 등)별 막대 차트로 표시. 발송 요청·발송 성공 막대, 상위 30건, groupBy에 따라 X축 라벨 결정.
- **KPI 카드 시각 강화 (KPICards.jsx)**: 카드별 배경색·테두리·아이콘·숫자 색상 적용(캠페인 수·발송 요청/성공/실패·오픈·클릭). 섹션 제목 "주요 지표".
- **DashboardPage**: 본문 순서 — 주요 지표(KPI) → 채널별 분포(도넛) → 기준별 발송 현황(막대) → 집계 데이터 테이블. AggregatedDataTable 섹션 스타일 통일(둥근 모서리·섹션 제목).
