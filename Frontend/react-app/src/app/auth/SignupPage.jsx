/**
 * app/auth/SignupPage.jsx (초대 코드 회원가입)
 * ====================================
 * POST /api/auth/signup — invite_code, email, password, nickname. 성공 시 로그인 안내·/login 이동.
 *
 * [Main Functions]
 * ===========
 * - SignupPage
 *
 * [Dependencies]
 * =========
 * - react-router-dom, shared/api/authClient
 */

import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import { getInviteValidate, postSignup } from '@/shared/api/authClient.js'

import { useAuth } from './AuthContext.jsx'
import './login.css'

export default function SignupPage() {
  const { me, loading } = useAuth()
  const navigate = useNavigate()
  const [inviteCode, setInviteCode] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [inviteHint, setInviteHint] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

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
    const c = inviteCode.trim()
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
      const parts = [row.dptmt_name, row.email, row.invite_target_dvsn].filter(Boolean)
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
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
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
              onChange={(ev) => setPassword(ev.target.value)}
              required
              minLength={10}
              className="login-page__input"
            />
          </label>
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
          {' · '}
          <Link to="/create-org">부서 새로 만들기</Link>
        </p>
      </div>
    </div>
  )
}
