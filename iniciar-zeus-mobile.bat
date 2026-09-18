@echo off
setlocal
title ZEUS Finance - Acesso Mobile
color 0A

cd /d "%~dp0"

echo ==========================================
echo       ZEUS FINANCE - ACESSO MOBILE
echo ==========================================
echo.

if not exist "package.json" (
  echo ERRO: coloque este arquivo na raiz do projeto zeus-finance.
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

echo [1/4] Verificando permissao do Firewall...
net session >nul 2>&1
if errorlevel 1 (
  echo.
  echo Este passo precisa de permissao de Administrador apenas para
  echo liberar a porta 5173 em redes PRIVADAS do Windows.
  echo O Windows exibira a confirmacao do UAC.
  echo.
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

echo [2/4] Liberando TCP 5173 somente em redes privadas...
netsh advfirewall firewall delete rule name="ZEUS Finance - Porta 5173" >nul 2>&1
netsh advfirewall firewall add rule name="ZEUS Finance - Porta 5173" dir=in action=allow protocol=TCP localport=5173 profile=private >nul
if errorlevel 1 (
  echo ERRO: nao foi possivel configurar o Firewall.
  pause
  exit /b 1
)
echo OK.
echo.

echo [3/4] Atualizando dependencias...
call npm install
if errorlevel 1 (
  echo ERRO durante o npm install.
  pause
  exit /b 1
)
echo.

echo [4/4] Iniciando o ZEUS Finance...
echo.
echo IMPORTANTE:
echo - Computador e celular devem estar na mesma rede Wi-Fi.
echo - O terminal mostrara uma linha "Celular:" com o endereco.
echo - Digite esse endereco no navegador do celular.
echo.

call npm start

echo.
echo Servidor encerrado.
pause
