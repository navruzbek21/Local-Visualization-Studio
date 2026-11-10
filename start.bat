@echo off
rem Запуск Visualization Studio (Windows). Портативный Node.js можно положить в папку node\
chcp 65001 >nul
cd /d "%~dp0"
set NODE=node
if exist "node\node.exe" set NODE=node\node.exe
"%NODE%" server.js
pause
