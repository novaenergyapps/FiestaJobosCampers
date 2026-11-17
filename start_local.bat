@echo off
title Fiesta de Navidad - Jobos Campers Park (Localhost Port 5180)
echo ==============================================================
echo   Iniciando Informe de Ingresos y Gastos - Fiesta de Navidad
echo   Jobos Campers Park (Puerto 5180)
echo ==============================================================
cd /d "%~dp0"

if not exist "node_modules" (
    echo Instalando dependencias...
    call npm install
)

echo Abriendo navegador en http://localhost:5180 ...
start http://localhost:5180

echo Iniciando servidor Vite en el puerto 5180...
call npm run dev -- --port 5180
pause
