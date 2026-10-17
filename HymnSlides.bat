@echo off
rem Double-click this file to open the HymnSlides window.
cd /d "%~dp0"
if exist python-path.txt (
  set /p PYEXE=<python-path.txt
) else (
  set "PYEXE=python"
)
"%PYEXE%" -c "import hymnslides" >nul 2>nul && ("%PYEXE%" -m hymnslides gui & exit /b)
echo.
echo   HymnSlides is not installed yet.
echo   Double-click INSTALL.bat in this folder first.
echo.
pause
