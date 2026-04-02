/**
 * shared/utils/passwordPolicy.js (비밀번호 정책 — 프론트 사전 검증)
 * ============================================================
 * Backend.auth_server.security.validate_password_strength 와 동일 규칙.
 * 10자 이상, 영문 대·소문자·숫자·특수문자 각 1자 이상.
 *
 * [Main Functions]
 * ===========
 * - getPasswordStrengthError: 위반 시 한글 메시지, 통과 시 null
 *
 * [Dependencies]
 * =========
 * - 없음
 */

const RE_UPPER = /[A-Z]/
const RE_LOWER = /[a-z]/
const RE_DIGIT = /\d/
// Backend security._RE_SPECIAL 과 동일 문자 집합
const RE_SPECIAL = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/

/**
 * @param {string} plain
 * @returns {string | null} 오류 메시지 또는 null(통과)
 */
export function getPasswordStrengthError(plain) {
  if (!plain || plain.length < 10) {
    return '비밀번호는 10자 이상이어야 합니다.'
  }
  if (!RE_UPPER.test(plain)) {
    return '비밀번호에 영문 대문자를 1자 이상 포함해 주세요.'
  }
  if (!RE_LOWER.test(plain)) {
    return '비밀번호에 영문 소문자를 1자 이상 포함해 주세요.'
  }
  if (!RE_DIGIT.test(plain)) {
    return '비밀번호에 숫자를 1자 이상 포함해 주세요.'
  }
  if (!RE_SPECIAL.test(plain)) {
    return '비밀번호에 특수문자를 1자 이상 포함해 주세요. (!, @, #, $ 등)'
  }
  return null
}
