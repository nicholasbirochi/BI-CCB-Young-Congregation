@echo off
setlocal
title BI - Reuniao de Jovens e Menores (CCB)
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
  echo.
  echo [ERRO] Python nao foi encontrado neste computador.
  echo Instale o Python 3 gratuitamente em https://www.python.org/downloads/
  echo IMPORTANTE: na instalacao, marque a caixa "Add python.exe to PATH".
  echo Depois de instalar, de dois cliques neste arquivo novamente.
  echo.
  pause
  exit /b 1
)

if not exist "venv" (
  echo Configurando pela primeira vez, aguarde um instante...
  python -m venv venv
  call venv\Scripts\activate.bat
  python -m pip install --upgrade pip >nul
  pip install -r requirements.txt
  if errorlevel 1 (
    echo.
    echo [ERRO] Nao foi possivel instalar os componentes necessarios.
    echo Verifique se este computador tem internet ^(apenas para esta primeira vez^) e tente novamente.
    pause
    exit /b 1
  )
) else (
  call venv\Scripts\activate.bat
)

python app.py

echo.
echo O servidor foi encerrado.
pause
