@echo off
chcp 65001 >nul
echo ========================================
echo   🌐 เริ่มต้น Local Server
echo ========================================
echo.
echo กำลังเปิด HTTP Server บน Port 8080...
echo.
echo เปิดเบราว์เซอร์ไปที่: http://localhost:8080
echo.
echo กด Ctrl+C เพื่อปิด Server
echo ========================================
echo.

REM Check if Python is available
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python ยังไม่ถูกติดตั้ง
    echo กรุณาติดตั้ง Python จาก https://www.python.org/downloads/
    pause
    exit /b 1
)

REM Start Python HTTP server
python -m http.server 8080

pause
