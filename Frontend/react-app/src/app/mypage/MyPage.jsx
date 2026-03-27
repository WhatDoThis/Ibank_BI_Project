/**
 * app/mypage/MyPage.jsx (마이페이지 S7)
 * =============================
 * 프로필(닉네임)·비밀번호·로그인 이력. PATCH /api/auth/me·/me/password·GET login-history.
 * 비밀번호 변경 성공 시 세션 무효 → 토큰 제거 후 /login.
 *
 * [Main Functions]
 * ===========
 * - MyPage
 *
 * [Dependencies]
 * =========
 * - react-router-dom, app/auth/AuthContext, shared/api/authClient, shared/auth/tokenStorage
 */

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  getLoginHistory,
  patchMe,
  patchPassword,
} from '@/shared/api/authClient.js'
import { clearTokens } from '@/shared/auth/tokenStorage.js'

import { useAuth } from '@/app/auth/AuthContext.jsx'
import './mypage.css'

function formatDtm(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString('ko-KR')
  } catch {
    return String(iso)
  }
}

export default function MyPage() {
  const { me, refreshMe, setMe } = useAuth()
  const navigate = useNavigate()

  const [nickname, setNickname] = useState('')
  const [profileBusy, setProfileBusy] = useState(false)
  const [profileMsg, setProfileMsg] = useState('')
  const [profileErr, setProfileErr] = useState('')

  const [curPwd, setCurPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [newPwd2, setNewPwd2] = useState('')
  const [pwdBusy, setPwdBusy] = useState(false)
  const [pwdErr, setPwdErr] = useState('')

  const [historyItems, setHistoryItems] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)

  useEffect(() => {
    if (me?.nickname != null) setNickname(me.nickname)
  }, [me?.nickname])

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const data = await getLoginHistory()
      setHistoryItems(Array.isArray(data?.items) ? data.items : [])
    } catch {
      setHistoryItems([])
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  async function handleProfileSubmit(e) {
    e.preventDefault()
    setProfileErr('')
    setProfileMsg('')
    setProfileBusy(true)
    try {
      await patchMe({ nickname: nickname.trim() })
      await refreshMe()
      setProfileMsg('저장되었습니다.')
    } catch (err) {
      setProfileErr(err?.message || '저장 실패')
    } finally {
      setProfileBusy(false)
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault()
    setPwdErr('')
    if (newPwd !== newPwd2) {
      setPwdErr('새 비밀번호가 일치하지 않습니다.')
      return
    }
    if (newPwd.length < 10) {
      setPwdErr('새 비밀번호는 10자 이상이어야 합니다.')
      return
    }
    setPwdBusy(true)
    try {
      await patchPassword(curPwd, newPwd)
      clearTokens()
      setMe(null)
      navigate('/login', { replace: true, state: { passwordChanged: true } })
    } catch (err) {
      setPwdErr(err?.message || '비밀번호 변경 실패')
    } finally {
      setPwdBusy(false)
    }
  }

  if (!me) {
    return null
  }

  return (
    <div className="mypage">
      <h1 className="mypage__title">마이페이지</h1>

      <section className="mypage__section" aria-labelledby="mypage-profile">
        <h2 id="mypage-profile" className="mypage__section-title">
          프로필
        </h2>
        <div className="mypage__row">
          <strong>이메일</strong>
          <span>{me.email || '—'}</span>
        </div>
        <div className="mypage__row">
          <strong>소속 부서</strong>
          <span>{me.dptmt_name || '—'}</span>
        </div>
        <div className="mypage__row">
          <strong>역할</strong>
          <span>{me.user_dvsn || '—'}</span>
        </div>
        <form onSubmit={handleProfileSubmit}>
          <label className="mypage__label">
            닉네임
            <input
              type="text"
              className="mypage__input"
              value={nickname}
              onChange={(ev) => setNickname(ev.target.value)}
              maxLength={100}
              autoComplete="nickname"
            />
          </label>
          {profileErr ? <p className="mypage__error">{profileErr}</p> : null}
          {profileMsg ? <p className="mypage__ok">{profileMsg}</p> : null}
          <button type="submit" className="mypage__submit" disabled={profileBusy}>
            {profileBusy ? '저장 중…' : '닉네임 저장'}
          </button>
        </form>
      </section>

      <section className="mypage__section" aria-labelledby="mypage-pwd">
        <h2 id="mypage-pwd" className="mypage__section-title">
          비밀번호 변경
        </h2>
        <p className="mypage__hint">
          변경 후 모든 기기에서 로그아웃되며, 다시 로그인해야 합니다. (10자 이상, 영문 대·소문자·숫자·특수문자)
        </p>
        <form onSubmit={handlePasswordSubmit}>
          <label className="mypage__label">
            현재 비밀번호
            <input
              type="password"
              className="mypage__input"
              value={curPwd}
              onChange={(ev) => setCurPwd(ev.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <label className="mypage__label">
            새 비밀번호
            <input
              type="password"
              className="mypage__input"
              value={newPwd}
              onChange={(ev) => setNewPwd(ev.target.value)}
              autoComplete="new-password"
              required
              minLength={10}
            />
          </label>
          <label className="mypage__label">
            새 비밀번호 확인
            <input
              type="password"
              className="mypage__input"
              value={newPwd2}
              onChange={(ev) => setNewPwd2(ev.target.value)}
              autoComplete="new-password"
              required
              minLength={10}
            />
          </label>
          {pwdErr ? <p className="mypage__error">{pwdErr}</p> : null}
          <button type="submit" className="mypage__submit" disabled={pwdBusy}>
            {pwdBusy ? '처리 중…' : '비밀번호 변경'}
          </button>
        </form>
      </section>

      <section className="mypage__section" aria-labelledby="mypage-history">
        <h2 id="mypage-history" className="mypage__section-title">
          로그인 이력 (최근 10건)
        </h2>
        {historyLoading ? (
          <p className="mypage__muted">불러오는 중…</p>
        ) : historyItems.length === 0 ? (
          <p className="mypage__muted">기록이 없습니다.</p>
        ) : (
          <div className="mypage__table-wrap">
            <table className="mypage__table">
              <thead>
                <tr>
                  <th>일시</th>
                  <th>결과</th>
                  <th>IP</th>
                  <th>클라이언트</th>
                </tr>
              </thead>
              <tbody>
                {historyItems.map((row, idx) => (
                  <tr key={`${row.create_dtm || ''}-${idx}`}>
                    <td>{formatDtm(row.create_dtm)}</td>
                    <td>
                      {(row.login_success_yn || '').toUpperCase() === 'Y'
                        ? '성공'
                        : '실패'}
                    </td>
                    <td>{row.login_trial_ip || '—'}</td>
                    <td>{row.login_trial_browser || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
