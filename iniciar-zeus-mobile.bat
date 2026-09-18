@echo off
setlocal EnableExtensions
title ZEUS Finance - Atualizar e Acesso Mobile
color 0A

cd /d "%~dp0"

echo ================================================
echo   ZEUS FINANCE - ATUALIZAR + ACESSO MOBILE
echo ================================================
echo.

if not exist "package.json" (
  echo ERRO: package.json nao encontrado.
  echo Coloque este arquivo na raiz do projeto zeus-finance.
  pause
  exit /b 1
)

if not exist ".git" (
  echo ERRO: repositorio Git nao encontrado nesta pasta.
  echo Coloque este arquivo na raiz do repositorio zeus-finance.
  pause
  exit /b 1
)

where git >nul 2>&1
if errorlevel 1 (
  echo ERRO: Git nao foi encontrado no PATH.
  pause
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  echo ERRO: Node.js nao foi encontrado no PATH.
  echo Instale o Node.js 24 e tente novamente.
  pause
  exit /b 1
)

echo [1/7] Solicitando permissao de Administrador...
net session >nul 2>&1
if errorlevel 1 (
  echo O Windows exibira o UAC.
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
echo OK.
echo.

echo [2/7] Encerrando servidor antigo na porta 5173...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":5173" ^| findstr "LISTENING"') do (
  echo Encerrando PID %%P...
  taskkill /PID %%P /F >nul 2>&1
)
echo OK.
echo.

echo [3/7] Mudando para a branch main...
git switch main
if errorlevel 1 (
  echo.
  echo ERRO ao mudar para a branch main.
  echo Verifique se existem alteracoes locais pendentes.
  pause
  exit /b 1
)
echo.

echo [4/7] Atualizando o projeto pelo GitHub...
git pull origin main
if errorlevel 1 (
  echo.
  echo ERRO durante o git pull.
  echo Pode haver alteracoes locais ou conflito de arquivos.
  pause
  exit /b 1
)
echo.

echo [5/7] Liberando TCP 5173 apenas em redes privadas...
netsh advfirewall firewall delete rule name="ZEUS Finance - Porta 5173" >nul 2>&1
netsh advfirewall firewall add rule name="ZEUS Finance - Porta 5173" dir=in action=allow protocol=TCP localport=5173 profile=private >nul
if errorlevel 1 (
  echo.
  echo ERRO: nao foi possivel configurar o Firewall.
  pause
  exit /b 1
)
echo OK.
echo.

echo [6/7] Instalando/atualizando dependencias...
call npm install
if errorlevel 1 (
  echo.
  echo ERRO durante o npm install.
  pause
  exit /b 1
)
echo.

echo [7/7] Iniciando o ZEUS Finance...
echo.
echo ================================================
echo COMPUTADOR E CELULAR DEVEM ESTAR NO MESMO WI-FI.
echo O terminal mostrara:
echo.
echo   Computador: http://localhost:5173
echo   Celular:    http://SEU-IP:5173
echo.
echo Abra no celular exatamente o endereco "Celular:".
echo Para encerrar o servidor, pressione Ctrl+C.
echo ================================================
echo.

call npm start

echo.
echo Servidor encerrado.
pause
