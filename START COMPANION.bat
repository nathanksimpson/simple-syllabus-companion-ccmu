@echo off
cd /d "%~dp0"
echo Syllabus Companion — starting local server on http://localhost:8090
echo.
if not exist "vendor\ccmu\js\syllabus-table.js" (
    echo Vendor files missing. Running sync from Class Calendar...
    call npm run sync:ccmu
)
start http://localhost:8090
npm start
