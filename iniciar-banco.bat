@echo off
title Smart-Base - Inicializador do Banco de Dados
echo ================================================================================
echo    Iniciando PostgreSQL 16 (pgvector) e pgAdmin 4 no Docker (WSL2)...
echo ================================================================================
echo.

REM Inicia o processo em segundo plano do WSL para mantê-lo ativo
powershell -NoProfile -Command "Start-Process wsl.exe -ArgumentList '-d','Ubuntu-24.04','-u','root','--','sleep','infinity' -WindowStyle Hidden"

REM Garante o servico do Docker e inicia os conteineres do banco
wsl -d Ubuntu-24.04 -u root -- bash -c "service docker status >/dev/null 2>&1 || service docker start; docker start smartbase-postgres smartbase-pgadmin"

echo.
echo ================================================================================
echo   [OK] Banco de Dados e Servicos Ativos com Sucesso!
echo.
echo   - PostgreSQL 16 (pgvector): localhost:5432
echo   - pgAdmin 4: http://localhost:5050 (ou http://127.0.0.1:5050)
echo   - Prisma Studio: npx prisma studio (http://localhost:5555)
echo   - Web Demo: npm run web (http://localhost:3000)
echo ================================================================================
echo.
pause
