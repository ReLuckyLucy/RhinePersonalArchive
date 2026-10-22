@echo off
cd /d "%~dp0"
if exist "%~dp0node.exe" ("%~dp0node.exe" scripts\stop-local.mjs) else (node scripts\stop-local.mjs)
if errorlevel 1 pause
