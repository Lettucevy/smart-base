@echo off
REM Wrapper para executar o docker-compose nativamente via WSL2 (Ubuntu-24.04) no Windows
REM Mantém a VM do WSL2 ativa em segundo plano para que os contêineres continuem rodando
powershell -NoProfile -Command "if (-not (Get-Process wsl -ErrorAction SilentlyContinue)) { Start-Process wsl -ArgumentList '-d','Ubuntu-24.04','-u','root','--','sleep','infinity' -WindowStyle Hidden }"
wsl -d Ubuntu-24.04 -u root -- bash -c "service docker status >/dev/null 2>&1 || service docker start >/dev/null 2>&1; docker compose %*"
