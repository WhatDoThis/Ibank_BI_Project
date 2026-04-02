/**
 * packages/etl/utils/storageDb.js (저장 DB 선택 값 통일)
 * ==========================================================
 * 파일 업로드·DB 연결·배치 Job 등에서 "기본 DB" vs "저장 DB 연결" 처리를 하나의 규칙으로 통일.
 * 내장 저장소: main(config.main_db, API null)·dash(config.dash_db, API -1). 등록 연결은 etl_storage_connections. 첫 번째 연결 ID로 main을 대체하지 않음.
 *
 * [규칙]
 * - UI "기본 DB (main)" option value = "" (빈 문자열) → API null (config.main_db).
 * - UI "기본 DB (dash)" option value = "-1" → API 정수 -1 (config.dash_db). STORAGE_BUILTIN_DASH_ID와 동일.
 * - 그 외 저장 연결은 etl_storage_connections 의 양수 ID. JSON body에 storage_connection_id 필드 항상 포함.
 * - FormData(multipart): main(null)일 때만 키 생략; dash(-1) 및 양수 ID는 append.
 *
 * [Main Functions]
 * ===========
 * 1. normalizeStorageConnectionId(uiValue) → null | number. ''/null/undefined → null, '-1' → STORAGE_BUILTIN_DASH_ID, 그 외 숫자.
 * 2. getStorageConnectionIdForFormData(uiValue) → FormData용; main(null)만 append 생략, dash(-1)은 append.
 * 3. formatEtlStorageLabel(id, name) → 목록·툴팁용 표시 문자열(main/dash/등록 연결).
 * 4. getEtlStorageSelectOptions(apiList) → 셀렉트용 {key,value,label}[] (API 내장 행 + 등록 연결; 구 서버는 폴백 옵션).
 */

/** API·DB와 동일: 내장 dash 저장소 (config.dash_db) */
export const STORAGE_BUILTIN_DASH_ID = -1;

// 1.
/**
 * 셀렉트/폼 값(빈 문자열, null 등)을 API용 storage_connection_id로 정규화.
 * 기본 DB = null, 그 외 = 연결 ID(숫자). JSON body에 항상 이 값을 넣음 (null이어도 필드 포함).
 * @param {string|number|null|undefined} uiValue - 셀렉트 value 또는 state
 * @returns {null|number}
 */
export function normalizeStorageConnectionId(uiValue) {
  if (uiValue === '' || uiValue == null || uiValue === undefined) return null;
  const n = Number(uiValue);
  if (Number.isNaN(n)) return null;
  if (n === STORAGE_BUILTIN_DASH_ID) return STORAGE_BUILTIN_DASH_ID;
  return n;
}

// 2.
/**
 * FormData에 storage_connection_id를 넣을 때 사용. 기본 DB(null)이면 append하지 말고, 숫자일 때만 append.
 * @param {string|number|null|undefined} uiValue
 * @returns {{ append: boolean, value: null|number }} append가 true일 때만 form.append('storage_connection_id', String(value))
 */
export function getStorageConnectionIdForFormData(uiValue) {
  const id = normalizeStorageConnectionId(uiValue);
  return { append: id !== null, value: id };
}

/** 목록·툴팁용 표시 문자열 */
export function formatEtlStorageLabel(storageConnectionId, connectionName) {
  if (storageConnectionId == null || storageConnectionId === '') {
    return connectionName || '기본 DB (main)';
  }
  if (Number(storageConnectionId) === STORAGE_BUILTIN_DASH_ID) {
    return connectionName || '기본 DB (dash)';
  }
  return connectionName || `저장 DB #${storageConnectionId}`;
}

// 4.
/**
 * GET /api/etl/storage-connections 결과로 저장 DB 셀렉트 옵션 생성.
 * @param {unknown} connectionsFromApi - storage_connections 배열
 * @returns {{ key: string, value: string, label: string }[]}
 */
export function getEtlStorageSelectOptions(connectionsFromApi) {
  const list = Array.isArray(connectionsFromApi) ? connectionsFromApi : [];
  const hasMain = list.some(
    (c) => c && c.is_builtin && (c.storage_connection_id == null || c.storage_connection_id === undefined),
  );
  const hasDash = list.some(
    (c) => c && c.is_builtin && Number(c.storage_connection_id) === STORAGE_BUILTIN_DASH_ID,
  );

  const out = [];
  if (!hasMain) {
    out.push({
      key: 'fallback-main',
      value: '',
      label: '기본 DB (main · config.main_db)',
    });
  }
  if (!hasDash) {
    out.push({
      key: 'fallback-dash',
      value: String(STORAGE_BUILTIN_DASH_ID),
      label: '기본 DB (dash · config.dash_db)',
    });
  }

  for (const c of list) {
    if (!c) continue;
    const rawId = c.storage_connection_id;
    const isBuiltin = Boolean(c.is_builtin);
    const value = rawId === null || rawId === undefined ? '' : String(rawId);
    const key =
      isBuiltin && (rawId === null || rawId === undefined)
        ? 'builtin-main'
        : isBuiltin && Number(rawId) === STORAGE_BUILTIN_DASH_ID
          ? 'builtin-dash'
          : `reg-${rawId}`;
    out.push({
      key,
      value,
      label:
        c.connection_name ||
        (rawId != null && rawId !== '' ? `저장 DB #${rawId}` : '기본 DB (main)'),
    });
  }
  return out;
}
