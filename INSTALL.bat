@echo off
setlocal
cd /d "%~dp0"
title Install HymnSlides
echo.
echo   ==========================================
echo      Installing HymnSlides - please wait
echo   ==========================================
echo.

rem HymnSlides needs Python 3.11, 3.12 or 3.13. Newer versions (3.14, 3.15)
rem do not have all the parts it needs yet, so they are skipped.
call :findpython
if defined PY goto install

echo Installing Python 3.12 for HymnSlides (your other Python stays as it is).
echo If Windows asks "Do you want to allow this app to make changes", click YES.
echo.
py install 3.12 >nul 2>nul
call :findpython
if defined PY goto install
where winget >nul 2>nul || goto nowinget
winget install -e --id Python.Python.3.12 --scope user --accept-package-agreements --accept-source-agreements
call :findpython
if defined PY goto install
echo.
echo   ------------------------------------------------------------
echo   Python 3.12 is installed.
echo   Now CLOSE this window and DOUBLE-CLICK INSTALL.bat AGAIN.
echo   ------------------------------------------------------------
pause
exit /b 0

:install
echo Using Python: %PY%
echo Installing the parts HymnSlides needs.
echo This takes a few minutes; lots of text will scroll by. That is normal.
echo.
%PY% -m pip install --upgrade pip
%PY% -m pip install --only-binary=:all: -e .
if errorlevel 1 goto failed
rem Remember which Python to use, for HymnSlides.bat.
%PY% -c "import sys; print(sys.executable)" > python-path.txt

rem Put a HymnSlides icon on the Desktop.
powershell -NoProfile -Command "$s = (New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop') + '\HymnSlides.lnk'); $s.TargetPath = '%~dp0HymnSlides.bat'; $s.WorkingDirectory = '%~dp0'; $s.Save()" >nul 2>nul

echo.
echo   ==========================================
echo      DONE! HymnSlides is installed.
echo   ==========================================
echo   To start it, double-click the "HymnSlides" icon on your Desktop
echo   (or HymnSlides.bat in this folder).
echo.
pause
exit /b 0

:findpython
set "PY="
for %%V in (3.12 3.13 3.11) do (
  if not defined PY py -%%V -c "import sys" >nul 2>nul && set "PY=py -%%V"
)
if not defined PY python -c "import sys; sys.exit(0 if (3, 11) <= sys.version_info[:2] <= (3, 13) else 1)" >nul 2>nul && set "PY=python"
if not defined PY if exist "%LocalAppData%\Programs\Python\Python312\python.exe" set "PY="%LocalAppData%\Programs\Python\Python312\python.exe""
exit /b 0

:nowinget
echo.
echo   This computer cannot install Python 3.12 by itself. Please:
echo   1. Go to https://www.python.org/downloads/release/python-31210/
echo   2. Scroll down and click "Windows installer (64-bit)", then run the file.
echo   3. On the FIRST screen, tick "Add python.exe to PATH", then "Install Now".
echo   4. Then double-click INSTALL.bat again.
echo.
pause
exit /b 1

:failed
echo.
echo   Something went wrong while installing (see the text above).
echo   Check that the computer is connected to the internet, then double-click
echo   INSTALL.bat again. If it still fails, take a photo of this window and
echo   send it to whoever is helping you.
echo.
pause
exit /b 1
