#!/bin/bash
# =============================================================================
# deploy.sh - 리눅스 서버 일괄 배포 (빌드 + report-api/report-front 재시작)
# =============================================================================
# 사용: /root/report 에서 실행
#   chmod +x deploy.sh
#   ./deploy.sh
#   (systemctl 재시작에 sudo 필요 시) sudo ./deploy.sh
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
REACT_APP_DIR="$PROJECT_ROOT/Frontend/react-app"

echo "=========================================="
echo "  Report 배포: 빌드 + 서비스 재시작"
echo "=========================================="
echo "프로젝트 경로: $PROJECT_ROOT"
echo ""

# 1) Frontend 의존성 설치 후 빌드
echo "[1/3] Frontend/react-app 의존성 설치 및 빌드..."
cd "$REACT_APP_DIR"
if ! npm install; then
  echo "오류: npm install 실패" >&2
  exit 1
fi
if ! npm run build; then
  echo "오류: npm run build 실패" >&2
  exit 1
fi
cd "$PROJECT_ROOT"
echo "빌드 완료."
echo ""

# 2) report-api 재시작
echo "[2/3] report-api 재시작..."
if command -v systemctl >/dev/null 2>&1; then
  sudo systemctl restart report-api || { echo "경고: report-api 재시작 실패" >&2; exit 1; }
  echo "report-api 재시작 완료."
else
  echo "경고: systemctl 없음, report-api 재시작 생략"
fi
echo ""

# 3) report-front 재시작
echo "[3/3] report-front 재시작..."
if command -v systemctl >/dev/null 2>&1; then
  sudo systemctl restart report-front || { echo "경고: report-front 재시작 실패" >&2; exit 1; }
  echo "report-front 재시작 완료."
else
  echo "경고: systemctl 없음, report-front 재시작 생략"
fi
echo ""

echo "=========================================="
echo "  배포 완료. 상태 확인: sudo systemctl status report-api report-front"
echo "=========================================="
