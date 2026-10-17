@echo off
setlocal
cd /d "%~dp0"
title Install HymnSlides
echo.
echo   ==========================================
echo      Installing HymnSlides - please wait
echo   ==========================================
echo.

rem 1. Find Python (3.10 or newer).
set "PY="
python -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>nul && set "PY=python"
if not defined PY py -3 -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>nul && set "PY=py -3"

if not defined PY (
  echo Python is not on this computer yet. Installing it now...
  echo If Windows asks "Do you want to allow this app to make changes", click YES.
  echo.
  where winget >nul 2>nul || goto nowinget
  winget install -e --id Python.Python.3.12 --scope user --accept-package-agreements --accept-source-agreements
  echo.
  echo   ------------------------------------------------------------
  echo   Python is installed.
  echo   Now CLOSE this window and DOUBLE-CLICK INSTALL.bat AGAIN.
  echo   ------------------------------------------------------------
  pause
  exit /b 0
)

rem 2. Install HymnSlides and the parts it needs.
echo Python found. Installing the parts HymnSlides needs.
echo This takes a few minutes; lots of text will scroll by. That is normal.
echo.
%PY% -m pip install --upgrade pip
%PY% -m pip install -e .
if errorlevel 1 goto failed

rem 3. Put a HymnSlides icon on the Desktop.
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

:nowinget
echo.
echo   This computer cannot install Python by itself. Please:
echo   1. Go to https://www.python.org/downloads/
echo   2. Click the yellow "Download Python" button and run the file.
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
