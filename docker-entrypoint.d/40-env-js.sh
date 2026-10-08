#!/bin/sh
set -e

cat > /usr/share/nginx/html/env.js <<JS
window.__env = { apiBase: "${API_BASE:-}" };
JS

echo "[40-env-js] configuração da API gerada"
