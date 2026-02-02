@echo off
chcp 65001 >nul
echo ========================================
echo  스타벅스 CRM 노코드 쿼리 빌더
echo ========================================
echo.
echo [1] API 서버 (5000) 와 웹 서버 (8888) 를 각각 새 창에서 실행합니다.
echo     브라우저에서 http://localhost:8888 접속
echo.
start "API 서버" cmd /k "cd /d %~dp0 && python api_server.py"
timeout /t 2 /nobreak >nul
start "웹 서버" cmd /k "cd /d %~dp0 && python serve.py"
echo.
echo 두 창이 열렸습니다. 브라우저에서 http://localhost:8888 를 열어주세요.
pause
