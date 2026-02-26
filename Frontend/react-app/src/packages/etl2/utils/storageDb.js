/**
 * packages/etl2/utils/storageDb.js (저장 DB 선택 값 통일)
 * ==========================================================
 * 파일 업로드·DB 연결·배치 Job 등에서 "기본 DB" vs "저장 DB 연결" 처리를 하나의 규칙으로 통일.
 * 기본 DB = config 기반 ibank_db. 절대 "첫 번째 연결 ID"로 대체하지 않음.
 *
 * [규칙]
 * - UI "기본 DB" option value = "" (빈 문자열).
 * - API 전송: 기본 DB일 때 null, 그 외에는 연결 ID(숫자). JSON body에는 항상 storage_connection_id 필드 포함(값 null 또는 숫자).
 * - FormData(multipart): 기본 DB일 때는 storage_connection_id 키를 append하지 않음.
 *
 * [Main]
 * - normalizeStorageConnectionId(uiValue) → null | number. 폼/셀렉트 값 → API·body용. ''/null/undefined → null, 그 외 Number.
 * - getStorageConnectionIdForFormData(uiValue) → null | number. FormData에 넣을 때만 사용; null이면 append 안 함.
 */

/**
 * 셀렉트/폼 값(빈 문자열, null 등)을 API용 storage_connection_id로 정규화.
 * 기본 DB = null, 그 외 = 연결 ID(숫자). JSON body에 항상 이 값을 넣음 (null이어도 필드 포함).
 * @param {string|number|null|undefined} uiValue - 셀렉트 value 또는 state
 * @returns {null|number}
 */
export function normalizeStorageConnectionId(uiValue) {
  if (uiValue === '' || uiValue == null || uiValue === undefined) return null;
  const n = Number(uiValue);
  return Number.isNaN(n) ? null : n;
}

/**
 * FormData에 storage_connection_id를 넣을 때 사용. 기본 DB(null)이면 append하지 말고, 숫자일 때만 append.
 * @param {string|number|null|undefined} uiValue
 * @returns {{ append: boolean, value: null|number }} append가 true일 때만 form.append('storage_connection_id', String(value))
 */
export function getStorageConnectionIdForFormData(uiValue) {
  const id = normalizeStorageConnectionId(uiValue);
  return { append: id !== null, value: id };
}
