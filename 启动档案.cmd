@echo off
cd /d "%~dp0"
if exist "%~dp0node.exe" ("%~dp0node.exe" scripts\start-local.mjs --open) else (node scripts\start-local.mjs --open)
if errorlevel 1 pause
