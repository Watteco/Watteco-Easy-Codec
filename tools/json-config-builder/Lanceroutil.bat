@echo off
setlocal

cd /d "%~dp0"
title Outils Easy Codec

set "PYTHON_EXE="
set "PYTHON_ARGS="

if exist "C:\Python314\python.exe" (
    set "PYTHON_EXE=C:\Python314\python.exe"
) else (
    py -3.14 --version >nul 2>&1
    if not errorlevel 1 (
        set "PYTHON_EXE=py"
        set "PYTHON_ARGS=-3.14"
    )
)

if not defined PYTHON_EXE (
    python --version >nul 2>&1
    if not errorlevel 1 set "PYTHON_EXE=python"
)

if not defined PYTHON_EXE (
    echo Python introuvable.
    echo.
    echo Installe Python 3.14 ou ajoute Python au PATH.
    pause
    exit /b 1
)

"%PYTHON_EXE%" %PYTHON_ARGS% -m streamlit --version >nul 2>&1
if errorlevel 1 (
    echo Streamlit n'est pas installe pour ce Python :
    echo   "%PYTHON_EXE%" %PYTHON_ARGS%
    echo.
    echo Installation des dependances :
    echo   "%PYTHON_EXE%" %PYTHON_ARGS% -m pip install -r "%~dp0requirements.txt"
    echo.
    pause
    exit /b 1
)

if not exist "%~dp0app.py" (
    echo Fichier introuvable : "%~dp0app.py"
    pause
    exit /b 1
)

if not exist "%~dp0app2.py" (
    echo Fichier introuvable : "%~dp0app2.py"
    pause
    exit /b 1
)

echo Choisis l'outil a lancer :
echo.
echo   1 - Easy Codec JSON Builder
echo   2 - ROM Config Finder
echo   3 - Lancer les deux
echo.
set /p "CHOICE=Ton choix [1/2/3] : "

if "%CHOICE%"=="3" goto both
if "%CHOICE%"=="2" goto rom_config
goto json_builder

:json_builder
title Easy Codec JSON Builder
echo.
echo Demarrage de Easy Codec JSON Builder...
echo Le navigateur va s'ouvrir sur http://localhost:8501
echo Cette fenetre va se fermer.
echo.

powershell -NoProfile -WindowStyle Hidden -Command "Start-Process -FilePath '%PYTHON_EXE%' -ArgumentList '%PYTHON_ARGS% -m streamlit run %~dp0app.py --server.port=8501 --server.headless=false --browser.gatherUsageStats=false' -WorkingDirectory '%~dp0' -WindowStyle Minimized"
goto end

:rom_config
title ROM Config Finder
echo.
echo Demarrage de ROM Config Finder...
echo Le navigateur va s'ouvrir sur http://localhost:8502
echo Cette fenetre va se fermer.
echo.

powershell -NoProfile -WindowStyle Hidden -Command "Start-Process -FilePath '%PYTHON_EXE%' -ArgumentList '%PYTHON_ARGS% -m streamlit run %~dp0app2.py --server.port=8502 --server.headless=false --browser.gatherUsageStats=false' -WorkingDirectory '%~dp0' -WindowStyle Minimized"
goto end

:both
title Outils Easy Codec
echo.
echo Demarrage de app.py sur http://localhost:8501
echo Demarrage de app2.py sur http://localhost:8502
echo Cette fenetre va se fermer.
echo.
powershell -NoProfile -WindowStyle Hidden -Command "Start-Process -FilePath '%PYTHON_EXE%' -ArgumentList '%PYTHON_ARGS% -m streamlit run %~dp0app.py --server.port=8501 --server.headless=true --browser.gatherUsageStats=false' -WorkingDirectory '%~dp0' -WindowStyle Minimized"
ping -n 3 127.0.0.1 >nul
powershell -NoProfile -WindowStyle Hidden -Command "Start-Process -FilePath '%PYTHON_EXE%' -ArgumentList '%PYTHON_ARGS% -m streamlit run %~dp0app2.py --server.port=8502 --server.headless=false --browser.gatherUsageStats=false' -WorkingDirectory '%~dp0' -WindowStyle Minimized"
goto end

:end
exit /b 0
