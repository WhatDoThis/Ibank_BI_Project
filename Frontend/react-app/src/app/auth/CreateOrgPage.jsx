/**
 * app/auth/CreateOrgPage.jsx (부서·최초 계정 생성)
 * =======================================
 * POST /api/auth/create-org — org_name, email, password, nickname. 성공 시 /login 이동.
 *
 * [Main Functions]
 * ===========
 * - CreateOrgPage
 *
 * [Dependencies]
 * =========
 * - react-router-dom, shared/api/authClient, shared/utils/crudConfirm
 */

import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import { postCreateOrg } from '@/shared/api/authClient.js'
import { confirmCrud } from '@/shared/utils/crudConfirm.js'

import { useAuth } from './AuthContext.jsx'
import './login.css'

export default function CreateOrgPage() {
  const { me, loading } = useAuth()
  const navigate = useNavigate()
  const [orgName, setOrgName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
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

  async function handleSubmit(e) {
    e.preventDefault()
    if (!confirmCrud('부서와 최초 관리자 계정을 생성할까요? 이 작업은 되돌리기 어렵습니다.')) return
    setError('')
    setBusy(true)
    try {
      await postCreateOrg({
        org_name: orgName.trim(),
        email: email.trim(),
        password,
        nickname: nickname.trim(),
      })
      navigate('/login', { replace: true, state: { createOrgOk: true } })
    } catch (err) {
      setError(err?.message || '생성 실패')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-page__card">
        <h1 className="login-page__title">부서 새로 만들기</h1>
        <p className="login-page__hint">최초 부서명과 관리자 계정을 만듭니다.</p>
        <form onSubmit={handleSubmit} className="login-page__form">
          <label className="login-page__label">
            부서(조직) 이름
            <input
              type="text"
              value={orgName}
              onChange={(ev) => setOrgName(ev.target.value)}
              required
              maxLength={100}
              className="login-page__input"
            />
          </label>
          <label className="login-page__label">
            이메일 (관리자)
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
            {busy ? '처리 중…' : '부서 만들기'}
          </button>
        </form>
        <p className="login-page__links">
          <Link to="/login">로그인</Link>
          {' · '}
          <Link to="/signup">초대 코드로 가입</Link>
        </p>
      </div>
    </div>
  )
}
