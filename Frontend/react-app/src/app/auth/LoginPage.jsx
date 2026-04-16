/**
 * app/auth/LoginPage.jsx (이메일·비밀번호·2차 인증코드 로그인)
 * ===================================================
 * POST /api/auth/login → verify-login. 하단 링크(가입)·플래시(가입 완료·비밀번호 변경 후 재로그인 등). 성공 시 refreshMe 후 `/` 이동.
 *
 * [Main Functions]
 * ===========
 * - LoginPage
 *
 * [Dependencies]
 * =========
 * - react-router-dom, ./AuthContext, shared/api/authClient
 */

import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'

import { postLogin, postVerifyLogin } from '@/shared/api/authClient.js'

import { useAuth } from './AuthContext.jsx'
import './login.css'

export default function LoginPage() {
  const { me, loading, refreshMe } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const st = location.state
  let flash = ''
  if (st?.passwordChanged) {
    flash = '비밀번호가 변경되어 모든 세션이 종료되었습니다. 다시 로그인해 주세요.'
  } else if (st?.signupOk) {
    flash = '가입이 완료되었습니다. 로그인해 주세요.'
  }
  const [step, setStep] = useState('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [preAuthToken, setPreAuthToken] = useState('')
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

  async function handleEmailLogin(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const data = await postLogin(email.trim(), password)
      setPreAuthToken(data.pre_auth_token)
      setStep('code')
    } catch (err) {
      setError(err?.message || '로그인 실패')
    } finally {
      setBusy(false)
    }
  }

  async function handleVerify(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await postVerifyLogin(preAuthToken, code.trim())
      await refreshMe()
      navigate('/', { replace: true })
    } catch (err) {
      setError(err?.message || '인증 실패')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-page__card">
        <h1 className="login-page__title">로그인</h1>
        {flash ? <p className="login-page__flash">{flash}</p> : null}
        {step === 'email' && (
          <form onSubmit={handleEmailLogin} className="login-page__form">
            <label className="login-page__label">
              이메일
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                required
                className="login-page__input"
              />
            </label>
            <label className="login-page__label">
              비밀번호
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                required
                className="login-page__input"
              />
            </label>
            {error ? <p className="login-page__error">{error}</p> : null}
            <button type="submit" disabled={busy} className="login-page__submit">
              {busy ? '처리 중…' : '인증 코드 받기'}
            </button>
          </form>
        )}
        {step === 'code' && (
          <form onSubmit={handleVerify} className="login-page__form">
            <p className="login-page__hint">이메일로 전달된 인증 코드를 입력하세요.</p>
            <label className="login-page__label">
              인증 코드
              <input
                type="text"
                inputMode="numeric"
                value={code}
                onChange={(ev) => setCode(ev.target.value)}
                required
                className="login-page__input"
              />
            </label>
            {error ? <p className="login-page__error">{error}</p> : null}
            <button type="submit" disabled={busy} className="login-page__submit">
              {busy ? '확인 중…' : '로그인'}
            </button>
            <button
              type="button"
              className="login-page__back"
              onClick={() => {
                setStep('email')
                setCode('')
                setError('')
              }}
            >
              ← 이메일로 돌아가기
            </button>
          </form>
        )}
        <p className="login-page__links">
          <Link to="/signup">초대 코드로 가입</Link>
        </p>
      </div>
    </div>
  )
}
