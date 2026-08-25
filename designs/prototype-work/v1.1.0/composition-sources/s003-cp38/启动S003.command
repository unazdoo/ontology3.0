#!/bin/zsh

set -euo pipefail

WORKSPACE_DIR="${0:A:h}"
PORT="4333"
BASE_URL="http://127.0.0.1:${PORT}"
ENTRY_URL="${BASE_URL}/s001-e2e-integration/index.html?scenarioId=S003#home"

if curl --silent --fail --max-time 1 "${BASE_URL}/s001-e2e-integration/index.html" | grep -q "智财问策"; then
  open "${ENTRY_URL}"
  exit 0
fi

if command -v lsof >/dev/null 2>&1 && lsof -nP -iTCP:"${PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "端口 ${PORT} 已被其他程序占用，无法安全启动 S003。"
  echo "请关闭占用端口的服务后重新双击本启动器。"
  read -r "?按回车退出..."
  exit 1
fi

cd "${WORKSPACE_DIR}"
python3 -m http.server "${PORT}" --bind 127.0.0.1 --directory "${WORKSPACE_DIR}" &
SERVER_PID=$!
trap 'kill "${SERVER_PID}" 2>/dev/null || true' EXIT INT TERM

for _ in {1..30}; do
  if curl --silent --fail --max-time 1 "${BASE_URL}/s001-e2e-integration/index.html" | grep -q "智财问策"; then
    open "${ENTRY_URL}"
    echo "S003 已启动：${ENTRY_URL}"
    echo "请保持此窗口打开；关闭窗口即可停止本地服务。"
    wait "${SERVER_PID}"
    exit 0
  fi
  sleep 0.2
done

echo "S003 本地服务启动失败，请检查 Python 3 和端口 ${PORT}。"
read -r "?按回车退出..."
exit 1
