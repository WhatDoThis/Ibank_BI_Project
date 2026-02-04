# Report 서버 배포 (Linux / systemd)

## 502 방지: report-front는 `run.py serve` 사용

`run.py front`는 **매번 npm run build**(수십 초) 후에 3500을 열어서, 재시작 직후 nginx가 3500에 접속하면 **502 Bad Gateway**가 난다.  
프론트 서비스는 **빌드 없이 정적 서버만** 띄우는 `run.py serve`를 쓰고, 배포 시에만 수동으로 빌드 후 재시작한다.

---

## 1. report-front.service 수정 (한 번만)

```bash
sudo nano /etc/systemd/system/report-front.service
```

**ExecStart**를 다음처럼 변경:

```ini
ExecStart=/root/report/.venv/bin/python run.py serve
```

(기존 `run.py front` → `run.py serve`)

저장 후:

```bash
sudo systemctl daemon-reload
```

---

## 2. 배포 절차 (git pull 후)

```bash
cd /root/report
git pull

# 프론트 코드가 바뀐 경우에만: 빌드 후 재시작
cd /root/report/Frontend/react-app
npm run build
cd /root/report
sudo systemctl restart report-front

# API만 바뀐 경우
sudo systemctl restart report-api
```

재시작 후 곧바로 3500에서 응답하므로 502가 나지 않는다.

---

## 3. 상태 확인

```bash
sudo systemctl status report-api report-front
ss -tlnp | grep -E '3500|8500'
```

---

## 4. 502 Bad Gateway 발생 시 점검 (순서대로)

502 = **nginx가 3500 포트에서 응답을 받지 못함**. nginx 설정이 아니라 **3500에서 우리 앱이 떠 있는지** 확인한다.

### ① config.json 포트 확인

```bash
grep -E "static_port|api_port" /root/report/Env/config/config.json
```

- **frontend.static_port** 가 **3500** 이어야 함. (8080이면 nginx는 3500으로 요청하는데 앱은 8080에서 대기 → 502)
- **backend.api_port** 가 **8500** 이어야 함.

**DB/API 설정**: `Env/config/config.json` 이 **환경 변수보다 우선**합니다. config.json 의 `backend.db_host`, `db_name`, `api_base_url` 등을 수정한 뒤에는 **반드시 `sudo systemctl restart report-api report-front`** 로 재시작해야 반영됩니다. (환경 변수 DB_HOST 등이 설정돼 있어도 config.json 값이 사용됩니다.)

### ② report-front 서비스 상태

```bash
sudo systemctl status report-front
```

- **Active: active (running)** 인지 확인.
- **ExecStart** 가 **run.py serve** 인지 확인. (`run.py front` 이면 재시작 직후 빌드 동안 3500 미개방 → 502)
- 실패 시: `journalctl -u report-front -n 50 --no-pager`

### ③ 3500 포트 리스닝 여부

```bash
ss -tlnp | grep 3500
```

- **0.0.0.0:3500** 또는 **127.0.0.1:3500** 에서 LISTEN 이 보여야 함. 없으면 report-front가 3500을 열지 않은 것.

### ④ nginx 에러 로그 (원인 확인)

```bash
tail -30 /var/log/nginx/error.log
```

- **connection refused** → 3500에 아무도 안 듣고 있음 (서비스 중지·실패 또는 다른 포트 사용).
- **upstream prematurely closed** → 3500이 연결 후 바로 끊음 (앱 크래시 등).

### ⑤ 정리

| 확인 항목 | 기대값 |
|-----------|--------|
| Env/config/config.json | frontend.static_port: **3500** |
| report-front.service | ExecStart: **run.py serve**, Active: **active (running)** |
| 포트 | **3500** 에서 LISTEN |
| nginx error.log | connection refused 등 502 원인 문구 확인 |

**conf(nginx_report.conf) 쪽**: `proxy_pass http://127.0.0.1:3500/` 가 맞으면 수정할 필요 없음. 502는 **업스트림(3500) 미응답** 때문이다.

### ⑥ exit-code 1 / activating (auto-restart) 일 때

서비스가 계속 재시작만 반복되면 `run.py serve` 또는 정적 서버가 **예외로 종료**한 것.

**에러 확인:**

```bash
journalctl -u report-front -n 80 --no-pager
```

- **"정적 디렉터리가 없습니다"** → `Frontend/react-app/dist` 없음.  
  `cd /root/report/Frontend/react-app && npm run build` 실행 후 `systemctl restart report-front`.
- **ModuleNotFoundError** → venv 활성화 또는 PYTHONPATH 문제.  
  `ExecStart` 가 `/root/report/.venv/bin/python run.py serve` 인지, `WorkingDirectory=/root/report` 인지 확인.
- **기타 traceback** → 위 로그의 마지막 예외 메시지 기준으로 조치.

**직접 실행해서 에러 확인:**

```bash
cd /root/report
source .venv/bin/activate
python run.py serve
```

(콘솔에 뜨는 오류 메시지 확인 후 Ctrl+C 로 종료)

---

## 5. 도메인 접속 시 "Load resource" 404 발생 시

**원인**: 앱이 Nginx에서 `/report/` 아래로 서비스되는데, `api-config.js`가 **도메인 루트**(`/api-config.js`)로 요청되면 Nginx의 `location /report/`에 매칭되지 않아 404가 난다.

**조치**: static_server가 index.html에 주입하는 스크립트 경로를 **상대 경로** `api-config.js`로 변경했다.  
→ 브라우저가 현재 페이지 기준으로 요청하므로 `https://도메인/report/` 접속 시 `/report/api-config.js`로 요청되고, Nginx가 `/report/`로 프록시하여 3500에서 정상 응답한다.

**적용**: 코드 반영 후 서버에서 `git pull` → (필요 시) `npm run build` → `systemctl restart report-front`.

---

## 6. Linux 서버에서 api_base_url (필수)

Nginx는 **프론트엔드**와 **API**를 서로 다른 경로로 프록시합니다.

- `location /report/` → 프론트엔드(정적 서버, 3500)
- `location /report_api/` → 백엔드 API(8500)

프론트엔드 앱이 API를 호출할 때 사용하는 주소는 **백엔드로 가는 경로**여야 합니다.

| 설정 | 설명 |
|------|------|
| **잘못된 예** | `"api_base_url": "https://ajo.sdev-ibank.co.kr/report"` → API 요청이 `/report/api/...` 로 나가서 **프론트엔드 서버(3500)** 로 전달됨 → API 실패 |
| **올바른 예** | `"api_base_url": "https://ajo.sdev-ibank.co.kr/report_api"` → API 요청이 `/report_api/api/...` 로 나가서 **백엔드(8500)** 로 전달됨 → 정상 동작 |

**조치**: Linux 서버의 `Env/config/config.json` 에서 `frontend.api_base_url` 을 **`https://도메인/report_api`** 로 설정해야 합니다. (`/report` 가 아닌 **`/report_api`**)  
수정 후 `sudo systemctl restart report-front` 로 재시작해야 반영됩니다.
