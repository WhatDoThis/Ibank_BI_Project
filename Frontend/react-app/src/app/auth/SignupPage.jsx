/**
 * app/auth/SignupPage.jsx (초대 코드 회원가입)
 * ====================================
 * POST /api/auth/signup — invite_code, email, password, nickname. 성공 시 로그인 안내·/login 이동.
 * 초대 메일 링크(`/signup?code=…`, 서버 invite_user_by_email과 동일) 접속 시 쿼리의 code·invite_code를 초대 코드 입력에 반영하고 유효성 힌트를 자동 조회.
 * 비밀번호 확인·정책 검증(shared/utils/passwordPolicy) 후 가입 확인 다이얼로그.
 *
 * [Main Functions]
 * ===========
 * - SignupPage
 *
 * [Dependencies]
 * =========
 * - react-router-dom(useSearchParams), shared/api/authClient, shared/utils/crudConfirm, shared/utils/passwordPolicy, shared/utils/userDvsnDisplay(formatUserDvsnDisplay)
 */

import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'

import { getInviteValidate, postSignup } from '@/shared/api/authClient.js'
import { confirmCrud } from '@/shared/utils/crudConfirm.js'
import { getPasswordStrengthError } from '@/shared/utils/passwordPolicy.js'
import { formatUserDvsnDisplay } from '@/shared/utils/userDvsnDisplay.js'

import { useAuth } from './AuthContext.jsx'
import './login.css'

export default function SignupPage() {
  const { me, loading } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [inviteCode, setInviteCode] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [nickname, setNickname] = useState('')
  const [inviteHint, setInviteHint] = useState('')
  const [error, setError] = useState('')
  const [pwdCheckHint, setPwdCheckHint] = useState('')
  const [pwdCheckOk, setPwdCheckOk] = useState(false)
  const [busy, setBusy] = useState(false)

  const applyInviteValidation = useCallback(async (raw) => {
    const c = String(raw || '').trim()
    if (!c) {
      setInviteHint('')
      return
    }
    try {
      const row = await getInviteValidate(c)
      if (!row.valid) {
        setInviteHint(
          row.reason === 'used'
            ? '이미 사용된 초대 코드입니다.'
            : row.reason === 'expired'
              ? '만료된 초대 코드입니다.'
              : '초대 코드를 찾을 수 없습니다.',
        )
        return
      }
      const parts = [
        row.dptmt_name,
        row.email,
        row.invite_target_dvsn != null && String(row.invite_target_dvsn).trim() !== ''
          ? formatUserDvsnDisplay(row.invite_target_dvsn)
          : '',
      ].filter(Boolean)
      const extra = []
      if (row.invite_etl_yn === 'Y') extra.push('ETL 자격 포함')
      if (row.has_project_attachment) {
        const pName = row.invite_project_name || '프로젝트'
        const rName = row.invite_pmssn_name || '역할'
        extra.push(`${pName} 프로젝트에 ${rName} 역할로 자동 등록`)
      }
      const base = parts.length ? `부서·역할: ${parts.join(' · ')}` : '초대가 유효합니다.'
      setInviteHint(extra.length ? `${base} (${extra.join(', ')})` : base)
    } catch {
      setInviteHint('초대 코드 확인에 실패했습니다.')
    }
  }, [])

  useEffect(() => {
    if (loading || me) return
    const q =
      (searchParams.get('code') || searchParams.get('invite_code') || '').trim()
    if (!q) return
    setInviteCode(q)
    void applyInviteValidation(q)
  }, [loading, me, searchParams, applyInviteValidation])

  if (loading) {
    return (
      <div className="login-page">
        <div className="login-page__card">로딩 중…</div>
      </div>
    )
  }

  if (me) {
    return <Navigate to="/" replace />
  }

  async function handleBlurInvite() {
    await applyInviteValidation(inviteCode)
  }

  function clearPwdCheckFeedback() {
    setPwdCheckHint('')
    setPwdCheckOk(false)
  }

  function handleVerifyPasswordClick() {
    setError('')
    clearPwdCheckFeedback()
    if (password !== passwordConfirm) {
      setPwdCheckHint('비밀번호가 일치하지 않습니다.')
      return
    }
    const strengthErr = getPasswordStrengthError(password)
    if (strengthErr) {
      setPwdCheckHint(strengthErr)
      return
    }
    setPwdCheckOk(true)
    setPwdCheckHint('비밀번호가 정책을 만족하고 두 입력이 일치합니다. 가입하기를 눌러 계속하세요.')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.')
      clearPwdCheckFeedback()
      return
    }
    const strengthErr = getPasswordStrengthError(password)
    if (strengthErr) {
      setError(strengthErr)
      clearPwdCheckFeedback()
      return
    }
    if (!confirmCrud('입력한 정보로 회원가입을 완료할까요?')) return
    setBusy(true)
    try {
      await postSignup({
        invite_code: inviteCode.trim(),
        email: email.trim(),
        password,
        nickname: nickname.trim(),
      })
      navigate('/login', { replace: true, state: { signupOk: true } })
    } catch (err) {
      setError(err?.message || '가입 실패')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-page__card">
        <h1 className="login-page__title">초대 코드로 가입</h1>
        <form onSubmit={handleSubmit} className="login-page__form">
          <label className="login-page__label">
            초대 코드
            <input
              type="text"
              value={inviteCode}
              onChange={(ev) => setInviteCode(ev.target.value)}
              onBlur={handleBlurInvite}
              required
              className="login-page__input"
              autoComplete="off"
            />
          </label>
          {inviteHint ? <p className="login-page__hint">{inviteHint}</p> : null}
          <label className="login-page__label">
            이메일
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              required
              className="login-page__input"
            />
          </label>
          <label className="login-page__label">
            비밀번호 (10자 이상, 영문 대·소문자·숫자·특수문자)
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(ev) => {
                setPassword(ev.target.value)
                clearPwdCheckFeedback()
              }}
              required
              minLength={10}
              className="login-page__input"
            />
          </label>
          <label className="login-page__label">
            비밀번호 확인
            <input
              type="password"
              autoComplete="new-password"
              value={passwordConfirm}
              onChange={(ev) => {
                setPasswordConfirm(ev.target.value)
                clearPwdCheckFeedback()
              }}
              required
              minLength={10}
              className="login-page__input"
            />
          </label>
          <button
            type="button"
            className="login-page__submit login-page__submit--secondary"
            onClick={handleVerifyPasswordClick}
          >
            비밀번호 조건·일치 검증
          </button>
          {pwdCheckHint ? (
            <p
              className={
                pwdCheckOk ? 'login-page__hint login-page__hint--ok' : 'login-page__error'
              }
            >
              {pwdCheckHint}
            </p>
          ) : null}
          <label className="login-page__label">
            닉네임 (선택)
            <input
              type="text"
              value={nickname}
              onChange={(ev) => setNickname(ev.target.value)}
              className="login-page__input"
            />
          </label>
          {error ? <p className="login-page__error">{error}</p> : null}
          <button type="submit" disabled={busy} className="login-page__submit">
            {busy ? '처리 중…' : '가입하기'}
          </button>
        </form>
        <p className="login-page__links">
          <Link to="/login">로그인</Link>
        </p>
      </div>
    </div>
  )
}
