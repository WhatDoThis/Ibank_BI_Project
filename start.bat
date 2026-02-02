@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ========================================
echo  스타벅스 CRM 노코드 쿼리 빌더
echo ========================================
echo.
echo [1] 가상환경(.venv) 사용. API 서버와 웹 서버를 각각 새 창에서 실행합니다.
echo     기본: API http://localhost:5001 , 웹 http://localhost:8080
echo.
start "API 서버" cmd /k "cd /d %~dp0 && .venv\Scripts\activate && python -m Backend.api_server.main"
timeout /t 2 /nobreak >nul
start "웹 서버" cmd /k "cd /d %~dp0 && .venv\Scripts\activate && python -m Frontend.static_server.serve"
echo.
echo 두 창이 열렸습니다. 브라우저에서 http://localhost:8080 를 열어주세요.
pause
