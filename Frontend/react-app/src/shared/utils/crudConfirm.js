/**
 * shared/utils/crudConfirm.js (CRUD 전 확인)
 * =====================================
 * 저장·수정·삭제 등 서버/상태 반영 전 사용자 확인. 추후 커스텀 모달로 교체 시 이 함수만 갈아끼우면 됨.
 *
 * [Main Functions]
 * ===========
 * - confirmCrud(message): window.confirm 래퍼, 확인 시 true
 *
 * [Dependencies]
 * =========
 * - 없음 (브라우저 confirm)
 */

/**
 * @param {string} message
 * @returns {boolean}
 */
export function confirmCrud(message) {
  return window.confirm(message)
}
