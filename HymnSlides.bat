@echo off
rem Double-click this file to open the HymnSlides window.
cd /d "%~dp0"
python -m hymnslides gui
if errorlevel 1 (
  echo.
  echo HymnSlides could not start. See the README, "Install (Windows)".
  pause
)
