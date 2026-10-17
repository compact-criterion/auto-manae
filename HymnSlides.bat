@echo off
rem Double-click this file to open the HymnSlides window.
cd /d "%~dp0"
python -c "import hymnslides" >nul 2>nul && (python -m hymnslides gui & exit /b)
py -3 -c "import hymnslides" >nul 2>nul && (py -3 -m hymnslides gui & exit /b)
echo.
echo   HymnSlides is not installed yet.
echo   Double-click INSTALL.bat in this folder first.
echo.
pause
