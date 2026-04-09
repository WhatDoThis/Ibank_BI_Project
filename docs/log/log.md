# Log

## Log Index
308. 2026-04-09 프로젝트 하위 페이지 기준 정리: db_type 비노출·매핑 여부 중심
307. 2026-04-09 위젯보드/쿼리스튜디오: 매핑 db_type main·dash 동시 지원
306. 2026-04-09 위젯보드: 테이블 test_report_ 제한 해제·매핑 검증, 쿼리저장 매핑 upsert 재시도
305. 2026-04-09 위젯보드: 복수 일 차트 X축이 범주 컬럼으로 남는 문제(데이터 API 컬럼 타입·meta)
304. 2026-04-09 위젯보드: 설정 변경 후 데이터 조회 PATCH 레이스 수정
303. 2026-04-09 위젯보드 생성·설정 모달 UX: 크기·스크롤·오버레이 닫기 제거·차원/지표 라벨
302. 2026-04-09 위젯보드 목록 초대 모달: admin-org 스타일·레이아웃 정리
301. 2026-04-09 위젯보드 캔버스: 보드명 셸/브레드크럼·목록 링크 상단·카드 헤더 정리
300. 2026-04-09 위젯보드 삭제 확인 UI·목록 API: 알림 건수 제거·요약 2항목만
299. 2026-04-09 위젯보드 list_boards: psycopg2 LIKE 패턴 `%` 이스케이프(500 IndexError)
298. 2026-04-09 위젯보드 완전 삭제 확인 모달·목록 API 건수 필드
297. 2026-04-09 위젯보드 DELETE: 비활성 보드 물리 삭제(기존은 active_yn만 갱신되어 목록 불변)
296. 2026-04-09 위젯보드 목록 생성·수정 모달: 부서관리(admin-org) 모달 스타일 정합
295. 2026-04-09 위젯보드 목록 참여자 열: 인원 수 글씨 축소·버튼 수직 정렬
294. 2026-04-09 위젯보드 목록 모달: 오버레이 클릭 닫기·참여자/초대 이메일 열 말줄임
293. 2026-04-09 위젯보드 목록 테이블: 관리 페이지와 동일 ibank-btn-table·admin-users__actions
292. 2026-04-09 위젯보드: private/project·알림 초대·사용자관리 위젯보드 이관
291. 2026-04-09 위젯보드: share_scope 비사용·초대(widget_board_share)만 접근 제어
290. 2026-04-09 위젯보드 목록 페이지·참여자/초대 API·비활성·캔버스 라우트 분리
289. 2026-04-09 widget_item.create_user_id DDL·add_widget INSERT 반영
288. 2026-04-09 위젯보드: 설정 모달 통합·생성 시 지표/차원·기간 자동 집계
287. 2026-04-09 위젯 카드 헤더 기간 표시: 2행 레이아웃·짧은 부제·말줄임(가독성)
286. 2026-04-09 ETL DB 적재: column_mapping TEXT 오저장 시 소스 스키마로 타입 보정·타겟 TIMESTAMP 유지
285. 2026-04-09 위젯 카드 헤더에 조회 기간 부제 표시
284. 2026-04-09 위젯보드 data_config 기간·마법사 UI·saved_table 서버 필터
283. 2026-04-09 core/sql_safety 통합·shared queryStudioTableApi·위젯보드-쿼리스튜디오 경계 정리
282. 2026-04-09 위젯보드 FE 서버 연동·GET 보드 can_edit·API 가이드 §6.2
281. 2026-04-09 docs/report/20 §7.0 프로젝트 귀속·개인 보드 FE 명시
280. 2026-04-09 docs/report/20 §3.4 컬럼 사용 검증(위젯보드 테이블)
279. 2026-04-09 docs/report/20 설계서 최적화·S0~S8·ibank_system_data psql 절 추가
278. 2026-04-09 docs/report/20 위젯 보드 분리 설계서·ReportIndex 갱신
277. 2026-04-09 홈 위젯보드 카드 부가 설명을 widgetboard로 복구
276. 2026-04-09 위젯보드 패키지: Dashboard3Page → WidgetboardPage 명칭·문서 정합
275. 2026-04-09 docs/main/03_API_GUIDE.md §5.3 campaign_dash_server 라우터·흐름·보안 요약
274. 2026-04-09 docs/main/03_API_GUIDE.md §6.1 notification_server 요약·흐름·생성 경로
273. 2026-04-09 docs/main/03_API_GUIDE.md §6.1 query_studio 롤백(사용자 요청)
272. 2026-04-09 docs/main/03_API_GUIDE.md 서버 단위 재구성·project_server·중복 §8–10 제거
271. 2026-04-09 docs/main/03_API_GUIDE.md auth 비활성·권한·흐름 갱신·§9 명칭·표현 정리
270. 2026-04-09 docs/main/03_API_GUIDE.md 역할 문구·어드민 표·흐름 A–J·02 정합
269. 2026-04-09 docs/main/03_API_GUIDE.md 본문 작성·02_BACKEND_GUIDE 상호참조 갱신
268. 2026-04-02 docs/main 정합: AI 가이드 report 경로·03_API 예정·백엔드 §4.0·헤더 프로젝트 전환
267. 2026-04-08 대시보드·위젯보드 프로젝트 전환 시 데이터 재조회 보강
266. 2026-04-08 org 관리자 타부서 프로젝트 API 차단 복귀·작업프로젝트 드롭다운 목록 갱신
265. 2026-04-08 타부서 프로젝트 초대: sa/a 관리자도 참여자면 경로·멤버목록 허용
264. 2026-04-08 프로젝트 전환 자동 재조회·타부서(o) 멤버 API 허용
263. 2026-04-08 쿼리 스튜디오: 헤더 프로젝트 전환 시 빌더 초기화·테이블 재로드
262. 2026-04-08 헤더 작업 프로젝트 드롭다운(이메일·알림 사이)
261. 2026-04-08 알림: project_invite 수락 전·후 안내 문구 표시
260. 2026-04-08 타부서 초대 수락 후 JWT 프로젝트 미동기화로 기능 라우트 차단 수정
259. 2026-04-08 프로젝트 멤버 추가·강퇴·수락: 양측 알림
258. 2026-04-08 알림: 초대 수락·거절 완료 표시(행·토스트)
257. 2026-04-08 알림 패널: 내부용 JSON noti_content 비노출
256. 2026-04-08 notification_info update_dtm: 읽음·수락 갱신·목록 조회 정합
255. 2026-04-08 accept-invite: notification_info에 update_dtm 미존재 DB 호환
254. 2026-04-03 프로젝트 멤버 추가 API·UI: 타부서 초대 알림·멤버 추가 모달
253. 2026-04-02 프로젝트 초대: 만료(7일)·거절 API·초대자 수락/거절 알림·UI 만료 표시
252. 2026-04-02 프로젝트 타부서 초대: 멤버 목록 pending·초대 취소 API, 알림 수락 피드백·accept 400 통일
251. 2026-04-09 가입 페이지: 초대 메일 URL `?code=`·`invite_code=` 쿼리로 초대코드 자동 입력·유효성 힌트
250. 2026-04-09 사용자 초대: 발송 성공 시 완료 alert(모달 즉시 닫힘으로 안내 미노출 보완)
249. 2026-04-09 사용자관리 409 모달「목록 열고 이관」: 작업물 API 로드 누락 수정(이관 쿼리 NaN 방지)
248. 2026-04-09 Admin 프로젝트 목록: 사용자관리와 동일 작업 패턴(비활성 시 활성·삭제만)·수정 모달에서 활성 셀렉트 제거
247. 2026-04-09 비활성 프로젝트 가드: 권한 0·require_permission 403·선택(rotate) 차단·비활성화 후 refreshMe
246. 2026-04-09 Admin 프로젝트: 비활성만 DB 완전 삭제(purge)·참여·매핑·알림·초대 참조 선행 정리
245. 2026-04-09 사용자관리: 「초대자 등록상태」표기 통일(섹션·409·가드 문구)
244. 2026-04-09 프로젝트 참여 초대자 기록: 작업물·가드·project_invite 이관·무단 SQL 치환 제거
243. 2026-04-09 delete_inactive_user: project_ptcpnt_info.invite_user_id NOT NULL 위반 수정(이관 UPDATE)
242. 2026-04-02 ibank-btn-table--primary 제거(솔리드): 활성 버튼도 일반 액션 아웃라인·호버와 동일
241. 2026-04-02 ibank-btn-table: 일반 아웃라인 그린(#0a8f6e)·호버 채움 / danger 아웃라인 #fe5655·호버 채움
240. 2026-04-02 ibank-btn-table--danger: button 기본 규칙보다 낮던 특이도 보완·호버도 #dc2626 유지
239. 2026-04-02 어드민 테이블 파괴 액션 버튼: ibank-btn-table--danger 솔리드 레드(#dc2626) 통일
238. 2026-04-02 Admin 사용자관리: 비활성 행 작업 열 축소·비활성 사용자 DELETE·소유 가드 모달 분기
237. 2026-04-03 비활성(정지) 계정: 세션 무효·API·리프레시에서 user_active_yn 검사
236. 2026-04-03 프로젝트 유효 권한: sa_dev/sa/a 자동 UI 권한 확장 제거(pmssn∩feature_flags만)
235. 2026-04-02 ETL: 접이식 카드·목록 thead 테두리를 설명 열 헤더 톤(--etl-table-list-th-description-border)으로 통일
234. 2026-04-02 ETL 페이지: 설명을 소스 탭 아래 접이식 카드로 이동·탭 전환 떨림 완화
233. 2026-04-03 프로젝트 PATCH 후 현재 선택 프로젝트면 refreshMe — 네비·ProjectFeatureRoute와 /me 동기화
232. 2026-04-03 project_info.feature_flags: query·dash·widget DB 컬럼 기준으로 권한·어드민 API 통일(enabled_pages 제거)
231. 2026-04-03 enabled_pages: 홈 진입 경로·사이드바·ProjectFeatureRoute·프로젝트 수정 모달 통합
230. 2026-04-08 프로젝트 초대·멤버 검색: 일반 부서에서 개발부서(dptmt 0) 계정 비노출·API 차단
229. 2026-04-08 Admin 프로젝트 멤버: 검색 인풋·버튼 동일 라인(ap__member-add-inline)
228. 2026-04-08 Admin 프로젝트 멤버: 초대자·참여일시 열·권한 셀렉트·검색 행 정렬
227. 2026-04-08 Admin 프로젝트 목록 테이블: 프로젝트명·설명 열 분리·말줄임·작업 버튼 통일
226. 2026-04-03 프로젝트 생성 모달: 가로 폭 확대·바깥 클릭으로 닫힘 제거
225. 2026-04-03 고객여정 Phase 6: 프로젝트 생성 흐름을 create_project_full·accept-invite 기준으로 갱신
224. 2026-04-03 프로젝트 생성 전면 개편: creator_pmssn·테이블·멤버·타부서 초대·수락 API
223. 2026-04-03 ETL batch_target_registry: create_user_id SELECT 누락 보완·폴더 등록자 COALESCE로 생성자 이메일 보강
222. 2026-04-03 사용자관리: 등록 부서 목록·생성자 이관(dptmt_creator)·역할 변경 스마트 가드(409)
221. 2026-04-03 ETL 패키지: 생성자 본인 배지 정합(adminAccess·log219) 모듈 주석·Dependencies 보강
220. 2026-04-02 update_user_management 역할 UPDATE 들여쓰기 수정(허용 역할도 DB 미반영 버그)
219. 2026-04-03 생성자「본인」배지: /api/auth/me 의 email·user_id와 목록 FK 정합
218. 2026-04-03 ETL 등록·배치 Job 테이블: 생성자 열을 동작 열 바로 앞으로 이동
217. 2026-04-03 사용자 변경·정지: 소유 매트릭스 스마트 검사(409·blocking_assets)·ownership_guards
216. 2026-04-03 ETL 목록 동작 열: 글자 버튼 sm 크기 복구·×(행 삭제)만 소형 유지
215. 2026-04-03 ETL create_user_label: user_info JOIN만 쓸 때 core 보강 누락으로「ID n」표시되던 문제 수정
214. 2026-04-03 사용자 변경: 역할 미변경 시 소유물 검사 생략(etl_yn만 부여 가능)
213. 2026-04-03 ETL 등록·배치 Job 목록: 테이블 스크롤 래퍼 통일(etl-db-form__table-wrap)·새로고침 버튼 통일(ibank secondary)
212. 2026-04-03 ETL 관리자 표시·권한 정합: etl_yn vs 프로젝트 pmssn 안내·etl_manager 판별·u 역할 시 etl_yn 동기화
211. 2026-04-03 ETL 등록 목록: 새로고침 툴바를 테이블 가로 스크롤 밖으로 분리(ibank-btn-toolbar)
210. 2026-04-03 관리·ETL 생성자 열: 이메일 셀 패턴으로 통일(전원 배지 제거)
209. 2026-04-03 프로젝트 생성: 기본 pmssn_master 선택 로직 수정·오류 문구 정리
208. 2026-04-03 관리·ETL 테이블 작업 열 nowrap·가로 스크롤·생성자 admin-users 배지
207. 2026-04-03 ETL create_user_label: user_info 크로스 스키마 JOIN·core DB 보강
206. 2026-04-03 ETL UI: 테이블 동작 버튼 소형화·열 헤더「생성자」통일
205. 2026-04-03 Admin·ETL API: 목록 creator_email·create_user_label 이메일 우선
204. 2026-04-02 사용자관리: 본인 배지(이메일 옆)·작업 열 비활성 버튼 title 툴팁
203. 2026-04-02 docs/report: ETL 단일 스택 경로 정합(09·etc01·ReportIndex)
202. 2026-04-02 docs/main·README·requirements 정합(로그·코드 기준)
201. 2026-04-02 Backend 로깅 정리(포맷 유지·태그 메시지·노이즈 제거)
200. 2026-04-02 관리자 UI: ibank 버튼 통일·용어 ETL 관리자
199. 2026-04-02 사용자관리: ETL 작업물 대분류 묶음·대분류 전체이관·etl_infra 일괄 모달 문구
198. 2026-04-02 사용자관리: 전체이관 문구 명확화(카테고리 섹션만·다른 섹션 제외)
197. 2026-04-02 사용자관리 작업물 패널: 카테고리·하위목록 구분·등록한 권한·전체이관
196. 2026-04-02 ETL 이력 탭(JobHistoryPanel): 삭제·새로고침·상태 뱃지를 목록/배치와 통일
195. 2026-04-02 ETL 목록: 상태 뱃지·동작 버튼을 배치 Job 목록(etl-db-form)과 통일
194. 2026-04-02 ETL 패키지: 잔여 에메랄드·슬레이트·스카이 인라인 제거, 브랜드 토큰 통일
193. 2026-04-03 UI: 부서·권한·사용자·ETL 테이블/버튼 스타벅스 톤 정합(ibank-btn·ap__btn·etl-db-form__btn)
192. 2026-04-03 ETL 패키지 etl.css: design-tokens 브랜드 그린·중립 토큰 정렬
191. 2026-04-03 공용 shared-ui.css(툴바·테이블 버튼·데이터테이블)·ap__table 정합·admin-users 액션 호버
190. 2026-04-02 ETL 이력 탭: 라벨 열을 etl_tables.table_label로 표시(list_jobs JOIN)
189. 2026-04-02 부서: 셀렉트 display_label(상위·하위)·사용안함 시 사용자 이관 모달·PATCH migrate
188. 2026-04-02 사용자 역할 변경: 생성물 정합성(테이블마스터 단독 허용·ETL·etl_yn 해제)
187. 2026-04-02 사용자관리: 테이블마스터 연쇄 이관 안내에 ETL 테이블·Job·배치 식별 라벨
186. 2026-04-02 소유 이관 후보: 상·하위 부서 트리 동일 범위(ETL·테이블마스터·ETL 검증)
185. 2026-04-02 테이블마스터 이관: ETL 생성 테이블 연쇄 이관 + 목록 └ 하위 안내
184. 2026-04-02 사용자 목록 패널: 생성/등록 이력 없음 안내 문구 추가
183. 2026-04-02 사용자관리 SA 역할 변경 가드: dptmt_create_user_id 이관 안내·SA_DEV 마지막 SA 추가확인
182. 2026-04-02 DB 배치잡: apply_mapping_type_cast 전 `_override_mapping_types_for_transform_rules` (수동 적재와 정합)
181. 2026-04-02 DB ETL 적재: CREATE TABLE은 변환 룰 적용 컬럼만 df dtype, 나머지는 매핑 원본 타입
180. 2026-04-02 DB ETL 적재: 변환 룰 적용 컬럼은 apply_mapping_type_cast 전 매핑 type을 df dtype으로 오버라이드
179. 2026-04-02 DB ETL 적재: 변환 룰 후 columns_final을 DataFrame dtype 기준으로 DDL 결정
178. 2026-04-02 DB ETL 적재: column_mapping 시 COPY 행 값 누락(소스 키 vs 타겟 컬럼) 수정
177. 2026-04-02 사용자관리 변경 모달: ETL 인프라 자격(etl_yn) SA·SA_DEV 토글·change-options
176. 2026-04-02 ETL 삭제: 다운스트림(소스로 읽는 다른 ETL) 검사·거절
175. 2026-04-02 ETL 목록 삭제 실패 시 공유타겟 거절도 alert
174. 2026-04-02 ETL 삭제: 공유타겟·프로젝트매핑 차단·table_master·DROP 일괄
173. 2026-04-02 ETL 삭제: 배치 레지스트리 선삭제·DROP 생략 사유 응답·UI 안내
172. 2026-04-02 ETL 파일 배치: 변환 룰 정렬·load_dataframe 형변환 실패 전파
171. 2026-04-02 ETL 배치 적재: numpy 스칼라→psycopg2 바인딩(can't adapt numpy.int64)
170. 2026-04-02 사용자관리: 본인 행「목록」허용(작업물·이관)·변경·정지·활성은 유지 잠금
169. 2026-04-02 ETL 타겟모달: table_label 30자·table_dscrtn 100자 UI 제한·안내·제출 검증
168. 2026-04-02 ETL table_label·table_dscrtn: etl_tables·table_master·타겟모달·배치 적재 연동
167. 2026-04-02 ETL 타겟모달: 변환 종류별 타입·적재 비차단 안내(getTransformTypeGuidance)
166. 2026-04-02 ETL 미리보기 BIGINT+마스킹·타겟모달 마스킹 기본값·초대 역할 rid=0 호출 방지
165. 2026-04-02 관리자 get_user_work_assets: ETL 메타 SELECT is_active 동적화
164. 2026-04-02 고객여정 06 v4: 알고리즘 흐름 중심 전면 재구성
163. 2026-04-02 CreateOrgPage: 비밀번호 확인 UI 제거(회원가입만 요청 범위)
162. 2026-04-02 회원가입(SignupPage): 비밀번호 확인·정책 검증 버튼·공용 passwordPolicy
161. 2026-04-02 고객여정 06 Phase 11: 부서·사용자·권한 기술 흐름·함수 맵·흐름도
160. 2026-04-02 ETL 스키마 대조 후속: 배치 interval·저장DB 물리컬럼·JSONB 적재·변환룰 DB·문서04
159. 2026-04-02 2차 전수검사: 문서04 etl_jobs·배치이력·쿼리스튜디오 권한 오버라이드·pytest
158. 2026-04-02 ETL 전수검사: 라우트 대조 스크립트·transform 테스트 경로·헬스 스모크
157. 2026-04-02 ETL service: etl_connections·storage source_type/encrypted_password 동적 INSERT·SELECT
156. 2026-04-02 ETL service_file DB 실측 정합: protocol·registry PK id·폴더 목록 생성자·문서18
155. 2026-04-02 ETL DB 증분: etl_tables pk_columns 미저장 시 소스·타겟 PK로 실행 시 보강
154. 2026-04-02 ETL 정본 스키마 정합: batch_folder is_verified 제거·etl_jobs JOIN·insert_job
153. 2026-04-02 문서 04·ETL 주석: 운영 DB 실측 기준 문구 정리(확장 DDL 표현 제거)
152. 2026-04-02 ETL 운영 DB 실측 정합: batch_jobs 동적 INSERT·schedule_cron·transform_rules·스케줄러
151. 2026-04-02 ETL delete_job: etl_jobs.add_file_path 없을 때 SELECT 생략
150. 2026-04-02 ETL update_etl_table_status: etl_tables.status 없을 때 no-op
149. 2026-04-02 이관 후보: 역할 SQL 필터·관리범위 검증·빈 목록 안내
148. 2026-04-02 ETL DB연동 소스 테이블: 활성 연결만·목록 API 정합·로딩 가드
147. 2026-04-02 사용자관리: table_master create_user_id 이관·권한 기반 수신 후보·전건 목록
146. 2026-04-02 ETL 저장 DB API 내장 행·공용 셀렉트·저장 DB 탭 흐름 통일
145. 2026-04-02 정지 검사: user_has_transferable_ownership에 table_master.create_user_id 반영
144. 2026-04-02 ETL 내장 저장소 main(null)·dash(-1) UI·API 설명 정합
143. 2026-04-02 table_master 전사 원장 복원·db_type main|dash만
142. 2026-04-02 table_master create_user_id·부서 유일키·문서 04 정합
141. 2026-04-01 etl_tables·etl_jobs 실DB 정합·04 문서 동기화
140. 2026-04-01 이관: 부서 SA→sa_dev 금지·A는 ETL 등 sa_dev 수신 가능
139. 2026-04-01 사용자관리: ETL 메타 작업물 목록·create_user_id 이관·정지 검사
138. 2026-04-01 list_batch_target_registry: batch_jobs 컬럼 동적 SELECT
137. 2026-04-01 etl_batch_target_registry: id 레거시 폴백 제거(registry_id만)
136. 2026-04-01 etl_batch_target_registry: registry_id·운영 DDL·upsert/clear/delete 정합
135. 2026-04-01 ETL: user_info 없을 때 JOIN 생략·레지스트리 컬럼 동적 SELECT
134. 2026-04-01 ETL: list_jobs/get_job etl_tables 컬럼 방어·백필 SELECT 통일
133. 2026-04-01 ETL: etl_jobs DDL 드리프트·batch_jobs target_table 방어
132. 2026-04-01 ETL 등록자 UI·API: create_user_label·insert_job·batch_jobs
131. 2026-04-01 ETL service: DDL 단일 기준 고정·create_user_id 조회 반영
130. 2026-04-01 ETL service: ibank_etl_data 컬럼명 정합(db_type·password·config_json)
129. 2026-04-01 ETL 전사 단위: create_user_id·04 문서·INSERT/라우터
128. 2026-04-01 batch_folder_connections: 코드 protocol→folder_type 정합
127. 2026-04-01 pmssn 시드 query.read/query.execute·auth·쿼리스튜디오·문서 정합
126. 2026-04-01 .cursor 에이전트·스킬·룰: ETL 단일·캠페인 대시보드·http.js 정합
125. 2026-04-01 report_server→query_studio_server·문서·스킬 명명 정합
124. 2026-04-01 docs/main 일괄 정합: user_dvsn 캐논·인증·라우터·테이블 노출 정책
123. 2026-04-01 권한문서 05: require_permission 검증 흐름도·엣지 케이스 표 추가
122. 2026-04-01 고객여정 06: 부서·사용자·권한 어드민 UX 가이드(Phase 11) 보강
121. 2026-04-01 권한 목록 테이블: 권한명·상세 폰트를 작업 버튼과 통일·행 세로 중앙
120. 2026-04-01 권한관리: 우상단 권한 생성 모달·본문에 목록 우선 표시
119. 2026-03-31 권한 수정 모달: 권한상세 textarea 제거·셀렉트+행 목록으로 통일
118. 2026-03-31 권한상세 목록 영역 높이·패딩·세로 정렬 CSS
117. 2026-03-31 권한상세 추가 목록 row 표시로 UI 변경
116. 2026-03-31 권한상세 옵션 조회를 pmssn_master_detail로 전환
115. 2026-03-31 권한관리 화면 개편·사용현황 드릴다운 추가
114. 2026-03-31 사용자관리 대상 검증을 부서트리 기준으로 통일
113. 2026-03-31 사용자관리 조회 범위: 동일부서→부서트리(본인+하위)로 수정
112. 2026-03-31 변경 모달 프로젝트별 권한 위임 선택 추가
111. 2026-03-31 변경 모달 프로젝트 영역 empty-state 표시
110. 2026-03-31 변경 모달 높이 확장(프로젝트 목록 가시성 개선)
109. 2026-03-31 사용자관리 모달 가독성 재조정(1열·둥근 버튼·폭 축소)
108. 2026-03-31 사용자관리 모달 UI/레이아웃 개선(부서추가 스타일 톤)
107. 2026-03-31 사용자 변경 모달(부서·역할·프로젝트참여) 및 관리 API
106. 2026-03-31 A→SA 행 목록 허용(정지·활성만 잠금)
105. 2026-03-31 A가 SA 사용자 작업버튼 비활성
104. 2026-03-31 사용자관리 SA_DEV 전역 목록·부서컬럼·정렬·정지-이관 검증
103. 2026-03-31 사용자 관리 UI(초대 모달·작업물 목록·이관 API)
102. 2026-03-31 이메일 초대 500: email_invite_code_master 확장 컬럼 DDL·안내
101. 2026-03-31 부서 비활성·삭제 전 FK성 참조 검사(프로젝트·초대·역할 등)
100. 2026-03-31 부서 목록 부서구분(상위·하위) 열·SA 본인 부서 수정삭제 차단
99. 2026-03-31 부서 삭제 하드·수정에 사용여부·목록에서 ID0 제거·내소속 읽기전용
98. 2026-03-31 부서 관리 목록·상위표시·행 수정삭제·추가 모달·PATCH/DELETE API
97. 2026-03-31 CRUD 전 confirmCrud(공용)·어드민·마이페이지·알림·위젯보드·ETL이력
96. 2026-03-31 user_dvsn 단일 코드(sa_dev·sa·a·o·u)·비허용 시 빈 목록
95. 2026-03-31 user_dvsn effective_dvsn 정규화 제거(원복)
94. 2026-03-31 effective_dvsn·부서 정책(SA_DEV/SA)·UI·초대 dept≥0
93. 2026-03-31 부서 초대 목록 ID0 포함·org/departments 추가·초대 API ge=0
92. 2026-03-31 셸 브랜드 로고(Starbucks)·마이페이지 상단 헤더 이동
91. 2026-03-31 사이드바 프로젝트 필수 메뉴 비활성·ETL 구스키마 쿼리 호환
90. 2026-03-31 초대용 app_url: localhost 폴백 제거·frontend.app_url·미설정 시 메일 생략
89. 2026-03-31 smtp_info.app_url을 Vite base(/ibank-bi)에 맞춤·초대 폴백 수정
88. 2026-03-31 backend smtp_info 구조 반영(auth_config·문서 17·loader)
87. 2026-03-28 SMTP send_email 재시도 로직(STARTTLS 검증완화·새 소켓 평문 fallback·timeout)
86. 2026-03-28 auth_server __init__ router 재export (include_router AttributeError 수정)
85. 2026-03-28 전수검사 반영: admin list_projects role_name·SignupPage 초대 UX
84. 2026-03-28 react-app src/app 카테고리 폴더(auth·home·admin·layout·guards)
83. 2026-03-28 어드민 나머지: 역할·프로젝트·멤버·ProjectAdminRoute·adminClient
82. 2026-03-28 홈 §5.2 빠른 액세스·/admin/org·SuperAdminRoute·homeAccess
81. 2026-03-27 Backend/migrations 제거(저장소에 마이그레이션 파일 금지)
80. 2026-03-27 auth 초대 JOIN·로그인 토큰 1회·프로젝트 active·SA_DEV 유저관리
79. 2026-03-27 초대 DDL 수동 적용·CHECK·migrations 폴더 제거
78. 2026-03-27 초대 플로우 전면 개편(부서 트리·A→A 초대·ETL·U 프로젝트)
77. 2026-03-28 ETL 자격 etl_yn 분리·5역할·문서 v3
76. 2026-03-27 S8 알림 벨·notificationsClient·/admin/users·OrgAdminRoute
75. 2026-03-27 S7 마이페이지(/mypage)·프로필·비밀번호·로그인 이력·authClient
74. 2026-03-27 비밀번호 정책(10자·대소문자·숫자·특수문자) security·service·스키마·폼
73. 2026-03-27 회원가입·부서생성 화면·ETL 네비·라우트(sa_dev·etl_manager)
72. 2026-03-27 프론트 S5/S6 인증·프로젝트 선택·http Bearer·refresh
71. 2026-03-27 대시보드 단일화(캠페인만 연동·구형 UI 패키지 제거)
70. 2026-03-27 M1-8 대시보드 매핑 제한(campaign_dash 완료·core·legacy·new)
69. 2026-03-27 권한·/me·정지활성·O검색·SMTP·pmssn 정규화
68. 2026-03-27 6단계 역할 정합(operator·초대·가입·부서 role)
67. 2026-03-27 ETL 적재 완료 table_master 훅(M1-4)
66. 2026-03-26 M1 백엔드 핵심 보정(core/report/admin)
65. 2026-03-26 문서 교차대조 정합 보정(17·04·06)
64. 2026-03-26 Role 6단계·ETL 전사·permissions·docs/main 05/06
63. 2026-03-26 ETL 메타 DB 분리(etl_db) 적용
62. 2026-03-26 04_DB_ARCHITECTURE·17 §13 물리명 table_*·pmssn 시드 주의
61. 2026-03-26 report 17 §13 ETL·테이블 마스터·§10.4 M1/M2·체크리스트
60. 2026-03-26 S4 require_permission·report·dashboard·ETL·/me permissions
59. 2026-03-26 S3 project·admin·notification 서버·main 통합·JWT 프로젝트 claim
58. 2026-03-26 report 17 §10 우선순위·진행현황·권장 순서 명시
57. 2026-03-26 auth_server S2 백엔드(/api/auth)·get_system_db
56. 2026-03-26 allowed_tables 제거·main_db.table_schema 빈값=public
55. 2026-03-26 상용화 S1 config·auth_config·get_allowed_tables 화이트리스트
54. 2026-03-26 report 17 로그인·프로젝트·SMTP 등 구현 명세 보강
53. 2026-03-26 상용화 가이드 §12·섹션 게이트·.cursor 서브에이전트
52. 2026-03-26 report 17 운영 DB 반영·문서 정합
51. 2026-03-26 report 17 시스템 DB 상용화 구현 가이드·인덱스
50. 2026-03-26 원격 저장소 ibankbi 브랜치를 프로젝트 루트에 클론
49. 2026-03-24 README·02 가이드 main_db 문서 정합
48. 2026-03-24 config backend.main_db — 메인 DB 설정 중첩·core.db 로드
47. 2026-03-23 docs/main 리뷰 보강(인증·에러·ER·dash·배포·로그·테스트)
46. 2026-03-23 docs/main 갱신·03_개발가이드(AI용) 추가
45. 2026-03-23 core db·dependencies [Package Usage] 1~22·1~2 정리
44. 2026-03-23 dashboard_service [Package Usage] 함수 1~11 대응
43. 2026-03-23 Backend/core 모듈 docstring [Package Usage] 추가
42. 2026-03-23 백엔드 리패키징(core·report_server·legacy_dashboard·api_server 슬림)
41. 2026-03-23 대시보드2(성과리포트) 제거·문서·README 정리
40. 2026-03-23 뉴/캠페인 대시보드 주간 API target_date 일요일 끝점 보정
39. 2026-03-23 docs/main·README·docs/README 아키텍처·캠페인 대시보드 반영
38. 2026-03-23 프론트 API 패키지 분리·라우트 모듈화(shared client 제거)
37. 2026-03-23 캠페인 대시보드 구현(campaign_dash_server·campaign_dashboard)
36. 2026-03-23 캠페인 대시보드 Star 스키마 계획서(16)·Report 인덱스
35. 2026-03-20 member-summary 주·월 직전 스냅샷 폴백(base_date < 기간시작)
34. 2026-03-20 docs/main 가이드 문체 정리(§4.7.1·부록 A·PRD)
33. 2026-03-20 member-summary 주·월 직전 스냅샷 조회 범위 수정
32. 2026-03-20 docs/main 뉴 대시보드 member-summary 계산 공식(§4.7.1)
31. 2026-03-20 뉴 대시보드 member-summary 전환 끝점 빼기(주·월 포함)
30. 2026-03-20 뉴 대시보드 전환 카드 표시값·안내 문구 정리
29. 2026-03-20 뉴 대시보드 전환 KPI 유입·이탈 순증감 정의로 수정
28. 2026-03-20 docs/main·README dash_db 반영 (로그 #27 기준)
27. 2026-03-20 뉴 대시보드 테이블 dash_db 연결 전면 적용 (ibank_1 계열)
26. 2026-03-20 docs/main·README 현행화 (docs/log·docs/report 로그 기준)
25. 2026-03-20 뉴 대시보드 등급 분포 도넛 표시(레이아웃)
24. 2026-03-20 뉴 대시보드 등급 분포 도넛 복원
23. 2026-03-20 뉴 대시보드 등급 막대·동의 UI·퍼널 트랙·KPI 문구 정리
22. 2026-03-20 뉴 대시보드 전환 KPI 카드 색상·하단 안내
21. 2026-03-20 뉴 대시보드 member-summary 스냅샷 일자 정렬(전환 KPI 불일치 수정)
20. 2026-03-20 뉴 대시보드 채널별 동의 현황·레이아웃(추이 하단 전폭)
19. 2026-03-20 뉴 대시보드 회원 현황 KPI 3열·전환 카드·member-summary 필드
18. 2026-03-20 뉴 대시보드 회원 분석 성별 도넛 차트 레이아웃(잘림) 수정
17. 2026-03-20 뉴 대시보드 시간대별/성별/나이대 데이터 문제 점검 및 FunnelSection 퍼널 수정
16. 2026-03-19 client.js 뉴 대시보드 API 3함수 세트 주석·설계서 Phase2 보강
15. 2026-03-19 뉴 대시보드 Phase 6 정합성 검증 (설계서 15)
14. 2026-03-19 뉴 대시보드 Phase 4·5 NewDashboardPage·CSS (설계서 15)
13. 2026-03-19 뉴 대시보드 Phase 3A·3C 컴포넌트 6종 (설계서 15)
12. 2026-03-19 뉴 대시보드 Phase 2·3B client·dateUtils·TrendLineChart (설계서 15)
11. 2026-03-19 뉴 대시보드 Phase 1 백엔드 엔드포인트 3종 (설계서 15)
10. 2026-03-19 설계서 15번 age 루프·Phase4 제목·AgeBarChart opacity
9. 2026-03-19 설계서 15번 리뷰 잔여 이슈 반영(JSX·3B import·행 get)
8. 2026-03-19 설계서 15번 인코딩 원인 정리·UTF-8 복구·잔여 치환
7. 2026-03-19 뉴 대시보드 업그레이드 설계서 15번 작성
6. 2026-03-17 apply_mapping_type_cast·_apply_type_cast information_schema 풀 타입명 인식
5. 2026-03-17 column_mapping type 누락 시 TEXT 강제 적용 문제 수정(소스 타입 유지)
4. 2026-03-17 ETL 변환 룰 rule_category·operation 최상위 전달 및 백엔드 방어·로그
3. 2026-03-17 ETL 날짜/시간 연산 — 날짜 빼기(date_subtract) 추가
2. 2026-03-17 컬럼 매핑 모달 변환 상세 셀렉트/레이아웃 품질 개선
1. 2026-03-17 ETL 컬럼 변환 룰 — 날짜/시간 연산 UI·규칙 저장 전면 지원

## Log Body

308. 2026-04-09 프로젝트 하위 페이지 기준 정리: db_type 비노출·매핑 여부 중심
Purpose: 사용자 관점 정책을 명확히 반영 — 프로젝트 하위 페이지는 `main/dash` 구분값이 아니라 “현재 프로젝트에 매핑된 테이블인가”만 판단
Changes:

`/api/list-tables` 응답에서 `db_type` 노출 제거(내부 분기만 유지), 문서에 페이지 관점 기준 명시
Changed files: Backend/query_studio_server/router.py, docs/main/03_API_GUIDE.md, docs/report/20_Widget_Board_System_Design.md, docs/log/log.md

307. 2026-04-09 위젯보드/쿼리스튜디오: 매핑 db_type main·dash 동시 지원
Purpose: `table_project_mapping`이 main뿐 아니라 dash도 포함할 수 있다는 정책에 맞춰, 조회·검증·saved_table 데이터 로드에서 db_type 분기 반영
Changes:

`widget_board_server.service`: `_allowed_saved_table`이 main/dash 매핑을 모두 판정하고 반환값(db_type)으로 `fetch_widget_data`의 연결·스키마를 선택
`query_studio_server.router`: `/api/list-tables`가 main+dash 매핑을 통합 반환(`db_type` 포함), `/api/describe-table`이 프로젝트 매핑 기준으로 main/dash 스키마에서 컬럼 조회
문서/주석: `03_API_GUIDE.md`, `20_Widget_Board_System_Design.md`, `WidgetboardPage.jsx` 코멘트
Changed files: Backend/widget_board_server/service.py, Backend/query_studio_server/router.py, Frontend/react-app/src/packages/widgetboard/WidgetboardPage.jsx, docs/main/03_API_GUIDE.md, docs/report/20_Widget_Board_System_Design.md, docs/log/log.md

306. 2026-04-09 위젯보드: 테이블 test_report_ 제한 해제·매핑 검증, 쿼리저장 매핑 upsert 재시도
Purpose: 위젯 데이터 소스를 프로젝트에 매핑된 모든 main 테이블로 확장; `test_report_` 비매핑 우회 제거; 위젯 추가·수정·데이터 조회 시 동일 검증
Changes:

FE `listTables` 결과 전체 사용, 라벨 문구 정리; BE `_allowed_saved_table`·`add_widget`/`patch_widget` 검증; 저장 워커 `_upsert_table_master_and_mapping` 3회 재시도
문서: `20_Widget_Board_System_Design.md`, `03_API_GUIDE.md` §6.2
Changed files: Backend/widget_board_server/service.py, query_studio_server/router.py, Frontend/react-app/src/packages/widgetboard/WidgetboardPage.jsx, components/WidgetDataWizardModal.jsx, docs/report/20_Widget_Board_System_Design.md, docs/main/03_API_GUIDE.md, docs/log/log.md

305. 2026-04-09 위젯보드: 복수 일 차트 X축이 범주 컬럼으로 남는 문제(데이터 API 컬럼 타입·meta)
Purpose: `/widgets/.../data` 가 name-only 컬럼을 주어 FE가 날짜 축을 못 찾고 `dimensionKey`(campaign_id 등)로 집계하던 현상 제거
Changes:

`fetch_widget_data`(saved_table): `information_schema`로 컬럼 type 채움, 기간 필터 시 `meta.applied_date_column` 추가
`WidgetboardPage`: 캐시에 `appliedDateColumn` 저장, `resolveWidgetDateColumnName` 보강, 복수 일인데 시간 축 불가 시 범주 집계 대신 빈 차트
Changed files: Backend/widget_board_server/service.py, Frontend/react-app/src/packages/widgetboard/WidgetboardPage.jsx, api/widgetBoardClient.js, docs/log/log.md

304. 2026-04-09 위젯보드: 설정 변경 후 데이터 조회 PATCH 레이스 수정
Purpose: `/widgets/{id}/data` 가 DB의 `data_config`를 읽는데, 프론트가 `updateWidget` 완료 전에 데이터를 요청하면 이전 기간·설정으로 조회되는 문제 제거
Changes:

`persistWidgetPatch`·`persistWidgetFullConfig`: PATCH 성공 후 `loadWidgetDataset(nextCfg)` 호출; 제목만 변경 시에는 데이터 재조회 생략
Changed files: Frontend/react-app/src/packages/widgetboard/WidgetboardPage.jsx, docs/log/log.md

303. 2026-04-09 위젯보드 생성·설정 모달 UX: 크기·스크롤·오버레이 닫기 제거·차원/지표 라벨
Purpose: 캔버스 위젯 설정·데이터 마법사·목록 생성·수정 모달에서 바깥 클릭으로 닫힘 방지, 본문 스크롤·폭 확대, 확인/취소·× 정책 정리, 차트 차원(범주)·지표(Y) 문구 및 복수 일 차원 잠금 정합
Changes:

위젯 설정 모달: 푸터 취소/확인, 오버레이 비닫기, 본문 스크롤·max-width 600px, 차원 잠금을 복수 일만으로
데이터 마법사: 동일 오버레이 정책, 푸터 분리·스크롤, 차원 비활성 조건 단순화
목록 생성·수정: 오버레이 클릭 제거, 헤더 ×, wb-board-form-modal 폭·패딩
widgetboard.css: modal-settings·widget-data-wizard·wb-board-form-modal 스타일
Changed files: Frontend/react-app/src/packages/widgetboard/WidgetboardPage.jsx, WidgetboardListPage.jsx, components/WidgetDataWizardModal.jsx, widgetboard.css, docs/log/log.md

302. 2026-04-09 위젯보드 목록 초대 모달: admin-org 스타일·레이아웃 정리
Purpose: 초대 알림 보내기 모달을 ap__modal 혼용에서 admin-org__modal·메타·툴바·테이블 랩·modal-actions로 통일.

Changes:

- `WidgetboardListPage.jsx`, `widgetboard.css`

Changed files: Frontend/react-app/src/packages/widgetboard/WidgetboardListPage.jsx, widgetboard.css, docs/log/log.md

301. 2026-04-09 위젯보드 캔버스: 보드명 셸/브레드크럼·목록 링크 상단·카드 헤더 정리
Purpose: 캔버스에서 상단 제목을 보드명으로, 목록 링크를 프로젝트 멤버처럼 제목 위(ap__back). 위젯 카드에서 테이블명 제거, 설정·복제·삭제를 제목과 한 줄 오른쪽.

Changes:

- `ShellChromeOverrideContext.jsx`, `ProtectedLayout.jsx`, `PageHeader.jsx`(backLink), `pageTitles.js`(/widgetboard/:id)
- `WidgetboardPage.jsx`, `widgetboard.css`

Changed files: Frontend/react-app/src/app/layout/ShellChromeOverrideContext.jsx, ProtectedLayout.jsx, PageHeader.jsx, pageTitles.js, packages/widgetboard/WidgetboardPage.jsx, widgetboard.css, docs/log/log.md

300. 2026-04-09 위젯보드 삭제 확인 UI·목록 API: 알림 건수 제거·요약 2항목만
Purpose: 삭제 컨펌은 위젯·공유 건수만 확정 표시, 테이블명 제거. 알림은 FK 없음·로그성 안내로 건수 미표시. `list_boards`에서 `purge_notification_count` 서브쿼리 제거.

Changes:

- `widget_board_server/service.py`, `WidgetboardListPage.jsx`, `docs/main/03_API_GUIDE.md`

Changed files: Backend/widget_board_server/service.py, Frontend/react-app/src/packages/widgetboard/WidgetboardListPage.jsx, docs/main/03_API_GUIDE.md, docs/log/log.md

299. 2026-04-09 위젯보드 list_boards: psycopg2 LIKE 패턴 `%` 이스케이프(500 IndexError)
Purpose: `purge_notification_count` 서브쿼리의 `'%' || ... || '%'` 가 psycopg2에서 추가 `%s` 자리로 파싱되어 파라미터 개수 불일치(`IndexError`). SQL 리터럴은 `%%` 로 이스케이프.

Changes:

- `widget_board_server/service.py`: LIKE 결합 문자열을 `%%` 로 수정

Changed files: Backend/widget_board_server/service.py, docs/log/log.md

298. 2026-04-09 위젯보드 완전 삭제 확인 모달·목록 API 건수 필드
Purpose: 삭제 컨펌에 연관 테이블·건수 안내, 목록이 길면 스크롤. `GET /api/widget-boards` 항목에 `widget_item_count`, `share_row_count`, `purge_notification_count` 추가.

Changes:

- `widget_board_server/service.py`: `list_boards` SELECT 보강
- `WidgetboardListPage.jsx`: `deleteConfirmRow` 모달, `runDeleteBoardConfirmed`
- `widgetboard.css`: `.wb-delete-confirm__*`
- `docs/main/03_API_GUIDE.md`: GET 목록 행 설명

Changed files: Backend/widget_board_server/service.py, Frontend/react-app/src/packages/widgetboard/WidgetboardListPage.jsx, widgetboard.css, docs/main/03_API_GUIDE.md, docs/log/log.md

297. 2026-04-09 위젯보드 DELETE: 비활성 보드 물리 삭제(기존은 active_yn만 갱신되어 목록 불변)
Purpose: `delete_board`가 이미 `active_yn=N`인 보드에 대해 동일 UPDATE만 수행해 UI에서 삭제가 되지 않은 것처럼 보임. 비활성일 때만 `widget_item`·`widget_board_share`·관련 `notification_info` 제거 후 `widget_board` 행 삭제. 활성 보드 DELETE는 400.

Changes:

- `widget_board_server/service.py`: `delete_board` 물리 삭제·활성 시 거부
- `widget_board_server/router.py`: 엔드포인트 주석
- `docs/main/03_API_GUIDE.md`: DELETE 행 설명

Changed files: Backend/widget_board_server/service.py, router.py, docs/main/03_API_GUIDE.md, docs/log/log.md

296. 2026-04-09 위젯보드 목록 생성·수정 모달: 부서관리(admin-org) 모달 스타일 정합
Purpose: `ap__modal` 계열 대신 `admin-org__modal-overlay`·`admin-org__modal`·`admin-org__label`·`admin-org__input`·`admin-org__modal-actions` 및 `ibank-btn-toolbar--secondary`로 부서 추가 모달과 동일 UI.

Changes:

- `WidgetboardListPage.jsx`: admin-org.css import, 생성·수정 모달 마크업·폼 submit
- `widgetboard.css`: `.wb-list-modal__textarea` (textarea 모서리·높이)

Changed files: Frontend/react-app/src/packages/widgetboard/WidgetboardListPage.jsx, Frontend/react-app/src/packages/widgetboard/widgetboard.css, docs/log/log.md

295. 2026-04-09 위젯보드 목록 참여자 열: 인원 수 글씨 축소·버튼 수직 정렬
Purpose: 참여자 열 `(N명)` 이 `ap__hint`로 인해 줄 높이·마진이 커져 버튼과 어긋남. 전용 클래스로 작은 글씨·line-height 1·마진 0.

Changes:

- `WidgetboardListPage.jsx`: `wb-list-participant-actions`·`wb-list-participant-count`
- `widgetboard.css`: 위 클래스 스타일

Changed files: Frontend/react-app/src/packages/widgetboard/WidgetboardListPage.jsx, Frontend/react-app/src/packages/widgetboard/widgetboard.css, docs/log/log.md

294. 2026-04-09 위젯보드 목록 모달: 오버레이 클릭 닫기·참여자/초대 이메일 열 말줄임
Purpose: 부서/사용자 관리와 동일하게 모달 배경 클릭 시 닫힘. 참여자·초대 모달에서 긴 이메일이 행을 밀지 않도록 말줄임·title 툴팁.

Changes:

- `WidgetboardListPage.jsx`: 생성·수정·참여자·초대 `ap__modal-overlay`에 `onClick`으로 각 상태 초기화, 참여자/초대 표에 `ap__td-clip-inviter`·`admin-users__email-*`·`wb-list-modal-table`
- `widgetboard.css`: `.wb-list-modal-table`·`.wb-list-modal-email-cell` 보조 스타일

Changed files: Frontend/react-app/src/packages/widgetboard/WidgetboardListPage.jsx, Frontend/react-app/src/packages/widgetboard/widgetboard.css, docs/log/log.md

293. 2026-04-09 위젯보드 목록 테이블: 관리 페이지와 동일 ibank-btn-table·admin-users__actions
Purpose: ibank-btn-small·flexWrap으로 어긋나던 목록 행을 AdminProjects/AdminUsers와 동일 패턴으로 정렬(한 줄·테이블 버튼). ap__table--projects 명·설명 말줄임.

Changes:

- `WidgetboardListPage.jsx`: admin-users.css import, `ap__table--projects`, `admin-users__actions`, 위험/주요 액션 variant, 참여자·초대 모달 행 버튼 정합

Changed files: Frontend/react-app/src/packages/widgetboard/WidgetboardListPage.jsx, docs/log/log.md

292. 2026-04-09 위젯보드: private/project·알림 초대·사용자관리 위젯보드 이관
Purpose: share_scope 복구(project=동일 프로젝트 읽기 캔버스). 초대는 알림(noti_type widget_board_invite) 후 수락 시 share. 목록 범위 컬럼·체크박스 일괄 초대. 어드민 소유 위젯보드 이관 시 위젯 create_user_id 일괄 이관.

Changes:

- `widget_board_server/service.py`·`schemas.py`·`router.py`: list has_share, invite batch·accept/reject, share_scope create/patch
- `NotificationBell.jsx`·`widgetBoardClient.js`·`WidgetboardListPage.jsx`
- `admin_server/service_users.py`·`ownership_guards.py`·`schemas.py`·`AdminUsersPage.jsx`

Changed files: Backend/widget_board_server/service.py, schemas.py, router.py, Backend/admin_server/service_users.py, ownership_guards.py, schemas.py, Frontend/react-app/src/app/layout/NotificationBell.jsx, Frontend/react-app/src/app/admin/AdminUsersPage.jsx, Frontend/react-app/src/packages/widgetboard/WidgetboardListPage.jsx, api/widgetBoardClient.js, docs/log/log.md

291. 2026-04-09 위젯보드: share_scope 비사용·초대(widget_board_share)만 접근 제어
Purpose: 프로젝트 전체 공유(project) 분기 제거. 보드 접근은 소유자 또는 widget_board_share 행만. 신규 INSERT는 share_scope 항상 private. API 바디의 share_scope는 deprecated(무시).

Changes:

- `widget_board_server/service.py`: `_can_read_board`·`_can_edit_board`·`list_boards`·`create_board`·`patch_board`·`upsert_share`·`list_board_participants` 정리
- `schemas.py`: Create/Patch `share_scope` Field(deprecated)
- `WidgetboardListPage.jsx`: 생성 시 share_scope 제거, 참여자 모달 안내 문구 통일

Changed files: Backend/widget_board_server/service.py, schemas.py, Frontend/react-app/src/packages/widgetboard/WidgetboardListPage.jsx, docs/log/log.md

290. 2026-04-09 위젯보드 목록 페이지·참여자/초대 API·비활성·캔버스 라우트 분리
Purpose: `/widgetboard` 목록·생성·참여자 모달·초대(위젯보드 권한자)·비활성/활성/삭제, `/widgetboard/:id` 캔버스. 제외 시 widget_item.create_user_id 소유자 이관.

Changes:

- `widget_board_server/service.py`: list_boards 확장(is_owner·can_edit·owner·participant_count), 비활성 보드 소유자 목록, get_detail/fetch_data 비활성 차단, patch_board active_yn·비활성 시 소유자만 메타 수정, upsert_share→custom·비활성 금지, delete_share 이관, list_board_participants·list_invite_candidates
- `schemas.py`: WidgetBoardPatchBody.active_yn
- `router.py`: GET participants, invite-candidates
- `WidgetboardListPage.jsx`, `routes.jsx` 중첩 라우트, `WidgetboardPage.jsx` URL boardId·목록 링크, `widgetBoardClient.js` API 추가

Changed files: Backend/widget_board_server/service.py, schemas.py, router.py, Frontend/react-app/src/packages/widgetboard/WidgetboardListPage.jsx, WidgetboardPage.jsx, api/widgetBoardClient.js, app/routes.jsx, docs/log/log.md

289. 2026-04-09 widget_item.create_user_id DDL·add_widget INSERT 반영
Purpose: 위젯 생성자 추적용 컬럼 추가 및 API 생성 시 JWT 사용자 ID 저장.

Changes:

- `widget_board_server/service.py` `add_widget`: INSERT 에 `create_user_id` 및 `int(user_id)` 바인딩

Changed files: Backend/widget_board_server/service.py, docs/log/log.md

288. 2026-04-09 위젯보드: 설정 모달 통합·생성 시 지표/차원·기간 자동 집계
Purpose: 「변경」과 설정 중복 제거, 생성 마법사에 metric/dimension 추가, 시작≠종료일이면 차트 X축을 dateGrain 기준 버킷 집계.

Changes:

- `WidgetboardPage.jsx`: 헤더「변경」제거·테이블 미연결 시 설정으로 유도, 설정 모달에 테이블 셀렉트, 기간 변경 시 `handleDataWidgetRangePatch`로 dimensionKey 정리, 캐시 키에 `tableName` 포함, 마법사 edit 모드 제거
- `WidgetDataWizardModal.jsx`: 생성 전용·지표/차원 필드, 복수 일이면 차원 비활성
- `dataUtils.js`: `aggregateForChartByTimeGrain`, `resolveWidgetDateColumnName`, `bucketLabelForGrain`
- `dateRangePolicy.js`: `isMultiDayWidgetRange`

Changed files: Frontend/react-app/src/packages/widgetboard/WidgetboardPage.jsx, WidgetDataWizardModal.jsx, utils/dataUtils.js, utils/dateRangePolicy.js, docs/log/log.md

287. 2026-04-09 위젯 카드 헤더 기간 표시: 2행 레이아웃·짧은 부제·말줄임(가독성)
Purpose: 좁은 KPI 카드에서 `word-break: break-all`로 날짜가 숫자 단위로 깨지던 문제를 제거하고, 제목·기간은 전체 너비를 쓰도록 한다.

Changes:

- `dateRangePolicy.js`: `formatWidgetPeriodSubtitleCompact` 추가
- `WidgetboardPage.jsx` `WidgetBlock`: 헤더 primary / toolbar 2행, 기간 `title`에 전체 문구
- `widgetboard.css`: `.widget-header-primary`, `.widget-header-toolbar`, 기간·데이터소스 말줄임

Changed files: Frontend/react-app/src/packages/widgetboard/utils/dateRangePolicy.js, Frontend/react-app/src/packages/widgetboard/WidgetboardPage.jsx, Frontend/react-app/src/packages/widgetboard/widgetboard.css, docs/log/log.md

286. 2026-04-09 ETL DB 적재: column_mapping TEXT 오저장 시 소스 스키마로 타입 보정·타겟 TIMESTAMP 유지
Purpose: UI가 PG `timestamp without time zone` 등을 TEXT로 저장해도 적재 시 CREATE/캐스트가 TEXT로 고정되던 문제를 막음.

Changes:
- `db_load_service.resolve_column_mapping_pg_type`: 저장 type이 TEXT이고 소스 information_schema 매핑이 TEXT가 아니면 소스 기준 PG 타입 사용. `run_db_load` 매핑 빌드에 적용.
- `batch_executor_db`: 동일 헬퍼로 배치 DB Job 매핑 타입 결정.
- `TargetTableSelectModal/constants.js`: `isDatetimeSemanticType`로 전체 타입명 인식, `inferredTypeToPg`·`typeFamily` 보강.

Changed files: Backend/etl_server/db_load_service.py, batch_executor_db.py, Frontend/react-app/src/packages/etl/components/TargetTableSelectModal/constants.js, docs/log/log.md

285. 2026-04-09 위젯 카드 헤더에 조회 기간 부제 표시
Purpose: 기간이 적용된 데이터 위젯에서 제목 아래에 `YYYY-MM-DD ~ YYYY-MM-DD (일별|주별|월별)` 안내를 둔다.

Changes:

- `dateRangePolicy.js`: `formatWidgetPeriodSubtitle`
- `WidgetboardPage.jsx` `WidgetBlock`: 헤더 좌측 제목+부제 레이아웃
- `widgetboard.css`: `.widget-header-left`, `.widget-title-text`, `.widget-date-range`

Changed files: Frontend/react-app/src/packages/widgetboard/utils/dateRangePolicy.js, Frontend/react-app/src/packages/widgetboard/WidgetboardPage.jsx, Frontend/react-app/src/packages/widgetboard/widgetboard.css, docs/log/log.md

284. 2026-04-09 위젯보드 data_config 기간·마법사 UI·saved_table 서버 필터
Purpose: 위젯별 조회 기간을 DB 컬럼 추가 없이 data_config(JSON)로만 저장하고, 드롭 후 마법사에서 제목·테이블·일/주/월 상한 내 기간·날짜 컬럼을 설정한다. 서버 fetch_widget_data 가 saved_table 에 동일 상한으로 WHERE 를 적용한다.

Changes:

- `widget_board_server/service.py`: dateStart/End/Grain/Column 파싱·검증(14일·12주·12개월), psycopg2 식별자 안전 WHERE
- `WidgetboardPage.jsx`: 전역 날짜 헤더 제거, 생성/편집 `WidgetDataWizardModal`, `buildDataConfigForApi`·캐시 키에 기간 반영, 설정 모달 기간·이름
- `components/WidgetDataWizardModal.jsx`, `utils/dateRangePolicy.js`: 클라이언트 검증·기본 기간
- `widgetboard.css`: 마법사 폼 스타일

Changed files: Backend/widget_board_server/service.py, Frontend/react-app/src/packages/widgetboard/WidgetboardPage.jsx, Frontend/react-app/src/packages/widgetboard/components/WidgetDataWizardModal.jsx, Frontend/react-app/src/packages/widgetboard/utils/dateRangePolicy.js, Frontend/react-app/src/packages/widgetboard/widgetboard.css, docs/log/log.md

283. 2026-04-09 core/sql_safety 통합·shared queryStudioTableApi·위젯보드-쿼리스튜디오 경계 정리
Purpose: query_studio와 widget_board 간 중복된 SQL 금지 검사를 제거하고, 위젯보드가 쿼리 스튜디오 HTTP API를 패키지 간 직접 import 없이 shared 경로로 사용하도록 한다.

Changes:

- `Backend/core/sql_safety.py` 신규: `contains_dangerous_sql` 단일 구현
- `query_studio_server/router.py`: 코어 함수 래퍼로 `_contains_dangerous_sql` 축소
- `widget_board_server/service.py`: 코어 import로 전환, `widget_board_server/sql_safety.py` 삭제
- `shared/api/queryStudioTableApi.js` 신규: listTables, describeTable, executeQuery
- `query_studio/api/queryStudioClient.js`: 위 세 함수 shared에서 re-export, `WidgetboardPage.jsx`는 shared 직접 import
- `docs/report/20_…`, `docs/main/02_BACKEND_GUIDE.md` 설계·트리 문구 정합

Changed files: Backend/core/sql_safety.py, Backend/query_studio_server/router.py, Backend/widget_board_server/service.py, Frontend/react-app/src/shared/api/queryStudioTableApi.js, Frontend/react-app/src/packages/query_studio/api/queryStudioClient.js, Frontend/react-app/src/packages/widgetboard/WidgetboardPage.jsx, docs/report/20_Widget_Board_System_Design.md, docs/main/02_BACKEND_GUIDE.md, docs/main/03_API_GUIDE.md, docs/log/log.md (삭제: Backend/widget_board_server/sql_safety.py)

282. 2026-04-09 위젯보드 FE 서버 연동·GET 보드 can_edit·API 가이드 §6.2
Purpose: 운영 DB에 반영된 `widget_board`/`widget_item`/`widget_board_share`에 맞춰 위젯보드 UI를 `/api/widget-boards`와 동기화하고, 읽기 전용·편집 권한을 프론트에서 반영한다.

Changes:

- `widget_board_server/service.py`: `get_board_detail` 응답에 `can_edit` 추가
- `WidgetboardPage.jsx`: 보드 목록·생성·전환, 드롭 시 `addWidget`, 테이블 선택 시 `updateWidget`, 레이아웃 디바운스 `patchWidgetBoardLayout`, 데이터 `fetchWidgetData`, localStorage 제거 후 흐름 정리, `WidgetBlock` 읽기 전용 처리
- `widgetboard.css`: 보드 툴바·읽기 전용 팔레트 스타일
- `docs/main/03_API_GUIDE.md`: 라우터 9개 도식·`§6.2 widget_board_server` 엔드포인트 표

Changed files: Backend/widget_board_server/service.py, Frontend/react-app/src/packages/widgetboard/WidgetboardPage.jsx, Frontend/react-app/src/packages/widgetboard/widgetboard.css, docs/main/03_API_GUIDE.md, docs/log/log.md

281. 2026-04-09 docs/report/20 §7.0 프로젝트 귀속·개인 보드 FE 명시
Purpose: 위젯보드 프론트가 프로젝트 스코프+소유자 개인화 모델을 다루는지 문서에서 바로 읽히도록 §7 도입부·§13 목차를 보강한다.

Changes:

- `20_Widget_Board_System_Design.md`: §7.0 제품 맥락 표, §13 목차 6~7 설명

Changed files: docs/report/20_Widget_Board_System_Design.md, docs/log/log.md

280. 2026-04-09 docs/report/20 §3.4 컬럼 사용 검증(위젯보드 테이블)
Purpose: 위젯보드 3테이블 컬럼이 BE/FE에서 모두 쓰이는지 검증하고, MVP에서 빈 값·후순위 UI가 될 수 있는 항목을 표로 남긴다.

Changes:

- `20_Widget_Board_System_Design.md`: §3.4 컬럼 사용 검증 추가

Changed files: docs/report/20_Widget_Board_System_Design.md, docs/log/log.md

279. 2026-04-09 docs/report/20 설계서 최적화·S0~S8·ibank_system_data psql 절 추가
Purpose: 위젯보드 설계서를 시스템 최적안(localStorage 비사용·`widgetboard` 권한 1차·`table_project_mapping` 명칭)으로 정리하고, 컨텍스트 최적화용 S0~S8 게이트·`ibank_system_data` psql DDL/DML(파일 없음)을 단일 문서에 넣어 구현 가능하도록 한다.

Changes:

- `20_Widget_Board_System_Design.md`: §0 최적화·§11 psql·§12 게이트·§13 목차, API 권한 표 `widgetboard` 정합, ERD 매핑명 수정
- `00_ReportIndex.md`: 20번 설명 갱신

Changed files: docs/report/20_Widget_Board_System_Design.md, docs/report/00_ReportIndex.md, docs/log/log.md

278. 2026-04-09 docs/report/20 위젯 보드 분리 설계서·ReportIndex 갱신
Purpose: 사용자 정리안(3테이블·widget_board_server·엔드포인트·권한)을 바탕으로, 쿼리 스튜디오 정리는 제외하고 위젯보드 서버화·프론트(`packages/widgetboard`) 연동을 상세 설계 문서로 남긴다.

Changes:

- `docs/report/20_Widget_Board_System_Design.md` 신규: 원칙·DDL·ERD·API·데이터 흐름·현행 UI 매핑·추가 UI·클라이언트·구현 Phase
- `docs/report/00_ReportIndex.md`: 20번 행 추가

Changed files: docs/report/20_Widget_Board_System_Design.md, docs/report/00_ReportIndex.md, docs/log/log.md

277. 2026-04-09 홈 위젯보드 카드 부가 설명을 widgetboard로 복구
Purpose: 홈 카드 부가 문구가 어색해 `widgetboard` 표기로 되돌린다.

Changes:

- `HomePage.jsx`: `home__card-desc`를 `widgetboard`로 복구

Changed files: Frontend/react-app/src/app/home/HomePage.jsx, docs/log/log.md

276. 2026-04-09 위젯보드 패키지: Dashboard3Page → WidgetboardPage 명칭·문서 정합
Purpose: `packages/widgetboard`를 대시보드3 등 혼용 명칭 없이 위젯보드 용어·파일명으로 통일하고, 진입점·문서를 맞춘다.

Changes:

- `Dashboard3Page.jsx` 제거, `WidgetboardPage.jsx`로 이전·컴포넌트명 `WidgetboardPage`
- `index.jsx`: `./WidgetboardPage.jsx` 재export, 주석에서 「대시보드」 표현 제거
- `docs/main/00_PRD.md` §6.2.1, `01_FRONTEND_GUIDE.md` 트리·§4.3, `docs/report/log.md` 파일명 갱신

Changed files: Frontend/react-app/src/packages/widgetboard/WidgetboardPage.jsx, Frontend/react-app/src/packages/widgetboard/index.jsx, docs/main/00_PRD.md, docs/main/01_FRONTEND_GUIDE.md, docs/report/log.md, docs/log/log.md  
Removed: Frontend/react-app/src/packages/widgetboard/Dashboard3Page.jsx

275. 2026-04-09 docs/main/03_API_GUIDE.md §5.3 campaign_dash_server 라우터·흐름·보안 요약
Purpose: `campaign_dash_server/router.py` 엔드포인트 표, 내부 헬퍼, star_1/star_2 전제, 권한·매핑·식별자 검증 흐름, `dashboard_service` 위임 관계를 문서화한다.

Changes:

- `03_API_GUIDE.md`: 읽는 순서 §5, §5.3 본문, §6·맺음말 보강

Changed files: docs/main/03_API_GUIDE.md, docs/log/log.md

274. 2026-04-09 docs/main/03_API_GUIDE.md §6.1 notification_server 요약·흐름·생성 경로
Purpose: `notification_server` 라우터·서비스 표, `require_active_access` 이후 분기, 응답 형식, `insert_notification` 의 admin·project 호출 관계를 문서에 반영한다.

Changes:

- `03_API_GUIDE.md`: 읽는 순서·§6 bullet·§6.1 본문(엔드포인트·함수·ASCII 흐름·생성 경로·설계 요약)·맺음말

Changed files: docs/main/03_API_GUIDE.md, docs/log/log.md

273. 2026-04-09 docs/main/03_API_GUIDE.md §6.1 query_studio 롤백(사용자 요청)
Purpose: 직전에 추가한 §6.1 `query_studio_server` 상세(엔드포인트 표·흐름·보안 요약)를 제거하고, 읽는 순서·§6 bullet·맺음말을 §6.1 이전 형태로 되돌린다.

Changes:

- `03_API_GUIDE.md`: §6.1 전체 삭제, §6 `query_studio_server` 한 줄 안내·TOC·맺음말 복구
- `log.md`: 항목 273(§6.1 추가) 제거 후 본 롤백을 273으로 기록

Changed files: docs/main/03_API_GUIDE.md, docs/log/log.md

272. 2026-04-09 docs/main/03_API_GUIDE.md 서버 단위 재구성·project_server·중복 §8–10 제거
Purpose: §1~§6으로 동작 흐름을 나누고 흐름 직후 모듈 표를 두며, `project_server` 목록·select·초대 수락/거절을 반영한다. 말미 중복 블록(구 §8·9·10)을 삭제한다.

Changes:

- §1 코어: 앱·로깅·DB·auth_config·역할 코드·실행 참고 + 각 표
- §2 auth: 2.1 흐름(프로젝트 선택은 §3 안내), 2.2~2.4 모듈 표, 2.3 권한 소절
- §3 project_server: select·accept/reject 도식, router·service 표
- §4 admin: 4.0~4.1, B는 §3.2 참조, 4.2 정지·이관, 4.3 모듈 표 일원화
- §5 대시보드: 5.1 흐름 + 5.2 `dashboard_service`
- §6 기타 패키지 안내; 구 §10 전량 삭제

Changed files: docs/main/03_API_GUIDE.md, docs/log/log.md

271. 2026-04-09 docs/main/03_API_GUIDE.md auth 비활성·권한·흐름 갱신·§9 명칭·표현 정리
Purpose: `require_active_access`·`feature_flags` 교집합·refresh/rotate/suspend 흐름을 반영하고, 문서 전반의 변경 이력형 표현(신규·기존 대비 등)을 제거한다.

Changes:

- §4~§5·§5.1~5.4: 인증·권한 ASCII 흐름 재작성, 프로젝트 선택 경로 `/api/projects/{id}/select`
- §6·§8: 한눈에·정지 흐름 문구 정합
- §9: 제목·표를 현재 동작 설명 중심으로 정리
- §10.11~10.16: auth deps·permissions·service·router 표 갱신, 보조 모듈 한 줄 안내
- §2·§6.1 G·기타: 신규/업데이트 대비 문구 제거

Changed files: docs/main/03_API_GUIDE.md, docs/log/log.md

270. 2026-04-09 docs/main/03_API_GUIDE.md 역할 문구·어드민 표·흐름 A–J·02 정합
Purpose: 문서 역할을「전 모듈 기능 요약 + 흐름 도식」에 맞게 바로잡고, admin_server 최신 스펙(ownership_guards·create_project_full·라우트)을 반영한다.

Changes:

- 03_API_GUIDE: 제목·서두·읽는 순서, §6 요약+§6.1 A–J, §8 ownership_guards 보강, §10.17–10.24 admin 전면 갱신
- 02_BACKEND_GUIDE: 03 문서 한 줄 설명 정합

Changed files: docs/main/03_API_GUIDE.md, docs/main/02_BACKEND_GUIDE.md, docs/log/log.md

269. 2026-04-09 docs/main/03_API_GUIDE.md 본문 작성·02_BACKEND_GUIDE 상호참조 갱신
Purpose: 제공된 모듈·흐름 자료를 바탕으로 통합 API 가이드를 작성하고, 백엔드 가이드의 03 문서 상태 문구를 맞춘다.

Changes:

- docs/main/03_API_GUIDE.md: 읽는 순서, 앱 기동·DB·인증·권한·어드민·대시보드·정지/이관 ASCII 흐름, logging_setup·main `__main__` 변경 요약, api/core/auth/admin 함수·엔드포인트 표(§10)
- docs/main/02_BACKEND_GUIDE.md: 03_API_GUIDE 예정 문구를 본문 참조로 수정(목적·§7·문서 표)

Changed files: docs/main/03_API_GUIDE.md, docs/main/02_BACKEND_GUIDE.md, docs/log/log.md

268. 2026-04-02 docs/main 정합: AI 가이드 report 경로·03_API 예정·백엔드 §4.0·헤더 프로젝트 전환
Purpose: log·코드 기준으로 개발 문서 링크와 최근 UX/API 요약을 맞춘다. `03_AI_DEVELOP_GUIDE`는 **docs/report**로 이전된 경로를 전역 참조. **03_API_GUIDE.md**는 예정(본문 비움 유지). **02_BACKEND_GUIDE §4.0**에 auth·project·notification·admin 요약 추가.

Changes:

- docs/README.md, README.md: 표에 03_API(예정)·AI 가이드 report 링크
- docs/main 00/01/02: AI 가이드 경로·문서 표에 03_API·report 03_AI
- docs/main 01: 헤더 작업 프로젝트 드롭다운·전환 시 재조회 요약
- docs/main 02: §4.0 요약, 목적/§7 문서 표 갱신
- docs/report 03_AI, 19: 위치·근거 문서 경로 수정

Changed files: docs/README.md, README.md, docs/main/00_PRD.md, docs/main/01_FRONTEND_GUIDE.md, docs/main/02_BACKEND_GUIDE.md, docs/report/03_AI_DEVELOP_GUIDE.md, docs/report/19_Project_Creation_Overhaul.md, docs/log/log.md

267. 2026-04-08 대시보드·위젯보드 프로젝트 전환 시 데이터 재조회 보강
Purpose: refreshMe에서 project_info_id가 null↔값 포함해 바뀔 때마다 projectContextNonce 증가. 대시보드는 목록 반영 후 tableListRevision으로 동일 tableId여도 집계 재실행. 위젯보드는 mount skip ref 제거·prevProjectNonceRef로 전환 시 캐시 비우고 재조회.

Changes:

- AuthContext refreshMe: prev/next project_info_id 문자열 비교만으로 nonce
- CampaignDashboardPage: tableListRevision, loadData 의존
- Dashboard3Page: prevProjectNonceRef

Changed files: Frontend/react-app/src/app/auth/AuthContext.jsx, Frontend/react-app/src/packages/campaign_dashboard/CampaignDashboardPage.jsx, Frontend/react-app/src/packages/widgetboard/Dashboard3Page.jsx, docs/log/log.md

266. 2026-04-08 org 관리자 타부서 프로젝트 API 차단 복귀·작업프로젝트 드롭다운 목록 갱신
Purpose: 프로젝트 관리 주체는 소속 부서 관리자 — require_project_admin_or_operator_participant 에서 ORG_ADMIN은 pd=did만 허용(참여자 예외 제거). 헤더 드롭다운은 생성·초대수락·라우트 전환 시 GET /api/projects 재조회.

Changes:

- admin_server deps: ORG_ADMIN_DVSN 타부서 참여자 통과 제거
- AuthContext: participatingProjectsNonce, notifyParticipatingProjectsChanged
- ProjectHeaderSelect: pathname·nonce 의존 load
- AdminProjectsPage 생성 후 notify, NotificationBell 수락 후 notify

Changed files: Backend/admin_server/deps.py, Backend/admin_server/service_projects.py(doc), Frontend/react-app/src/app/auth/AuthContext.jsx, Frontend/react-app/src/app/layout/ProjectHeaderSelect.jsx, Frontend/react-app/src/app/admin/AdminProjectsPage.jsx, Frontend/react-app/src/app/layout/NotificationBell.jsx, docs/log/log.md

265. 2026-04-08 타부서 프로젝트 초대: sa/a 관리자도 참여자면 경로·멤버목록 허용
Purpose: ORG_ADMIN_DVSN(a/sa/sa_dev)는 기존에 프로젝트 소속 부서≠사용자 부서이면 참여 여부 없이 403. 초대·수락으로 project_ptcpnt_info에 있어도 막힘. 소속 부서 프로젝트는 예전과 동일, 타부서는 참여자면 허용. list_members도 o 전용이 아니라 참여자 공통으로 허용.

Changes:

- deps require_project_admin_or_operator_participant: org 관리자 타부서는 ptcpnt 행 있을 때만 통과
- service_projects _assert_member_list_allowed: 타부서 시 o 구분 제거·참여자면 허용, canon_user_dvsn import 제거

Changed files: Backend/admin_server/deps.py, Backend/admin_server/service_projects.py, docs/log/log.md

264. 2026-04-08 프로젝트 전환 자동 재조회·타부서(o) 멤버 API 허용
Purpose: refreshMe 시 project_info_id 변경이면 projectContextNonce 증가 — 대시보드·ETL·위젯보드가 새로고침 없이 재조회. 타부서 초대 멤버(o)가 본부 프로젝트에서 타부서 프로젝트로 돌아올 때 deps·list_members가 소속 부서만 검사하던 경로 수정.

Changes:

- AuthContext: projectContextNonce, refreshMe에서 PID 변경 시 증가
- CampaignDashboardPage, ETLPage(refreshKey), Dashboard3Page: nonce 구독
- admin_server deps: o는 project_ptcpnt_info 먼저 확인 후 타부서 허용
- service_projects: _assert_member_list_allowed, list_members에 actor_user_id·actor_dvsn
- admin router: list_members 호출 인자

Changed files: Frontend/react-app/src/app/auth/AuthContext.jsx, Frontend/react-app/src/packages/campaign_dashboard/CampaignDashboardPage.jsx, Frontend/react-app/src/packages/etl/ETLPage.jsx, Frontend/react-app/src/packages/widgetboard/Dashboard3Page.jsx, Backend/admin_server/deps.py, Backend/admin_server/service_projects.py, Backend/admin_server/router.py, docs/log/log.md

263. 2026-04-08 쿼리 스튜디오: 헤더 프로젝트 전환 시 빌더 초기화·테이블 재로드
Purpose: /me project_info_id 변경 시 이전 프로젝트 테이블·조인·결과가 남아 실행 오류가 나지 않도록 resetBuilderState·loadHealth/loadTables·안내 토스트.

Changes:

- QueryStudioPage: resetBuilderState(clearAll 공용), queryRunning/countLoading 상단 이동·전환 시 false, useAuth+prevProjectIdRef 이펙트

Changed files: Frontend/react-app/src/packages/query_studio/QueryStudioPage.jsx, docs/log/log.md

262. 2026-04-08 헤더 작업 프로젝트 드롭다운(이메일·알림 사이)
Purpose: 홈 없이 헤더에서 참여 프로젝트 전환(postSelectProject·refreshMe). 목록 없을 때「참여중인 프로젝트 없음」표시.

Changes:

- ProjectHeaderSelect.jsx, project-header-select.css 추가
- ProtectedLayout: ibank-shell-header-actions 순서(이메일 → 드롭다운 → 알림)

Changed files: Frontend/react-app/src/app/layout/ProjectHeaderSelect.jsx, Frontend/react-app/src/app/layout/project-header-select.css, Frontend/react-app/src/app/layout/ProtectedLayout.jsx, docs/log/log.md

261. 2026-04-08 알림: project_invite 수락 전·후 안내 문구 표시
Purpose: 초대 알림 행에서 수락 시 프로젝트 전환·권한 적용을 미리 안내하고, 수락 완료 행·토스트를 맞춤. postSelectProject 실패 시 sessionStorage needs_select로 홈 선택 안내 표시.

Changes:

- NotificationBell: PROJECT_INVITE_HINT_PENDING/DONE/NEEDS_HOME, nb-item__meta--invite-hint, needs_select 분기
- notification-bell.css: nb-item__meta--invite-hint

Changed files: Frontend/react-app/src/app/layout/NotificationBell.jsx, Frontend/react-app/src/app/layout/notification-bell.css, docs/log/log.md

260. 2026-04-08 타부서 초대 수락 후 JWT 프로젝트 미동기화로 기능 라우트 차단 수정
Purpose: 수락 API만 호출하고 JWT의 project_info_id가 예전 값(또는 null)인 채로 두면 /me permissions가 다른 프로젝트 기준이 되어 ProjectFeatureRoute가 쿼리·대시보드 등을 홈으로 돌림. 수락 직후 postSelectProject(pid)로 토큰 갱신.

Changes:

- NotificationBell handleAcceptProjectInvite: postSelectProject(실패 시 홈 수동 선택 안내)

Changed files: Frontend/react-app/src/app/layout/NotificationBell.jsx, docs/log/log.md

259. 2026-04-08 프로젝트 멤버 추가·강퇴·수락: 양측 알림
Purpose: 부서 내 즉시 멤버 추가·프로젝트 생성 시 부서 멤버 추가·멤버 제외 시 실행자·대상자 모두 notification_info 수신. 타부서 초대 수락 시 초대자(기존)·수락자 본인에 참여 완료 알림 추가.

Changes:

- service_projects: _noti_user_label·_notify_project_member_added_pair·_notify_project_member_removed_pair, create_project_full/add_member/remove_member 연동, remove_member(actor_user_id)
- admin router: 멤버 제거 시 actor user_id 전달
- project_server accept_project_invite: project_join_done(수락자)
- NotificationBell: 내부 JSON 숨김 키 actor_user_id·target_user_id

Changed files: Backend/admin_server/service_projects.py, Backend/admin_server/router.py, Backend/project_server/service.py, Frontend/react-app/src/app/layout/NotificationBell.jsx, docs/log/log.md

258. 2026-04-08 알림: 초대 수락·거절 완료 표시(행·토스트)
Purpose: 초대 수신 알림에서 수락 시 같은 행에 완료 문구·버튼 제거(sessionStorage로 id 보관), 거절 시 행이 사라지므로 패널 상단 토스트로 안내. 성공 시 window.alert 의존 완화.

Changes:

- NotificationBell: inviteAcceptedMap·패널 토스트·nb-item--invite-done 스타일
- notification-bell.css: nb-panel__toast·nb-item__meta--done

Changed files: Frontend/react-app/src/app/layout/NotificationBell.jsx, Frontend/react-app/src/app/layout/notification-bell.css, docs/log/log.md

257. 2026-04-08 알림 패널: 내부용 JSON noti_content 비노출
Purpose: 초대 수락/거절 알림 등 `noti_content`가 DB 연동용 JSON만 담은 경우 목록에 그대로 노출되지 않게 한다. 제목·시각(·초대 만료 안내)만 표시.

Changes:

- NotificationBell: `shouldShowNotiContentBody`(project_invite 제외·알려진 메타 키만 있는 JSON 숨김)

Changed files: Frontend/react-app/src/app/layout/NotificationBell.jsx, docs/log/log.md

256. 2026-04-08 notification_info update_dtm: 읽음·수락 갱신·목록 조회 정합
Purpose: DB에 반영된 `notification_info.update_dtm`과 코드 정합 — 읽음/초대수락 UPDATE 시 `update_dtm = NOW()`, 알림 목록 API에 컬럼 포함·ISO 직렬화.

Changes:

- notification_server: list_notifications SELECT·응답에 update_dtm; mark_read_one·mark_read_all에 update_dtm 갱신
- project_server: accept_project_invite 읽음 UPDATE에 update_dtm 추가
- docs/main/04_DB_ARCHITECTURE: notification_info `create_dtm`/`update_dtm`을 실제 DDL에 맞게 정리

Changed files: Backend/notification_server/service.py, Backend/project_server/service.py, docs/main/04_DB_ARCHITECTURE.md, docs/log/log.md

255. 2026-04-08 accept-invite: notification_info에 update_dtm 미존재 DB 호환
Purpose: 프로젝트 초대 수락 시 `UPDATE notification_info ... update_dtm`으로 UndefinedColumn(500)이 나던 문제를 제거한다. 읽음 처리는 `read_yn`만 갱신(notification_server.mark_read_one과 동일)·수신자 user_id 조건 추가.

Changes:

- accept_project_invite: UPDATE에서 update_dtm 제거, WHERE에 user_id 추가

Changed files: Backend/project_server/service.py, docs/log/log.md

254. 2026-04-03 프로젝트 멤버 추가 API·UI: 타부서 초대 알림·멤버 추가 모달
Purpose: 타부서 사용자 POST /members 시 즉시 INSERT 대신 project_invite JSON 알림만 발송. 멤버 화면에 프로젝트 생성과 동일 포맷의 멤버 추가 모달(부서 내 / 타부서). 초대 취소 핸들러 보완.

Changes:

- add_member: 부서 트리 범위면 project_ptcpnt_info INSERT, 아니면 notification_info INSERT(create_project_full 타부서와 동일 payload). 미수락 중복 초대·본인 추가 차단. notif_service.post-commit 호출 제거.
- admin_project_member_add: outcome별 메시지·응답 필드 outcome.
- AdminProjectMembersPage: ap__header-row·멤버 추가 모달·배치 추가·초대 취소(handleCancelInvite).
- adminClient postAdminProjectMember JSDoc(outcome).

Changed files: Backend/admin_server/service_projects.py, Backend/admin_server/router.py, Frontend/react-app/src/app/admin/AdminProjectMembersPage.jsx, Frontend/react-app/src/shared/api/adminClient.js, docs/log/log.md

253. 2026-04-02 프로젝트 초대: 만료(7일)·거절 API·초대자 수락/거절 알림·UI 만료 표시
Purpose: 초대 JSON에 `invite_expires_at`을 넣고 수락/거절 시 검사하며, 초대자에게 `project_invite_accepted`·`project_invite_rejected` 알림을 남긴다.

Changes:
- service_projects: 생성 시 만료 시각(UTC)·pending 목록에 만료 필드
- project_server: accept에 만료 검사·수락 후 초대자 알림, reject_project_invite·POST reject-invite, 거절 시 초대 알림 DELETE 후 초대자 알림
- Frontend: authClient postRejectProjectInvite, NotificationBell 거절·만료 표시·만료 시 버튼 숨김, 멤버 관리 만료 열·만료 뱃지, notification-bell.css

Changed files: Backend/admin_server/service_projects.py, Backend/project_server/service.py, Backend/project_server/router.py, Frontend/react-app/src/shared/api/authClient.js, Frontend/react-app/src/app/layout/NotificationBell.jsx, Frontend/react-app/src/app/layout/notification-bell.css, Frontend/react-app/src/app/admin/AdminProjectMembersPage.jsx, Frontend/react-app/src/app/admin/admin-pages.css, docs/log/log.md

252. 2026-04-02 프로젝트 타부서 초대: 멤버 목록 pending·초대 취소 API, 알림 수락 피드백·accept 400 통일
Purpose: 미수락 초대를 멤버 UI에 표시하고 취소할 수 있게 하며, 알림에서 수락 시 무반응·취소 후 수락 시 메시지를 명확히 한다.

Changes:
- admin_server: GET members가 list_members dict 그대로 반환, DELETE projects/{id}/invites/{nid}로 cancel_project_invite 연동, router docstring 갱신
- project_server: accept_invite ValueError(알림 없음) 안내 문구 보강, 수락 경로 ValueError를 400으로 통일(_map_accept_invite)
- Frontend: AdminProjectMembersPage에 pending_invites 행·초대 취소(컨펌), adminClient.deleteAdminProjectInvite, NotificationBell 수락 시 refreshMe·성공/실패 alert, admin-pages.css 뱃지·pending 행 스타일

Changed files: Backend/admin_server/router.py, Backend/project_server/router.py, Backend/project_server/service.py, Frontend/react-app/src/shared/api/adminClient.js, Frontend/react-app/src/app/admin/AdminProjectMembersPage.jsx, Frontend/react-app/src/app/admin/admin-pages.css, Frontend/react-app/src/app/layout/NotificationBell.jsx, docs/log/log.md

251. 2026-04-09 가입 페이지: 초대 메일 URL `?code=`·`invite_code=` 쿼리로 초대코드 자동 입력·유효성 힌트
Purpose: 메일의 `/signup?code=…` 링크로 들어올 때 수동 복붙 없이 초대 코드 필드를 채우고 `/api/auth/invite/validate` 안내 표시.

Changes: SignupPage `useSearchParams`, `applyInviteValidation` 공용화·마운트 시 자동 검증.

Changed files: Frontend/react-app/src/app/auth/SignupPage.jsx, docs/log/log.md

250. 2026-04-09 사용자 초대: 발송 성공 시 완료 alert(모달 즉시 닫힘으로 안내 미노출 보완)
Purpose: 초대 API 성공 직후 `setInviteOpen(false)`만 하여 `inviteMsg`가 화면에 남지 않아 발송 여부를 알기 어려움.

Changes: 성공 시 모달 닫은 뒤 `window.alert('초대 메일을 발송했습니다.')`.

Changed files: Frontend/react-app/src/app/admin/AdminUsersPage.jsx, docs/log/log.md

249. 2026-04-09 사용자관리 409 모달「목록 열고 이관」: 작업물 API 로드 누락 수정(이관 쿼리 NaN 방지)
Purpose: 정지 409 후 모달에서 목록만 펼쳐 `work-assets`를 호출하지 않아 이관 시 `dptmt_info_id=NaN` 등 잘못된 GET 쿼리가 나가던 문제 수정.

Changes: 버튼 클릭 시 `getAdminUserWorkAssets` 호출·로딩 상태·캐시 갱신.

Changed files: Frontend/react-app/src/app/admin/AdminUsersPage.jsx, docs/log/log.md

248. 2026-04-09 Admin 프로젝트 목록: 사용자관리와 동일 작업 패턴(비활성 시 활성·삭제만)·수정 모달에서 활성 셀렉트 제거
Purpose: 프로젝트 관리 작업 열 UX를 사용자 관리와 맞추고, 활성/비활성 전환은 목록 버튼만 사용.

Changes: 활성 행 — 멤버·수정·비활성화(조직 어드민) / 비활성 행 — 활성(primary)·삭제(purge)(조직 어드민만). `admin-users__actions`. 수정 PATCH에서 `active_yn` 제거.

Changed files: Frontend/react-app/src/app/admin/AdminProjectsPage.jsx, docs/log/log.md

247. 2026-04-09 비활성 프로젝트 가드: 권한 0·require_permission 403·선택(rotate) 차단·비활성화 후 refreshMe
Purpose: `active_yn!=Y` 인데도 JWT에 `project_info_id`가 남아 대시보드/쿼리/위젯 API·화면이 통과하던 문제 수정.

Changes: `is_project_active`, `compute_effective_project_permission_ids` 선제 반환 `[]`, `require_permission` 실패 시 비활성 전용 문구, `rotate_session_tokens_with_project`에서 비활성 선택 거절, AdminProjectsPage 비활성화 성공 시 현재 선택 프로젝트면 `refreshMe`, 05 문서 STEP 3b.

Changed files: Backend/auth_server/permissions.py, service.py, Frontend/react-app/src/app/admin/AdminProjectsPage.jsx, docs/main/05_Permission_ARCHITECTURE.md, docs/log/log.md

246. 2026-04-09 Admin 프로젝트: 비활성만 DB 완전 삭제(purge)·참여·매핑·알림·초대 참조 선행 정리
Purpose: 비활성화 후 `project_info` 행을 제거할 수 있게 하고, FK·업무 데이터 정합을 위해 단일 트랜잭션에서 선행 DELETE/UPDATE를 수행.

Changes: `purge_inactive_project`(알림 project_invite·user_info/email_invite 초대 쌍 NULL·table_project_mapping·project_ptcpnt_info·project_info), `DELETE .../purge`, `purgeAdminProject`, 목록「DB에서 삭제」버튼·선택 프로젝트면 `refreshMe`.

Changed files: Backend/admin_server/service_projects.py, router.py, Frontend/react-app/src/shared/api/adminClient.js, Frontend/react-app/src/app/admin/AdminProjectsPage.jsx, docs/log/log.md

245. 2026-04-09 사용자관리: 「초대자 등록상태」표기 통일(섹션·409·가드 문구)
Purpose: 작업물 목록 섹션 제목·409 그룹 제목·백엔드 차단 사유 문구를 사용자 지정 용어로 맞춤.

Changed files: Frontend/react-app/src/app/admin/AdminUsersPage.jsx, Backend/admin_server/ownership_guards.py, docs/log/log.md

244. 2026-04-09 프로젝트 참여 초대자 기록: 작업물·가드·project_invite 이관·무단 SQL 치환 제거
Purpose: invite_user_id NOT NULL을 COALESCE로 덮어쓰지 않고, 목록에 노출·이관 후에만 정지·삭제 허용.

Changes: ownership_guards·_collect_system_owned_for_guard(for_suspend 시 project_invite blocking), get_user_work_assets(invited_project_participants), transfer_resource_ownership(project_invite), delete에서 invite UPDATE 제거, schemas·AdminUsersPage 섹션·가이드 라벨.

Changed files: Backend/admin_server/ownership_guards.py, service_users.py, schemas.py, Frontend/react-app/src/app/admin/AdminUsersPage.jsx, Frontend/react-app/src/shared/api/adminClient.js, docs/log/log.md

243. 2026-04-09 delete_inactive_user: project_ptcpnt_info.invite_user_id NOT NULL 위반 수정(이관 UPDATE)
Purpose: 비활성 사용자 DELETE 시 `invite_user_id = NULL` UPDATE가 컬럼 NOT NULL 제약으로 500 발생.

Changes: NULL 대신 `COALESCE(NULLIF(project_info.create_user_id, 삭제대상), ptcpnt_user_id)`로 초대자 참조를 유효한 사용자로 치환 후 `user_info` DELETE.

Changed files: Backend/admin_server/service_users.py, docs/log/log.md

242. 2026-04-02 ibank-btn-table--primary 제거(솔리드): 활성 버튼도 일반 액션 아웃라인·호버와 동일
Purpose: 사용자관리 등「활성」이 --primary로 솔리드만 적용되어 목록·변경과 톤이 달랐음. --primary 전용 규칙 삭제로 기본 테이블 버튼 규칙만 적용.

Changed files: Frontend/react-app/src/styles/shared-ui.css, docs/log/log.md

241. 2026-04-02 ibank-btn-table: 일반 아웃라인 그린(#0a8f6e)·호버 채움 / danger 아웃라인 #fe5655·호버 채움
Purpose: 솔리드 빨강으로 호버 변화가 없어 UX가 단조로워져, 일반·파괴 모두 흰 배경+테두리 기본·호버 시 해당 색으로 채움. 활성 등은 `--primary`로 솔리드 그린 유지.

Changes: shared-ui 테이블 버튼 기본·호버·focus-visible, --primary·--danger 특이도 체인 정리.

Changed files: Frontend/react-app/src/styles/shared-ui.css, docs/log/log.md

240. 2026-04-02 ibank-btn-table--danger: button 기본 규칙보다 낮던 특이도 보완·호버도 #dc2626 유지
Purpose: `button.ibank-btn-table`가 배경 #fff를 주어 `.ibank-btn-table--danger`만으로는 적용이 안 보이던 문제 수정. 일반·호버 모두 요청 색 #dc2626·흰 글자 유지.

Changes: `.ibank-btn-table.ibank-btn-table--danger` 및 `button`/`a` 조합으로 특이도 상승.

Changed files: Frontend/react-app/src/styles/shared-ui.css, docs/log/log.md

239. 2026-04-02 어드민 테이블 파괴 액션 버튼: ibank-btn-table--danger 솔리드 레드(#dc2626) 통일
Purpose: 정지·삭제·권한 삭제·프로젝트 비활성화·멤버 제거·부서 삭제 등 동일 성격 버튼을 흰 글자·레드 배경으로 통일.

Changes: `shared-ui.css` `.ibank-btn-table--danger` 기본·호버(#b91c1c)·focus-visible. 사용처는 사용자·권한·프로젝트·멤버·부서 관리 페이지의 기존 `--danger` 클래스만(추가 JSX 변경 없음).

Changed files: Frontend/react-app/src/styles/shared-ui.css, docs/log/log.md

238. 2026-04-02 Admin 사용자관리: 비활성 행 작업 열 축소·비활성 사용자 DELETE·소유 가드 모달 분기
Purpose: 비활성 사용자 행에서는 목록·변경·정지를 숨기고 활성·삭제만 표시해 작업 열 폭을 줄이고, 비활성 계정을 DB에서 제거할 수 있게 함. 삭제도 정지와 동일 소유 검사(409)를 적용하되 비활성 행에는 목록이 없으므로 409 모달은 안내·닫기만(목록 열기 버튼 없음).

Changes:
- delete_inactive_user: 활성 거절·소유 가드·연관 로그·참여·초대코드 정리 후 user_info DELETE; DELETE /api/admin/users/{id}
- adminClient.deleteAdminUser; AdminUsersPage: 활성=목록·변경·정지, 비활성=활성·삭제(본인 제외), 작업물 패널은 활성+펼침일 때만; ownershipGateModal로 정지/삭제 409 분기
- renderOwnershipBlock 힌트 variant(delete 시 활성화 후 목록 이관 안내)
Changed files: Backend/admin_server/service_users.py, router.py, Frontend/react-app/src/shared/api/adminClient.js, Frontend/react-app/src/app/admin/AdminUsersPage.jsx, docs/log/log.md

237. 2026-04-03 비활성(정지) 계정: 세션 무효·API·리프레시에서 user_active_yn 검사
Purpose: 정지 후에도 기존 access JWT만으로 이용되던 문제 수정 — 정지 시 해당 사용자 session_log 만료, 보호 API는 DB에서 활성·미잠금 확인, refresh·프로젝트 토큰 회전·OTP 완료 시에도 동일 검사.

Changes:
- suspend_user: invalidate_all_sessions(do_commit=False) 후 단일 commit
- require_active_access + admin get_authenticated_user_row에서 user_active_yn·user_lock_yn
- /api/auth/me 등·require_permission·프로젝트·알림 라우트 연동; POST /logout은 기존처럼 JWT만(정지자도 세션 정리 가능)
- refresh_session_tokens, rotate_session_tokens_with_project, verify_login_complete 보강
Changed files: Backend/auth_server/deps.py, service.py, router.py, permissions.py, Backend/admin_server/service_users.py, deps.py, Backend/project_server/router.py, Backend/notification_server/router.py

235. 2026-04-02 ETL: 접이식 카드·목록 thead 테두리를 설명 열 헤더 톤(--etl-table-list-th-description-border)으로 통일
Purpose: etl-db-form 접이식 카드가 페이지 배경과 구분이 어려워, ETL 목록 thead(설명 열 포함)와 동일한 그린 테두리 톤을 적용.

Changes: `.etl-page`에 `--etl-table-list-th-description-border: rgba(0, 112, 74, 0.38)` 정의. `etl-db-form__section--card.etl-db-form__section--collapsible` 외곽선·카드 본문 상단 구분선, `etl-table-list__table thead th`에 동일 변수(폴백 동일값) 적용.

Changed files: Frontend/react-app/src/packages/etl/etl.css, docs/log/log.md

236. 2026-04-03 프로젝트 유효 권한: sa_dev/sa/a 자동 UI 권한 확장 제거(pmssn∩feature_flags만)
Purpose: 조직 역할이 sa_dev/sa/a인 계정이 프로젝트에서 쿼리 역할만 받아도 대시보드·위젯이 열리던 문제 수정.

Changes: `compute_effective_project_permission_ids`에서 `_AUTO_PROJECT_ROLES` 합집합 제거. 유효 권한은 항상 `pmssn_list(정규화) ∩ feature_flags`. docs/main/05_Permission_ARCHITECTURE.md STEP 4~6·엣지 표 갱신.

Changed files: Backend/auth_server/permissions.py, docs/main/05_Permission_ARCHITECTURE.md, docs/log/log.md

234. 2026-04-02 ETL 페이지: 설명을 소스 탭 아래 접이식 카드로 이동·탭 전환 떨림 완화
Purpose: 탭별로 길이·높이가 다른 리드·안내 블록이 헤더 아래에 있어 전환 시 레이아웃이 위아래로 밀리는 현상 완화.

Changes:
- PageHeader에서 `description`(etlLead) 제거.
- `SourceTypeSelector` 직후 `CollapsibleCardSection`(기본 닫힘)에 etlLead + 기존 `etl-page__tip` 내용 배치. 탭 전환 시 `key={sourceType}`로 카드 상태 초기화.
- etl.css: `etl-page__guide-wrap`, `etl-page__guide-lead`, `etl-page__tip--in-card`.

Changed files: Frontend/react-app/src/packages/etl/ETLPage.jsx, etl.css, docs/log/log.md

233. 2026-04-03 프로젝트 PATCH 후 현재 선택 프로젝트면 refreshMe — 네비·ProjectFeatureRoute와 /me 동기화
Purpose: 어드민에서 feature_flags 수정 후 세션 유지 시 /me.permissions가 옛값이라 네비·가드가 꺼진 페이지로 통과하던 문제 수정.

Changes: AdminProjectsPage handleEditSubmit 성공 시 `me.project_info_id`와 수정 대상 id가 같으면 `refreshMe()` 호출. ProjectFeatureRoute 주석에 스냅샷·refreshMe 안내.

Changed files: Frontend/react-app/src/app/admin/AdminProjectsPage.jsx, app/guards/ProjectFeatureRoute.jsx, docs/log/log.md

232. 2026-04-03 project_info.feature_flags: query·dash·widget DB 컬럼 기준으로 권한·어드민 API 통일(enabled_pages 제거)
Purpose: `enabled_pages` 문자열 배열 저장 방식을 제거하고, 사용자 DDL과 동일한 `feature_flags` jsonb로 생성·수정·effective 권한을 맞춤.

Changes:
- permissions: `get_project_enabled_feature_ids`가 `feature_flags`만 조회·query→query.read/execute, dash→dashboard, widget→widgetboard 매핑.
- admin schemas: `ProjectFeatureFlags`, Create/Update 바디의 `feature_flags`.
- service_projects: INSERT/SELECT/UPDATE `feature_flags`, `normalize_feature_flags_for_db`.
- router: create/patch에 `model_dump()` 전달.
- AdminProjectsPage·adminClient: 요청·목록 필드 `feature_flags`.
- docs: 04_DB_ARCHITECTURE §8, 19_Project_Creation_Overhaul, 06_CUSTOMER_JOURNEY Phase 6 반영.

Changed files:
- Backend/auth_server/permissions.py
- Backend/admin_server/schemas.py, service_projects.py, router.py
- Frontend/react-app/src/app/admin/AdminProjectsPage.jsx
- Frontend/react-app/src/shared/api/adminClient.js
- Frontend/react-app/src/app/guards/ProjectFeatureRoute.jsx (주석)
- docs/main/04_DB_ARCHITECTURE.md, docs/report/19_Project_Creation_Overhaul.md, docs/main/06_CUSTOMER_JOURNEY.md
- docs/log/log.md

231. 2026-04-03 enabled_pages: 홈 진입 경로·사이드바·ProjectFeatureRoute·프로젝트 수정 모달 통합
Purpose: 대시보드만 켠 프로젝트에서 쿼리 스튜디오로 고정 이동되던 문제를 막고, 미허용 기능은 API(기존 require_permission)·UI에서 접근 불가에 가깝게 정리.

Changes:
- homeAccess: pickDefaultProjectPath(대시보드→쿼리→위젯 순). HomePage: postSelectProject 후 refreshMe 반환값으로 이동·「계속」버튼 동일.
- AuthContext: refreshMe가 갱신된 프로필을 반환.
- routes: NeedProjectRoute 내부에 ProjectFeatureRoute(query-studio|dashboard|widgetboard).
- ProtectedLayout: NAV_ITEMS에서 /me 권한 없는 프로젝트 작업 메뉴 제외.
- adminClient: getAdminProjectTables, patchAdminProject 바디에 enabled_pages·table_master_ids.
- AdminProjectsPage: 생성·수정 단일 모달(수정 시 멤버·타부서 섹션 제외), enabled_pages·테이블 매핑 로드·PATCH, 운영자(o)는 페이지·테이블 필드 잠금.
- admin PATCH: update_project에 enabled_pages·table_master_ids 전달, service update 분기에서 불필요한 cur.close 제거, schemas 보강.

Changed files:
- Frontend/react-app/src/app/home/homeAccess.js
- Frontend/react-app/src/app/home/HomePage.jsx
- Frontend/react-app/src/app/auth/AuthContext.jsx
- Frontend/react-app/src/app/routes.jsx
- Frontend/react-app/src/app/guards/ProjectFeatureRoute.jsx
- Frontend/react-app/src/app/layout/ProtectedLayout.jsx
- Frontend/react-app/src/shared/api/adminClient.js
- Frontend/react-app/src/app/admin/AdminProjectsPage.jsx
- Backend/admin_server/router.py
- Backend/admin_server/schemas.py
- Backend/admin_server/service_projects.py
- docs/log/log.md

230. 2026-04-08 프로젝트 초대·멤버 검색: 일반 부서에서 개발부서(dptmt 0) 계정 비노출·API 차단
Purpose: 타부서 초대 이메일 검색·멤버 추가에 개발(시스템) 부서 소속이 나오지 않도록 함. sa_dev 또는 소속 부서 PK=0 인 경우만 예외.
Changes: `search_users_by_email(exclude_dptmt_zero)`, 라우터 조건; `create_project_full`·`add_member`에 `actor_dvsn` 및 대상 `dptmt_info_id=0` 검증.

Changed files: Backend/admin_server/service_projects.py, service_users.py, router.py, docs/report/19_Project_Creation_Overhaul.md, docs/log/log.md

229. 2026-04-08 Admin 프로젝트 멤버: 검색 인풋·버튼 동일 라인(ap__member-add-inline)
Purpose: 라벨+인풋을 한 flex 아이템에 두면 검색 버튼이 인풋과 수직으로 맞지 않음. 안내 문구는 별도 행, 인풋·검색만 `ap__member-add-inline` 한 줄·`align-items: center`로 정렬.
Changed files: Frontend/react-app/src/app/admin/AdminProjectMembersPage.jsx, admin-pages.css, docs/log/log.md

228. 2026-04-08 Admin 프로젝트 멤버: 초대자·참여일시 열·권한 셀렉트·검색 행 정렬
Purpose: 멤버 목록 테이블 컬럼·용어 정합, 권한 변경 전 컨펌, 검색 입력·버튼 한 줄 및 입력 폭 50px 축소. API에 초대자 표시용 필드 추가.
Changes:

- `list_members`: `invite_user_id`·`invite_user_email`·`invite_user_nickname` LEFT JOIN
- AdminProjectMembersPage: 초대자·참여일시, 프로젝트 권한 라벨·셀렉트 폰트·변경 컨펌, 멤버 추가 행 `ap__member-add-row`
- admin-pages: `ap__member-add-*`, `ap__select--table-in-cell`, `ap__td-clip-inviter`

Changed files: Backend/admin_server/service_projects.py, Frontend/react-app/src/app/admin/AdminProjectMembersPage.jsx, admin-pages.css, docs/log/log.md

227. 2026-04-08 Admin 프로젝트 목록 테이블: 프로젝트명·설명 열 분리·말줄임·작업 버튼 통일
Purpose: 프로젝트 관리 목록을 사용자·권한 등 관리 테이블과 동일한 nowrap·말줄임·소형 액션 버튼 패턴으로 정리.
Changes:

- AdminProjectsPage: 헤더 프로젝트명·프로젝트설명, 설명 전용 열·`ap__cell-clip`, 멤버 관리 `Link`를 `ibank-btn-table`로 통일
- admin-pages: `ap__table--projects` 열 폭·모바일 보정
- shared-ui: `a.ibank-btn-table` 기본·hover(primary/danger 포함)

Changed files: Frontend/react-app/src/app/admin/AdminProjectsPage.jsx, admin-pages.css, styles/shared-ui.css, docs/log/log.md

226. 2026-04-03 프로젝트 생성 모달: 가로 폭 확대·바깥 클릭으로 닫힘 제거
Purpose: 실수로 오버레이 클릭 시 폼이 초기화·닫히는 불편 완화. 닫기는「닫기」「취소」만 사용.
Changes: `ap__modal--create-wide` min/max 폭 조정(약 1040~1200px 상한). 생성 모달 오버레이 `onClick` 제거.

Changed files: Frontend/react-app/src/app/admin/AdminProjectsPage.jsx, admin-pages.css, docs/log/log.md

225. 2026-04-03 고객여정 Phase 6: 프로젝트 생성 흐름을 create_project_full·accept-invite 기준으로 갱신
Purpose: 점검에서 지적한 `docs/main/06_CUSTOMER_JOURNEY.md` Phase 6 레거시(`default_manager_pmssn_master_id`, 생성 후 별도 테이블 매핑만 서술)를 제거하고, 현행 API·서비스명과 일치시킴. Phase 5 산출물의 다음 단계 문구·Phase 7 서두(생성 시 이미 반영된 멤버) 보강. 명세 19의 사용자 목록 함수명·roles 쿼리·Phase 3 체크 문구 정합.
Changes:

- 06_CUSTOMER_JOURNEY: Phase 6 다이어그램·본문 전면, 생성 후 추가 매핑/멤버 안내, Phase 7 연결 문구
- 19_Project_Creation_Overhaul: `list_users_dept_tree_for_project_create`, `roles?scope=project_assignable`, Phase 3·요약

Changed files: docs/main/06_CUSTOMER_JOURNEY.md, docs/report/19_Project_Creation_Overhaul.md, docs/log/log.md

224. 2026-04-03 프로젝트 생성 전면 개편: creator_pmssn·테이블·멤버·타부서 초대·수락 API
Purpose: 시스템 기본 pmssn 자동 배정 제거. 생성 API 확장·알림 수락·관리 화면 모달·문서 인덱스 갱신.
Changes:

- Backend: `create_project_full`, `accept_project_invite`, `GET /users?scope=dept_tree`, `GET /tables?sort=project_create`, 스키마 `ProjectCreateBody` 확장
- Frontend: `AdminProjectsPage` 생성 모달, `NotificationBell` project_invite 수락, `adminClient`·`authClient` API 래퍼
- docs: `00_ReportIndex`에 19번, `docs/report/19_Project_Creation_Overhaul.md` 참고
Changed files: Backend/admin_server/service_projects.py, service_users.py, service_tables.py, router.py, schemas.py, Backend/project_server/service.py, router.py, Frontend/react-app/src/app/admin/AdminProjectsPage.jsx, admin-pages.css, shared/api/adminClient.js, authClient.js, app/layout/NotificationBell.jsx, notification-bell.css, docs/report/00_ReportIndex.md, docs/log/log.md

223. 2026-04-03 ETL batch_target_registry: create_user_id SELECT 누락 보완·폴더 등록자 COALESCE로 생성자 이메일 보강
Purpose: `list_batch_target_registry` 메인 SELECT에 `j.create_user_id`가 없어 `_enrich_rows_create_user_label`이 동작하지 않고 SQL 폴백 `ID n`만 노출되던 문제 수정. `_registry_batch_jobs_cols_sql`에 `create_user_id`(가능 시 `COALESCE(j.create_user_id, c.create_user_id)`) 추가, `user_info` JOIN·라벨 CASE도 동일 식 사용.
Changes: `Backend/etl_server/service_file.py` (`_registry_batch_jobs_cols_sql`, `list_batch_target_registry`)

Changed files: Backend/etl_server/service_file.py, docs/log/log.md

222. 2026-04-03 사용자관리: 등록 부서 목록·생성자 이관(dptmt_creator)·역할 변경 스마트 가드(409)
Purpose: work-assets에 dptmt_create_user_id 부서 표시, 이관은 동일 부서 트리 내 SA·SA_DEV만, SA가 비SA로 변경 시 등록 부서 잔존 시 409·blocking_assets
Changes:

- get_user_work_assets: created_departments, 이관 API resource_type dptmt_creator·list_department_creator_transfer_targets·transfer_resource_ownership
- ownership_guards: dptmt_creator 논리 타입·build_ownership_violation_payload departments
- update_user_management: 부서 생성자 전용 ValueError 제거(가드로 일원화)
- AdminUsersPage·adminClient: 섹션·이관 모달·ownershipGroupTitle
Changed files: Backend/admin_server/service_users.py, ownership_guards.py, router.py, schemas.py, Frontend/react-app/src/app/admin/AdminUsersPage.jsx, Frontend/react-app/src/shared/api/adminClient.js

221. 2026-04-03 ETL 패키지: 생성자 본인 배지 정합(adminAccess·log219) 모듈 주석·Dependencies 보강
Purpose: 동작 코드는 이미 `isEtlCreateLabelSelf(me, label, create_user_id)` 사용 중 — 파일 상단에 `/api/auth/me`의 `email`·`user_id`와의 정합·log 219 교차 참조를 명시해 이후 수정 시 회귀 방지.
Changes: `ETLTableList.jsx`, `BatchJobListFile.jsx`, `FolderConnectionListFile.jsx`, `JobHistoryPanel.jsx` docstring·Dependencies

Changed files: Frontend/react-app/src/packages/etl/components/ETLTableList.jsx, BatchJobListFile.jsx, FolderConnectionListFile.jsx, JobHistoryPanel.jsx, docs/log/log.md

220. 2026-04-02 update_user_management 역할 UPDATE 들여쓰기 수정(허용 역할도 DB 미반영 버그)
Purpose: 허용된 역할 변경 시에도 user_dvsn UPDATE가 실행되지 않던 논리 오류 수정
Changes:

- `if nd not in allowed: raise` 이후의 `if td_before != nd`·UPDATE·u일 때 etl_yn 동기화 블록을 동일 `if user_dvsn is not None` 수준으로 이동(허용 시에만 실행)
Changed files: Backend/admin_server/service_users.py

219. 2026-04-03 생성자「본인」배지: /api/auth/me 의 email·user_id와 목록 FK 정합
Purpose: `isCreatorSelfEmail`이 `me.user_email`만 읽어 `/me` 응답(`email`)과 불일치·본인 배지 미표시. `meLoginEmail`·`isCreatorSelf`(이메일 또는 project_create_user_id·dptmt_create_user_id·creator_user_id·create_user_id)로 수정. ETL은 `create_user_id` 인자 추가.
Changes: `adminAccess.js`, admin·ETL 생성자 열, `service_projects`·`service_users` 부서·`service_roles` 목록에 생성자 FK 포함

Changed files: Frontend/react-app/src/app/admin/adminAccess.js, AdminOrgPage.jsx, AdminRolesPage.jsx, AdminProjectsPage.jsx, packages/etl/components/ETLTableList.jsx, BatchJobListFile.jsx, FolderConnectionListFile.jsx, JobHistoryPanel.jsx, Backend/admin_server/service_projects.py, service_users.py, service_roles.py, docs/log/log.md

218. 2026-04-03 ETL 등록·배치 Job 테이블: 생성자 열을 동작 열 바로 앞으로 이동
Purpose: `etl-table-list__table`은 저장 DB → 상태 → 생성자 → 동작 순으로 정렬. `etl-batch-job-list__table`은 유형·Job 이름·소스…·다음 예상 실행 다음에 생성자·동작.
Changes: `ETLTableList.jsx`, `BatchJobListFile.jsx`, `docs/log/log.md`

Changed files: Frontend/react-app/src/packages/etl/components/ETLTableList.jsx, BatchJobListFile.jsx, docs/log/log.md

217. 2026-04-03 사용자 변경·정지: 소유 매트릭스 스마트 검사(409·blocking_assets)·ownership_guards
Purpose: 목표 `user_dvsn`·`etl_yn`(또는 정지) 기준으로 프로젝트·커스텀 pmssn·table_master·ETL 메타 소유 가능 여부를 매트릭스로 판정. 불가 시 409·`blocking_assets`·`allowed_assets`. 프론트 변경 모달·정지 안내 모달. `user_has_transferable_ownership`·`_assert_role_change_allowed_for_owned_assets` 제거.
Changes: `ownership_guards.py`, `service_users.py`, `router.py`, `AdminUsersPage.jsx`, `admin-users.css`, `docs/log/log.md`

Changed files: Backend/admin_server/ownership_guards.py, Backend/admin_server/service_users.py, Backend/admin_server/router.py, Frontend/react-app/src/app/admin/AdminUsersPage.jsx, Frontend/react-app/src/app/admin/admin-users.css, docs/log/log.md

216. 2026-04-03 ETL 목록 동작 열: 글자 버튼 sm 크기 복구·×(행 삭제)만 소형 유지
Purpose: 전역 `.etl-db-form__btn--sm`를 과도하게 줄여 등록 ETL·배치 등 테이블의「미리보기·실행·삭제」까지 모두 작아진 문제를 바로잡는다. × 한 건만 `.etl-db-form__btn--sm.etl-table-list__delete-row`로 22px 고정.
Changes: `etl.css` — sm 패딩·글자 크기 복구, compact 테이블에서 sm 0.7rem 강제 제거, delete-row 셀렉터에 `.etl-db-form__btn--sm` 포함해 글자 버튼 규칙과 구분

Changed files: Frontend/react-app/src/packages/etl/etl.css, docs/log/log.md

215. 2026-04-03 ETL create_user_label: user_info JOIN만 쓸 때 core 보강 누락으로「ID n」표시되던 문제 수정
Purpose: ETL DB 스키마에 `user_info`가 있으면 SQL LEFT JOIN만 수행하고 `_enrich_rows_create_user_label`(system_core 정본)을 호출하지 않아, ETL 쪽 `user_info`에 해당 `user_id` 행이 없거나 이메일·닉네임이 비어 있으면 `ID 4` 같은 폴백만 노출되었다. 사용자 이관 누락이 아니라 보강 조건(`not ui_tbl`일 때만 호출) 버그다.
Changes:

- `service.py`: `list_etl_tables`, `get_etl_table`, `list_jobs`에서 `create_user_id` 컬럼이 있으면 JOIN 여부와 관계없이 `_enrich_rows_create_user_label` 호출. 함수 docstring·모듈 헤더 설명 갱신.
- `service_file.py`: `list_folder_connections`, `list_batch_jobs`, `get_batch_job`, `list_batch_target_registry` 동일.

Changed files: Backend/etl_server/service.py, Backend/etl_server/service_file.py, docs/log/log.md

214. 2026-04-03 사용자 변경: 역할 미변경 시 소유물 검사 생략(etl_yn만 부여 가능)
Purpose: `PUT .../management`에 `user_dvsn`이 항상 포함될 때, 캐논 역할이 기존과 같으면 `_assert_role_change_allowed_for_owned_assets`·`UPDATE user_dvsn`·u일 때 etl_yn 클리어를 건너뜀. 동일 dvsn에서 etl_yn·부서·프로젝트만 바꿀 수 있음.
Changes: `Backend/admin_server/service_users.py` `update_user_management`

Changed files: Backend/admin_server/service_users.py, docs/log/log.md

213. 2026-04-03 ETL 등록·배치 Job 목록: 테이블 스크롤 래퍼 통일(etl-db-form__table-wrap)·새로고침 버튼 통일(ibank secondary)
Purpose: 등록 ETL만 `etl-table-list__table-wrap`를 쓰던 것을 배치 Job 목록과 동일한 `etl-db-form__table-wrap`로 맞추고, 배치 쪽 전용 `etl-batch-job-list__refresh` 스타일을 제거해 같은 화면의 새로고침이 모두 `ibank-btn-toolbar ibank-btn-toolbar--secondary`로 보이게 한다. 터치 스크롤은 공용 래퍼에 `-webkit-overflow-scrolling: touch`를 추가하고, ETL 목록은 툴바 아래 중복 여백을 피하려 `.etl-table-list > .etl-db-form__table-wrap { margin-top: 0 }`로 조정한다.
Changes:

- `ETLTableList.jsx`: 테이블을 `etl-db-form__table-wrap`로 감쌈
- `BatchJobListFile.jsx`: 새로고침 클래스를 ibank 툴바 secondary로 변경
- `etl.css`: `etl-table-list__table-wrap` 제거, `etl-batch-job-list__refresh` 블록 제거, `etl-db-form__table-wrap` 보강 및 ETL 목록 하위 마진 오버라이드

Changed files: Frontend/react-app/src/packages/etl/components/ETLTableList.jsx, BatchJobListFile.jsx, packages/etl/etl.css, docs/log/log.md

212. 2026-04-03 ETL 관리자 표시·권한 정합: etl_yn vs 프로젝트 pmssn 안내·etl_manager 판별·u 역할 시 etl_yn 동기화
Purpose: 사용자관리「ETL 관리」열이 `user_info.etl_yn`·SA_DEV(및 레거시 etl_manager)만 반영함을 UI에 명시. 프로젝트 권한(project_all 등)만 바꿔서는 열이 안 바뀌는 것이 정상임을 안내. `permissions.user_has_etl_infrastructure_access`에서 etl_manager가 canon 후 비교되어 도달 불가이던 버그 수정. `update_user_management`에서 조직 역할을 u로 변경 시 etl_yn을 N으로 맞춤(이후 본문 etl_yn이 있으면 그대로 재설정 가능).
Changes: `permissions.py`, `service_users.py`, `AdminUsersPage.jsx`, `etlAccess.js`, `docs/log/log.md`

Changed files: Backend/auth_server/permissions.py, Backend/admin_server/service_users.py, Frontend/react-app/src/app/admin/AdminUsersPage.jsx, Frontend/react-app/src/app/guards/etlAccess.js, docs/log/log.md

211. 2026-04-03 ETL 등록 목록: 새로고침 툴바를 테이블 가로 스크롤 밖으로 분리(ibank-btn-toolbar)
Purpose: `.etl-table-list`에 걸려 있던 `overflow-x: auto` 때문에 새로고침 버튼이 넓은 테이블과 함께 가로로 밀려 보이던 문제를 제거한다. 부서 관리의 `admin-org__table-wrap`과 같이 스크롤은 테이블 래퍼만 담당한다.
Changes:

- `ETLTableList.jsx`: `<div class="etl-table-list__table-wrap">`로 `<table>`만 감쌈, 새로고침에 `ibank-btn-toolbar ibank-btn-toolbar--secondary`
- `etl.css`: 루트 overflow 제거, `__table-wrap`에 가로 스크롤, 전용 `__refresh` 스타일 제거(공용 툴바로 대체)
- `JobHistoryPanel.jsx`: 동일 툴바 클래스로 정합(삭제된 `__refresh` CSS 의존 제거)

Changed files: Frontend/react-app/src/packages/etl/components/ETLTableList.jsx, JobHistoryPanel.jsx, packages/etl/etl.css, docs/log/log.md

210. 2026-04-03 관리·ETL 생성자 열: 이메일 셀 패턴으로 통일(전원 배지 제거)
Purpose: 생성자 이메일/라벨을 `admin-users__self-badge`로 감싸 전부 pill처럼 보이던 것을 사용자 관리의 `admin-users__email-cell` + `admin-users__email-text`와 동일하게 표시하고, 본인 행만「본인」배지를 붙인다.
Changes:

- `adminAccess.js`: `isCreatorSelfEmail`, `isEtlCreateLabelSelf`
- 부서·권한·프로젝트: JSX 교체, `ap__creator-cell`·`admin-org__creator-cell` CSS 정리(배지 래퍼 제거)
- ETL 목록·배치·폴더연결·이력: 동일 패턴, `etl.css` 생성자 열 폭 규칙 갱신

Changed files: Frontend/react-app/src/app/admin/adminAccess.js, AdminOrgPage.jsx, AdminRolesPage.jsx, AdminProjectsPage.jsx, admin-pages.css, admin-org.css, packages/etl/components/ETLTableList.jsx, BatchJobListFile.jsx, FolderConnectionListFile.jsx, JobHistoryPanel.jsx, packages/etl/etl.css, docs/log/log.md

209. 2026-04-03 프로젝트 생성: 기본 pmssn_master 선택 로직 수정·오류 문구 정리
Purpose: `default_manager_pmssn_master_id`가 `"admin" in names`로만 판별해 실제 시드(pmssn_list=query.read 등)와 맞지 않아 생성이 실패하고, 사용자에게 DB 시드 오류로 오인될 수 있던 문제를 수정한다.
Changes:

- `service_projects.default_manager_pmssn_master_id`: `관리자` 역할명·전체 프로젝트 기능 ID 집합 포함 여부로 우선 선택, 없으면 시스템 기본 첫 행 fallback. 시드 0건일 때만 `프로젝트 생성 권한이 없습니다.` 반환.

Changed files: Backend/admin_server/service_projects.py, docs/log/log.md

208. 2026-04-03 관리·ETL 테이블 작업 열 nowrap·가로 스크롤·생성자 admin-users 배지
Purpose: 부서·사용자·권한·프로젝트 관리 및 ETL 목록에서 작업 열 버튼이 세로로 줄바꿈되지 않도록 레이아웃·폰트·래퍼 스크롤을 정리하고, 생성자 열은 사용자 관리와 동일한 `admin-users__self-badge` 칩으로 통일.
Changes:

- admin: `admin-pages.css`, `admin-org.css`, `admin-users.css` — `ap__cell-actions`·`admin-org__actions` 등 inline-flex nowrap, 테이블 `max-content`·가로 스크롤, 생성자 래퍼+배지
- admin JSX: `AdminOrgPage`, `AdminUsersPage`, `AdminRolesPage`, `AdminProjectsPage`, `AdminProjectMembersPage` — 작업/생성자 클래스 정합
- ETL: `ETLPage.jsx`에서 `admin-users.css` 로드, `ETLTableList`·`BatchJobListFile`·`FolderConnectionListFile`·`JobHistoryPanel` 생성자에 배지, `etl.css`에 `etl-creator-badge-in-cell`·이력/목록 테이블 스크롤·배치 동작 열 버튼 `flex-shrink: 0`

Changed files: Frontend/react-app/src/app/admin/admin-pages.css, admin-org.css, admin-users.css, AdminOrgPage.jsx, AdminUsersPage.jsx, AdminRolesPage.jsx, AdminProjectsPage.jsx, AdminProjectMembersPage.jsx, Frontend/react-app/src/packages/etl/ETLPage.jsx, etl.css, ETLTableList.jsx, BatchJobListFile.jsx, FolderConnectionListFile.jsx, JobHistoryPanel.jsx, docs/log/log.md

207. 2026-04-03 ETL create_user_label: user_info 크로스 스키마 JOIN·core DB 보강
Purpose: ETL 메타 스키마(etl_db.table_schema)에 `user_info`가 없어 `create_user_label`이 항상 `ID n`으로만 나오던 문제 수정. `user_info`는 system_db 스키마(보통 public)에만 있는 전형적 배포를 지원한다.
Changes:

- service.py: `_user_info_qualified_table`(ETL 스키마→core_schema→public 순 탐색), `_enrich_rows_create_user_label`(ETL DB에 user_info 없을 때 get_db_connection_system_core로 일괄 조회). list_etl_tables·get_etl_table·list_jobs에 적용.
- service_file.py: 폴더 연결·배치 Job·레지스트리 목록/단건 동일 패턴 및 보강.

Changed files: Backend/etl_server/service.py, Backend/etl_server/service_file.py, docs/log/log.md

206. 2026-04-03 ETL UI: 테이블 동작 버튼 소형화·열 헤더「생성자」통일
Purpose: ETL 목록·배치·이력·폴더 연결 테이블의 삭제 등 동작 버튼이 커서 오클릭 위험이 있어 `etl-db-form__btn--sm`·`etl-table-list__delete-row` 크기를 축소. 용어는 관리자 화면과 맞춰 등록자→생성자.
Changes:

- etl.css: `btn--sm` 패딩·글자 크기 축소, compact 테이블 내 버튼 폰트 축소, 동작 열 `gap` 축소, 삭제(×) 셀 32px→22px
- ETLTableList, BatchJobListFile, JobHistoryPanel, FolderConnectionListFile: 테이블 헤더「생성자」

Changed files: Frontend/react-app/src/packages/etl/etl.css, ETLTableList.jsx, BatchJobListFile.jsx, JobHistoryPanel.jsx, FolderConnectionListFile.jsx, docs/log/log.md

205. 2026-04-03 Admin·ETL API: 목록 creator_email·create_user_label 이메일 우선
Purpose: 관리자 프로젝트·역할·부서 목록에 생성자 이메일 노출, ETL 메타 등록자 라벨은 이메일→닉네임→ID 순.
Changes:

- admin_server: list_projects_in_dept·list_projects_for_participant에 creator_email, list_roles_for_dept에 creator_email(MAX), list_departments_for_org_settings에 creator_email·CTE에 dptmt_create_user_id
- etl_server service·service_file: user_info JOIN 시 create_user_label COALESCE 순서를 email 우선으로 통일
  Changed files: Backend/admin_server/service_projects.py, service_roles.py, service_users.py, Backend/etl_server/service.py, service_file.py

204. 2026-04-02 사용자관리: 본인 배지(이메일 옆)·작업 열 비활성 버튼 title 툴팁
Purpose: 본인 행은 이메일 옆「본인」pill로 표시하고, 작업 열에서는 안내 문구를 제거한 뒤 변경·정지·활성 비활성 시 래퍼 `title`로만 설명(호버). A가 SA 행 제한·처리 중도 동일 패턴.
Changes: `AdminUsersPage.jsx` 이메일 셀·액션 래핑, `admin-users.css` `email-cell`·`self-badge`·`action-disabled-wrap`

Changed files: Frontend/react-app/src/app/admin/AdminUsersPage.jsx, Frontend/react-app/src/app/admin/admin-users.css, docs/log/log.md

203. 2026-04-02 docs/report: ETL 단일 스택 경로 정합(09·etc01·ReportIndex)
Purpose: 삭제된 `etl_server2`·`packages/etl2`·`/api/etl2` 표기를 현재 **`Backend/etl_server`**, **`packages/etl`**, **`/api/etl`·`/api/etl/batch`** 기준으로 맞춤. 학습 문서(etc01) 아키텍처·API 표·프론트 경로·`etlClient.js` 안내를 코드와 일치시킴.
Changes:

- 09_ETL_SFTP_Connection: 잔여 ETL2 제품 문구를 ETL/단일 패키지 표현으로 통일
- etc01_Backend_Learning_Flow: 제목·범위·다이어그램·경로·API prefix·섹션 16 참고·Phase 6 실경로·`etlClient.js` 명시
- 00_ReportIndex: 09·etc01 행을 정본 구조에 맞게 갱신

Changed files: docs/report/09_ETL_SFTP_Connection.md, docs/report/etc01_Backend_Learning_Flow.md, docs/report/00_ReportIndex.md, docs/log/log.md

202. 2026-04-02 docs/main·README·requirements 정합(로그·코드 기준)
Purpose: `docs/log/log.md` 이후 반영된 구조(단일 `etl_server`·쿼리 스튜디오·인증·Job 큐 3동시 등)에 맞춰 **docs/main** 전반 정리, README·requirements 갱신. 구 `etl_server2`/동시 2건 등 구식 표기 삭제·치환. **docs/report/00_ReportIndex** 에 경로 정합 노트 및 09·etc01 설명 갱신.
Changes:

- 00_PRD: Backend 패키지 목록·JWT/smtp_info·Job 큐·etl_limits 문구
- 01_FRONTEND: `etl2*` 클라이언트명·동시 3건·API 설명
- 02_BACKEND: core·서버 트리, lifespan/스케줄러 vs queue_worker, §3.2.2 인증·메일, etl_limits·Oracle·§4.3 미등록 명시, §6.4 로그 태그, 부록 log 경로
- 03_AI: core 표·ETL 패키지·project-conventions 연결
- docs/report/00_ReportIndex: etl_server2 레거시 안내·09·etc01 행
- README: Backend 트리·API 한 줄·config·Job 큐·문서 표
- requirements.txt: ETL2 표기 제거·주석 정리
- docs/README.md: 03 파일명 링크 수정·04~06 표 추가

Changed files: docs/main/00_PRD.md, 01_FRONTEND_GUIDE.md, 02_BACKEND_GUIDE.md, 03_AI_DEVELOP_GUIDE.md, docs/report/00_ReportIndex.md, docs/README.md, README.md, requirements.txt, docs/log/log.md

201. 2026-04-02 Backend 로깅 정리(포맷 유지·태그 메시지·노이즈 제거)
Purpose: 루트 로거는 `logging_setup`의 `YYYY-MM-DD HH:MM:SS / [LEVEL] message` 유지. 불필요·중복 로그 제거, 운영·디버깅에 필요한 항목은 짧은 영문 태그 접두로 grep·AI 파싱 용이하게 통일.
Changes:

- ETL: `load_service`, `load_service_file`, `db_load_service`(diff PK fetch 요약 로그 제거), `queue_worker`, `router_file`, `preview_service`, `transform_engine`, `timezone_utils`, `table_master_hook`, `csv_reader`, `folder_adapter_file`(미사용 logger 제거), `scheduler_file` stray pass 제거, `service_file` 로그 문구 정리
- 인증·관리: `auth_server/email_service`, `auth_server/service`, `admin_server/service_users`
- 대시보드·기타: `new_dash_server/router`, `campaign_dash_server/router`, `new_dash_server2/router`, `query_studio_server/router`

Changed files: Backend/etl_server/{load_service,load_service_file,db_load_service,queue_worker,router_file,preview_service,transform_engine,timezone_utils,table_master_hook,csv_reader,folder_adapter_file,scheduler_file,service_file}.py, Backend/auth_server/{email_service,service}.py, Backend/admin_server/service_users.py, Backend/new_dash_server/router.py, Backend/campaign_dash_server/router.py, Backend/new_dash_server2/router.py, Backend/query_studio_server/router.py, docs/log/log.md

200. 2026-04-02 관리자 UI: ibank 버튼 통일·용어 ETL 관리자
Purpose: 부서·사용자·프로젝트·권한 페이지와 모달 버튼을 `ibank-btn-toolbar`·`ibank-btn-table`(+`--danger`)로 통일. 사용자 변경 확인은「변경」. `ETL 인프라` 표현을 UI·API·문서에서 `ETL 관리자` 등으로 정리.
Changes:

- FE: AdminUsers/Org/Roles/Projects/ProjectMembers, `admin-users.css`·`admin-org.css`·`admin-pages.css`, `shared-ui.css`(`ibank-btn-table--danger`), Home·etlAccess
- BE: `admin_server/service_users.py`, `schemas.py`, `auth_server/permissions.py`
- docs: `main/00,04,05,06`, `report/17`
Changed files: Frontend/react-app/src/app/admin/*, src/styles/shared-ui.css, src/app/home/HomePage.jsx, src/app/guards/etlAccess.js, Backend/admin_server/service_users.py, Backend/admin_server/schemas.py, Backend/auth_server/permissions.py, docs/main/*.md, docs/report/17_*.md, docs/log/log.md

199. 2026-04-02 사용자관리: ETL 작업물 대분류 묶음·대분류 전체이관·etl_infra 일괄 모달 문구
Purpose: DB·테이블·Job·저장DB·배치 폴더·배치 Job을 하나의「ETL」대분류 아래 중분류로 표시하고, 이관 가능 2건 이상이면 대분류「전체이관」으로 한 번에 처리. 수신 검증은 etl_infra로 동일하므로 모달·확인 문구를 ETL 일괄에 맞게 정리.
Changes:

- `AdminUsersPage.jsx`: `renderEtlMegaSection`, 6개 ETL 블록 단일 섹션·중첩 `renderAssetList`, `openBulkTransferModal`/`runTransfer`/모달 강조문 ETL·`every(etlInfra)` 분기
- `admin-users.css`: `--etl-mega`, `--work-subsection`, `--nested` 패널·`--etl-nested-wrap`

Changed files: Frontend/react-app/src/app/admin/AdminUsersPage.jsx, Frontend/react-app/src/app/admin/admin-users.css, docs/log/log.md

198. 2026-04-02 사용자관리: 전체이관 문구 명확화(카테고리 섹션만·다른 섹션 제외)
Purpose: 전체이관이 ‘모든 카테고리 일괄’로 오해되지 않도록, 동작은 기존과 같이 섹션별만 해당함을 모달·확인·툴팁·라벨에 명시.
Changes: `AdminUsersPage.jsx` 문구·`title`/`aria-label`, `docs/log/log.md`

Changed files: Frontend/react-app/src/app/admin/AdminUsersPage.jsx, docs/log/log.md

197. 2026-04-02 사용자관리 작업물 패널: 카테고리·하위목록 구분·등록한 권한·전체이관
Purpose: `panel-scroll--tall` 내 카테고리 헤더와 항목 목록의 시각적 계층을 두고, 이관 가능 2건 이상인 카테고리에서「전체이관」으로 일괄 이관(첫 항목 기준 수신 후보·확인 문구).
Changes:

- `AdminUsersPage`: `work-section`·`openBulkTransferModal`·`runTransfer` bulk 루프, 커스텀 역할 표기「등록한 권한」
- `admin-users.css`: `work-section-head`·`work-list-panel`·`btn-transfer-all`·`modal-hint--emph`

Changed files: Frontend/react-app/src/app/admin/AdminUsersPage.jsx, Frontend/react-app/src/app/admin/admin-users.css, docs/log/log.md

196. 2026-04-02 ETL 이력 탭(JobHistoryPanel): 삭제·새로고침·상태 뱃지를 목록/배치와 통일
Purpose: `tab=history`에서 상단 Job 이력 테이블만 버튼·새로고침 스타일이 달랐음. ETL 목록과 동일하게 새로고침을 우측 정렬 툴바에 두고 삭제는 `etl-db-form__btn--danger` + `etl-db-form__btn--sm`으로 통일.
Changes:

- `JobHistoryPanel.jsx`: `etl-table-list__toolbar` + `etl-table-list__refresh`, 행 삭제 `etl-db-form__btn--sm`, 상태 열 `etl-db-form__status-badge` + 한글 라벨.
- `etl.css`: `etl-history__bar`·`__refresh`·`__del` 제거, 필터에 하단 여백.
Changed files: Frontend/react-app/src/packages/etl/components/JobHistoryPanel.jsx, Frontend/react-app/src/packages/etl/etl.css, docs/log/log.md

195. 2026-04-02 ETL 목록: 상태 뱃지·동작 버튼을 배치 Job 목록(etl-db-form)과 통일
Purpose: 동일 화면에서 ETL 테이블 목록의 상태 열이 `etl-db-form__status-badge`와 다르게 보이던 문제와 동작 열 버튼 radius·글자색 불일치를 제거.
Changes:

- `ETLTableList.jsx`: 상태를 `<span class="etl-db-form__status-badge …">`로 렌더. 동작 래퍼를 `etl-batch-job-list__actions`로 통일, 버튼을 `etl-db-form__btn--sm`(primary/secondary/danger)로 교체.
- `etl.css`: `etl-table-list__status--*`·전용 미리보기/실행/삭제 버튼 블록 제거. × 버튼은 `etl-table-list__delete-row`로 치수만 보조.
Changed files: Frontend/react-app/src/packages/etl/components/ETLTableList.jsx, Frontend/react-app/src/packages/etl/etl.css, docs/log/log.md

194. 2026-04-02 ETL 패키지: 잔여 에메랄드·슬레이트·스카이 인라인 제거, 브랜드 토큰 통일
Purpose: `packages/etl`에서 Tailwind 에메랄드(`#059669` 등)·인라인 슬레이트/스카이(`#e2e8f0`, `#f0f9ff`)를 `design-tokens`의 Starbucks 그린·중립 변수로 맞춤.
Changes:

- `etl.css`: 드롭존 `--has`, 성공 뱃지·PK 체크·Job 로그 성공·파일 폼 결과 등을 `--color-action-primary` / `--primary-light` / `rgba(0,112,74,…)`로 통일.
- JSX: `BatchJobFormFile`, `BatchScheduleModal`, `SkippedFilesPanelFile`, `BatchHistoryDetailFile` 인라인 색을 CSS 변수 또는 워닝용 앰버(`#b45309`)로 조정.
Changed files: Frontend/react-app/src/packages/etl/etl.css, BatchJobFormFile.jsx, BatchScheduleModal.jsx, SkippedFilesPanelFile.jsx, BatchHistoryDetailFile.jsx, docs/log/log.md

193. 2026-04-03 UI: 부서·권한·사용자·ETL 테이블/버튼 스타벅스 톤 정합(ibank-btn·ap__btn·etl-db-form__btn)
Purpose: 툴바 버튼 `ibank-btn-toolbar` 병행, 테이블 내 버튼·폼 버튼을 shared-ui·ap 패턴과 맞춤. 테이블은 clamp 폰트·nowrap·헤더 primary-light·긴 텍스트 ellipsis(ap__cell-clip).
Changes:

- `AdminOrgPage.jsx`·`admin-org.css`, `admin-pages.css`·`AdminRolesPage.jsx`, `admin-users.css`, `mypage.css`, `packages/etl/etl.css`
Changed files: Frontend/react-app/src/app/admin/AdminOrgPage.jsx, admin-org.css, admin-pages.css, AdminRolesPage.jsx, admin-users.css, Frontend/react-app/src/app/mypage/mypage.css, Frontend/react-app/src/packages/etl/etl.css, docs/log/log.md

192. 2026-04-03 ETL 패키지 etl.css: design-tokens 브랜드 그린·중립 토큰 정렬
Purpose: ETL UI의 파랑·인디고·슬레이트 하드코드를 `design-tokens.css`의 Starbucks 그린(`--color-action-primary`, `--primary-light` 등)과 `--color-text`·`--color-border-light` 등 중립 토큰으로 치환. 오류·파괴 동작은 기존 적색 유지.

Changes:

- `etl.css`: 주요 버튼·탭·포커스 링·실행 중 하이라이트·타겟 선택/모달 링크를 액션 프라이머리 톤으로 통일. 배경/테두리/보조 텍스트는 `--background`, `--color-border`, `--color-text-muted` 등으로 정리. `.etl-page`에 `font-family: var(--font-sans)`. 파일 헤더에 브랜드 팔레트 주석 추가.

Changed files: Frontend/react-app/src/packages/etl/etl.css, docs/log/log.md

191. 2026-04-03 공용 shared-ui.css(툴바·테이블 버튼·데이터테이블)·ap__table 정합·admin-users 액션 호버
Purpose: 앱 전역 재사용 UI 유틸(`ibank-btn-*`, `ibank-data-table`) 추가. 어드민 공용 `ap__table`을 반응형 clamp·nowrap·`ap__cell-clip`으로 `ibank-data-table`과 정합. 사용자관리 행 액션 호버를 Starbucks 톤으로 통일. 헤더 내비는 범위 제외(주석 명시).
Changes:

- `shared-ui.css` 신설, `main.jsx`에서 design-tokens 다음 import
- `admin-pages.css`: `.ap__table`·`ap__cell-clip`·`td.ap__mono` 줄바꿈 예외, `--roles` 중복 제거·역할 테이블 보조 규칙 유지
- `admin-users.css`: `.admin-users__actions button` 호버·font-weight

Changed files: Frontend/react-app/src/styles/shared-ui.css, Frontend/react-app/src/main.jsx, Frontend/react-app/src/app/admin/admin-pages.css, Frontend/react-app/src/app/admin/admin-users.css, docs/log/log.md

190. 2026-04-02 ETL 이력 탭: 라벨 열을 etl_tables.table_label로 표시(list_jobs JOIN)
Purpose: 이력 「라벨」을 ETL 목록과 동일한 `table_label`로 정합. `list_jobs`/`get_job`의 etl_tables JOIN에 `table_label` 추가.
Changes:

- `service`: `_etl_tables_join_select_parts`, `_apply_etl_job_list_compat_keys`
- `JobHistoryPanel.jsx`: `table_label` 표시
Changed files: Backend/etl_server/service.py, Frontend/react-app/src/packages/etl/components/JobHistoryPanel.jsx, docs/log/log.md

189. 2026-04-02 부서: 셀렉트 display_label(상위·하위)·사용안함 시 사용자 이관 모달·PATCH migrate
Purpose: 사용자 변경·초대 부서 옵션에 `이름 (상위|하위)` 표시. 부서 관리에서 사용 안 함으로 저장 시 소속 사용자가 있으면 사용 중 부서만 담은 이관 모달 후 `migrate_users_to_dptmt_info_id`로 일괄 이관 뒤 비활성화.
Changes:

- `service_users`: `_apply_department_option_display_labels`, `list_departments_for_org_settings`에 member_count, `_list_departments_for_change`·`list_departments_for_invite`에 라벨·활성 부서만
- `_migrate_users_for_department_invalidate`, `update_department_in_org_settings(..., migrate_users_to_dptmt_info_id)`
- `schemas`·`router`, `AdminUsersPage`·`AdminOrgPage`·`admin-org.css`, `adminClient`

Changed files: Backend/admin_server/service_users.py, Backend/admin_server/schemas.py, Backend/admin_server/router.py, Frontend/react-app/src/shared/api/adminClient.js, Frontend/react-app/src/app/admin/AdminUsersPage.jsx, Frontend/react-app/src/app/admin/AdminOrgPage.jsx, Frontend/react-app/src/app/admin/admin-org.css, docs/log/log.md

188. 2026-04-02 사용자 역할 변경: 생성물 정합성(테이블마스터 단독 허용·ETL·etl_yn 해제)
Purpose: 역할 변경 시 `table_master` 소유만으로 전면 차단되던 로직을 완화하고, ETL 메타 등록 건은 목표 역할이 o/a/sa/sa_dev일 때만 허용·`etl_yn` 해제 시 등록 건이 있으면 거절하도록 정리.
Changes:

- `_user_has_role_change_blockers` 제거 → `_assert_role_change_allowed_for_owned_assets`(프로젝트·커스텀 pmssn 유지 차단, table_master 제외, ETL 등록은 u 등으로만 내릴 때 차단)
- `_raise_if_etl_registry_blocks_clearing_etl_yn`: `set_user_etl_flag`·`update_user_management`에서 etl_yn=N 전 검사

Changed files: Backend/admin_server/service_users.py, docs/log/log.md

187. 2026-04-02 사용자관리: 테이블마스터 연쇄 이관 안내에 ETL 테이블·Job·배치 식별 라벨
Purpose: table_master 이관 시 “ETL 테이블 n건 연쇄 이관”만으로는 하단 ETL 목록의 `sample_test_02 ← public.sample_test` 등과 대응이 어려워, 연쇄 블록에 동일 식별 라벨을 `·` 상세 줄로 표시.
Changes:

- `service_users`: `_summarize_etl_cascade_for_table`가 필터된 행 목록을 반환, `cascade_children`에 `·` 라벨 줄 추가(ETL 테이블/실행 Job/배치 Job)
- `AdminUsersPage`·`admin-users.css`: `·` 시작 줄은 들여쓰기·작은 글씨로 구분

Changed files: Backend/admin_server/service_users.py, Frontend/react-app/src/app/admin/AdminUsersPage.jsx, Frontend/react-app/src/app/admin/admin-users.css, docs/log/log.md

186. 2026-04-02 소유 이관 후보: 상·하위 부서 트리 동일 범위(ETL·테이블마스터·ETL 검증)
Purpose: 이관 대상자 목록이 `dptmt_info_id` 동일 행만 조회해 하위(또는 상위) 부서 소속 ETL 관리자가 빠지던 문제를 수정. 소유자 부서 기준 조상·자손 부서를 한 범위로 묶어 후보를 채우고, ETL 이관·테이블마스터 SA/A 동일 부서 판정도 동일 트리 규칙으로 통일.
Changes:

- `_dptmt_same_vertical_branch`: 조상·자손 관계(동일 PK 포함) 판정 헬퍼 추가
- `list_ownership_transfer_targets`, `list_table_master_transfer_targets`: 후보 SQL을 부서 트리 branch(상향·하향 CTE)로 확장
- `_assert_etl_infra_recipient`, `_table_master_recipient_eligible`: 동일 부서 판정을 PK 일치 대신 상·하위 트리 허용

Changed files: Backend/admin_server/service_users.py, docs/log/log.md

185. 2026-04-02 테이블마스터 이관: ETL 생성 테이블 연쇄 이관 + 목록 └ 하위 안내
Purpose: table_master 이관 시 ETL 생성 테이블이면 관련 ETL 메타(etl_tables/etl_jobs/batch_jobs)를 함께 연쇄 이관하고, 목록 화면에서만 하위(└)로 연쇄 대상 수를 보여 이관 단위는 table_master 1건으로 유지.
Changes:

- `service_users.transfer_resource_ownership(table_master)`: `db_type/table_name` 기준 ETL 연관 검사 후 `create_user_id` 연쇄 이관
- `service_users.get_user_work_assets`: table_master 행에 `cascade_children`(└ ETL 테이블/Job/배치 Job n건) 계산 추가
- `AdminUsersPage`: 목록에서 `cascade_children`를 하위 안내로 렌더링(이관 버튼은 table_master만)

Changed files: Backend/admin_server/service_users.py, Frontend/react-app/src/app/admin/AdminUsersPage.jsx, docs/log/log.md

184. 2026-04-02 사용자 목록 패널: 생성/등록 이력 없음 안내 문구 추가
Purpose: 사용자별 작업물 패널이 비어 있을 때 빈 화면 대신 상태 메시지를 보여 사용자가 "조회 실패"와 "이력 없음"을 구분할 수 있게 개선.
Changes:

- `AdminUsersPage`: `hasAnyWorkAssets` 헬퍼 추가
- 패널 하단: 자산 배열이 모두 비어 있으면 `생성/등록한 이력이 없습니다.` 안내 문구 표시
- 파일 상단 설명에 빈 목록 안내 동작 추가

Changed files: Frontend/react-app/src/app/admin/AdminUsersPage.jsx, docs/log/log.md

183. 2026-04-02 사용자관리 SA 역할 변경 가드: dptmt_create_user_id 이관 안내·SA_DEV 마지막 SA 추가확인
Purpose: SA 역할 하향 시 부서 생성자(`dptmt_create_user_id`)를 이관 필요 자산으로 취급. SA가 만든 하위 부서가 남아 있으면 역할 변경을 차단하고 이관 안내. 단, SA_DEV는 마지막 SA라도 차단하지 않되 저장 직전 추가 confirm으로 안전장치 제공.
Changes:

- `service_users.get_user_change_options`: `actor_user_dvsn`, `last_sa_in_department`, `last_sa_department_name` 메타 제공
- `service_users.update_user_management`: SA→비SA 변경 시 `dptmt_info` 생성자 존재 검사 및 이관 안내 에러 추가
- `AdminUsersPage`: SA_DEV가 마지막 SA 하향 변경 시 `${부서명} 부서의 마지막 SA 사용자입니다...` 추가 confirm

Changed files: Backend/admin_server/service_users.py, Frontend/react-app/src/app/admin/AdminUsersPage.jsx, docs/log/log.md

182. 2026-04-02 DB 배치잡: apply_mapping_type_cast 전 `_override_mapping_types_for_transform_rules` (수동 적재와 정합)
Purpose: `run_db_batch_job`이 `run_db_load`와 달리 변환 룰 직후 매핑 type 오버라이드 없이 캐스트해 마스킹 등 값이 깨질 수 있음. `rules` 초기화 후 동일 헬퍼 호출.
Changes:

- `batch_executor_db`: fetch 배치 루프 내 `mapping_used = _override_mapping_types_for_transform_rules(...)` 후 `apply_mapping_type_cast`
Changed files: Backend/etl_server/batch_executor_db.py, docs/log/log.md

181. 2026-04-02 DB ETL 적재: CREATE TABLE은 변환 룰 적용 컬럼만 df dtype, 나머지는 매핑 원본 타입
Purpose: `_columns_final_for_mapping_after_transform`가 매핑 전 컬럼까지 pandas object→TEXT로 잡아 timestamp가 TEXT DDL로 내려가는 문제 방지. `_transformed_column_names_from_rules`로 룰 대상만 `_pg_type_from_pandas`, 그 외는 `column_mapping.type`(소스 기준) 유지.
Changes:

- `db_load_service`: `_transformed_column_names_from_rules`, `_columns_final_for_mapping_after_transform(..., transformed_columns)`, `_override_mapping_types_for_transform_rules`가 동일 집합 재사용, 스트리밍·full-fetch 호출부
Changed files: Backend/etl_server/db_load_service.py, docs/log/log.md

180. 2026-04-02 DB ETL 적재: 변환 룰 적용 컬럼은 apply_mapping_type_cast 전 매핑 type을 df dtype으로 오버라이드
Purpose: 마스킹 후 object(TEXT)인데 매핑 BIGINT로 `apply_mapping_type_cast`가 재캐스트해 NaN·float64가 됨. 활성 룰의 target/source_column에 해당하는 매핑 행의 type을 `_pg_type_from_pandas(df[source])`로 맞춤. 스트리밍·full-fetch·diff INSERT 경로 적용. full-fetch는 `rules` 미정의 방지 위해 `rules = []` 선행.
Changes:

- `db_load_service`: `_override_mapping_types_for_transform_rules`, `run_db_load`·`_run_diff_sync` 호출부
Changed files: Backend/etl_server/db_load_service.py, docs/log/log.md

179. 2026-04-02 DB ETL 적재: 변환 룰 후 columns_final을 DataFrame dtype 기준으로 DDL 결정
Purpose: 매핑의 원래 `type`만으로 CREATE TABLE하면 마스킹 등으로 실제 값이 TEXT인데 BIGINT DDL이 잡혀 COPY/스테이징 캐스트 실패. `apply_rules`·`apply_mapping_type_cast` 이후 `df`에서 target/source 컬럼 dtype으로 `_pg_type_from_pandas` 적용.
Changes:

- `db_load_service`: `_columns_final_for_mapping_after_transform`, 스트리밍 `first_batch`·full-fetch 경로 `columns_final` 생성
Changed files: Backend/etl_server/db_load_service.py, docs/log/log.md

178. 2026-04-02 DB ETL 적재: column_mapping 시 COPY 행 값 누락(소스 키 vs 타겟 컬럼) 수정
Purpose: `run_db_load`에서 DataFrame 행 dict 키는 소스 컬럼명인데 INSERT/COPY는 타겟 컬럼 순서로 `r.get(타겟)`만 해 변환·형변환 값이 빠짐. 파일 적재와 동일하게 타겟 키 우선·소스 폴백.
Changes:

- `db_load_service`: `_row_tuple_for_column_mapping`, `_incremental_cell_from_row`
- diff·스트리밍·일괄 경로 `rows_tuples`·증분 `max_vals` 정합
Changed files: Backend/etl_server/db_load_service.py, docs/log/log.md

177. 2026-04-02 사용자관리 변경 모달: ETL 인프라 자격(etl_yn) SA·SA_DEV 토글·change-options
Purpose: 사용자 변경 시 부서·역할·프로젝트와 함께 ETL 인프라 자격(기존 `PATCH .../etl-access`와 동일 취지)을 설정. A(조직 관리자)는 읽기 안내만.
Changes:

- `get_user_change_options`: `target_user.etl_yn`, `can_manage_etl_yn`
- `UserManageUpdateBody`·`update_user_management`: 선택 필드 `etl_yn` (set_user_etl_flag와 동일 검증)
- `AdminUsersPage` 체크박스·SA_DEV 대상 변경 불가 안내·`putAdminUserManagement` body
- `adminClient` JSDoc

Changed files: Backend/admin_server/schemas.py, router.py, service_users.py, Frontend/react-app/src/app/admin/AdminUsersPage.jsx, Frontend/react-app/src/shared/api/adminClient.js, docs/log/log.md

176. 2026-04-02 ETL 삭제: 다운스트림(소스로 읽는 다른 ETL) 검사·거절
Purpose: 외부→A 적재 후 A→B ETL이 같은 PG 인스턴스에서 A 테이블을 읽는 경우, A ETL만 삭제하면 파이프라인이 깨짐. 저장 PG와 동일 (host,port,database,schema)에서 source_table이 DROP 대상과 일치하면 삭제 400·UI alert.
Changes:

- `service`: `_storage_pg_identity_tuple`, `_find_downstream_etl_reading_target_pg`, `delete_etl_table` 선검증
- `ETLTableList`: 다운스트림 거절 메시지 alert
Changed files: Backend/etl_server/service.py, Frontend/react-app/src/packages/etl/components/ETLTableList.jsx, docs/log/log.md

175. 2026-04-02 ETL 목록 삭제 실패 시 공유타겟 거절도 alert
Purpose: 동일 target_table 다른 ETL 존재로 삭제 거절 시 목록 오류만이 아니라 window.alert로도 안내.
Changes:

- `ETLTableList` delete catch: `동일 타겟`·`다른 ETL 등록` 문구 시 alert
Changed files: Frontend/react-app/src/packages/etl/components/ETLTableList.jsx, docs/log/log.md

174. 2026-04-02 ETL 삭제: 공유타겟·프로젝트매핑 차단·table_master·DROP 일괄
Purpose: 목록 삭제 시 물리 테이블·배치·원장 정리 일관성. 동일 타겟 다른 ETL 존재 시 삭제 거절. 내장 저장소는 `table_project_mapping`이 있으면 먼저 매핑 해제하라고 400. 성공 시 배치 정리→`table_master` 삭제→DROP→ETL 메타 삭제. DROP 실패 시 시스템 DB rollback.
Changes:

- `service._count_table_project_mapping_for_target`, `delete_etl_table` 재구성(검증·스케줄러 제거·원장·DROP 순)
- `router` DELETE: 비즈니스 `ValueError` → 400, 없음 → 404
- `ETLTableList` 확인 문구·성공 시 drop_skip alert 제거
Changed files: Backend/etl_server/service.py, Backend/etl_server/router.py, Frontend/react-app/src/packages/etl/components/ETLTableList.jsx, docs/log/log.md

173. 2026-04-02 ETL 삭제: 배치 레지스트리 선삭제·DROP 생략 사유 응답·UI 안내
Purpose: ETL 목록 삭제 시 배치 Job이 안 지워지거나 타겟 테이블이 남는 현상 — `etl_batch_target_registry`→`batch_jobs` FK로 배치 삭제가 막힐 수 있음. 동일 `target_table` 다중 ETL 시 의도적 DROP 생략은 유지하되 사유를 API·알림으로 노출.
Changes:

- `service_file.delete_batch_target_registry_rows_for_etl_table`: `etl_table_id`에 묶인 배치의 레지스트리 행 선삭제
- `delete_etl_table`·`delete_etl_table_row_only`: 배치 메타 삭제 전 위 함수 호출, DROP 생략 시 `drop_skip_reason`·로그, 성공 시 `target_table_dropped`
- `router.delete /tables/{id}`: JSON 응답(204 제거)
- `ETLTableList`: 확인 문구 보강, `drop_skip_reason`별 alert
Changed files: Backend/etl_server/service.py, Backend/etl_server/service_file.py, Backend/etl_server/router.py, Frontend/react-app/src/packages/etl/components/ETLTableList.jsx, docs/log/log.md

172. 2026-04-02 ETL 파일 배치: 변환 룰 정렬·load_dataframe 형변환 실패 전파
Purpose: DB 배치(`batch_executor_db`)와 달리 파일 배치가 `etl_table_id` 변환 룰을 건너뛰던 불일치 제거. `load_dataframe`에서 `apply_mapping_type_cast` 예외를 삼켜 잘못된 타입이 PG로 갈 수 있던 위험 제거.
Changes:

- `batch_executor_file`: `etl_table_id` 있으면 `list_transform_rules` + `apply_rules`(룰 로드/적용 실패 시 warning 후 skip, DB 배치와 동일)
- `load_service_file.load_dataframe`: column_mapping 경로에서 형변환 ValueError 전파, 기타 예외는 ValueError로 래핑
Changed files: Backend/etl_server/batch_executor_file.py, Backend/etl_server/load_service_file.py, docs/log/log.md

171. 2026-04-02 ETL 배치 적재: numpy 스칼라→psycopg2 바인딩(can't adapt numpy.int64)
Purpose: 파일 배치 `load_dataframe` → `_batch_insert`/`_batch_upsert` 시 `itertuples`가 numpy.int64 등을 넘겨 psycopg2가 적응하지 못하는 오류 수정.
Changes:

- `load_service_file._to_psycopg2_param` 추가, INSERT/UPSERT `flat` 바인딩 전 변환
- `_batch_upsert`/`_batch_insert` 반환값 `int()` 정규화
Changed files: Backend/etl_server/load_service_file.py

170. 2026-04-02 사용자관리: 본인 행「목록」허용(작업물·이관)·변경·정지·활성은 유지 잠금
Purpose: 관리자가 본인이 생성자인 자산을 동료에게 이관할 수 있도록 본인 행에서도 작업물 패널을 열 수 있게 함. `listDisabled`에서 `isSelf` 제거. 변경·정지·활성은 `actionDisabled`로 본인 행 계속 비활성.
Changes:

- `listDisabled`: `isSelf` 제거(본인 행에서도 목록 열기)
- 본인 힌트: 「본인 · 목록·이관만 가능」
- 파일 상단 설명 보강

Changed files: Frontend/react-app/src/app/admin/AdminUsersPage.jsx, docs/log/log.md

169. 2026-04-02 ETL 타겟모달: table_label 30자·table_dscrtn 100자 UI 제한·안내·제출 검증
Purpose: 운영 DB varchar(30)/varchar(100)·라벨 UNIQUE에 맞춰 입력 단계에서 안내·maxLength·글자 수·적용 전 검증, DbConnectionForm/FileUploadForm 제출 시 동일 상수 검증.
Changes:

- `TargetTableSelectModal/constants.js`: ETL_TABLE_LABEL_MAX_LEN(30), ETL_TABLE_DSCRTN_MAX_LEN(100)
- 모달: 안내 문구, 카운터, slice onChange/open, handleApply 가드
- `DbConnectionForm`/`FileUploadForm`: 제출 전 길이 검증
- `etl.css`: meta-hint·counter 스타일
Changed files: Frontend/react-app/src/packages/etl/components/TargetTableSelectModal/{constants.js,index.jsx}, DbConnectionForm.jsx, FileUploadForm.jsx, etl.css

168. 2026-04-02 ETL table_label·table_dscrtn: etl_tables·table_master·타겟모달·배치 적재 연동
Purpose: system_db `table_master`와 동일 컬럼명으로 ETL 메타 저장 및 적재 후 UPSERT 시 반영. DDL은 저장소에 파일 추가 없이 운영 DB에 수동 적용.
Changes:

- `etl_tables`: `table_label`, `table_dscrtn` 컬럼(운영 ALTER). `service` SELECT/INSERT/UPDATE, `table_master_hook`·`load_service*`·`db_load_service`·배치 실행기·`load_dataframe` 인자 연동
- API: `CreateTableBody`/`UpdateTableBody`/upload Form `table_label`·`table_dscrtn`(기존 label_name·description 제거)
- FE: `TargetTableSelectModal` 선택 입력·onSelect 7번째 meta; `DbConnectionForm`/`FileUploadForm`/`ETLTableList`/`AddFileModal`/`ETLPage` 정합
- `query_studio_server` `_upsert_table_master_and_mapping` 동일 컬럼 UPSERT
Changed files: Backend/etl_server/{table_master_hook,service,router,db_load_service,load_service,load_service_file,batch_executor_db,batch_executor_file}.py, Backend/query_studio_server/router.py, Frontend/react-app/src/packages/etl/{components/{TargetTableSelectModal/index.jsx,DbConnectionForm.jsx,FileUploadForm.jsx,ETLTableList.jsx,AddFileModal.jsx},ETLPage.jsx,etl.css}

167. 2026-04-02 ETL 타겟모달: 변환 종류별 타입·적재 비차단 안내(getTransformTypeGuidance)
Purpose: 변환 셀렉트 선택 시 alert 대신 상세 행 상단에 소스 타입·타겟 PG 타입·연산 조합별 안내를 표시. 정리(cleansing)만 선택해도 안내 행 표시.
Changes:

- `constants.js`: `getTransformTypeGuidance` (cleansing, masking, string, type_cast, cleansing_and_type_cast, datetime, code_map)
- `TransformDetailRow.jsx`: `targetPgType`, 안내 블록 + cleansing 전용 행
- `ColumnMappingSection.jsx`: 기존 테이블은 `columns`의 `data_type`으로 타겟 타입 추정, 신규 테이블은 소스 추론 타입
- `etl.css`: `.etl-target-select-modal__transform-guidance*`

Changed files: Frontend/react-app/src/packages/etl/components/TargetTableSelectModal/constants.js, TransformDetailRow.jsx, ColumnMappingSection.jsx, Frontend/react-app/src/packages/etl/etl.css, docs/log/log.md

166. 2026-04-02 ETL 미리보기 BIGINT+마스킹·타겟모달 마스킹 기본값·초대 역할 rid=0 호출 방지
Purpose: 테이블 미리보기에서 mask_right 후 BIGINT 캐스트가 값을 null로 지움. 변환 상세에서 마스킹 선택 직후 n·char 입력이 비어 보임. 초대 부서 미선택 시 `Number('')===0`으로 invite/roles 400.
Changes:

- `preview_service._get_preview_with_transform`: `apply_mapping_type_cast(..., default_on_error="keep")`
- `TransformCell`+`ColumnMappingSection`: 마스킹 선택 시 `maskingConfig`에 n=4·char=* 시드
- `AdminUsersPage`: `inviteDeptId === ''`이면 프로젝트/역할 API 미호출

Changed files: Backend/etl_server/preview_service.py, Frontend/react-app/src/packages/etl/components/TargetTableSelectModal/TransformCell.jsx, ColumnMappingSection.jsx, Frontend/react-app/src/app/admin/AdminUsersPage.jsx, docs/log/log.md

165. 2026-04-02 관리자 get_user_work_assets: ETL 메타 SELECT is_active 동적화
Purpose: `_fetch_etl_work_blocks`가 `etl_tables` 등에 고정으로 `is_active`를 SELECT하여 컬럼이 없는 DDL에서 `column "is_active" does not exist`로 ETL 작업물 블록 전체가 실패함.
Changes:

- `service_users.py`: `_admin_etl_select_cols`, `batch_jobs`의 `created_at` 선택적 포함

Changed files: Backend/admin_server/service_users.py, docs/log/log.md

164. 2026-04-02 고객여정 06 v4: 알고리즘 흐름 중심 전면 재구성
Purpose: 사용자 제공 초안을 반영해 Phase 0~12를 API·서비스 함수·검증 단계 중심 흐름도로 정리하고, 역할 범례·초대 매트릭스·ETL·어드민·로그인 알고리즘을 한 문서에 통합한다.
Changes:

- `docs/main/06_CUSTOMER_JOURNEY.md`: v3 표·Phase 11 세부 표·Mermaid·UX 가이드 제거 후 v4 본문으로 교체. 부서 목록은 라우터 빈 목록 분기·`_assert_department_clear_for_invalidate_or_remove` 명칭으로 코드와 정합

Changed files: docs/main/06_CUSTOMER_JOURNEY.md, docs/log/log.md

163. 2026-04-02 CreateOrgPage: 비밀번호 확인 UI 제거(회원가입만 요청 범위)
Purpose: 사용자 요청이 초대 회원가입에 한정되었으므로 부서 새로 만들기 화면의 비밀번호 확인·검증 버튼·제출 전 정책 검사를 되돌림.
Changes:

- `CreateOrgPage.jsx`: 단일 비밀번호 필드·기존 `confirmCrud` 후 API 흐름으로 복원

Changed files: Frontend/react-app/src/app/auth/CreateOrgPage.jsx, docs/log/log.md

162. 2026-04-02 회원가입(SignupPage): 비밀번호 확인·정책 검증 버튼·공용 passwordPolicy
Purpose: 초대 코드 회원가입 화면에 비밀번호 확인 입력과 백엔드 `validate_password_strength`와 동일한 사전 검증, 「비밀번호 조건·일치 검증」 버튼으로 피드백 제공. (부서 생성 화면은 요청 범위 밖으로 유지.)
Changes:

- `shared/utils/passwordPolicy.js`: `getPasswordStrengthError` (10자·대·소·숫자·특수문자, 메시지 백엔드 정합)
- `SignupPage.jsx`: 비밀번호 확인 필드, 검증 버튼, 제출 전 일치·정책 검사 후 `confirmCrud`
- `login.css`: 보조 버튼·성공 힌트 스타일

Changed files: Frontend/react-app/src/shared/utils/passwordPolicy.js, Frontend/react-app/src/app/auth/SignupPage.jsx, Frontend/react-app/src/app/auth/login.css, docs/log/log.md

161. 2026-04-02 고객여정 06 Phase 11: 부서·사용자·권한 기술 흐름·함수 맵·흐름도
Purpose: 도입·운영 설명용으로 어드민 API(`admin_server`)와 프로젝트 `require_permission`의 차이, 엔드포인트·서비스 함수·프론트 클라이언트 연계, 부서 목록 `sa`/`sa_dev` 게이트 등을 Phase 11에 ASCII·Mermaid로 정리한다.
Changes:

- `docs/main/06_CUSTOMER_JOURNEY.md`: Phase 11에 「기술 흐름」절 추가(공통 JWT·deps, 부서·사용자·권한 표, `pmssn_master`↔런타임 권한), 문서 상단 용도 문구 보강

Changed files: docs/main/06_CUSTOMER_JOURNEY.md, docs/log/log.md

160. 2026-04-02 ETL 스키마 대조 후속: 배치 interval·저장DB 물리컬럼·JSONB 적재·변환룰 DB·문서04
Purpose: 감사에서 지적된 잠재 혼동·누락을 코드로 제거. schedule_cron 없는 DB에서의 cron 폴백 착시 제거, etl_storage_connections 물리 컬럼과 config_json 동기화, 증분 COPY 시 JSONB·JSON 소스 타입 지원, transform_rules가 ETL DB에만 붙도록 명시, sync_mode·저장 DB 문서 보강.
Changes:

- `service_file.py`: `effective_interval_minutes_from_batch_row`는 행에 `schedule_cron` 키가 있을 때만 cron 파싱
- `service.py`: `_storage_conn_password_column_for_insert`·`_storage_physical_select_fragments`, `create_storage_connection`/`update_storage_connection`/`list_storage_connections`/`get_storage_connection`에서 물리 컬럼 동기화·조회, `create_etl_table` sync_mode 주석
- `db_load_service.py`: `_copy_staging_cast_expr`(JSONB), `_serialize_value` dict/list, MySQL·PG·Oracle JSON→JSONB 타입 매핑
- `transform_rules_service.py`: `_etl_data_conn()` → `get_db_connection_etl()`
- `docs/main/04_DB_ARCHITECTURE.md`: sync_mode DDL 기본 권장, etl_storage_connections 앱 동작 문구

검증: `python -m compileall Backend/etl_server`, `pytest tests/test_transform_engine.py tests/test_query_studio_api.py` 21 passed.

Changed files: Backend/etl_server/service_file.py, Backend/etl_server/service.py, Backend/etl_server/db_load_service.py, Backend/etl_server/transform_rules_service.py, docs/main/04_DB_ARCHITECTURE.md, docs/log/log.md

159. 2026-04-02 2차 전수검사: 문서04 etl_jobs·배치이력·쿼리스튜디오 권한 오버라이드·pytest
Purpose: 운영 DDL과 `04_DB_ARCHITECTURE` 잔여 불일치(§16·§23·§24) 정리, `test_query_studio_api`가 JWT 없이 401만 받던 문제를 공통 `Depends` 식별자로 해소, ETL 라우트 감사·변환 테스트 재실행.
Changes:

- `docs/main/04_DB_ARCHITECTURE.md`: §16 `etl_jobs` 확장 컬럼·앱 주석, §23 `batch_run_history`·§24 `batch_loaded_keys` 실측 정합
- `Backend/query_studio_server/router.py`: `require_query_read_perm`·`require_query_execute_perm` 모듈 상수로 분리(엔드포인트 `Depends` 치환)
- `tests/test_query_studio_api.py`: `app.dependency_overrides`로 위 권한 의존성 스텁

검증: `python tests/etl_api_route_audit.py` exit 0, `pytest tests/test_query_studio_api.py tests/test_transform_engine.py` 21 passed.

Changed files: docs/main/04_DB_ARCHITECTURE.md, Backend/query_studio_server/router.py, tests/test_query_studio_api.py, docs/log/log.md

158. 2026-04-02 ETL 전수검사: 라우트 대조 스크립트·transform 테스트 경로·헬스 스모크
Purpose: packages/etl `etlClient.js`와 FastAPI `/api/etl*` 경로 패턴 전수 대조, transform 단위 테스트 복구, API 헬스·ETL 게이트 스모크.
Changes:

- `tests/etl_api_route_audit.py` 추가: etlClient 추출·앱 라우트 정규화·누락 검출
- `tests/test_transform_engine.py`: `etl_server2` → `etl_server` 경로 수정
- `docs/report/18_…`: 전수검사 요약 절 추가, log

검증: `python tests/etl_api_route_audit.py` exit 0, `pytest tests/test_transform_engine.py` 15 passed, TestClient `/health` 200·`/api/etl` 401.

Changed files: tests/etl_api_route_audit.py, tests/test_transform_engine.py, docs/report/18_ETL_ibank_etl_data_Schema_Creator_CURL_FE.md, docs/log/log.md

157. 2026-04-02 ETL service: etl_connections·storage source_type/encrypted_password 동적 INSERT·SELECT
Purpose: 실측 `ibank_etl_data`는 `etl_connections.source_type`·`encrypted_password`·`etl_storage_connections.source_type`인데 코드가 `db_type`·`password`·`storage_type`만 가정해 INSERT/SELECT가 실패할 수 있음. `information_schema` 기준으로 물리 컬럼 선택.
Changes:

- `service.py`: `_etl_conn_*`·`_storage_conn_*` 헬퍼, `create_connection`·`list_connections`·`get_connection_for_etl`·`get_or_create_file_connection`·`delete_connection`·`list_etl_tables`·`get_etl_table`·`list_storage_connections`·`get_storage_connection`·`create_storage_connection` 정합
- `18_…Schema_Creator_CURL_FE.md` 표 보강, log

Changed files: Backend/etl_server/service.py, docs/report/18_ETL_ibank_etl_data_Schema_Creator_CURL_FE.md, docs/log/log.md

156. 2026-04-02 ETL service_file DB 실측 정합: protocol·registry PK id·폴더 목록 생성자·문서18
Purpose: ibank_etl_data 실측(`batch_folder_connections.protocol`, `etl_batch_target_registry.id` PK)과 코드 불일치 제거. 생성자·CURL/FE 후속 작업용 체크리스트를 report에 저장.

Changes:

- `service_file`: `folder_type`/`protocol` 동적 매핑(INSERT·SELECT·JOIN), `etl_batch_target_registry` PK `id`·`registry_id` 동시 지원, upsert/delete/list·CREATE IF NOT EXISTS DDL 정리, 폴더 연결 목록에 `create_user_id`·`create_user_label`(user_info 있을 때 닉네임·이메일)
- `FolderConnectionListFile.jsx`: 등록자 열
- `docs/report/18_ETL_ibank_etl_data_Schema_Creator_CURL_FE.md`, `00_ReportIndex.md`

Changed files: Backend/etl_server/service_file.py, Frontend/react-app/src/packages/etl/components/FolderConnectionListFile.jsx, docs/report/18_ETL_ibank_etl_data_Schema_Creator_CURL_FE.md, docs/report/00_ReportIndex.md, docs/log/log.md

155. 2026-04-02 ETL DB 증분: etl_tables pk_columns 미저장 시 소스·타겟 PK로 실행 시 보강
Purpose: 운영 `etl_tables`에 `pk_columns` 컬럼이 없으면 등록 시 소스에서 읽은 PK가 DB에 남지 않아 증분 실행에서 `incremental 모드는 pk_columns가 필요합니다`로 실패함. `run_db_load`에서 컬럼 매핑 확정 직후 `_resolve_pk_columns_for_db_load`로 저장값 → 소스 PK+매핑 → 소스 PK → `get_target_pk_columns` 순 보강.

Changed files: Backend/etl_server/db_load_service.py, Backend/etl_server/service.py (create_etl_table 주석), docs/log/log.md

154. 2026-04-02 ETL 정본 스키마 정합: batch_folder is_verified 제거·etl_jobs JOIN·insert_job
Purpose: 운영 DB 정본에 맞춰 존재하지 않는 컬럼 참조를 제거·완화. `batch_folder_connections`: 목록 SELECT·create에서 `is_verified` 제거, `set_folder_connection_verified`는 컬럼 없으면 no-op, API 호환 `is_verified` None. `list_batch_target_registry`에 `c.folder_type` SELECT 추가. `etl_jobs`+`etl_tables` JOIN은 `target_table`·`source_table`·`connection_id`·`sync_mode`만 선택(`t.description` 제거), `list_jobs`/`get_job` 응답에 `description`·`source_type`·`job_type`·`storage_connection_id` compat None. `insert_job`는 `add_file_path`/`add_file_type` 컬럼이 있을 때만 해당 INSERT 분기.

Changed files: Backend/etl_server/service_file.py, Backend/etl_server/service.py, docs/log/log.md

153. 2026-04-02 문서 04·ETL 주석: 운영 DB 실측 기준 문구 정리(확장 DDL 표현 제거)
Purpose: 운영 DB를 옮긴 실측 스키마가 기준인데 문서에「확장 DDL」「최소 DDL」 등이 섞여 DB를 늘리라는 뉘앙스로 읽힐 수 있어 수정함. §13~ 도입·§15·§16·§22 및 테이블 분류 표를「운영 실측 + 앱이 information_schema로 존재 컬럼만 사용」「API↔DB 컬럼명 차이는 앱 매핑」으로 통일. `batch_jobs` 표에서 전달 실측에 없던 `create_user_id` 행 제거. `service_file` ValueError 문구·모듈 주석, `transform_rules_service` 헤더 정리.

Changed files: docs/main/04_DB_ARCHITECTURE.md, Backend/etl_server/service_file.py, Backend/etl_server/transform_rules_service.py, docs/log/log.md

152. 2026-04-02 ETL 운영 DB 실측 정합: batch_jobs 동적 INSERT·schedule_cron·transform_rules·스케줄러
Purpose: 운영 `ibank_etl_data` 실측 컬럼(예: `batch_jobs`의 `schedule_cron` 중심, `etl_transform_rules`의 `rule_order`·`expression`)과 코드가 어긋나 INSERT/ORDER BY 실패하던 문제를 정리. `create_batch_job`·`update_batch_job`를 존재 컬럼만 사용하도록 하고 `schedule_cron`↔`interval_minutes` 매핑·중복 검사·타겟명 `etl_table_id` 보완을 추가. 스케줄러는 `effective_batch_job_type`·`effective_interval_minutes_from_batch_row` 사용. 변환 룰은 실측 컬럼에 맞춘 CRUD·조회 정렬·`expression`→`rule_config` 보강. `delete_etl_table`/`row_only`는 `add_file_path` 컬럼 있을 때만 SELECT.

Changes:
- service_file: `_interval_to_schedule_cron`, `effective_*`, `_BATCH_INSERT_COL_ORDER`, 동적 INSERT/중복, `update_batch_job` 컬럼 필터, `list_batch_jobs`/`get_batch_job`에서 `interval_minutes` 보완, SELECT에 `schedule_cron`
- scheduler_file: `effective_batch_job_type`·`effective_interval_minutes_from_batch_row` 연동
- batch_executor_file: `target_table`·`column_mapping`·`pk_columns`를 `etl_tables`에서 보완
- transform_rules_service: `_enrich_rule_dict`, `rule_order` 정렬, DB 컬럼 조합별 INSERT/UPDATE
- service.py: `delete_etl_table`·`delete_etl_table_row_only` add_file_path 가드
- docs/main/04_DB_ARCHITECTURE.md: (당시) ETL 절 운영 실측·앱 동작 안내 보강 — 이후 153에서 문구 재정리

Changed files: Backend/etl_server/service_file.py, scheduler_file.py, batch_executor_file.py, transform_rules_service.py, service.py, docs/main/04_DB_ARCHITECTURE.md, docs/log/log.md

151. 2026-04-02 ETL delete_job: etl_jobs.add_file_path 없을 때 SELECT 생략
Purpose: `DELETE /api/etl/jobs/{id}`가 삭제 전 `SELECT add_file_path`를 항상 실행해, 컬럼이 없는 실DB에서 `UndefinedColumn`→500이 났음. `information_schema`로 컬럼 확인 후 있을 때만 조회·파일 삭제, 이후 `DELETE`는 동일.

Changed files: Backend/etl_server/service.py, docs/log/log.md

150. 2026-04-02 ETL update_etl_table_status: etl_tables.status 없을 때 no-op
Purpose: 실DB `etl_tables`에 `status` 컬럼이 없을 때 `UPDATE ... SET status`가 실패해 Job 전체가 실패·에러 핸들러까지 연쇄 예외가 났음. `information_schema`로 컬럼 확인 후 없으면 갱신 생략, 있으면 `updated_at`은 컬럼 있을 때만 SET.

Changed files: Backend/etl_server/service.py, docs/log/log.md

149. 2026-04-02 이관 후보: 역할 SQL 필터·관리범위 검증·빈 목록 안내
Purpose: `list_ownership_transfer_targets`가 동일 부서 전원을 읽은 뒤 Python에서 거르지 않고, 비ETL 경로는 SQL에서 `sa_dev|sa|a`만 조회. ETL 경로도 후보마다 `_assert_target_exists_or_same_dept` 적용. 이관 모달에 사전 검증 목록 설명·유형별 빈 목록 문구·`admin-users__empty-title`.

Changed files: Backend/admin_server/service_users.py, Frontend/react-app/src/app/admin/AdminUsersPage.jsx, admin-users.css, docs/log/log.md

148. 2026-04-02 ETL DB연동 소스 테이블: 활성 연결만·목록 API 정합·로딩 가드
Purpose: `GET /api/etl/connections`가 비활성 행까지 내려주고 소스 테이블 조회는 `get_connection_for_etl`의 `is_active=TRUE`만 허용해, 선택 후 목록이 비어 보이는 불일치가 생김. 목록을 활성만으로 맞추고 `DbConnectionForm`에서 로딩 가드·연결 ID 문자열 통일·조회 실패 메시지를 추가함.

Changes: `list_connections`에 `WHERE is_active=TRUE`(컬럼 존재 시); `DbConnectionForm` `useMemo`·`loadingConn` 가드·`tablesLoadError`·option `String(connection_id)`.

Changed files: Backend/etl_server/service.py, router.py, Frontend/react-app/src/packages/etl/components/DbConnectionForm.jsx, docs/log/log.md

147. 2026-04-02 사용자관리: table_master create_user_id 이관·권한 기반 수신 후보·전건 목록
Purpose: `table_master.create_user_id = 대상`인 행을 전부 작업물에 표시(매핑 프로젝트명 요약). 이관 수신자는 `get_effective_permission_ids_for_me`로 매핑 프로젝트에서 `query.execute` 보유자, 또는 원 소유자와 동일 부서 SA/A, 또는 SA_DEV(액터 SA→sa_dev 제외). `ownership-transfer-targets?resource_type=table_master&table_master_id=`·`transfer-ownership`·`get_user_dptmt_for_admin` 검증.

Changed files: Backend/admin_server/service_users.py, router.py, schemas.py, Frontend/react-app/src/shared/api/adminClient.js, Frontend/react-app/src/app/admin/AdminUsersPage.jsx, docs/log/log.md

146. 2026-04-02 ETL 저장 DB API 내장 행·공용 셀렉트·저장 DB 탭 흐름 통일
Purpose: `GET /api/etl/storage-connections` 선두에 config 기반 내장 main·dash 항목(`is_builtin`)을 넣어 셀렉트 옵션과 &quot;저장 DB 등록&quot; 탭이 같은 출처를 보도록 함. `EtlStorageDbSelect`·`getEtlStorageSelectOptions`로 파일/DB/배치 폼 일원화, 테이블선택 모달에 현재 적재 대상 안내.

Changes: `list_storage_connections` 선두 내장 행; `StorageConnectionForm` 내장/등록 구역 분리; `TargetTableSelectModal`·`ETLPage` 안내 문구; `etl.css` 배너 스타일.

Changed files: Backend/etl_server/service.py, router.py, Frontend/react-app/src/packages/etl/utils/storageDb.js, components/EtlStorageDbSelect.jsx, DbConnectionForm.jsx, FileUploadForm.jsx, BatchJobFormFile.jsx, StorageConnectionForm.jsx, TargetTableSelectModal/index.jsx, ETLPage.jsx, etl.css, docs/log/log.md

145. 2026-04-02 정지 검사: user_has_transferable_ownership에 table_master.create_user_id 반영
Purpose: 역할 변경 차단·문서상 테이블 생성자와 맞추어, `table_master.create_user_id`만 가진 사용자도 정지 전 이관 안내가 나가도록 `user_has_transferable_ownership`에 SELECT 추가. 정지 안내 문구 보강.

Changed files: Backend/admin_server/service_users.py, docs/log/log.md

144. 2026-04-02 ETL 내장 저장소 main(null)·dash(-1) UI·API 설명 정합
Purpose: 적재 대상을 config `main_db`·`dash_db` 두 축으로 분리해 셀렉트·목록 라벨·전체 동기화 확인 문구를 맞춤. `storageDb.js`에 `STORAGE_BUILTIN_DASH_ID`·`formatEtlStorageLabel` 추가, FormData는 dash일 때도 `storage_connection_id` 전송.

Changes: ETL 폼(FileUpload·DbConnection·BatchJobFile)에 dash 옵션; `ETLTableList`·`BatchJobListFile` 저장 열 표시 통일; `ETLPage` full sync 경고 DB 구분; `router.py`·`router_file.py` 필드·엔드포인트 설명 보강.

Changed files: Frontend/react-app/src/packages/etl/utils/storageDb.js, components/FileUploadForm.jsx, DbConnectionForm.jsx, BatchJobFormFile.jsx, ETLTableList.jsx, BatchJobListFile.jsx, ETLPage.jsx, Backend/etl_server/router.py, router_file.py, docs/log/log.md

143. 2026-04-02 table_master 전사 원장 복원·db_type main|dash만
Purpose: `table_master`에 `dptmt_info_id`를 두지 않는 정책에 맞춰 UPSERT를 `UNIQUE(db_type,table_name)`·컬럼 `(db_type,table_name,create_user_id,…)` 기준으로 되돌림. `db_type` 값은 `star`를 쓰지 않고 main·dash만 허용; 대시보드 허용·집계 후보는 main∪dash만 조회하고 `*_star_*` 파트너 규칙은 dash 매핑 기준으로 유지.

Changes: `table_master_hook`, `query_studio_server.router` `_upsert_table_master_and_mapping`; `admin_server.service_tables`·`router` Query 설명; `core.db` `_normalize_db_type`·`is_table_allowed_for_project_dashboard`; `dashboard_service.get_aggregatable_tables`; `docs/main/04`·`06`; log.

Changed files: Backend/etl_server/table_master_hook.py, Backend/query_studio_server/router.py, Backend/admin_server/service_tables.py, router.py, Backend/core/db.py, dashboard_service.py, Backend/etl_server/load_service.py, db_load_service.py, docs/main/04_DB_ARCHITECTURE.md, docs/main/06_CUSTOMER_JOURNEY.md, docs/log/log.md

142. 2026-04-02 table_master create_user_id·부서 유일키·문서 04 정합
Purpose: `ibank_system_data.table_master`에 `create_user_id` 추가 및 실제 UNIQUE(`dptmt_info_id`,`db_type`,`table_name`)에 맞춰 ETL·쿼리스튜디오·배치 적재 경로에서 INSERT/UPSERT 시 생성자·부서를 반영. `docs/main`의 `table_master` 서술을 실DB와 일치.

Changes: `table_master_hook` UPSERT 컬럼·충돌 타겟 수정; `load_service`·`db_load_service`에서 job/etl_tables `create_user_id` 전달; `query_studio` 큐·`_upsert_table_master_and_mapping`에 JWT `user_id`·`project_info.dptmt_info_id` 반영; `load_dataframe` 신규 CREATE 시 기본 저장 DB면 훅 호출 및 배치 실행기에서 인자 전달; admin 목록·사용자 작업물·정지 검사에 `create_user_id` 반영; `04`·`06` 문서 갱신.

Changed files: Backend/etl_server/table_master_hook.py, load_service.py, db_load_service.py, load_service_file.py, batch_executor_file.py, batch_executor_db.py, Backend/query_studio_server/router.py, Backend/admin_server/service_tables.py, service_users.py, docs/main/04_DB_ARCHITECTURE.md, docs/main/06_CUSTOMER_JOURNEY.md, docs/log/log.md

141. 2026-04-01 etl_tables·etl_jobs 실DB 정합·04 문서 동기화
Purpose: `ibank_etl_data` 실물리 스키마(최소 `etl_tables`·`etl_jobs`)에 맞춰 목록/단건/INSERT/갱신이 실패하지 않도록 `service.py`에서 동적 컬럼·`rows_loaded`/`rows_extracted` 매핑을 적용. `04_DB_ARCHITECTURE`의 `etl_tables.connection_id` NULL 가능·`etl_jobs`에서 필수 아닌 컬럼·`batch_jobs.create_user_id` 확장 표기로 문서와 DB 정합.

Changes: `Backend/etl_server/service.py`·`docs/main/04_DB_ARCHITECTURE.md`·`docs/log/log.md`.

Changed files: Backend/etl_server/service.py, docs/main/04_DB_ARCHITECTURE.md, docs/log/log.md

140. 2026-04-01 이관: 부서 SA→sa_dev 금지·A는 ETL 등 sa_dev 수신 가능
Purpose: 부서 소속 Super Admin(sa)이 전사 sa_dev에게 작업물·ETL 등록 건을 넘기는 것은 정책상 불가. Admin(a)은 ETL 이관 대상 목록에서 etl_yn=Y 또는 sa_dev인 동일 부서 사용자(sa_dev 포함)에게 이관 가능 유지.

Changes: `list_ownership_transfer_targets`에서 액터 sa일 때 수신 후보에서 sa_dev 제외; `transfer_resource_ownership` 동일 검증.

Changed files: Backend/admin_server/service_users.py, docs/log/log.md

139. 2026-04-01 사용자관리: ETL 메타 작업물 목록·create_user_id 이관·정지 검사
Purpose: SA_DEV·SA·A가 보는 사용자의 etl_db 등록 건을「목록」에 표시하고, 동일 부서·ETL 자격(etl_yn=Y 또는 SA_DEV) 수신자에게 create_user_id 이관. 정지 전 transferable 검사에 ETL 소유 포함. etl_server 패키지 상위 import 회피용 로컬 information_schema 헬퍼 사용.

Changes: `get_user_work_assets` etl_db 조회·`target_user_dptmt_info_id`; `list_ownership_transfer_targets(etl_infra)`; `transfer_resource_ownership` 6종 ETL 타입; `user_has_transferable_ownership`·정지 메시지; 스키마·adminClient·AdminUsersPage.

Changed files: Backend/admin_server/service_users.py, router.py, schemas.py, Frontend/react-app/src/shared/api/adminClient.js, Frontend/react-app/src/app/admin/AdminUsersPage.jsx, docs/log/log.md

138. 2026-04-01 list_batch_target_registry: batch_jobs 컬럼 동적 SELECT
Purpose: 메인 조회에서 `j.interval_minutes` 등 고정 참조로 구 DDL에서 UndefinedColumn 발생 → `_registry_batch_jobs_cols_sql`·`folder_connection_id` 없으면 폴더 JOIN `ON FALSE`.

Changed files: Backend/etl_server/service_file.py, docs/log/log.md

137. 2026-04-01 etl_batch_target_registry: id 레거시 폴백 제거(registry_id만)
Purpose: `r.id AS registry_id`·PK `id` 분기 제거. DDL이 맞지 않으면 조회·upsert·삭제가 실패하도록 단일 기준(`registry_id`)만 사용.

Changes: `_registry_row_select_sql`, `_registry_order_by`, `upsert_batch_target_registry`, `delete_batch_target_registry_and_drop_table`.

Changed files: Backend/etl_server/service_file.py, docs/log/log.md

136. 2026-04-01 etl_batch_target_registry: registry_id·운영 DDL·upsert/clear/delete 정합
Purpose: PK `registry_id`, `batch_job_id NOT NULL` 운영 DDL에 맞춤. `_ensure` CREATE, `_registry_row_select_sql`·`upsert_batch_target_registry`·`clear_batch_job_from_registry`(DELETE), `delete_batch_target_registry_and_drop_table`·목록 응답 `id` 호환.

Changes: `service_file.py` 레지스트리 블록.

Changed files: Backend/etl_server/service_file.py, docs/log/log.md

135. 2026-04-01 ETL: user_info 없을 때 JOIN 생략·레지스트리 컬럼 동적 SELECT
Purpose: ETL DB에 `user_info`가 없을 때 `LEFT JOIN user_info`로 500 방지(`_table_exists`). `etl_batch_target_registry` 구 DDL에 `storage_connection_id` 등 없을 때 `r.*` 동적 SELECT·`COALESCE(r,j)`로 스토리지 JOIN.

Changes: `service._table_exists`; `list_etl_tables`, `get_etl_table`, `list_jobs`; `service_file.list_batch_jobs`, `get_batch_job`, `list_batch_target_registry`, `_registry_row_select_sql`, `_registry_order_by`.

Changed files: Backend/etl_server/service.py, service_file.py, docs/log/log.md

134. 2026-04-01 ETL: list_jobs/get_job etl_tables 컬럼 방어·백필 SELECT 통일
Purpose: `t.description`/`t.target_table` 누락 시 Job 목록·단건 조회 오류 방지. `list_batch_target_registry` 백필은 `_batch_job_backfill_select_parts`로 `batch_job_id` 등 컬럼까지 `_batch_job_select_parts`와 동일 규칙 적용.

Changes: `service._etl_tables_join_select_parts`, `list_jobs`, `get_job`; `service_file._batch_job_backfill_select_parts`, `list_batch_target_registry`.

Changed files: Backend/etl_server/service.py, service_file.py, docs/log/log.md

133. 2026-04-01 ETL: etl_jobs DDL 드리프트·batch_jobs target_table 방어
Purpose: 터미널 오류 `column j.rows_processed does not exist`, `column j.target_table does not exist` 대응. `list_jobs`·`get_job`은 `information_schema` 기준으로 `etl_jobs` SELECT 컬럼을 조합하고, `list_batch_target_registry` 초기 백필 쿼리는 `batch_jobs.target_table` 없으면 `NULL::text` 사용.

Changes: `service._etl_jobs_j_select_sql`·`list_jobs`·`get_job`; `service_file.list_batch_target_registry`. `permission denied for table batch_jobs`는 DB `GRANT SELECT`로 해결.

Changed files: Backend/etl_server/service.py, service_file.py, docs/log/log.md

132. 2026-04-01 ETL 등록자 UI·API: create_user_label·insert_job·batch_jobs
Purpose: ETL 테이블·배치 Job·Job 이력 목록에서 누가 등록했는지 확인할 수 있도록 `user_info` 조인 `create_user_label`을 내려주고, `etl_jobs`·`batch_jobs` INSERT 시 JWT `create_user_id`를 저장한다.

Changes: `service.insert_job`·`list_jobs`·`list_etl_tables`·`get_etl_table`; `service_file.list_batch_jobs`·`get_batch_job`·`create_batch_job`·`list_batch_target_registry`; `router` add-file·zip·run; `router_file` 배치 Job 생성·복제. 프론트 `ETLTableList`·`BatchJobListFile`·`JobHistoryPanel`에 등록자 열, `etl.css`. `docs/main/04` etl_jobs·batch_jobs에 `create_user_id` 행 안내.

Changed files: Backend/etl_server/service.py, service_file.py, router.py, router_file.py, Frontend/react-app/src/packages/etl/components/ETLTableList.jsx, BatchJobListFile.jsx, JobHistoryPanel.jsx, etl.css, docs/main/04_DB_ARCHITECTURE.md, docs/log/log.md

131. 2026-04-01 ETL service: DDL 단일 기준 고정·create_user_id 조회 반영
Purpose: 사용자 제공 `ibank_etl_data` DDL을 단일 기준으로 삼아 `source_type`/`encrypted_password` 물리 컬럼 폴백을 제거하고, `create_user_id`는 INSERT뿐 아니라 목록·상세 조회에 포함한다.

Changes: `etl_connections` SQL은 `db_type`·`password` 고정. `etl_storage_connections`는 `config_json`·`storage_type`만 사용(호스트 분산 컬럼 경로 제거). `list_etl_tables`·`get_etl_table`에 `create_user_id` 컬럼, `list_storage_connections`·`get_storage_connection`에 `create_user_id` 선택. 파일 연결 생성은 `db_type`·`password` 필수 스키마 가정.

Changed files: Backend/etl_server/service.py, docs/log/log.md

130. 2026-04-01 ETL service: ibank_etl_data 컬럼명 정합(db_type·password·config_json)
Purpose: 운영 `ibank_etl_data`의 `etl_connections`(db_type·password)·`etl_storage_connections`(storage_type·config_json) 물리명과 레거시(source_type·host 분산 컬럼)를 동시 지원한다.

Changes: `information_schema`로 컬럼 선택 후 INSERT/SELECT·`get_connection_for_etl`·`list_connections`·`create_connection`·`get_or_create_file_connection`·`delete_connection`·`list_etl_tables`/`get_etl_table` JOIN에 `db_type`/`password` 분기. 저장소는 `config_json` 단일 컬럼 시 JSON에 host 등 직렬화·`normalize_storage_connection_row`로 응답 호환·`update_storage_connection` 병합 갱신.

Changed files: Backend/etl_server/service.py, docs/log/log.md

129. 2026-04-01 ETL 전사 단위: create_user_id·04 문서·INSERT/라우터
Purpose: ETL 메타를 부서(`dptmt_info_id`)가 아닌 전사 단위로 두고, `docs/main/04`에 `create_user_id`(FK user_info)를 명시. INSERT는 `information_schema`로 컬럼 존재 시에만 `create_user_id`·레거시 `created_by`를 채움. JWT `user_id`는 `require_etl_infrastructure` payload로 전달.

Changes: `service.py` `_append_creator_columns_etl`, `create_connection`·`create_storage_connection`·`get_or_create_file_connection`·`create_etl_table`; `router.py`·`router_file.py` 생성 API에 `Depends(require_etl_infrastructure)`; `service_file.create_folder_connection` 동적 마스터 INSERT(`is_active`/`is_verified`·`create_user_id`). 프론트 ETL에 부서 필터 없음(변경 없음).

Changed files: Backend/etl_server/service.py, router.py, router_file.py, service_file.py, docs/main/04_DB_ARCHITECTURE.md, docs/log/log.md

128. 2026-04-01 batch_folder_connections: 코드 protocol→folder_type 정합
Purpose: DB·`docs/main/04` 설계 컬럼명 `folder_type`과 일치하도록 ETL 배치 폴더 연결 SQL·API·실행기·프론트를 `protocol`에서 되돌림.

Changes: `service_file` INSERT/SELECT/JOIN·`get_folder_adapter`·`router_file` Pydantic·`batch_executor_file` job dict 키·폴더 연결 폼/목록. 설계서 `09_ETL_SFTP_Connection`·`etc01` 예시 문구.

Changed files: Backend/etl_server/service_file.py, router_file.py, batch_executor_file.py, Frontend/react-app/src/packages/etl/components/FolderConnectionFormFile.jsx, FolderConnectionListFile.jsx, docs/report/09_ETL_SFTP_Connection.md, docs/report/etc01_Backend_Learning_Flow.md, docs/log/log.md

127. 2026-04-01 pmssn 시드 query.read/query.execute·auth·쿼리스튜디오·문서 정합
Purpose: DB `pmssn_master_detail` 시드가 `query.read`·`query.execute`로 바뀐 것에 맞춰 JWT·Fast Path·라우터·홈 빠른 액세스·아키텍처 문서를 동일 키로 통일한다.

Changes: `Backend/auth_server/permissions.py` `_PROJECT_FEATURE_IDS`, `Backend/query_studio_server/router.py` `require_permission`, `app/home/homeAccess.js`·`HomePage.jsx`, `docs/main/04`·`05`, `docs/report/17` 권한·시드·경로 표기.

Changed files: Backend/auth_server/permissions.py, Backend/query_studio_server/router.py, Frontend/react-app/src/app/home/homeAccess.js, Frontend/react-app/src/app/home/HomePage.jsx, docs/main/04_DB_ARCHITECTURE.md, docs/main/05_Permission_ARCHITECTURE.md, docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/log/log.md

126. 2026-04-01 .cursor 에이전트·스킬·룰: ETL 단일·캠페인 대시보드·http.js 정합
Purpose: 구 etl1/etl2·`etl_server2`·구 dashboard 패키지 경로 등 잔재를 제거하고, docs/main 과 동일하게 단일 `etl_server`·`packages/etl`, 대시보드는 `campaign_dash_server`/`campaign_dashboard`, API 클라이언트는 `packages/*/api/*Client.js`·`shared/api/http.js` 로 통일.

Changes: `project-conventions.mdc`, `tech-lead-orchestration.mdc`, agents(be-*·fe-*·linker·verifier), skills(api-client-sync·fastapi·db-load·cross-check·react-component·migration-helper), commands(add-feature·build-check·verify), `.cursor/README.md` 현행 스택 요약.

Changed files: .cursor/**, docs/log/log.md

125. 2026-04-01 report_server→query_studio_server·문서·스킬 명명 정합
Purpose: 백엔드 패키지를 `auth_server` 등과 동일하게 `query_studio_server`로 통일. 프론트 `packages/query_studio`와 구분되는 서버 접미사 `_server` 명시. HTTP `/api/*` 유지. JWT 권한 키는 이후 로그 #127에서 `query.read`/`query.execute`로 정합.

Changes: `Backend/query_studio` 폴더를 `query_studio_server`로 이동, import·`query_studio_router`·테스트 `test_query_studio_api.py`·`docs/main`·`docs/report/17`·`.cursor` 스킬/룰/be-impl 갱신.

Changed files: Backend/query_studio_server/**, Backend/api_server/main.py, Backend/api_server/routers/__init__.py, Backend/core/db.py, Backend/core/dependencies.py, Backend/__init__.py, Backend/api_server/__init__.py, Backend/core/__init__.py, Backend/auth_server/permissions.py, tests/test_*.py, docs/main/*.md, docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, .cursor/agents/be-impl.md, .cursor/rules/project-conventions.mdc, .cursor/skills/api-client-sync/SKILL.md, .cursor/skills/react-component/SKILL.md, docs/log/log.md

124. 2026-04-01 docs/main 일괄 정합: user_dvsn 캐논·인증·라우터·테이블 노출 정책
Purpose: `docs/log`·코드(`user_dvsn_codes`, `auth_server`, `api_server/main`, `query_studio_server/list-tables`, 가입 서비스) 기준으로 docs/main 7종과 시스템 동작 불일치를 제거한다.

Changes:

- `05`·`04`·`06`: DB·앱 `user_dvsn` 값 `sa_dev`/`sa`/`a`/`o`/`u`, 권한 템플릿(`pmssn_master`) 용어 정리
- `00`·`02`·`03`: 앱 수준 JWT·`require_permission`·라우터 조립·system_db 범위·쿼리 스튜디오 테이블=프로젝트 매핑 반영; 구 “인증 없음”·구 대시보드 중심 지도 수정
- `01`: 디렉터리 트리 `app/layout/navConfig.js` 경로 수정
- `03`·`00` 문서 인덱스 문구 보강

Changed files: docs/main/00_PRD.md, 01_FRONTEND_GUIDE.md, 02_BACKEND_GUIDE.md, 03_AI_DEVELOP_GUIDE.md, 04_DB_ARCHITECTURE.md, 05_Permission_ARCHITECTURE.md, 06_CUSTOMER_JOURNEY.md, docs/log/log.md

123. 2026-04-01 권한문서 05: require_permission 검증 흐름도·엣지 케이스 표 추가
Purpose: `permissions.py` 구현과 동일한 단계(액세스 JWT → canon user_dvsn → project_info_id → Fast/Slow path)를 `05_Permission_ARCHITECTURE.md` 상단에 ASCII 흐름도로 두고, `needed` 빈 튜플·ETL/미존재 user·캐논 불일치 등 엣지 케이스를 표로 정리한다.

Changes:

- STEP 1~6 흐름, 기본 기능 집합·`_AUTO_PROJECT_ROLES` 설명, ETL 별도 의존성 안내
- 엣지 케이스 표: 빈 `require_permission()`은 Slow Path 후 루프 0회 통과 등
- 백엔드 구현 메모에 `deps.py`·캐논 코드 참조·자동 역할 표현 보정

Changed files: docs/main/05_Permission_ARCHITECTURE.md, docs/log/log.md

122. 2026-04-01 고객여정 06: 부서·사용자·권한 어드민 UX 가이드(Phase 11) 보강
Purpose: 최근 부서·사용자·권한 관리 화면 개편 및 로그(#98~#121) 내용을 `06_CUSTOMER_JOURNEY.md`에 반영해, 여정 문서만 읽고도 실제 화면 조작 흐름을 따라갈 수 있게 한다.

Changes:

- 문서 상단 용도에 Phase 11 UX 가이드·log 교차 참조 문구 추가
- Phase 11 역할별 범위 표를 트리 조회·권한 관리 표현으로 정리
- 하위 절「부서·사용자·권한 화면 UX 가이드」: `/admin/org`·`/admin/users`·`/admin/roles`별 표 형식 안내(레이아웃, 모달, 검증, 사용현황 드릴다운 등)

Changed files: docs/main/06_CUSTOMER_JOURNEY.md, docs/log/log.md

121. 2026-04-01 권한 목록 테이블: 권한명·상세 폰트를 작업 버튼과 통일·행 세로 중앙
Purpose: `ap__table` 권한 관리 목록에서 권한명·권한상세 셀 글자 크기를 `.ap__btn`(0.875rem)과 맞추고, `ap__mono`로 작아지던 상세 열을 동일 크기로 두며 행은 세로 중앙 정렬한다.

Changes:

- 권한 목록 `table`에 `ap__table--roles` 적용
- `vertical-align: middle`, 작업 열 `ap__row`는 `align-items: center`

Changed files: Frontend/react-app/src/app/admin/AdminRolesPage.jsx, Frontend/react-app/src/app/admin/admin-pages.css, docs/log/log.md

120. 2026-04-01 권한관리: 우상단 권한 생성 모달·본문에 목록 우선 표시
Purpose: 부서/사용자 관리와 동일하게 헤더 우측에「권한 생성」을 두고, 기존 상단 인라인 생성 폼을 모달로 옮긴 뒤 본문에서는 권한 목록이 바로 보이도록 한다.

Changes:

- `ap__header-row`·`ap__btn-head-create`·`ap__modal--create`·모달 액션/힌트 보조 클래스
- 생성 성공 시 모달 닫기·폼 초기화·목록 `load()`

Changed files: Frontend/react-app/src/app/admin/AdminRolesPage.jsx, Frontend/react-app/src/app/admin/admin-pages.css, docs/log/log.md

119. 2026-03-31 권한 수정 모달: 권한상세 textarea 제거·셀렉트+행 목록으로 통일
Purpose: 수정 모달에서 권한 상세를 직접 입력(textarea)하던 UX를 제거하고, 생성 폼과 동일하게 `pmssn_master_detail` 기반 셀렉트·추가·행 목록(x 제거)으로 편집한다.

Changes:

- `pmssnListToArray`로 기존 `pmssn_list`를 편집 배열로 로드
- 수정 모달: `editPmssnList`, `editSelectedPermission`, 추가/제거 핸들러, 생성 폼과 동일 테이블 UI
- 옵션 비동기 로드 시 셀렉트 기본값 보정 `useEffect`
- `ap__modal--edit`로 모달 폭·스크롤 보강

Changed files: Frontend/react-app/src/app/admin/AdminRolesPage.jsx, Frontend/react-app/src/app/admin/admin-pages.css, docs/log/log.md

118. 2026-03-31 권한상세 목록 영역 높이·패딩·세로 정렬 CSS
Purpose: `ap__permission-list-wrap`이 셀렉트+추가 행(`ap__row`)과 비슷한 최소 높이를 갖도록 하고, 빈 상태 힌트·테이블 셀에 좌측 패딩 10px 이상과 상하 중앙 정렬을 적용한다.

Changes:

- `ap__permission-list-wrap`: `min-height`를 입력행 높이에 맞춤, flex로 빈 상태 세로 중앙
- `ap__permission-list` th/td: `padding: 12px 14px`, `vertical-align: middle`
- 빈 상태 `.ap__hint`: `padding: 12px 14px`
- 삭제 셀·버튼: 세로 정렬 보강

Changed files: Frontend/react-app/src/app/admin/admin-pages.css, docs/log/log.md

117. 2026-03-31 권한상세 추가 목록 row 표시로 UI 변경
Purpose: 권한 생성 폼에서 `추가`된 권한상세 항목을 칩 형태 대신 행 목록으로 보여주고, `권한명/권한설명`을 함께 확인할 수 있게 개선한다.

Changes:

- `newPmssnList` 렌더링을 칩 UI에서 row 테이블 UI로 변경 (`권한명`, `권한설명`, `x`)
- `permissionOptions` 기반 `permissionOptionMap`을 사용해 설명 컬럼 표시(설명 미존재/동일값은 `-`)
- `x` 버튼을 행 우측 끝 정렬로 배치하고 기존 제거 동작 유지

Changed files: Frontend/react-app/src/app/admin/AdminRolesPage.jsx, Frontend/react-app/src/app/admin/admin-pages.css, docs/log/log.md

116. 2026-03-31 권한상세 옵션 조회를 pmssn_master_detail로 전환
Purpose: 권한 관리 화면의 `권한 상세 목록` 셀렉트가 빈 목록으로 보이던 문제를 해결한다. 옵션 소스를 `pmssn_master.pmssn_list`가 아닌 기준 테이블 `pmssn_master_detail`로 맞춘다.

Changes:

- `list_permission_options_for_dept`의 조회 SQL을 `pmssn_master_detail.pmssn_detail_name` 기반 DISTINCT 오름차순으로 변경
- 빈 문자열 방지 조건(`TRIM(COALESCE(...)) <> ''`) 추가
- 반환 형식은 기존과 동일하게 `list[str]` 유지하여 프론트 호환 유지

Changed files: Backend/admin_server/service_roles.py, docs/log/log.md

115. 2026-03-31 권한관리 화면 개편·사용현황 드릴다운 추가
Purpose: 역할 관리 화면을 권한 관리 중심으로 전환하고, 권한 상세목록 선택형 생성 UX와 사용현황 조회/드릴다운(프로젝트·사용자) 관리 흐름을 추가한다.

Changes:

- `/admin/roles` 메뉴·페이지 문구를 `권한 관리`로 변경하고, 생성 폼을 `프로젝트 권한 생성` + `권한 상세 목록` 선택형 UI로 개편
- 권한 사용현황 API 추가: `permission-options`, `roles/{id}/usages`, `roles/{id}/projects/{id}/participants`, `roles/users/{id}/usages`
- 권한 목록 응답에 `usage_count`를 포함해 사용중 여부를 표시하고, 사용중일 때만 목록 버튼 활성
- 사용현황 모달(최대폭 700px, 스크롤 대응)에서 프로젝트/사용자 드릴다운, 권한 변경·강퇴 액션(컨펌 포함) 구현
- 프론트-백엔드 경로 정합 수정: 사용자 드릴다운 API를 `/api/admin/roles/users/{user_id}/usages`로 일치

Changed files: Backend/admin_server/router.py, Backend/admin_server/schemas.py, Backend/admin_server/service_roles.py, Frontend/react-app/src/app/layout/navConfig.js, Frontend/react-app/src/app/admin/AdminRolesPage.jsx, Frontend/react-app/src/app/admin/admin-pages.css, Frontend/react-app/src/shared/api/adminClient.js, docs/log/log.md

114. 2026-03-31 사용자관리 대상 검증을 부서트리 기준으로 통일
Purpose: 하위부서 사용자의 변경 모달에서 `다른 부서 사용자` 오류가 발생하던 문제를 해결한다. 조회와 동일하게 대상 사용자 검증도 본인+하위 부서 트리 기준으로 통일한다.

Changes:

- `service_users._assert_target_exists_or_same_dept`: non-sa_dev 검증을 동일부서에서 부서트리 검증(`_assert_target_in_managed_tree`)으로 변경
- `set_user_etl_flag(sa)`도 동일부서 검증을 트리 검증으로 변경

Changed files: Backend/admin_server/service_users.py, docs/log/log.md

113. 2026-03-31 사용자관리 조회 범위: 동일부서→부서트리(본인+하위)로 수정
Purpose: 상위부서 SA 화면에서 하위부서로 이동된 사용자가 목록에서 사라지는 문제를 해결한다. 조회 기준을 부서 ID 단일값이 아닌 부서 트리 범위로 확장한다.

Changes:

- `list_users_for_admin_ui`: non-sa_dev 조회를 `u.dptmt_info_id = actor_dptmt_id`에서 재귀 CTE(scope) 기반 `본인+하위부서`로 변경
- 정렬 규칙(부서 그룹/역할/etl/email)은 유지

Changed files: Backend/admin_server/service_users.py, docs/log/log.md

112. 2026-03-31 변경 모달 프로젝트별 권한 위임 선택 추가
Purpose: 프로젝트 참여 체크 시 해당 프로젝트에 부여 가능한 권한(pmssn)을 선택하고, 선택 권한을 프로젝트명 오른쪽 배지로 표시. 체크 해제 시 권한 선택도 초기화.

Changes:

- `change-options`: 프로젝트별 `role_options`, 현재 참여 권한(`current_project_assignments`) 응답 추가
- `PUT /users/{id}/management`: `project_assignments[{project_info_id, pmssn_master_id}]` 반영(추가/권한변경/제거), 타부서 추가 차단 유지
- 변경 모달 UI: 프로젝트 체크박스 + 하단 권한 셀렉트 + 우측 권한 배지, 해제 시 `project_roles` 자동 삭제

Changed files: Backend/admin_server/service_users.py, router.py, schemas.py, Frontend/react-app/src/app/admin/AdminUsersPage.jsx, Frontend/react-app/src/app/admin/admin-users.css, Frontend/react-app/src/shared/api/adminClient.js, docs/log/log.md

111. 2026-03-31 변경 모달 프로젝트 영역 empty-state 표시
Purpose: 변경 모달의 프로젝트 패널에서 하단 잘림/무자료 상태를 구분하기 어렵던 UX를 개선한다.

Changes:

- `AdminUsersPage`: 프로젝트 목록이 비어 있으면 `참여 가능한 프로젝트가 없습니다.` 표시
- `admin-users.css`: `admin-users__panel-scroll--change` 최소 높이(`min-height`) 추가로 패널 형태 고정
- empty 상태용 텍스트 스타일(`admin-users__empty`) 추가

Changed files: Frontend/react-app/src/app/admin/AdminUsersPage.jsx, Frontend/react-app/src/app/admin/admin-users.css, docs/log/log.md

110. 2026-03-31 변경 모달 높이 확장(프로젝트 목록 가시성 개선)
Purpose: 사용자 변경 모달의 상하 표시 영역이 짧아 프로젝트 참여 목록이 답답하게 보이던 문제를 개선한다.

Changes:

- `AdminUsersPage`: 변경 모달 프로젝트 목록 컨테이너에 `admin-users__panel-scroll--change` 클래스 적용
- `admin-users.css`: 변경 모달 최대 높이 `95vh`, 변경 목록 스크롤 최대 높이 `52vh`로 확대

Changed files: Frontend/react-app/src/app/admin/AdminUsersPage.jsx, Frontend/react-app/src/app/admin/admin-users.css, docs/log/log.md

109. 2026-03-31 사용자관리 모달 가독성 재조정(1열·둥근 버튼·폭 축소)
Purpose: 이메일 초대/변경 모달의 선택창을 1라인 1필드로 정리하고, 모달 폭을 과도하지 않게 조정. 버튼을 둥근 형태로 통일.

Changes:

- `admin-users.css`: `.admin-users__grid-2`를 1열로 변경(셀렉트 1줄 1개)
- 모달 기본 폭 `460px`, 변경 모달 `520px`로 축소
- 작업버튼/모달버튼/이관버튼/대상선택버튼의 border-radius를 pill 형태로 통일

Changed files: Frontend/react-app/src/app/admin/admin-users.css, docs/log/log.md

108. 2026-03-31 사용자관리 모달 UI/레이아웃 개선(부서추가 스타일 톤)
Purpose: 이메일 초대/사용자 변경/이관 모달의 시각 품질을 부서관리 `부서 추가` 모달 톤에 맞춰 정돈하고, 필드 배치/가독성을 개선.

Changes:

- `AdminUsersPage`: 초대 모달 2열 레이아웃(부서·역할, 프로젝트·pmssn), 공통 모달 타이틀/힌트 클래스 정리
- `admin-users.css`: 모달 오버레이/카드/스크롤 패널 스타일을 `admin-org` 톤으로 통일, 변경 모달 폭 확장, 반응형 1열 폴백
- 이관 대상 버튼/스크롤 영역 대비 개선

Changed files: Frontend/react-app/src/app/admin/AdminUsersPage.jsx, Frontend/react-app/src/app/admin/admin-users.css, docs/log/log.md

107. 2026-03-31 사용자 변경 모달(부서·역할·프로젝트참여) 및 관리 API
Purpose: 작업 컬럼에 `변경` 버튼을 추가해 사용자의 부서·역할·프로젝트 참여를 한 번에 조정한다. 백엔드에서 dvsn/부서/프로젝트 제약을 동일하게 검증한다.

Changes:

- `GET /api/admin/users/{id}/change-options`, `PUT /api/admin/users/{id}/management`
- `service_users.get_user_change_options/update_user_management` 추가(본인이하 역할만, 역할 변경 시 생성물 차단, 프로젝트 추가 시 타부서 제한)
- `AdminUsersPage` 변경 모달(UI)·체크박스 프로젝트 참여 변경 및 `adminClient` API 연동

Changed files: Backend/admin_server/service_users.py, router.py, schemas.py, Frontend/react-app/src/app/admin/AdminUsersPage.jsx, Frontend/react-app/src/app/admin/admin-users.css, Frontend/react-app/src/shared/api/adminClient.js, docs/log/log.md

106. 2026-03-31 A→SA 행 목록 허용(정지·활성만 잠금)
Purpose: Admin(a)이 SA 사용자 행에서 작업물 조회·이관은 가능해야 하므로 목록 버튼은 활성 유지하고, 정지/활성만 비활성으로 제한.

Changes:

- `AdminUsersPage`: `listDisabled`(본인/로딩만), `actionDisabled`(본인/로딩/`A->SA`) 분리
- A가 SA 행에서 `목록`은 클릭 가능, `정지/활성`만 disabled

Changed files: Frontend/react-app/src/app/admin/AdminUsersPage.jsx, docs/log/log.md

105. 2026-03-31 A가 SA 사용자 작업버튼 비활성
Purpose: Admin(a)이 SA 사용자를 목록에서 볼 수는 있지만 작업 컬럼 버튼(목록/정지/활성)을 누르지 못하도록 잠금.

Changes:

- `AdminUsersPage`: `actorDvsn === 'a' && row.user_dvsn === 'sa'`인 경우 작업 버튼 disabled
- 작업 컬럼 안내 문구 `A는 SA 관리 불가` 표시

Changed files: Frontend/react-app/src/app/admin/AdminUsersPage.jsx, docs/log/log.md

104. 2026-03-31 사용자관리 SA_DEV 전역 목록·부서컬럼·정렬·정지-이관 검증
Purpose: SA_DEV는 전사 user 표시, SA·A 등은 기존대로 동일 부서. 부서명·하위부서(상위 소속 시 상위명+하위명), 역할(sa_dev·sa·a·o·u)·동일 역할 시 etl Y 우선 정렬. 역할-상태 사이 ETL 컬럼. 생성 자산 있으면 정지 거부+alert.

Changes:

- `list_users_for_admin_ui`, `user_has_transferable_ownership`, `suspend_user` 사전 검증
- `/api/admin/users` 응답 필드 dept_name·dept_sub_name
- AdminUsersPage 테이블·colSpan·handleSuspend alert

Changed files: Backend/admin_server/service_users.py, router.py, Frontend/react-app/src/app/admin/AdminUsersPage.jsx, admin-users.css, docs/log/log.md

103. 2026-03-31 사용자 관리 UI(초대 모달·작업물 목록·이관 API)
Purpose: 사용자 목록을 메인으로 두고 우상단「사용자초대」모달로 이메일 초대. 행별「목록」으로 작업물 조회·생성자 이관(project·커스텀 pmssn).

Changes:

- `GET /api/admin/users/{id}/work-assets`, `GET .../ownership-transfer-targets`, `POST .../transfer-ownership`
- `service_users`: 작업물 조회, 부서 내 sa_dev·sa·a 이관 후보, `project_create_user_id`·`pmssn_master.user_id` 갱신
- `AdminUsersPage`·`admin-users.css`, `adminClient.js`, `TransferOwnershipBody`

Changed files: Backend/admin_server/service_users.py, router.py, schemas.py, Frontend/react-app/src/app/admin/AdminUsersPage.jsx, admin-users.css, shared/api/adminClient.js, docs/log/log.md

102. 2026-03-31 이메일 초대 500: email_invite_code_master 확장 컬럼 DDL·안내
Purpose: `POST /api/admin/users/invite`가 `invite_target_dvsn` 등 미존재 컬럼으로 500이 나던 문제를 system_db 수동 DDL로 해소하고, 동일 상황 시 400과 문서 안내로 대응.

Changes:

- system_db `email_invite_code_master`: `invite_target_dvsn`, `invite_etl_yn`, `invite_project_info_id`, `invite_pmssn_master_id` ADD COLUMN IF NOT EXISTS (프로젝트 설정 연결로 일회 적용)
- `invite_user_by_email`: `psycopg2.errors.UndefinedColumn` → `ValueError`(문서 17 §0.3 DDL 안내)
- `docs/report/17_…Implementation_Guide.md` §0.3: PostgreSQL 수동 DDL 예시 블록 추가

Changed files: Backend/admin_server/service_users.py, docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/log/log.md

101. 2026-03-31 부서 비활성·삭제 전 FK성 참조 검사(프로젝트·초대·역할 등)
Purpose: `use_yn=N` 또는 행 삭제 시 `dptmt_info_id`를 참조하는 데이터가 있으면 거부. 부서명·코드만 변경은 허용.

Changes:

- `service_users._assert_department_clear_for_invalidate_or_remove`: 하위 부서·user_info·email_invite_code_master·project_info·pmssn_master 카운트
- `update_department_in_org_settings` / `delete_department_in_org_settings`에서 호출

Changed files: Backend/admin_server/service_users.py, docs/log/log.md

100. 2026-03-31 부서 목록 부서구분(상위·하위) 열·SA 본인 부서 수정삭제 차단
Purpose: 부서 테이블 UX(상위 부서 칸 「—」만 표시, 부서구분 열·상위 강조) 및 Super Admin이 본인 소속 부서 행을 수정·삭제하지 못하도록 백엔드·프론트 정합.

Changes:

- `AdminOrgPage`: 부서구분 열, 상위/하위 타이포, SA 본인 행 작업 버튼 숨김·안내 문구
- `service_users._assert_actor_can_manage_department`: sa일 때 `target == actor_dptmt_id` 거부

Changed files: Frontend/react-app/src/app/admin/AdminOrgPage.jsx, Frontend/react-app/src/app/admin/admin-org.css, Backend/admin_server/service_users.py, docs/log/log.md

99. 2026-03-31 부서 삭제 하드·수정에 사용여부·목록에서 ID0 제거·내소속 읽기전용
Purpose: 삭제는 use_yn이 아니라 DB DELETE. 사용 안 함은 수정 모달의 use_yn. 부서 ID 0은 API 목록·화면에서 제외. 내 소속 카드는 부서명·코드만 읽기 전용. 목록에서 ID·상위 ID 컬럼 제거.

Changes: `delete_department_in_org_settings` DELETE. `OrgDepartmentPatchBody.use_yn`, `update_department_in_org_settings` 확장. `list_departments_for_org_settings`에서 id≠0·미사용 행 포함(SA_DEV/SA). `_dptmt_id_in_managed_subtree`·상위 검증 조정. `AdminOrgPage` 테이블·수정 모달·읽기 전용 카드.

Changed files: Backend/admin_server/schemas.py, service_users.py, router.py, Frontend/react-app/src/shared/api/adminClient.js, app/admin/AdminOrgPage.jsx, app/admin/admin-org.css, docs/log/log.md

98. 2026-03-31 부서 관리 목록·상위표시·행 수정삭제·추가 모달·PATCH/DELETE API
Purpose: 부서 목록에서 상위 부서 ID만으로는 식별이 어려워 상위 부서명·코드 조인 표시. 행별 수정·삭제와 테이블 우측 상단 추가 버튼, SA_DEV는 추가 모달에서 최상위/하위 유형·상위 선택, SA는 본인 부서 고정 하위만 추가. 백엔드에 부서 단건 PATCH·DELETE 추가.

Changes: `list_departments_for_org_settings`에 `parent_dptmt_name`·`parent_dptmt_code` 조인. `update_department_in_org_settings`·`delete_department_in_org_settings`·`_assert_actor_can_manage_department`. `PATCH/DELETE /api/admin/org/departments/{id}`. `AdminOrgPage` 테이블·모달·`adminClient` patch/delete. `confirmCrud`로 추가·수정·삭제 확인.

Changed files: Backend/admin_server/schemas.py, service_users.py, router.py, Frontend/react-app/src/shared/api/adminClient.js, app/admin/AdminOrgPage.jsx, app/admin/admin-org.css, docs/log/log.md

97. 2026-03-31 CRUD 전 confirmCrud(공용)·어드민·마이페이지·알림·위젯보드·ETL이력
Purpose: 저장·수정·삭제·초대 등 반영 전 `window.confirm` 일원화. 추후 커스텀 모달로 교체 시 `confirmCrud`만 갈아끼우면 됨.

Changes: `shared/utils/crudConfirm.js` 추가. `AdminOrgPage`·`AdminUsersPage`·`AdminProjectsPage`·`AdminRolesPage`·`AdminProjectMembersPage`·`MyPage`·`NotificationBell`(전체 읽음)·`CreateOrgPage`·`SignupPage`·`JobHistoryPanel`·`Dashboard3Page`에 확인 문구 적용. 기존 `window.confirm` 일부를 `confirmCrud`로 치환.

Changed files: Frontend/react-app/src/shared/utils/crudConfirm.js, app/admin/*.jsx, app/mypage/MyPage.jsx, app/layout/NotificationBell.jsx, app/auth/CreateOrgPage.jsx, SignupPage.jsx, packages/etl/components/JobHistoryPanel.jsx, packages/widgetboard/Dashboard3Page.jsx, docs/log/log.md

96. 2026-03-31 user_dvsn 단일 코드(sa_dev·sa·a·o·u)·비허용 시 빈 목록
Purpose: `user_dvsn`은 sa_dev·sa(Super Admin)·a·o·u 다섯 값만 유효. 레거시 `super_admin` 등은 canon 불일치 → 어드민 목록 GET은 `items: []`, 프론트는 `canonUserDvsn` 빈값으로 메뉴 비표시.

Changes: `Backend/core/user_dvsn_codes.py`(ALLOWED·ORG_ADMIN·SUPER·PROJECT 집합, `canon_user_dvsn`). `deps`·`permissions`·`service_users`·`service_projects`·`auth_server/service`·`router`·`schemas` 전역 치환. 어드민 목록 GET 다수를 `get_authenticated_user_row`+canon 검사 후 빈 배열. 신규 부서 첫 유저 `sa`. 초대·가입 허용 `sa,a,o,u`.

Changed files: Backend/core/user_dvsn_codes.py, Backend/admin_server/deps.py, router.py, service_users.py, service_projects.py, schemas.py, Backend/auth_server/service.py, router.py, permissions.py, Frontend/react-app/src/app/admin/adminAccess.js, AdminUsersPage.jsx, AdminOrgPage.jsx, AdminProjectsPage.jsx, guards/SuperAdminRoute.jsx, OrgAdminRoute.jsx, docs/log/log.md

95. 2026-03-31 user_dvsn effective_dvsn 정규화 제거(원복)
Purpose: DB `user_dvsn`은 정확히 `sa_dev`·`super_admin` 등 허용 값만 사용하기로 함. `sa_dev_*` 접두 매핑은 불필요.

Changes: `Backend/core/dvsn_effective.py` 삭제. `admin_server/deps`·`auth_server/permissions`·`admin_server/service_users`에서 `(user_dvsn or "").strip().lower()` 직접 비교로 복귀. `assert_invite_dptmt_allowed` 호출 인자를 `actor_dvsn` 원문 전달로 정리. 프론트 `adminAccess`·`etlAccess`·`AdminUsersPage`·`AdminOrgPage`에서 `effectiveUserDvsn` 제거.

Changed files: Backend/core/dvsn_effective.py(삭제), Backend/admin_server/deps.py, Backend/auth_server/permissions.py, Backend/admin_server/service_users.py, Frontend/react-app/src/app/admin/adminAccess.js, guards/etlAccess.js, AdminUsersPage.jsx, AdminOrgPage.jsx, docs/log/log.md

94. 2026-03-31 effective_dvsn·부서 정책(SA_DEV/SA)·UI·초대 dept≥0
Purpose: DB `user_dvsn`이 `sa_dev_kgh` 등 접미 형태일 때 프론트·백엔드가 `sa_dev`와 불일치해 메뉴·API가 막히는 문제. SA_DEV는 전체 부서+루트/하위 생성, Super Admin은 소속 트리만·루트 생성 금지·하위만.

Changes: `Backend/core/dvsn_effective.py` `effective_dvsn`. `service_users` 초대·역할·ETL·부서 `list_departments_for_org_settings`·`create_department`(SA 루트 거부·트리 검증)·`assert_invite_dptmt_allowed` 등 정규화. `admin_server/deps`·`auth_server/permissions` 연동(기존). `router` org/departments 시그니처 반영. 프론트 `adminAccess.effectiveUserDvsn`·`etlAccess`·`AdminUsersPage`(초대 부서 ID `≥0`)·`AdminOrgPage`(역할별 최상위/하위 폼 분리).

Changed files: Backend/core/dvsn_effective.py, Backend/admin_server/service_users.py, Backend/admin_server/router.py, Backend/admin_server/deps.py, Backend/auth_server/permissions.py, Frontend/react-app/src/app/admin/adminAccess.js, guards/etlAccess.js, AdminUsersPage.jsx, AdminOrgPage.jsx, docs/log/log.md

93. 2026-03-31 부서 초대 목록 ID0 포함·org/departments 추가·초대 API ge=0
Purpose: SA_DEV 초대 시 `dptmt_info_id > 0` 조건으로 부서 0이 빠져 가입 부서 셀렉트가 비는 문제. 부서 관리에 최상위/하위 부서 추가 UI·API 부재.

Changes: `list_departments_for_invite`(sa_dev)에서 `> 0` 제거. `GET/POST /api/admin/org/departments`, `list_all_departments_super`·`create_department`. 초대 프로젝트/역할 쿼리 `dptmt_info_id` `ge=0`. `AdminOrgPage`·`adminClient`·`OrgDepartmentCreateBody`.

Changed files: Backend/admin_server/service_users.py, router.py, schemas.py, Frontend/react-app/src/app/admin/AdminOrgPage.jsx, admin-org.css, shared/api/adminClient.js, docs/log/log.md

92. 2026-03-31 셸 브랜드 로고(Starbucks)·마이페이지 상단 헤더 이동
Purpose: 업로드 PNG를 사이드바 브랜드 영역에 배치(흰 로고·어두운 사이드바 대비). 마이페이지는 좌측 메뉴 대신 이메일과 로그아웃 사이 링크로 이동.

Changes: `public/starbucks-logo.png` 추가. `ProtectedLayout` 이미지 경로·`ibank-sidebar-brand__logo` 스타일. `navConfig`에서 마이페이지 항목 제거. `ibank-shell-mypage-link` 스타일(로그아웃과 동일 폰트 단위·굵기, 링크형).

Changed files: Frontend/react-app/public/starbucks-logo.png, Frontend/react-app/src/app/layout/ProtectedLayout.jsx, Frontend/react-app/src/app/layout/navConfig.js, Frontend/react-app/src/styles/app-shell.css, docs/log/log.md

91. 2026-03-31 사이드바 프로젝트 필수 메뉴 비활성·ETL 구스키마 쿼리 호환
Purpose: 좌측 메뉴에서 쿼리스튜디오·대시보드·위젯 클릭 시 프로젝트 미선택이면 NeedProjectRoute가 `/`로만 돌려 “연결 안 됨”처럼 보임. 시스템 DB DDL이 앱보다 낮을 때 etl_tables.storage_connection_id·batch_jobs.connection_id 등으로 쿼리 실패.

Changes: ProtectedLayout에서 `requiresProject`이고 JWT에 프로젝트 없으면 `NavLink` 대신 비활성 `span`+툴팁. `app-shell.css` `.ibank-sidebar-link--disabled`. `service._table_columns_lower`·`list_etl_tables` 분기(저장 DB 컬럼 없을 때 NULL). `service_file` 배치 목록·단건·레지스트리 조회를 batch_jobs 컬럼 존재에 맞춤. `router_file` 컬럼 누락 오류 안내 문구.

Changed files: Frontend/react-app/src/app/layout/ProtectedLayout.jsx, Frontend/react-app/src/styles/app-shell.css, Backend/etl_server/service.py, Backend/etl_server/service_file.py, Backend/etl_server/router_file.py, docs/log/log.md

90. 2026-03-31 초대용 app_url: localhost 폴백 제거·frontend.app_url·미설정 시 메일 생략
Purpose: `_INVITE_APP_URL_FALLBACK`(localhost:8080/ibank-bi)는 리눅스·도메인 배포와 무관해 잘못된 초대 링크를 만들 수 있음. 공개 SPA 베이스는 설정으로만 결정.

Changes: `get_app_url`에 `frontend.app_url` 단계 추가. `invite_user_by_email`은 URL 없으면 경고 로그만 남기고 초대 메일 미발송(코드는 DB에 유지). 예시·문서 17·`project-conventions`·`config.json.example`에 `frontend.app_url` 안내. `_INVITE_APP_URL_FALLBACK` 제거.

Changed files: Backend/core/auth_config.py, Backend/admin_server/service_users.py, Env/config/loader.py, Env/config/config.json.example, docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, .cursor/rules/project-conventions.mdc, docs/log/log.md

89. 2026-03-31 smtp_info.app_url을 Vite base(/ibank-bi)에 맞춤·초대 폴백 수정
Purpose: 초대 링크가 `get_app_url()/signup`으로 조립되는데, 설정에 다른 앱 경로(`acc_bi_assistant_with_wa`)가 들어 있으면 실제 SPA(`BrowserRouter` basename `/ibank-bi`)와 불일치함. 공개 베이스 URL 규칙을 코드·문서·설정에 명시.

Changes: `Env/config/config.json`의 `smtp_info.app_url`을 `.../ibank-bi/`로 정정(호스트는 배포에 맞게 유지). `service_users` 초대 폴백을 `http://localhost:8080/ibank-bi`로 변경·모듈 주석. `auth_config.get_app_url` docstring·목록 설명. 문서 17 예시·설명 보강.

Changed files: Env/config/config.json, Backend/admin_server/service_users.py, Backend/core/auth_config.py, docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/log/log.md

88. 2026-03-31 backend smtp_info 구조 반영(auth_config·문서 17·loader)
Purpose: `config.json`의 SMTP·초대 링크 URL을 `backend.smtp_info` 객체로 통일한 설정을 코드·문서에서 동일하게 읽도록 정합.

Changes: `auth_config._smtp_config_source`·`get_smtp_settings`·`get_app_url`(smtp_info.app_url 우선)·docstring. `Env/config/loader.py` 주석. `17_SystemDB_Commercialization_Implementation_Guide.md` 예시 JSON 및 §2.7·설명 문구.

Changed files: Backend/core/auth_config.py, Env/config/loader.py, docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/log/log.md

87. 2026-03-28 SMTP send_email 재시도 로직(STARTTLS 검증완화·새 소켓 평문 fallback·timeout)
Purpose: 로그인 2차 코드 메일 발송에서 STARTTLS 실패 이후 `Server not connected`가 나는 경로를 줄이기 위해, 새 소켓 평문 재시도와 timeout을 적용.

Changes: `send_email` 교체 — 465 SSL 고정, 그 외 STARTTLS(`check_hostname=False`, `CERT_NONE`, timeout=10) 1차 시도 후 실패 시 새 SMTP 소켓으로 평문 재연결·send.

Changed files: Backend/auth_server/email_service.py, docs/log/log.md

86. 2026-03-28 auth_server __init__ router 재export (include_router AttributeError 수정)
Purpose: `from Backend.auth_server import router` 가 `router.py` 모듈을 가져와 `include_router` 시 `routes` 없음 오류가 발생함. 다른 서버 패키지와 동일하게 `APIRouter` 인스턴스를 export.

Changes: `auth_server/__init__.py`에서 `from Backend.auth_server.router import router`, `__all__`.

Changed files: Backend/auth_server/__init__.py, docs/log/log.md

85. 2026-03-28 전수검사 반영: admin list_projects role_name·SignupPage 초대 UX
Purpose: B-7 어드민 참여 프로젝트 목록에 `role_name` 정합, B-6 초대 검증 시 프로젝트·역할명 표시.

Changes: `list_projects_for_participant`에 `pmssn_master` LEFT JOIN·`role_name`. SignupPage `has_project_attachment` 문구에 `invite_project_name`·`invite_pmssn_name` 반영.

Changed files: Backend/admin_server/service_projects.py, Frontend/react-app/src/app/auth/SignupPage.jsx, docs/log/log.md

84. 2026-03-28 react-app src/app 카테고리 폴더(auth·home·admin·layout·guards)
Purpose: SPA 전용 화면을 `app/` 하위 도메인 폴더로 정리. `packages/*` 는 기능 번들 유지.

Changes: `auth/`, `home/`, `mypage/`, `admin/`, `layout/`, `guards/` 로 이동, `App.jsx`·`routes.jsx`·`@/app/...` 수정, PRD·01·03·project-conventions.

Changed files: Frontend/react-app/src/app/**, Frontend/react-app/src/App.jsx, docs/main/00_PRD.md, docs/main/01_FRONTEND_GUIDE.md, docs/main/03_AI_DEVELOP_GUIDE.md, docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/README.md, .cursor/rules/project-conventions.mdc, docs/log/log.md

83. 2026-03-28 어드민 나머지: 역할·프로젝트·멤버·ProjectAdminRoute·adminClient
Purpose: `/admin/roles` 커스텀 CRUD, `/admin/projects` 생성·수정·비활성(어드민), `/admin/projects/:id/members` 검색·멤버·역할. operator 는 프로젝트 화면만. `admin-pages.css`, 홈·네비 연동.

Changes:

- adminClient: roles·projects·members·users/search
- AdminRolesPage, AdminProjectsPage, AdminProjectMembersPage, ProjectAdminRoute, canAccessProjectAdminPages
- routes, nav, ProtectedLayout, HomePage, docs

Changed files: Frontend/react-app/src/shared/api/adminClient.js, Frontend/react-app/src/app/adminAccess.js, admin-pages.css, AdminRolesPage.jsx, AdminProjectsPage.jsx, AdminProjectMembersPage.jsx, ProjectAdminRoute.jsx, routes.jsx, navConfig.js, ProtectedLayout.jsx, HomePage.jsx, docs/main/01_FRONTEND_GUIDE.md, docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/log/log.md

82. 2026-03-28 홈 §5.2 빠른 액세스·/admin/org·SuperAdminRoute·homeAccess
Purpose: `HomePage` 프로젝트·권한 기반 카드, `homeAccess.js`, `/admin/org` 부서명(GET/PATCH)·네비 `requiresDeptAdmin`.

Changes:

- home.css·HomePage, homeAccess.js, AdminOrgPage·admin-org.css, SuperAdminRoute
- adminClient getAdminOrg·patchAdminOrg, adminAccess canAccessDeptSettings, nav·ProtectedLayout·routes

Changed files: Frontend/react-app/src/app/HomePage.jsx, home.css, homeAccess.js, AdminOrgPage.jsx, admin-org.css, SuperAdminRoute.jsx, adminAccess.js, adminClient.js, navConfig.js, ProtectedLayout.jsx, routes.jsx, docs/log/log.md

81. 2026-03-27 Backend/migrations 제거(저장소에 마이그레이션 파일 금지)
Purpose: DDL은 채팅·수동 적용만. `Backend/migrations` 및 `20260327_invite_constraints.sql` 삭제, log #80 문구 정리, `.cursor/rules/project-conventions.mdc`에 금지 규칙 명시.

Changed files: docs/log/log.md, .cursor/rules/project-conventions.mdc

80. 2026-03-27 auth 초대 JOIN·로그인 토큰 1회·프로젝트 active·SA_DEV 유저관리
Purpose: invite_validate에 프로젝트·역할명 JOIN, 로그인 세션 토큰 단일 생성, 비활성 프로젝트 작업 제한 및 비활성화 경로 허용, SA_DEV 타부서 유저 정지·역할, 숨김 부서 초대 제한, 초대 FK SQL 파일.

Changes: `invite_validate_row`·`/invite/validate` 응답 확장, `verify_login_complete` 세션 플로우, `_assert_project_owned`·`update_project`·`deactivate_project`·`add_member`, `service_users` 헬퍼·초대 부서 필터, `DELETE /projects` docstring. (DB DDL은 저장소 마이그레이션 파일 없이 수동 적용.)

Changed files: Backend/auth_server/service.py, Backend/auth_server/router.py, Backend/admin_server/service_projects.py, Backend/admin_server/service_users.py, Backend/admin_server/router.py, docs/log/log.md

79. 2026-03-27 초대 DDL 수동 적용·CHECK·migrations 폴더 제거
Purpose: DB 반영은 채팅/수동 SQL로 하고, 저장소 `Backend/migrations` 제거. 프로젝트·pmssn 쌍 CHECK를 DDL에 포함.

Changes: `Backend/migrations` 삭제, `docs/main/04_DB_ARCHITECTURE.md`, `docs/report/17_…`, `docs/log/log.md` 경로 문구 정리.

Changed files: docs/main/04_DB_ARCHITECTURE.md, docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/log/log.md

78. 2026-03-27 초대 플로우 전면 개편(부서 트리·A→A 초대·ETL·U 프로젝트)
Purpose: 초대 정책과 제품 UX(05·06)에 맞춰 백엔드·프론트·DB 문서를 정합.

Changes:

- Admin 초대 대상: A가 admin·operator·user 초대 가능. 부서: SA_DEV는 전체, SA·A는 본인 부서 서브트리만.
- InviteBody: invite_etl_yn, invite_project_info_id, invite_pmssn_master_id. 가입 시 etl_yn·(U 선택 시) project_ptcpnt_info.
- API: GET /api/admin/invite/departments, invite/projects, invite/roles. DB DDL은 수동 적용(마이그레이션 파일 없음).
- AdminUsersPage 초대 폼, SignupPage 초대 검증 힌트 보강.

Changed files: Backend/admin_server/service_users.py, Backend/admin_server/schemas.py, Backend/admin_server/router.py, Backend/admin_server/service_projects.py, Backend/auth_server/service.py, Backend/auth_server/router.py, Frontend/react-app/src/shared/api/adminClient.js, Frontend/react-app/src/app/AdminUsersPage.jsx, Frontend/react-app/src/app/SignupPage.jsx, Frontend/react-app/src/app/admin-users.css, docs/main/04_DB_ARCHITECTURE.md, docs/main/05_Permission_ARCHITECTURE.md, docs/main/06_CUSTOMER_JOURNEY.md, docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/log/log.md

77. 2026-03-28 ETL 자격 etl_yn 분리·5역할·문서 v3
Purpose: `user_dvsn`에서 `etl_manager` 역할을 제거하고 `user_info.etl_yn`으로 ETL 인프라 자격을 분리한다(05 v3·DDL은 운영 DB 적용 완료 가정). 프로젝트 기능과 ETL 자격 충돌을 없앤다.

Changes:

- `Backend/auth_server/permissions.py`: `user_has_etl_infrastructure_access`, `require_permission`에서 etl_manager 차단 제거
- `Backend/admin_server/service_users.py`: 초대·역할 변경 5단계만, `set_user_etl_flag`, 부서 유저 목록에 `etl_yn`
- `Backend/admin_server/router.py`, `schemas.py`: `PATCH /users/{id}/etl-access`, `UserEtlYnBody`
- `Backend/auth_server/service.py`, `router.py`: `get_user_profile`·`/me`에 `etl_yn`, 가입 허용 dvsn에서 etl_manager 제거
- 프론트 `etlAccess.js`·라우트 주석: `me.etl_yn` 반영
- `docs/main/05_Permission_ARCHITECTURE.md` v3, `04_DB_ARCHITECTURE.md`, `06_CUSTOMER_JOURNEY.md`, `01_FRONTEND_GUIDE.md`, `docs/report/17_…` 정합
- `python -m py_compile` 관련 모듈 검증

Changed files: Backend/auth_server/permissions.py, service.py, router.py, Backend/admin_server/service_users.py, router.py, schemas.py, Backend/api_server/main.py, Frontend/react-app/src/app/etlAccess.js, EtlAccessRoute.jsx, navConfig.js, docs/main/05_Permission_ARCHITECTURE.md, docs/main/04_DB_ARCHITECTURE.md, docs/main/06_CUSTOMER_JOURNEY.md, docs/main/01_FRONTEND_GUIDE.md, docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/log/log.md

76. 2026-03-27 S8 알림 벨·notificationsClient·/admin/users·OrgAdminRoute
Purpose: 상단 알림(미읽음 폴링·패널·읽음)·조직 어드민 전용 사용자 목록·정지/활성. `adminAccess`·`orgAdmin` 네비 필터.

Changes:

- `notificationsClient.js`, `NotificationBell`·notification-bell.css
- `adminClient.js`, `AdminUsersPage`·admin-users.css, `OrgAdminRoute`, `adminAccess.js`
- ProtectedLayout·navConfig·routes·01·17

Changed files: Frontend/react-app/src/shared/api/notificationsClient.js, adminClient.js, Frontend/react-app/src/app/NotificationBell.jsx, notification-bell.css, AdminUsersPage.jsx, admin-users.css, OrgAdminRoute.jsx, adminAccess.js, ProtectedLayout.jsx, navConfig.js, routes.jsx, docs/main/01_FRONTEND_GUIDE.md, docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/log/log.md

75. 2026-03-27 S7 마이페이지(/mypage)·프로필·비밀번호·로그인 이력·authClient
Purpose: `/mypage` 프로필(닉네임)·비밀번호 변경(성공 시 세션 무효·/login 플래시)·최근 로그인 10건. 네비·`patchMe`·`patchPassword`·`getLoginHistory`.

Changes:

- MyPage.jsx, mypage.css, routes, navConfig
- authClient: PATCH me·me/password, GET login-history
- LoginPage: 비밀번호 변경 후 재로그인 플래시

Changed files: Frontend/react-app/src/app/MyPage.jsx, mypage.css, routes.jsx, navConfig.js, LoginPage.jsx, shared/api/authClient.js, docs/main/01_FRONTEND_GUIDE.md, docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/log/log.md

74. 2026-03-27 비밀번호 정책(10자·대소문자·숫자·특수문자) security·service·스키마·폼
Purpose: 신규 비밀번호만 검증(가입·부서생성·PATCH /me/password). `security.validate_password_strength`, 로그인은 기존 비번 허용.

Changes:

- security.py: validate_password_strength + ASCII 특수문자 집합
- service: signup·create_org·change_password 호출
- schemas: password min_length 10
- SignupPage·CreateOrgPage 라벨·minLength 10

Changed files: Backend/auth_server/security.py, service.py, schemas.py, Frontend/react-app/src/app/SignupPage.jsx, CreateOrgPage.jsx, docs/log/log.md

73. 2026-03-27 회원가입·부서생성 화면·ETL 네비·라우트(sa_dev·etl_manager)
Purpose: 문서 17 §5.1 흐름 — `/signup`(초대 검증 blur)·`/create-org`, 로그인 하단 링크·플래시. ETL은 `user_dvsn` 이 sa_dev·etl_manager 일 때만 네비·`/etl` 접근.

Changes:

- authClient: postSignup, postCreateOrg, getInviteValidate
- SignupPage, CreateOrgPage, EtlAccessRoute, etlAccess(canAccessEtl)
- routes: 공개 signup·create-org, ETL 래핑
- ProtectedLayout: ETL 네비 필터, LoginPage·login.css 링크·성공 안내

Changed files: Frontend/react-app/src/shared/api/authClient.js, Frontend/react-app/src/app/SignupPage.jsx, CreateOrgPage.jsx, EtlAccessRoute.jsx, etlAccess.js, routes.jsx, ProtectedLayout.jsx, LoginPage.jsx, login.css, navConfig.js, docs/log/log.md

72. 2026-03-27 프론트 S5/S6 인증·프로젝트 선택·http Bearer·refresh
Purpose: 로그인(2단계)·JWT 저장·request/fetchOkJson에 Authorization·401 refresh·403 프로젝트 미선택 시 홈으로. 보호 레이아웃·프로젝트 필수 라우트·홈에서 프로젝트 선택.

Changes:

- shared/auth/tokenStorage.js, jwtUtils.js — 토큰·JWT project_info_id
- shared/api/http.js — Bearer·tryRefreshOnce·프로젝트 403 안내
- shared/api/authClient.js — login·verify·logout·me·projects·select
- app/AuthContext.jsx, ProtectedLayout.jsx, NeedProjectRoute.jsx, LoginPage.jsx, HomePage.jsx, login.css, routes.jsx, App.jsx, navConfig.js

Changed files: Frontend/react-app/src/shared/auth/tokenStorage.js, jwtUtils.js, Frontend/react-app/src/shared/api/http.js, authClient.js, Frontend/react-app/src/app/AuthContext.jsx, ProtectedLayout.jsx, NeedProjectRoute.jsx, LoginPage.jsx, HomePage.jsx, login.css, routes.jsx, App.jsx, navConfig.js, docs/log/log.md

71. 2026-03-27 대시보드 단일화(캠페인만 연동·구형 UI 패키지 제거)
Purpose: 운영 대시보드는 캠페인 대시보드만 사용. legacy·new_dash·new_dash2 라우터를 main에서 제거하고, 프론트에서 dashboard·new-dashboard·new-dashboard2 패키지 삭제. 라우트 `/dashboard`는 CampaignDashboardPage, `/campaign-dashboard`는 `/dashboard`로 리다이렉트.

Changes:

- Backend/api_server/main.py: campaign_dashboard_router만 대시보드 API로 등록
- Backend/api_server/routers/__init__.py: dashboard_router 제거
- Frontend: packages/dashboard, new-dashboard, new-dashboard2 삭제; routes.jsx·navConfig 정리
- docs/main(00·01·02), README, report/17 권한 표, core docstring 정합

Changed files: Backend/api_server/main.py, Backend/api_server/routers/__init__.py, Backend/api_server/routers/health.py, Backend/__init__.py, Backend/api_server/__init__.py, Backend/core/__init__.py, Backend/core/db.py, Backend/core/dashboard_service.py, Backend/campaign_dash_server/__init__.py, Backend/campaign_dash_server/router.py, Frontend/react-app/src/app/routes.jsx, Frontend/react-app/src/app/navConfig.js, Frontend/react-app/src/packages/campaign_dashboard/index.jsx, README.md, docs/main/00_PRD.md, docs/main/01_FRONTEND_GUIDE.md, docs/main/02_BACKEND_GUIDE.md, docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/log/log.md

70. 2026-03-27 M1-8 대시보드 매핑 제한(campaign_dash 완료·core·legacy·new)
Purpose: legacy/new/campaign 대시보드에서 dash/star/main 물리 테이블을 table_master + table_project_mapping으로만 허용하고, 집계 테이블 목록은 프로젝트 기준 get_aggregatable_tables(project_info_id)로 제한한다.

Changes:

- core/db: is_table_allowed_for_project_dashboard, 캠페인 *_star_2는 대응 *_star_1 star 매핑 시 허용
- core/dashboard_service: get_aggregatable_tables(project_info_id)
- legacy_dashboard_server, new_dash_server, campaign_dash_server: require_permission("dashboard"), table_id 검사, /tables 프로젝트 필터

Changed files: Backend/core/db.py, Backend/core/dashboard_service.py, Backend/legacy_dashboard_server/router.py, Backend/new_dash_server/router.py, Backend/campaign_dash_server/router.py

69. 2026-03-27 권한·/me·정지활성·O검색·SMTP·pmssn 정규화
Purpose: 05 매트릭스 §3 정지/활성 범위, §8 `/me` permissions 자동 역할 병합, `pmssn_list` 문자열 표준·레거시 PK 치환, operator 멤버 초대용 검색, 프로젝트 deps 패턴, SMTP STARTTLS 폴백을 반영한다.

Changes:

- `Backend/admin_server/service_users.py`: `suspend_user`/`activate_user`에 `actor_dvsn`·대상 역할 검증; `search_users_by_email` 동일 부서 스코프(운영자)
- `Backend/admin_server/router.py`: 정지/활성 인자, `users/search`에 `require_org_admin_or_operator`
- `Backend/admin_server/deps.py`: `require_project_admin_or_operator_participant`가 `Request.path_params`로 `project_info_id` 조회
- `Backend/auth_server/permissions.py`: `resolve_pmssn_list_to_names`, `get_effective_permission_ids_for_me`
- `Backend/auth_server/router.py`: `GET /me`에서 자동 역할 시 §8 기능 ID 병합
- `Backend/admin_server/service_projects.py`: 기본 관리자 역할 선택 시 정규화된 `pmssn_list`로 `admin` 판별
- `Backend/auth_server/email_service.py`: STARTTLS 실패 시 경고 후 평문 SMTP 계속
- `docs/main/04_DB_ARCHITECTURE.md`: `pmssn_list` 저장 규칙·런타임 치환 문구
- `python -m py_compile` 관련 모듈 검증

Changed files: Backend/admin_server/service_users.py, router.py, deps.py, service_projects.py, Backend/auth_server/permissions.py, router.py, email_service.py, docs/main/04_DB_ARCHITECTURE.md, docs/log/log.md

68. 2026-03-27 6단계 역할 정합(operator·초대·가입·부서 role)
Purpose: `docs/main/05_Permission_ARCHITECTURE.md` 매트릭스와 불일치하던 백엔드를 맞춘다. operator 프로젝트 운영, `invite_target_dvsn` 저장·가입 반영, 부서 `user_dvsn` 변경 범위를 구현한다.

Changes:

- `Backend/admin_server/deps.py`: `require_org_admin_or_operator`, `require_project_admin_or_operator_participant` 추가
- `Backend/admin_server/router.py`: 프로젝트 목록·PATCH·멤버 API에 운영자 경로 적용, 초대·역할 변경 서비스 인자 반영
- `Backend/admin_server/service_projects.py`: 참여 프로젝트 목록, 운영자 `active_yn` 금지, 멤버 권한/강퇴 시 U만(운영자)
- `Backend/admin_server/service_users.py`: 초대 허용 역할 검증·INSERT `invite_target_dvsn`, `set_user_dvsn` admin/SA/sa_dev 매트릭스
- `Backend/admin_server/schemas.py`: `InviteBody.invite_target_dvsn`, `UserRoleBody` 설명
- `Backend/auth_server/service.py`, `router.py`: 가입 시 `invite_target_dvsn`, 초대 검증 응답 필드
- `python -m py_compile` 및 초대 검증 스모크 확인

Changed files: Backend/admin_server/deps.py, router.py, service_projects.py, service_users.py, schemas.py, Backend/auth_server/service.py, router.py, docs/log/log.md

67. 2026-03-27 ETL 적재 완료 table_master 훅(M1-4)
Purpose: 상용화 가이드 17번 §10.4 M1-4·§13.2.5에 따라 ETL이 메인 DB에 적재를 완료하면 `system_db.table_master`에 `(db_type, table_name)` UPSERT를 수행하고, 레거시 `add_allowed_table`(no-op) 호출을 제거한다.

Changes:

- `Backend/etl_server/table_master_hook.py`: `upsert_table_master_after_load` 추가(system_db 연결, 실패 시 경고 로그만)
- `Backend/etl_server/load_service.py`, `load_service.py` `run_file_upsert`: 기본 저장 DB 적재 시 훅 호출
- `Backend/etl_server/db_load_service.py`: 스트리밍·비스트리밍 DB 적재 완료 시 훅 호출
- `python -m py_compile` 위 파일 검증 완료

Changed files: Backend/etl_server/table_master_hook.py, Backend/etl_server/load_service.py, Backend/etl_server/db_load_service.py, docs/log/log.md

66. 2026-03-26 M1 백엔드 핵심 보정(core/report/admin)
Purpose: 상용화 가이드 17번의 M1 요구사항(프로젝트별 허용 테이블 제어, 리포트 저장 후 마스터/매핑 반영, 어드민 테이블 매핑 API)을 코드에 반영해 S1/S3 잔여 불일치를 해소한다.

Changes:

- `Backend/core/db.py`: `project_info_id` + `db_type` 기반 허용 테이블 조회(`table_project_mapping`+`table_master`) 함수 추가 및 `get_allowed_tables` 호환 분기 반영
- `Backend/report_server/router.py`: `/api/list-tables` 프로젝트 기반 필터링·프로젝트 미선택 403 보강, `save-query-as-table` 성공 후 `table_master`/`table_project_mapping` upsert 연계
- `Backend/admin_server/router.py`, `service.py`, `schemas.py`, `service_tables.py`: 테이블 마스터 목록/수정 및 프로젝트-테이블 매핑 조회·추가·삭제 API 구현
- 수정 파일 python 문법 컴파일(`py_compile`) 및 린트 확인 완료

Changed files: Backend/core/db.py, Backend/report_server/router.py, Backend/admin_server/router.py, Backend/admin_server/service.py, Backend/admin_server/schemas.py, Backend/admin_server/service_tables.py, docs/log/log.md

65. 2026-03-26 문서 교차대조 정합 보정(17·04·06)
Purpose: 교차 리뷰에서 지적된 문서 불일치(구 role 표, ETL 권한 설명, 초대 role 검증 누락, `pmssn_list` 타입 표기, 고객 여정 주어 모호성)를 정리하고, 확인 항목(ETL 관계도 참조·E 메인 UX)을 명시한다.

Changes:

- `docs/report/17_SystemDB_Commercialization_Implementation_Guide.md`: §1.3 구 3단계 역할 표 제거 및 05 참조, §4.3 etl 행을 `require_etl_infrastructure` 기반으로 명확화, §6.4 초대 `invite_target_dvsn` 백엔드 검증 문구 추가
- `docs/report/17_SystemDB_Commercialization_Implementation_Guide.md`: §0.13에 ETL 메타 구조는 04 참조 문구 추가, §5.2에 E(`etl_manager`) 프로젝트 0건일 때 ETL 카드 중심 UX 명시
- `docs/main/04_DB_ARCHITECTURE.md`: `user_info`에 `pswd_update_dtm`, `pswd_expire_dtm`, `user_lock_expire_dtm`, `last_login_ip` 추가, `pmssn_master.pmssn_list` 예시를 문자열 키 배열로 통일
- `docs/main/06_CUSTOMER_JOURNEY.md`: Phase 3 ⑫를 “부서 SA가 SA/A 초대”로 주어 명확화

Changed files: docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/main/04_DB_ARCHITECTURE.md, docs/main/06_CUSTOMER_JOURNEY.md, docs/log/log.md

64. 2026-03-26 Role 6단계·ETL 전사·permissions·docs/main 05/06
Purpose: 6단계 역할·ETL 전사 공통·`table_master` 부서 FK 제거 정책을 docs/main·report 17에 반영하고, ETL API는 `sa_dev`/`etl_manager`만, 프로젝트 기능은 `etl_manager` 차단 및 SA/A 자동 권한을 코드에 적용한다.

Changes:

- docs/main: `05_Permission_ARCHITECTURE.md` v2, `06_CUSTOMER_JOURNEY.md` 신규, `04_DB_ARCHITECTURE.md`·`00_PRD.md`·`03_AI_DEVELOP_GUIDE.md` 갱신
- docs/report: `17_SystemDB_Commercialization_Implementation_Guide.md` §10.4·§11.1·§13 전사 ETL로 정합, `00_ReportIndex.md` 17 설명
- `Backend/auth_server/permissions.py`: `require_etl_infrastructure`, `require_permission`에 `etl_manager` 차단·`sa_dev`/`super_admin`/`admin` 프로젝트 기능 자동 허용
- `Backend/api_server/main.py`: ETL 라우터 의존성 전환
- `Backend/admin_server/deps.py`: `sa_dev`를 org·super 경로에 포함

Changed files: docs/main/00_PRD.md, docs/main/01_FRONTEND_GUIDE.md, docs/main/02_BACKEND_GUIDE.md, docs/main/03_AI_DEVELOP_GUIDE.md, docs/main/04_DB_ARCHITECTURE.md, docs/main/05_Permission_ARCHITECTURE.md, docs/main/06_CUSTOMER_JOURNEY.md, docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/report/00_ReportIndex.md, docs/log/log.md, Backend/auth_server/permissions.py, Backend/api_server/main.py, Backend/admin_server/deps.py

63. 2026-03-26 ETL 메타 DB 분리(etl_db) 적용
Purpose: ETL 메타/테이블 조회 경로를 `system_db`에서 분리해 `etl_db`를 우선 사용하도록 전환하고, 인증·권한 계열은 기존 `system_db`를 유지한다.

Changes:

- `Backend/core/db.py`: `get_etl_db_config`, `get_db_connection_etl`, `get_system_table_schema_core`, `get_db_connection_system_core` 추가
- `Backend/core/db.py`: `get_db_connection_system`/`get_system_table_schema`를 ETL 호환 경로(etl_db 우선, 미설정 시 system_db fallback)로 조정
- `Backend/core/dependencies.py`: `get_system_db`를 `get_db_connection_system_core()`로 고정해 auth/admin/project/notification이 system_db를 사용하도록 분리

Changed files: Backend/core/db.py, Backend/core/dependencies.py, docs/log/log.md

62. 2026-03-26 04_DB_ARCHITECTURE·17 §13 물리명 table_*·pmssn 시드 주의
Purpose: 운영 DB 실제 테이블명(`table_master`,`table_project_mapping`)과 가이드 초안명(`project_table_*`) 불일치 정리, 전체 TRUNCATE 후 `pmssn_master` 0건·시드 필수 명시. `docs/main/04_DB_ARCHITECTURE.md` 정리 및 03 가이드 링크.

Changes:

- `docs/main/04_DB_ARCHITECTURE.md`: 제목·설명·`pmssn_master` FK 컬럼명(`user_id`)·초기화 주의
- `docs/main/03_개발가이드.md`: 04 참조 추가
- `docs/report/17_…`: §13 물리명·DDL·쿼리·admin 경로·§13.0.1·§11.1 `pmssn_master` 재시드 항목, 헤더에 04 링크
- `docs/report/00_ReportIndex.md`: 17 행 보강

Changed files: docs/main/04_DB_ARCHITECTURE.md, docs/main/03_개발가이드.md, docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/report/00_ReportIndex.md, docs/log/log.md

61. 2026-03-26 report 17 §13 ETL·테이블 마스터·§10.4 M1/M2·체크리스트
Purpose: 추가 업그레이드(ETL 메타 부서 FK, project_table_master/mapping, get_allowed_tables 개편, admin tables API, 프론트)를 계획서에 반영. DDL 적용 완료 가정·JWT `dptmt_info_id`+`etl` 권한 스코프 명시. 구현 우선순위 **M1(백엔드)→M2(프론트)** 및 S5 병행 주의를 §10.3·§10.4에 정리.

Changes:

- `docs/report/17_SystemDB_Commercialization_Implementation_Guide.md`: §10.3(M1/M2 행), §10.4(실행 재정립), §11.1 체크리스트, §13 전절 추가, §12.5 오탈자 수정
- `docs/report/00_ReportIndex.md`: 17번 행 설명 보강

Changed files: docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/report/00_ReportIndex.md, docs/log/log.md

60. 2026-03-26 S4 require_permission·report·dashboard·ETL·/me permissions
Purpose: 문서 17 S4 — `Backend/auth_server/permissions.py`로 JWT·프로젝트·`pmssn_list` 검증, 리포트 API별 `report.read`/`report.execute`, `main.py`에서 legacy/new/campaign/new2 대시보드·ETL 라우터에 `dashboard`/`etl` 권한, `/api/auth/me`에 선택 프로젝트 권한 목록 반영.

Changes:

- 신규: `Backend/auth_server/permissions.py` (`get_permission_ids_for_user_project`, `require_permission`)
- `Backend/report_server/router.py`: 엔드포인트별 Depends
- `Backend/api_server/main.py`: dashboard·etl·new_dashboard·campaign·new_dash2 `include_router(..., dependencies=[...])`
- `Backend/auth_server/router.py`: GET `/me` → `permissions` 채움
- `docs/report/17_…`: §10.3 S4 완료·S5 다음, §11 체크리스트

Changed files: Backend/auth_server/permissions.py, Backend/report_server/router.py, Backend/api_server/main.py, Backend/auth_server/router.py, docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/log/log.md

59. 2026-03-26 S3 project·admin·notification 서버·main 통합·JWT 프로젝트 claim
Purpose: 문서 17 S3 — `/api/projects`·`/api/notifications`·`/api/admin` 백엔드 1차, `main.py` 라우터 순서(health→auth→projects→notifications→admin→report…) 반영, 프로젝트 선택·refresh 시 `project_info_id` 유지.

Changes:

- 신규: `Backend/project_server`, `Backend/notification_server`, `Backend/admin_server`(deps·schemas·service_*·router)
- `Backend/auth_server/security.py`: `create_refresh_token` 선택적 `project_info_id`
- `Backend/auth_server/service.py`: `refresh_session_tokens`가 refresh 클레임의 프로젝트 유지, `rotate_session_tokens_with_project` 추가
- `Backend/api_server/main.py`: project·notification·admin 라우터 등록
- `Backend/core/dependencies.py`: get_system_db 사용처 설명 갱신
- `docs/report/17_…`: §10.3 S3 완료·S4 다음, §11 체크리스트 반영

Changed files: Backend/project_server/, Backend/notification_server/, Backend/admin_server/, Backend/auth_server/security.py, Backend/auth_server/service.py, Backend/api_server/main.py, Backend/core/dependencies.py, docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/log/log.md

58. 2026-03-26 report 17 §10 우선순위·진행현황·권장 순서 명시
Purpose: 구현 순서가 의존·리스크 기준 우선순위와 일치하는지 점검하고, §10.0 원칙·§10.3 진행 표·S3→S4→S5 권장·체크리스트 정합을 반영한다.

Changes:

- `docs/report/17_SystemDB_Commercialization_Implementation_Guide.md`: §10.0, §10.3, 유연성 문구, 체크리스트 분리; §10 하위 번호 10.0→10.1→10.2→10.3 순으로 정돈
- `.cursor/rules/tech-lead-orchestration.mdc`: §10.0 권장 일렬 순서(S3 전 S5 비권장) 한 줄

Changed files: docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/log/log.md, .cursor/rules/tech-lead-orchestration.mdc

57. 2026-03-26 auth_server S2 백엔드(/api/auth)·get_system_db
Purpose: 문서 17 S2 — `Backend/auth_server`(router·service·schemas·security·email_service·deps), `GET/POST /api/auth/*`, `main.py`에 auth 라우터 등록, `dependencies.get_system_db`, `requirements.txt`에 PyJWT·bcrypt.

Changes:

- 신규: `Backend/auth_server/*` — signup, create-org, login, verify-login, refresh, logout, me, me/password, login-history, invite/validate
- `Backend/core/dependencies.py`: `get_system_db`
- `Backend/api_server/main.py`: `auth_router` 등록
- `requirements.txt`: PyJWT, bcrypt
- `docs/report/17_…`: 체크리스트 반영

Changed files: Backend/auth_server/, Backend/core/dependencies.py, Backend/api_server/main.py, requirements.txt, docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/log/log.md

56. 2026-03-26 allowed_tables 제거·main_db.table_schema 빈값=public
Purpose: `allowed_tables` 설정 키 및 화이트리스트 로직 제거. `main_db.table_schema`가 비어 있으면 `public`으로 두고 해당 스키마의 테이블·뷰 전부 조회.

Changes:

- `Env/config/config.json`: `allowed_tables` 삭제, `main_db.table_schema` 빈 문자열
- `Backend/core/db.py`: `get_allowed_tables` 단순화, `get_table_schema` 빈값→public
- `Env/config/loader.py`, `docs/report/17_…` 정합

Changed files: Env/config/config.json, Backend/core/db.py, Env/config/loader.py, docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/log/log.md

55. 2026-03-26 상용화 S1 config·auth_config·get_allowed_tables 화이트리스트
Purpose: 문서 17 S1 — `config.json`에 JWT·SMTP·`app_url`·`allowed_tables`·`jwt_pre_auth_expire_minutes` 추가, `Backend/core/auth_config.py` 신설, `get_allowed_tables`가 비어 있지 않은 `allowed_tables`와 DB 교집합 적용.

Changes:

- `Env/config/config.json`: 상용화 키 추가(`jwt_secret`은 로컬에서 채움)
- `Backend/core/auth_config.py`: JWT·SMTP·app_url·개발 메일 스킵 판별
- `Backend/core/db.py`: `get_allowed_tables` 화이트리스트 교집합
- `Env/config/loader.py`: docstring 보강
- `docs/report/17_SystemDB_Commercialization_Implementation_Guide.md`: 체크리스트 S1 반영

Changed files: Env/config/config.json, Backend/core/auth_config.py, Backend/core/db.py, Env/config/loader.py, docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/log/log.md

54. 2026-03-26 report 17 로그인·프로젝트·SMTP 등 구현 명세 보강
Purpose: 리뷰 피드백 6건(pre_auth_token, create-org 트랜잭션, 프로젝트 미선택 403, 생성자 자동 멤버, 전역 유저 검색, SMTP 개발 모드)을 권장 방향으로 문서 17에 반영한다.

Changes:

- `pre_auth_token`·verify-login 바디, §2.3·§6.1·config `jwt_pre_auth_expire_minutes`
- §2.1 create-org 4단계, §4.2.1, §3.2·§3.3, `GET /api/admin/users/search`, §2.7, §9·§11 체크리스트

Changed files: docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/log/log.md

53. 2026-03-26 상용화 가이드 §12·섹션 게이트·.cursor 서브에이전트
Purpose: `IBANK_TEST_PROJECT_001\.cursor` 를 참고해 `Ibank_BI_Project`에 `.cursor`를 두고, 문서 17에 서브에이전트·병렬·컨텍스트 최적화 및 섹션별 담당자 게이트 흐름을 명시한다.

Changes:

- `docs/report/17_SystemDB_Commercialization_Implementation_Guide.md`: §10을 섹션(S0~S10)·게이트·병렬 표로 개편, §12 개발 운영 방식 추가, 서문에 `.cursor` 안내
- `.cursor/` 복사·보강: `README.md`, `rules/tech-lead-orchestration.mdc`, `agents/be-impl.md` 상용화 패키지 범위
- `docs/report/00_ReportIndex.md` 17번 설명 갱신

Changed files: docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/report/00_ReportIndex.md, .cursor/README.md, .cursor/rules/tech-lead-orchestration.mdc, .cursor/agents/be-impl.md, docs/log/log.md

52. 2026-03-26 report 17 운영 DB 반영·문서 정합
Purpose: `ibank_system_data`에 시스템 메타 10테이블·시드·인덱스·`ibankbi` 소유자 적용이 완료됨에 따라 가이드 문서를 “적용 완료” 기준으로 정합하고, 실제 DDL과 다른 컬럼 길이·NOT NULL·인덱스를 반영한다.

Changes:

- `17_SystemDB_Commercialization_Implementation_Guide.md`: DB 적용 현황·§0.0 요약, 표 컬럼 정의 정합, §0.11·§10 step1·§11 체크리스트 갱신
- `00_ReportIndex.md`: 17번 행에 운영 반영·DDL 비수록 안내

Changed files: docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/report/00_ReportIndex.md, docs/log/log.md

51. 2026-03-26 report 17 시스템 DB 상용화 구현 가이드·인덱스
Purpose: 시스템 DB(`ibank_system_data`) 메타·인증·권한·프로젝트·알림 상용화 설계를 report에 번호 17로 정리하고 인덱스를 갱신한다.

Changes:

- `docs/report/17_SystemDB_Commercialization_Implementation_Guide.md` 신규: DB 스키마·config·흐름·API·패키지·구현 순서·체크리스트 (2차 인증 컬럼 `scnd_auth_*`, `project_ptcpnt_info` UNIQUE, `notification_info` FK 등 검토 반영)
- `docs/report/00_ReportIndex.md`에 17번 행 추가

Changed files: docs/report/17_SystemDB_Commercialization_Implementation_Guide.md, docs/report/00_ReportIndex.md, docs/log/log.md

50. 2026-03-26 원격 저장소 ibankbi 브랜치를 프로젝트 루트에 클론
Purpose: 잘못된 `ibankbi` 하위 폴더 클론을 제거하고, `Ibank_BI_Project` 폴더 루트에 `https://github.com/WhatDoThis/Ibank_BI_Project.git` 의 **ibankbi** 브랜치를 직접 받음.

Changes:

- 기존 `ibankbi/` 디렉터리 삭제 후 `git clone -b ibankbi … .` 로 루트에 저장소 배치
- 현재 브랜치: `ibankbi`, 추적: `origin/ibankbi`

Changed files: (워크스페이스 루트 `.git` 및 클론된 전체 트리), docs/log/log.md

49. 2026-03-24 README·02 가이드 main_db 문서 정합
Purpose: 루트 README 설정 절과 02 백엔드 가이드에 **main_db** 중첩 구조·레거시 호환을 명시.

Changes:

- `README.md`: backend bullet을 main_db 기준으로 수정
- `docs/main/02_BACKEND_GUIDE.md`: §3.1.1 메인 DB(main_db) 소절 추가

Changed files: README.md, docs/main/02_BACKEND_GUIDE.md, docs/log/log.md

48. 2026-03-24 config backend.main_db — 메인 DB 설정 중첩·core.db 로드
Purpose: 비즈니스 DB 연결 정보를 system_db와 동일하게 `backend.main_db` 객체로 통일. 기존 평면 `backend.db_*` 는 `core.db` 에서 레거시 호환.

Changes:

- `Backend/core/db.py`: `_resolve_main_db`, `get_db_config`·`get_table_schema` 가 main_db 우선
- `Env/config/config.json`, `config.json.example`: main_db 블록
- `scripts/check_db_connections.py`, `Env/config/loader.py` 주석, `docs/main`(00_PRD, 02, 03)

Changed files: Backend/core/db.py, Env/config/config.json, Env/config/config.json.example, Env/config/loader.py, scripts/check_db_connections.py, docs/main/00_PRD.md, docs/main/02_BACKEND_GUIDE.md, docs/main/03_개발가이드.md, docs/log/log.md

47. 2026-03-23 docs/main 리뷰 보강(인증·에러·ER·dash·배포·로그·테스트)
Purpose: 코드 없이 구현 방향을 잡을 때 빠졌던 **인증 유무·에러 포맷·메인 DB 도메인 요약·dash_db 컬럼·배포 토폴로지·로깅·테스트 명령**을 문서에 반영.

Changes:

- `docs/main/03_개발가이드.md`: §9~§16 신설(인증, 에러+프론트 파싱, allowed_tables 예시 표, dash_db·member-summary 컬럼, mermaid 배포도, 로깅, pytest/vitest 표)
- `docs/main/00_PRD.md`: §5.1 인증·03 교차 참조
- `docs/main/02_BACKEND_GUIDE.md`: §1.1 인증·에러 한 줄 + 03 참조

Changed files: docs/main/03_개발가이드.md, docs/main/00_PRD.md, docs/main/02_BACKEND_GUIDE.md, docs/log/log.md

46. 2026-03-23 docs/main 갱신·03_개발가이드(AI용) 추가
Purpose: 로그 #42~#45(백엔드 리패키징·core Package Usage 등) 이후 **docs/main**을 현행 구조에 맞게 정리하고, 코드 전체 없이 시스템 이해·확장 질의에 쓰는 **03_개발가이드.md**를 신설. **docs/README.md**에 03 링크 추가.

Changes:

- 00_PRD: §2.1 백엔드 패키지 서술(core·report_server·legacy_dashboard·호스트), §5.2, §7 문서 표·역할 문구
- 01/02: 서두·§7 문서 구성에 03 반영, 02 부록 A.3 Phase 2·1 경로 정리
- 신설: `docs/main/03_개발가이드.md`(레이어, DB 매트릭스, 프론트↔API, 작업별 체크리스트, mermaid)
- docs/README: main 문서 표에 03 행 추가

Changed files: docs/main/00_PRD.md, 01_FRONTEND_GUIDE.md, 02_BACKEND_GUIDE.md, docs/main/03_개발가이드.md, docs/README.md, docs/log/log.md

45. 2026-03-23 core db·dependencies [Package Usage] 1~22·1~2 정리
Purpose: `Backend/core/db.py`는 [Main Functions] 1~22와 동일 번호로 [Package Usage] 기술(직접 호출 패키지·스크립트·내부 전용·미사용 명시). `dependencies.py`는 1.get_db, 2.get_config. `core/__init__.py`는 각 파일의 [Package Usage] 참조로 정리.

Changes:

- `Backend/core/db.py`, `dependencies.py`, `__init__.py` docstring 갱신

Changed files: Backend/core/db.py, Backend/core/dependencies.py, Backend/core/__init__.py, docs/log/log.md

44. 2026-03-23 dashboard_service [Package Usage] 함수 1~11 대응
Purpose: [Main Functions] 번호와 맞추어 각 함수가 어떤 Backend 패키지 라우터에서 호출되는지(또는 내부 전용인지) [Package Usage]에 1.~11.로 기술.

Changes:

- `Backend/core/dashboard_service.py` [Package Usage] 세분화, `Backend/core/__init__.py` 3번 항목을 상세 참조 문구로 정리

Changed files: Backend/core/dashboard_service.py, Backend/core/__init__.py, docs/log/log.md

43. 2026-03-23 Backend/core 모듈 docstring [Package Usage] 추가
Purpose: core 패키지·db·dependencies·dashboard_service 상단 주석에 어떤 Backend 패키지(및 scripts)가 import하는지 한눈에 보이도록 [Main Functions]와 [Dependencies] 사이에 [Package Usage] 블록 추가.

Changes:

- `Backend/core/__init__.py`, `db.py`, `dependencies.py`, `dashboard_service.py` docstring 갱신

Changed files: Backend/core/__init__.py, Backend/core/db.py, Backend/core/dependencies.py, Backend/core/dashboard_service.py, docs/log/log.md

42. 2026-03-23 백엔드 리패키징(core·report_server·legacy_dashboard·api_server 슬림)
Purpose: 공유 DB·dashboard_service를 `Backend/core`로, 리포트·조인 유틸을 `Backend/report_server`로, 구 `/api/dashboard`를 `Backend/legacy_dashboard_server`로 분리. URL(`/api/...`)은 유지. ETL·뉴/캠페인 대시보드·스크립트·테스트의 import를 `Backend.core`·`Backend.report_server`로 정리.

Changes:

- 신설: `Backend/core`(db, dependencies, dashboard_service), `Backend/report_server`(router, schemas 1–8, pluralize, join_*, relationship_inference, analysis_store), `Backend/legacy_dashboard_server`(router, schemas 9–10)
- `api_server`: `main.py`·`routers/health.py`·`routers/__init__.py`만 유지(리포트·대시보드 라우터는 타 패키지에서 로드)
- 제거: `api_server` 내 구 db·dependencies·dashboard_service·schemas·report·dashboard·조인/복수 유틸 파일(이동 완료 후 삭제)
- 소비자: `etl_server/*`, `new_dash_server`, `campaign_dash_server`, `scripts/*`, `tests/test_join_path.py`, `tests/test_table_relationship_inference.py`, `tests/test_four_tables_join.py` import 경로 갱신
- 문서: `docs/main/02_BACKEND_GUIDE.md` 디렉터리 트리·§5·부록 A.2 반영

Changed files: Backend/core/*, Backend/report_server/*, Backend/legacy_dashboard_server/*, Backend/api_server/main.py, routers/__init__.py, routers/health.py, Backend/__init__.py, Backend/api_server/__init__.py, Backend/etl_server/*.py(다수), Backend/new_dash_server/*, Backend/campaign_dash_server/router.py, Backend/new_dash_server2/star_db.py, scripts/*.py, tests/test_*.py, docs/main/02_BACKEND_GUIDE.md, docs/log/log.md

41. 2026-03-23 대시보드2(성과리포트) 제거·문서·README 정리
Purpose: `/dashboard2`·`/api/dashboard2` 및 전용 패키지 제거. 대시보드1·공통(dashboard_service, schemas) 유지. 문서에서 관련 설명 삭제(폐기 문구 없음), 백엔드 API 장 §4.4~§4.7 재번호.

Changes:

- Backend: `routers/dashboard2.py` 삭제, `main.py`·`routers/__init__.py`·`health.py`·`dashboard_service` docstring·`dashboard.py` 모듈 주석 정리
- Frontend: `packages/dashboard2/` 전체 삭제, `app/routes.jsx`·`navConfig.js`에서 라우트·네비 제거, `PeriodLabel`·`dateRange` 주석 정리
- 문서: `docs/main`(00_PRD, 01_FRONTEND, 02_BACKEND), README, `docs/report`(00_ReportIndex, 01_ChartReadability, 07·12 플랜), `.cursor` rules/skills, `schemas.py` 헤더
- 삭제: `docs/report/03_대시보드2_*.md`, `docs/report/05_대시보드2_*.md`

Changed files: Backend/api_server/main.py, routers/__init__.py, routers/health.py, routers/dashboard.py, dashboard_service.py, schemas.py (삭제: routers/dashboard2.py), Frontend/react-app/src/app/routes.jsx, navConfig.js, packages/dashboard/**/PeriodLabel.jsx, dateRange.js, docs/main/*, README.md, docs/report/*, docs/log/log.md, .cursor/rules/project-conventions.mdc, .cursor/skills/api-client-sync/SKILL.md

40. 2026-03-23 뉴/캠페인 대시보드 주간 API target_date 일요일 끝점 보정
Purpose: 주간 선택 시 weekValueToDate가 월요일만 저장되어 member-summary·hourly 등에 월요일이 넘어가 백엔드 curr_end가 월요일로 고정되던 문제 수정.

Changes:

- dateUtils: weeklySnapshotTargetDate — 해당 주 일요일과 오늘 중 이른 날
- NewDashboardPage·CampaignDashboardPage: period===weekly 일 때 summary·trendMulti·member·hourly에 apiTargetDate 사용

Changed files: Frontend/react-app/src/packages/new-dashboard/components/dateUtils.js, NewDashboardPage.jsx, Frontend/react-app/src/packages/campaign_dashboard/components/dateUtils.js, CampaignDashboardPage.jsx, docs/log/log.md

39. 2026-03-23 docs/main·README·docs/README 아키텍처·캠페인 대시보드 반영
Purpose: docs/main 을 현행 가이드로 통일(캠페인 대시보드·campaign_dash_server·패키지 API·트리). 날짜별 타임라인 제거·docs/report 역할 명시. 루트 README·docs/README 갱신.

Changes:

- 00_PRD: 캠페인 대시보드·접속 경로·§8 문서 이력 단순화·PeriodLabel 경로
- 01_FRONTEND_GUIDE: §7 변경 이력 제거·현행 구조만
- 02_BACKEND_GUIDE: campaign_dash_server 트리·§4.7.2·라우터 순서·§5.1·잘못된 §4.8 하위 문단 제거·문서 이력 단순화
- docs/README.md: main / log / report 역할 정리
- README.md: 프로젝트 트리·캠페인 경로·문서 표

Changed files: docs/main/00_PRD.md, docs/main/01_FRONTEND_GUIDE.md, docs/main/02_BACKEND_GUIDE.md, docs/README.md, README.md, docs/log/log.md

38. 2026-03-23 프론트 API 패키지 분리·라우트 모듈화(shared client 제거)
Purpose: shared/api/client.js 단일 집약을 제거하고 패키지별 api/*Client.js + shared/api/http.js 로 분리. 대시보드 전용 dateRange·PeriodLabel은 packages/dashboard 로 이동.

Changes:

- 신규: shared/api/http.js, packages/*/api/*Client.js(report, dashboard, dashboard2, new-dashboard, campaign_dashboard, new-dashboard2, etl), app/navConfig.js, app/routes.jsx
- App.jsx: 네비·Route를 app 모듈로 위임
- 삭제: shared/api/client.js, shared/utils/dateRange.js, shared/components/PeriodLabel.jsx
- 문서: docs/main/01_FRONTEND_GUIDE.md, .cursor/skills/api-client-sync/SKILL.md, docs/report/16 Phase2 표·표 내 client.js 잔여 문구
- report·dashboard·dashboard2·widgetboard 일부 파일 상단 [Dependencies]를 실제 import(*Client.js·dashboard/dateRange)에 맞게 정리

Changed files: Frontend/react-app/src/shared/api/http.js, Frontend/react-app/src/app/*, Frontend/react-app/src/App.jsx, Frontend/react-app/src/packages/**/api/*.js, Frontend/react-app/src/packages/query_studio/QueryStudioPage.jsx·hooks/useQueryStudioData.js, Frontend/react-app/src/packages/widgetboard/Dashboard3Page.jsx, Frontend/react-app/src/packages/dashboard/components/ChartWidget.jsx·ChartWidget2.jsx·DashboardHeader.jsx, Frontend/react-app/src/packages/dashboard2/components/Dashboard2Header.jsx, 다수 패키지 import 경로, docs/main/01_FRONTEND_GUIDE.md, .cursor/skills/api-client-sync/SKILL.md, docs/report/16_Campaign_Dashboard_Star_Schema_Plan.md, docs/log/log.md

37. 2026-03-23 캠페인 대시보드 구현(campaign_dash_server·campaign_dashboard)
Purpose: docs/report/16 계획에 따라 Star JSONB 테이블(ibank_*_star_1/2) 전용 API·UI를 뉴 대시보드와 동형으로 추가.

Changes:

- Backend/campaign_dash_server: `/api/campaign-dashboard` 라우터(summary·trend·trend-multi·tables·member-summary·delivery-demographics·hourly). table_id는 `*_star_1` 고정, 회원은 `_star_2` 매핑.
- db.py: `is_new_dash_physical_table`에 `ibank_*_star_1|2` 패턴. dashboard_service: `get_aggregatable_tables` dash 후보에 `ibank_1_star_1`.
- main.py: campaign_dashboard_router 등록.
- shared/api/client.js: getCampaignDashboard* 함수군.
- packages/campaign_dashboard: new-dashboard 복사본·CampaignDashboardPage·`/campaign-dashboard` 전용.
- App.jsx: 네비·Route 추가.

Changed files: Backend/campaign_dash_server/__init__.py, Backend/campaign_dash_server/router.py, Backend/api_server/db.py, Backend/api_server/dashboard_service.py, Backend/api_server/main.py, Frontend/react-app/src/shared/api/client.js, Frontend/react-app/src/packages/campaign_dashboard/**, Frontend/react-app/src/App.jsx, docs/log/log.md

36. 2026-03-23 캠페인 대시보드 Star 스키마 계획서(16)·Report 인덱스
Purpose: `new_dash_server`/`new-dashboard`와 동일 UI·API 계약으로 `ibank_1_star_1`·`ibank_1_star_2` 전환 시 컬럼·JSONB 매핑 검증 및 Phase 계획을 문서화.

Changes:

- `docs/report/16_Campaign_Dashboard_Star_Schema_Plan.md` 신규(ibank_1~_4 ↔ star 테이블 매핑, Phase·체크리스트).
- `docs/report/00_ReportIndex.md` 16번 항목 추가.

Changed files: docs/report/16_Campaign_Dashboard_Star_Schema_Plan.md, docs/report/00_ReportIndex.md, docs/log/log.md

35. 2026-03-20 member-summary 주·월 직전 스냅샷 폴백(base_date < 기간시작)
Purpose: 직전 달력 구간에 일별 행이 없을 때 prev_row 가 비어 전환 KPI 가 — 로만 표시되던 경우 대비.

Changes:
- `router.py`: weekly/monthly 에서 `query_prev` 무결과 시 `base_date < date_range[0]` 최신 1건 조회. 상단 `import logging` 정리.

Changed files:
- Backend/new_dash_server/router.py
- docs/log/log.md

34. 2026-03-20 docs/main 가이드 문체 정리(§4.7.1·부록 A·PRD)
Purpose: docs/main 본문을 현행 동작 기준 문장으로 정리, PRD §8 중복 행 통합.

Changes:
- `02_BACKEND_GUIDE.md`: §4.7.1·§6.7 db_load_service·부록 A 문장, §변경 이력 2026-03-20 한 줄로 통합.
- `00_PRD.md` §6.3.2·§8, `01_FRONTEND_GUIDE.md` §4.5.2 한 줄.
- `router.py` member_summary 주석 중립화.

Changed files:
- docs/main/02_BACKEND_GUIDE.md
- docs/main/00_PRD.md
- docs/main/01_FRONTEND_GUIDE.md
- Backend/new_dash_server/router.py
- docs/log/log.md

33. 2026-03-20 member-summary 주·월 직전 스냅샷 조회 범위 수정
Purpose: 주·월 `query_prev` 상한을 직전 기간 전체(`prev_range[1]`)로 통일, §4.7.1 문구 반영.

Changes:
- `router.py`: `query_prev` 상한 — 일간 `prev_end`, 주·월 `prev_range[1]`.
- `02_BACKEND_GUIDE.md` §4.7.1 스냅샷 선택.

Changed files:
- Backend/new_dash_server/router.py
- docs/main/02_BACKEND_GUIDE.md
- docs/log/log.md

32. 2026-03-20 docs/main 뉴 대시보드 member-summary 계산 공식(§4.7.1)
Purpose: 뉴 대시보드 회원 KPI·전환·분포의 계산 원칙을 docs/main에 명문화.

Changes:
- `02_BACKEND_GUIDE.md`: §4.7.1 `member-summary` 끝점 빼기·스냅샷 선택·지표·요약식 표.
- `00_PRD.md` §6.3.2, `01_FRONTEND_GUIDE.md` §4.5.2: §4.7.1 교차 참조. PRD 변경 이력 한 줄.

Changed files:
- docs/main/02_BACKEND_GUIDE.md
- docs/main/00_PRD.md
- docs/main/01_FRONTEND_GUIDE.md
- docs/log/log.md

31. 2026-03-20 뉴 대시보드 member-summary 전환 끝점 빼기(주·월 포함)
Purpose: 전환 순증감을 일별 inc/dec가 아니라 기간 말 total_recipients 직전 기간 대비 차이로 통일(SUM 없음).

Changes:
- `router.py`: `member_net_flow_count`/`member_net_flow_pct` = 끝점 빼기; `member_net_flow_delta` 계열 제거.
- `MemberKPICards` 안내 문구, `client.js` 주석.

Changed files:
- Backend/new_dash_server/router.py
- Frontend/react-app/src/packages/new-dashboard/components/MemberKPICards.jsx
- Frontend/react-app/src/shared/api/client.js
- docs/log/log.md

30. 2026-03-20 뉴 대시보드 전환 카드 표시값·안내 문구 정리
Purpose: 전환 카드가 ‘전일 순증감 차이’·pp 변화를 쓰며 전체 회원수 증감률과 숫자가 어긋나던 문제 수정; 안내는 스냅샷 용어 제거.

Changes:
- `MemberKPICards`: 전환 = `member_net_flow_count` + `member_net_flow_pct`(전체 대비 당일 순증감 비율).
- 하단 안내: 「전체 회원수 대비 유입·이탈 순증감 비율」.
- `client.js` member-summary 주석 간소화.

Changed files:
- Frontend/react-app/src/packages/new-dashboard/components/MemberKPICards.jsx
- Frontend/react-app/src/shared/api/client.js
- docs/log/log.md

29. 2026-03-20 뉴 대시보드 전환 KPI 유입·이탈 순증감 정의로 수정
Purpose: 전환 카드가 발송 타겟(target/total)이 아니라 increased_count·decreased_count 기반 순증감 및 전체 대비 비중(pp)을 표시하도록 정합.

Changes:
- `member-summary`: 제거 `conversion_rate`, `conversion_target_delta`, `conversion_rate_delta_pp`; 추가 `member_net_flow_*`, `inflow_share_pct`, `increased_change_pct`.
- `MemberKPICards.jsx`, `client.js` 주석 반영.

Changed files:
- Backend/new_dash_server/router.py
- Frontend/react-app/src/packages/new-dashboard/components/MemberKPICards.jsx
- Frontend/react-app/src/shared/api/client.js
- docs/log/log.md

28. 2026-03-20 docs/main·README dash_db 반영 (로그 #27 기준)
Purpose: 로그 #27(dash_db) 이후 PRD·백엔드 가이드·README에 뉴 대시보드 전용 DB 설명을 반영.

Changes:
- `02_BACKEND_GUIDE.md`: §1.1·§3.2.1·§4.7·§5.2·§5.6·변경 이력 — dash_db·ibank_1 계열.
- `00_PRD.md`: §3 설정·§6.3.2 뉴 대시보드 — dash_db 언급.
- `README.md`: 뉴 대시보드·config·db.py·문서 표.

Changed files:
- docs/main/00_PRD.md
- docs/main/02_BACKEND_GUIDE.md
- README.md
- docs/log/log.md

27. 2026-03-20 뉴 대시보드 테이블 dash_db 연결 전면 적용 (ibank_1 계열)
Purpose: config.json의 dash_db 설정을 사용하여 뉴 대시보드 관련 테이블(ibank_1, ibank_1_0~ibank_1_4)을 dash_db에서 로드하도록 전면 적용.

Changes:
- db.py: get_dash_db_config, get_dash_table_schema, get_db_connection_dash 추가. is_new_dash_physical_table로 ibank_1 계열 판별. validate_dashboard_data_table_name으로 대시보드 테이블명 검증(ibank_1 계열은 allowed_tables 없이 검증). get_table_columns_with_types, get_all_tables_columns_with_types에서 dash_db 분기 처리.
- dashboard_service.py: _full_table_name에서 ibank_1 계열은 dash_db 스키마 사용. get_dashboard_data, get_filter_options, get_chart_data에서 ibank_1 계열은 dash_db 연결 사용. get_aggregatable_tables에서 ibank_1도 체크 대상에 추가.
- new_dash_server/router.py: _get_sub_table에서 dash_db 스키마와 validate_dashboard_data_table_name 사용. 모든 DB 연결을 get_db_connection_dash로 변경. get_table_schema를 get_dash_table_schema로 변경.

Changed files:
- Backend/api_server/db.py
- Backend/api_server/dashboard_service.py
- Backend/new_dash_server/router.py
- docs/log/log.md

26. 2026-03-20 docs/main·README 현행화 (docs/log·docs/report 로그 기준)
Purpose: 개발문서·README를 최신 시스템 상태(ETL diff·변환 룰·뉴 대시보드 API·UI 확장)에 맞게 갱신. 변경 이력 일일이 복사하지 않고 요약 반영.

Changes:
- `00_PRD.md`, `01_FRONTEND_GUIDE.md`, `02_BACKEND_GUIDE.md`: ETL sync_mode diff·날짜/시간 변환·14번 설계서 참조, 뉴 대시보드 member-summary·delivery-demographics·hourly·컴포넌트·15번 설계서 참조.
- `README.md`: ETL·뉴 대시보드 요약·docs/main 최종 반영일.

Changed files:
- docs/main/00_PRD.md
- docs/main/01_FRONTEND_GUIDE.md
- docs/main/02_BACKEND_GUIDE.md
- README.md
- docs/log/log.md

25. 2026-03-20 뉴 대시보드 등급 분포 도넛 표시(레이아웃)
Purpose: 등급 분포 섹션에서 도넛이 보이지 않던 문제 수정(좁은 칸에서 가로 flex 시 도넛 영역 너비 0).

Changes:
- `GradeDonutChart.jsx`: `--row` 제거, `--grade` 세로 스택, Pie margin·label=false·ResponsiveContainer minHeight.
- `new-dashboard.css`: `.nd-demo-chart--grade` 도넛 위·범례 아래, `min-width: 0`으로 그리드 오버플로 방지.

Changed files:
- Frontend/react-app/src/packages/new-dashboard/components/GradeDonutChart.jsx
- Frontend/react-app/src/packages/new-dashboard/new-dashboard.css
- docs/log/log.md

24. 2026-03-20 뉴 대시보드 등급 분포 도넛 복원
Purpose: 등급 합계 100% 구조에 맞게 가로 막대 대신 도넛+범례 재적용.

Changes:
- `GradeDonutChart.jsx`: recharts PieChart 도넛, count>0만 표시, `.nd-demo-chart--row`.
- `new-dashboard.css`: `.nd-channel-consent.nd-grade-bars` 제거.

Changed files:
- Frontend/react-app/src/packages/new-dashboard/components/GradeDonutChart.jsx
- Frontend/react-app/src/packages/new-dashboard/new-dashboard.css
- docs/log/log.md

23. 2026-03-20 뉴 대시보드 등급 막대·동의 UI·퍼널 트랙·KPI 문구 정리
Purpose: 전환 카드 비교 스냅샷 제거, 발송 대상 회원수 라벨, 등급 도넛→가로 막대, 동의에서 카카오 제거·카드 높이, 퍼널 오픈/클릭 트랙을 발송성공 폭에 맞춤.

Changes:
- `MemberKPICards.jsx`: 비교 스냅샷 제거, 라벨 `발송 대상 회원수`.
- `GradeDonutChart.jsx`: A~E 가로 막대(동의 UI 패턴).
- `ChannelConsentBars.jsx`: 카카오 행 제거.
- `new-dashboard.css`: 동의 카드 min-height·패딩·행간, 등급 `.nd-channel-consent.nd-grade-bars`, 퍼널 `track-wrap`/`track-scaled`.
- `FunnelSection.jsx`: `successTrackPct`로 오픈·클릭 트랙 폭.

Changed files:
- Frontend/react-app/src/packages/new-dashboard/components/MemberKPICards.jsx
- Frontend/react-app/src/packages/new-dashboard/components/GradeDonutChart.jsx
- Frontend/react-app/src/packages/new-dashboard/components/ChannelConsentBars.jsx
- Frontend/react-app/src/packages/new-dashboard/components/FunnelSection.jsx
- Frontend/react-app/src/packages/new-dashboard/new-dashboard.css
- docs/log/log.md

22. 2026-03-20 뉴 대시보드 전환 KPI 카드 색상·하단 안내
Purpose: 전환 카드 증감에 따른 녹/적 색상 및 하단 안내 문구.

Changes:
- `MemberKPICards.jsx`: `conversionTone`, 값 영역 클래스 `...-up|down|neutral`, 하단 `증가 또는 감소된 회원 전환률`.
- `new-dashboard.css`: 전환 값·슬래시 색, `.nd-kpi-card__conversion-guide`.

Changed files:
- Frontend/react-app/src/packages/new-dashboard/components/MemberKPICards.jsx
- Frontend/react-app/src/packages/new-dashboard/new-dashboard.css
- docs/log/log.md

21. 2026-03-20 뉴 대시보드 member-summary 스냅샷 일자 정렬(전환 KPI 불일치 수정)
Purpose: 주/월간에서 기간 말일만 조회하던 스냅샷을 target_date(및 이전 기간 대응일)까지로 제한해 전환 증감과 헤더 일자 불일치 해소.

Changes:
- `router.py`: `_snapshot_end_clamped`, `_snapshot_prev_end_clamped`, `_row_date_iso` 등; member-summary 응답에 `snapshot_date`, `prev_snapshot_date`.
- `MemberKPICards.jsx`: 전환 카드 하단에 비교 스냅샷 일자 표시.
- `new-dashboard.css`: `.nd-kpi-card__desc--snapshot`.

Changed files:
- Backend/new_dash_server/router.py
- Frontend/react-app/src/packages/new-dashboard/components/MemberKPICards.jsx
- Frontend/react-app/src/packages/new-dashboard/new-dashboard.css
- docs/log/log.md

20. 2026-03-20 뉴 대시보드 채널별 동의 현황·레이아웃(추이 하단 전폭)
Purpose: ibank_1_0 opt_in 기준 채널별 동의율 막대 UI 추가, 섹션4를 발송|동의 2열 + 전체 추이 그래프 하단 한 줄로 재배치.

Changes:
- `router.py` member-summary `opt_in.kakao` ← `kakao_opt_in_count`(없으면 0).
- `ChannelConsentBars.jsx` 신규: 이메일/SMS/카카오/푸시, total_recipients 대비 %.
- `NewDashboardPage.jsx`: import·섹션4 레이아웃.
- `new-dashboard.css`: `.nd-channel-trend-stack`, `.nd-full-width-trend`, `.nd-channel-consent`, `.nd-consent-row*`.

Changed files:
- Backend/new_dash_server/router.py
- Frontend/react-app/src/packages/new-dashboard/components/ChannelConsentBars.jsx
- Frontend/react-app/src/packages/new-dashboard/NewDashboardPage.jsx
- Frontend/react-app/src/packages/new-dashboard/new-dashboard.css
- docs/log/log.md

19. 2026-03-20 뉴 대시보드 회원 현황 KPI 3열·전환 카드·member-summary 필드
Purpose: 이탈 수 카드 제거, 전환 카드는 증감 건/퍼센트포인트만 표시, 발송 대상 설명 문구 정리, 3열 그리드 여유 레이아웃.

Changes:
- `router.py` member-summary: `conversion_target_delta`, `conversion_rate_delta_pp` 추가(이전 기간 대비).
- `MemberKPICards.jsx`: 3카드, 전환 `+건 / +%` 형식, `nd-kpi-grid--3col nd-kpi-grid--member`.
- `new-dashboard.css`: `--4col` 회원용 제거·`--3col`+`--member` 스타일, 전환 값 타이포.

Changed files:
- Backend/new_dash_server/router.py
- Frontend/react-app/src/packages/new-dashboard/components/MemberKPICards.jsx
- Frontend/react-app/src/packages/new-dashboard/new-dashboard.css
- docs/log/log.md

18. 2026-03-20 뉴 대시보드 회원 분석 성별 도넛 차트 레이아웃(잘림) 수정
Purpose: `nd-demo-grid--3col` 내 성별 분포 도넛에서 슬라이스 라벨·범례가 칸 밖으로 잘리는 문제 해소.

Changes:
- `GenderDonutChart.jsx`: 루트에 `nd-demo-chart--gender`, Pie `label={false}`(비율·명수는 범례 유지), 도넛 반경·PieChart margin 조정, 높이 200px.
- `new-dashboard.css`: `.nd-demo-chart--gender` 패딩·범례 `flex-wrap`·줄간격.

Changed files:
- Frontend/react-app/src/packages/new-dashboard/components/GenderDonutChart.jsx
- Frontend/react-app/src/packages/new-dashboard/new-dashboard.css
- docs/log/log.md

17. 2026-03-20 뉴 대시보드 시간대별/성별/나이대 데이터 문제 점검 및 FunnelSection 퍼널 수정
Purpose: 시간대별 분석·성별/나이대 섹션 데이터 미표시 문제 점검 및 전체발송분석 퍼널그래프 수정(오픈·클릭은 발송성공 기준 비율).

Changes:
- FunnelSection.jsx: 오픈·클릭의 maxValue를 total_send → total_success로 변경(회색 영역이 발송 성공까지로 맞춤).
- NewDashboardPage.jsx: 신규 섹션 데이터 로딩 시 상세 로그 추가(member-summary·hourly 3종 데이터 존재 여부 확인).
- router.py: hourly·member-summary 엔드포인트에 데이터 없을 때 warning 로그 추가(디버깅용).

Changed files:
- Frontend/react-app/src/packages/new-dashboard/components/FunnelSection.jsx
- Frontend/react-app/src/packages/new-dashboard/NewDashboardPage.jsx
- Backend/new_dash_server/router.py
- docs/log/log.md

16. 2026-03-19 client.js 뉴 대시보드 API 3함수 세트 주석·설계서 Phase2 보강
Purpose: 공유 스니펫에 함수 1개만 보이는 혼동 방지 — 실제 코드는 이미 3함수 존재, `getNewDashboardHourly` 필수 이유 명시.

Changes:
- `client.js`: `getNewDashboardTrendMulti` 직후에 3함수 세트 유지 의무·`Hourly` 3회 호출 주석.
- `15_New_Dashboard_Upgrade_Plan.md` Phase 2: 3함수 한 세트·런타임 주의 문구.

Changed files:
- Frontend/react-app/src/shared/api/client.js
- docs/report/15_New_Dashboard_Upgrade_Plan.md
- docs/log/log.md

15. 2026-03-19 뉴 대시보드 Phase 6 정합성 검증 (설계서 15)
Purpose: 설계서 15 Phase 6 — client.js ↔ router.py 경로·쿼리 파라미터, 응답 키 ↔ 컴포넌트, new-dashboard.css 클래스 사용, delivery-demographics 미연동 의도 확인.

Changes:
- 코드 정적 검증만 수행(서버 실행·실DB 호출 없음). @verifier cross-check: API 경로·파라미터 일치, member-summary·hourly·trend-multi 응답 필드와 프론트 사용 일치, Phase 5 CSS 클래스 존재, `NewDashboardPage`에서 `getNewDashboardDeliveryDemographics` 미import 확인.

Changed files:
- docs/log/log.md

14. 2026-03-19 뉴 대시보드 Phase 4·5 NewDashboardPage·CSS (설계서 15)
Purpose: 설계서 15 Phase 4(페이지 통합: 분리 try-catch loadData, 섹션 1~7 JSX, `deliveryDemographics` 미사용) 및 Phase 5(CSS 하단 추가·반응형).

Changes:
- `NewDashboardPage.jsx`: `getNewDashboardMemberSummary`/`getNewDashboardHourly` 및 6개 컴포넌트 import, state 4종, `loadData` 2단 try + 마지막 `setLoading(false)`, `(kpi || memberData)` 래퍼, 빈 화면 조건 `!kpi && !memberData`, docstring 갱신.
- `new-dashboard.css`: 4열 KPI·3열 인구통계·차트·2열·시간대·채널 스택·1024px 미디어쿼리 블록 하단 추가.

Changed files:
- Frontend/react-app/src/packages/new-dashboard/NewDashboardPage.jsx
- Frontend/react-app/src/packages/new-dashboard/new-dashboard.css
- docs/log/log.md

13. 2026-03-19 뉴 대시보드 Phase 3A·3C 컴포넌트 6종 (설계서 15)
Purpose: 설계서 15 Phase 3A(회원 KPI·도넛·나이대·등급) 및 Phase 3C(채널 스택바·시간대 막대) 신규 컴포넌트 추가. `NewDashboardPage`는 미변경.

Changes:
- `components/MemberKPICards.jsx`, `GenderDonutChart.jsx`, `AgeBarChart.jsx`, `GradeDonutChart.jsx`, `ChannelStackBarChart.jsx`(`formatDateLabel` from `dateUtils`), `HourlyBarChart.jsx` 생성.

Changed files:
- Frontend/react-app/src/packages/new-dashboard/components/{MemberKPICards,GenderDonutChart,AgeBarChart,GradeDonutChart,ChannelStackBarChart,HourlyBarChart}.jsx
- docs/log/log.md

12. 2026-03-19 뉴 대시보드 Phase 2·3B client·dateUtils·TrendLineChart (설계서 15)
Purpose: 설계서 15 Phase 2(API 클라이언트 3함수) 및 Phase 3B(formatDateLabel 공통화) 구현. 통합 테스트는 최종 단계에서 수행.

Changes:
- `client.js`: `getNewDashboardMemberSummary`, `getNewDashboardDeliveryDemographics`, `getNewDashboardHourly` 추가, 상단 [Main Functions] 갱신.
- `dateUtils.js`: `formatDateLabel` export 및 docstring 6번.
- `TrendLineChart.jsx`: `formatDateLabel`를 `./dateUtils`에서 import, 로컬 정의 제거.

Changed files:
- Frontend/react-app/src/shared/api/client.js
- Frontend/react-app/src/packages/new-dashboard/components/dateUtils.js
- Frontend/react-app/src/packages/new-dashboard/components/TrendLineChart.jsx
- docs/log/log.md

11. 2026-03-19 뉴 대시보드 Phase 1 백엔드 엔드포인트 3종 (설계서 15)
Purpose: `docs/report/15_New_Dashboard_Upgrade_Plan.md` Phase 1에 따라 `new_dash_server`에 서브 테이블 상수·헬퍼 및 `member-summary`, `delivery-demographics`, `hourly` API 추가.

Changes:
- `router.py`: GRADE/AGE/GENDER/HOUR 상수, `_get_sub_table`, `_sub_table_date_col` 추가, `GET /member-summary`, `/delivery-demographics`, `/hourly` 구현, 상단 docstring [Endpoints] 갱신, 기존 엔드포인트 주석 번호 재정렬.

Changed files:
- Backend/new_dash_server/router.py
- docs/log/log.md

10. 2026-03-19 설계서 15번 age 루프·Phase4 제목·AgeBarChart opacity
Purpose: 2차 리뷰 반영 — delivery-demographics age 루프를 `len(AGE_COLS)`로 member-summary와 통일, 섹션 8 제목 물음표 제거, AgeBarChart `fillOpacity` 상한 방어.

Changes:
- Step 1-3 `build_item` age 리스트: `range(len(AGE_LABELS))` → `range(len(AGE_COLS))`.
- §8 제목: `NewDashboardPage 통합?` → `NewDashboardPage 통합`.
- AgeBarChart 샘플: `fillOpacity={Math.min(1, 0.7 + (i * 0.05))}`.

Changed files:
- docs/report/15_New_Dashboard_Upgrade_Plan.md
- docs/log/log.md

9. 2026-03-19 설계서 15번 리뷰 잔여 이슈 반영(JSX·3B import·행 get)
Purpose: 문서 리뷰 3건 — Step 4-4 등급 열 제목 오타, Phase 3B TrendLineChart import·docstring 지침 명시, Phase 1 DB 행 접근 `get()` 통일 및 컨벤션 문구 추가.

Changes:
- Step 4-4: 세 번째 컬럼 `<h3>` 성별 분포 → 등급 분포.
- Step 3B-2: `dateUtils` import 변경 전/후 코드 블록, 로컬 `formatDateLabel` 삭제 예시, 파일 상단 docstring `[Main Functions]` 정리 지침.
- Step 1-2 bullet: 행 접근 컨벤션; member-summary·delivery-demographics·hourly 샘플 코드에서 `row`/`r`를 `.get()`으로 통일.

Changed files:
- docs/report/15_New_Dashboard_Upgrade_Plan.md
- docs/log/log.md

8. 2026-03-19 설계서 15번 인코딩 원인 정리·UTF-8 복구·잔여 치환
Purpose: PowerShell Get/Set-Content 기본 인코딩으로 UTF-8 한글이 깨진 원인을 문서화하고, 치환 스크립트·수동 수정으로 15번 본문을 UTF-8로 정리.

Changes:
- 원인: UTF-8 `.md`를 `-Encoding UTF8` 없이 PowerShell로 읽고 쓰면 Windows 기본 코드페이지로 재저장되어 한글 손상.
- 예방: `.cursor/rules/utf8-file-editing.mdc` — UTF-8 텍스트는 StrReplace/Write 또는 Python `encoding='utf-8'` 사용, PowerShell 본문 치환 금지(또는 읽기·쓰기 모두 UTF-8).
- 복구: `docs/report/fix_15_encoding.py`로 일괄 치환 후 UTF-8 저장; 잔여 `?` 구간(응답·매핑·대상 파일·Props·HourlyBarChart Tooltip·캠페인 요약·검증 항목 등) 수동 StrReplace.

Changed files:
- docs/report/15_New_Dashboard_Upgrade_Plan.md
- docs/report/fix_15_encoding.py (이전 세션)
- .cursor/rules/utf8-file-editing.mdc (이전 세션)
- docs/log/log.md

7. 2026-03-19 뉴 대시보드 업그레이드 설계서 15번 작성
Purpose: 뉴 대시보드 회원 현황·발송 인구통계·시간대별 분석 추가 개발을 위한 실행용 계획서를 docs/report에 15번으로 등록. 서브에이전트 단위 Phase 분리 및 체크리스트 포함.

Changes:
- 15_New_Dashboard_Upgrade_Plan.md 신규 작성: 개요·최종 레이아웃, Phase 1(백엔드 3 엔드포인트)·2(client 3함수)·3A(회원/인구통계 컴포넌트 4종)·3B(formatDateLabel export)·3C(ChannelStackBarChart·HourlyBarChart)·4(NewDashboardPage)·5(CSS)·6(검증) 단계별 스텝·체크리스트·파일 목록.
- 00_ReportIndex.md: 15_New_Dashboard_Upgrade_Plan.md 항목 추가.

Changed files:
- docs/report/15_New_Dashboard_Upgrade_Plan.md
- docs/report/00_ReportIndex.md
- docs/log/log.md

6. 2026-03-17 apply_mapping_type_cast·_apply_type_cast information_schema 풀 타입명 인식
Purpose: column_mapping.type에 "TIMESTAMP WITHOUT TIME ZONE", "TIME WITH TIME ZONE" 등 information_schema 풀 타입명이 들어와도 TEXT로 떨어지던 문제 해결. pg_type → target 매핑 확장 및 target_type 정규화 추가.

Changes:
- transform_engine.apply_mapping_type_cast: pg_type 매핑 확장 — INTEGER/BIGINT 계열(SERIAL, INT4, INT8, MEDIUMINT, TINYINT 등), NUMERIC 계열(NUMBER, BINARY_FLOAT 등), TIMESTAMP/TIME 계열(TIMETZ, DATETIME, YEAR, INTERVAL) 및 "TIMESTAMP" in pg_type, "TIME" in pg_type && "TEXT" not in pg_type 로 풀 타입명 수용.
- transform_engine._apply_type_cast: target_type 정규화 — timestamp/time 포함 → timestamp, serial/int4 등 → bigint, decimal/real 등 → numeric, bool → boolean, varchar/varchar2 등 → text.
- transform_engine._apply_type_cast_with_mask: 동일 target_type 정규화 적용.

Changed files:
- Backend/etl_server/transform_engine.py
- docs/log/log.md

5. 2026-03-17 column_mapping type 누락 시 TEXT 강제 적용 문제 수정(소스 타입 유지)
Purpose: 컬럼 변환을 설정하지 않았는데 기존 DB의 date 등이 TEXT로 저장되던 원인 제거. column_mapping에 type이 없을 때 백엔드가 무조건 TEXT로 두고 apply_mapping_type_cast를 호출하던 동작을, 소스 타입을 쓰도록 변경.

Changes:
- load_service.run_file_load: mapping_used 구성 시 type이 비어 있으면 DataFrame 컬럼 dtype으로 schema_infer._dtype_to_inferred + _pg_type으로 추론해 채움. 없을 때만 TEXT.
- db_load_service (run_db_load 경로): mapping_used 구성 시 type이 비어 있으면 소스 스키마(columns)의 data_type을 type_mapper로 PG 타입으로 변환해 사용.
- batch_executor_db: 동일하게 소스 columns의 data_type으로 type_mapper 적용해 type 누락 시 소스 타입 사용. type_mapper를 mapping_used 루프 전에 설정.

Changed files:
- Backend/etl_server/load_service.py
- Backend/etl_server/db_load_service.py
- Backend/etl_server/batch_executor_db.py
- docs/log/log.md

4. 2026-03-17 ETL 변환 룰 rule_category·operation 최상위 전달 및 백엔드 방어·로그
Purpose: etl2CreateTransformRule 호출 시 rule_category·operation이 최상위에 없어 DB에 operation='default'로 저장되던 문제 해결 및 변환 적용 시 방어·로그 강화.

Changes:
- DbConnectionForm.jsx: buildAssembledRulesFromSettings에서 모든 rules.push에 rule_category·operation 최상위 추가(datetime/masking/string/code_map/cleansing/type_cast). onSelect 콜백에 assembledRules 6번째 인자 수신.
- TargetTableSelectModal/index.jsx: getAssembledRules에서 동일하게 rule_category·operation 최상위 추가. handleApply의 onSelect 호출 3곳에 assembled 6번째 인자로 전달.
- transform_engine.py: apply_rules에서 config.operation 없을 때 r.operation으로 채우기. source_column 미존재 시 경고 로그. datetime 변환 전후 동일 시 경고 로그. transformer 결과를 result에 담아 동일성 검사 후 out[tgt] 할당.
- transform_rules_service.py: list_transform_rules에서 rule_config 내부 operation 파싱 후 db_op/config_op 우선순위로 d.operation 설정.
- load_service.py: run_file_load·run_file_upsert에서 변환 룰 적용 전 룰 개수 info 로그, 예외 시 warning 로그(원본 유지).

Changed files:
- Frontend/react-app/src/packages/etl/components/DbConnectionForm.jsx
- Frontend/react-app/src/packages/etl/components/TargetTableSelectModal/index.jsx
- Backend/etl_server/transform_engine.py
- Backend/etl_server/transform_rules_service.py
- Backend/etl_server/load_service.py
- docs/log/log.md

3. 2026-03-17 ETL 날짜/시간 연산 — 날짜 빼기(date_subtract) 추가
Purpose: 날짜 더하기에 대응하는 날짜 빼기 연산을 UI·백엔드·룰 조립에 추가.

Changes:
- transform_engine.py: date_subtract 연산 추가(days/months/years 빼기, DateOffset 사용). docstring operation 목록에 date_subtract 반영.
- constants.js: DATETIME_OPERATION_OPTIONS에 date_subtract(날짜 빼기) 항목 추가.
- TransformDetailRow.jsx: date_subtract 선택 시 일/월/년 입력 필드(뺄 값) UI 추가.
- TargetTableSelectModal/index.jsx: getAssembledRules에서 date_subtract 시 rule_config에 days/months/years 반영.
- DbConnectionForm.jsx: buildAssembledRulesFromSettings에서 date_subtract 분기 추가.
- preview_service.py: _OPERATION_LABEL에 date_subtract(날짜빼기) 추가.

Changed files:
- Backend/etl_server/transform_engine.py
- Frontend/react-app/src/packages/etl/components/TargetTableSelectModal/constants.js
- Frontend/react-app/src/packages/etl/components/TargetTableSelectModal/TransformDetailRow.jsx
- Frontend/react-app/src/packages/etl/components/TargetTableSelectModal/index.jsx
- Frontend/react-app/src/packages/etl/components/DbConnectionForm.jsx
- Backend/etl_server/preview_service.py
- docs/log/log.md

2. 2026-03-17 컬럼 매핑 모달 변환 상세 셀렉트/레이아웃 품질 개선
Purpose: 컬럼 변환 카테고리(타입 변환·문자열·마스킹·날짜/시간) 진입 시 셀렉트박스·입력 필드가 모달 레이아웃에 맞게 통일되도록 스타일 정리.

Changes:
- etl.css: 변환 상세 공통 셀렉트 스타일(--detail, --type-cast-target, --string-op, --masking-op 통일). etl-detail__select-wrap을 flex로 넓이 100%·max-width 220px 적용. transform-detail-group gap·min-width·max-width 정리. transform-detail-summary 스타일 추가. input--detail 패딩/폰트/최대폭 셀렉트와 맞춤.
- TransformDetailRow.jsx: 모든 변환 상세 셀렉트에 etl-target-select-modal__select--detail 사용(타입 변환·문자열·마스킹·날짜 연산/시간대 등).

Changed files:
- Frontend/react-app/src/packages/etl/etl.css
- Frontend/react-app/src/packages/etl/components/TargetTableSelectModal/TransformDetailRow.jsx
- docs/log/log.md

1. 2026-03-17 ETL 컬럼 변환 룰 — 날짜/시간 연산 UI·규칙 저장 전면 지원
Purpose: 컬럼 매핑에서 날짜 포맷·부분 추출·날짜 차이·나이 계산·날짜 더하기 연산을 시간대 변환과 동일하게 UI 입력 및 API rule_config 저장이 가능하도록 세팅.

Changes:
- constants.js: DATETIME_EXTRACT_PART_OPTIONS, DATETIME_DATE_DIFF_UNIT_OPTIONS, DATETIME_DEFAULT_INPUT_FORMAT, DATETIME_DEFAULT_OUTPUT_FORMAT 추가. DATETIME_OPERATION_OPTIONS 주석 수정.
- TransformDetailRow.jsx: datetime 연산별 입력 UI 추가 — date_format(입력/출력 형식), extract(추출 부분), date_diff(비교 컬럼·단위), age(설명만), date_add(일/월/년).
- TargetTableSelectModal/index.jsx: getAssembledRules에서 datetime 연산별 rule_config 필드 채우기; 규칙 로드 시 datetimeConfig 전체 복원.
- DbConnectionForm.jsx: buildAssembledRulesFromSettings에서 datetime 연산별 rule_config 동일하게 조립.

Changed files:
- Frontend/react-app/src/packages/etl/components/TargetTableSelectModal/constants.js
- Frontend/react-app/src/packages/etl/components/TargetTableSelectModal/TransformDetailRow.jsx
- Frontend/react-app/src/packages/etl/components/TargetTableSelectModal/index.jsx
- Frontend/react-app/src/packages/etl/components/DbConnectionForm.jsx
- docs/log/log.md (신규)
