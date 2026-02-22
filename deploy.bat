@echo off
chcp 65001 >nul
echo ========================================
echo   🚀 Git Setup & Deploy to GitHub
echo ========================================
echo.

REM Check if git is installed
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Git ยังไม่ถูกติดตั้ง
    echo.
    echo กรุณาดาวน์โหลดและติดตั้ง Git จาก:
    echo https://git-scm.com/download/win
    echo.
    echo หลังจากติดตั้งแล้ว ให้เปิด PowerShell ใหม่แล้วรันสคริปต์นี้อีกครั้ง
    pause
    exit /b 1
)

echo ✅ Git version:
git --version
echo.

REM Check if already initialized
if exist .git (
    echo ⚠️  Git repository มีอยู่แล้ว
    echo.
    choice /C YN /M "ต้องการ Push การเปลี่ยนแปลงใหม่หรือไม่"
    if errorlevel 2 goto :end
    goto :push_changes
)

echo 📦 กำลัง Initialize Git Repository...
git init
if %errorlevel% neq 0 goto :error

echo.
echo 📄 กำลังเพิ่มไฟล์ทั้งหมด...
git add .
if %errorlevel% neq 0 goto :error

echo.
echo 💾 กำลัง Commit...
git commit -m "Initial commit: VAT Tax Filing Verification System"
if %errorlevel% neq 0 goto :error

echo.
echo 🔄 กำลังเปลี่ยน branch เป็น main...
git branch -M main
if %errorlevel% neq 0 goto :error

echo.
echo 🔗 กำลังเพิ่ม Remote Repository...
git remote add origin https://github.com/Nattapong1958/vat.git
if %errorlevel% neq 0 (
    echo ⚠️  Remote อาจมีอยู่แล้ว กำลังอัปเดต...
    git remote set-url origin https://github.com/Nattapong1958/vat.git
)

:push_changes
echo.
echo 🚀 กำลัง Push ไปยัง GitHub...
echo.
echo ⚠️  คุณอาจต้องกรอก Username และ Password/Token ของ GitHub
echo.
git push -u origin main
if %errorlevel% neq 0 goto :error

echo.
echo ========================================
echo   ✅ Deploy สำเร็จ!
echo ========================================
echo.
echo 🌐 เว็บของคุณจะพร้อมใช้งานที่:
echo    https://nattapong1958.github.io/vat/
echo.
echo 📝 ขั้นตอนต่อไป:
echo    1. ไปที่ https://github.com/Nattapong1958/vat/settings/pages
echo    2. ในส่วน Source เลือก branch "main" และ folder "/" (root)
echo    3. คลิก Save
echo    4. รอ 1-2 นาที แล้วเปิด URL ด้านบน
echo.
goto :end

:error
echo.
echo ❌ เกิดข้อผิดพลาด!
echo.
echo กรุณาตรวจสอบ:
echo  - เชื่อมต่ออินเทอร์เน็ตหรือไม่
echo  - สร้าง Repository บน GitHub แล้วหรือยัง
echo  - มีสิทธิ์ Push ไปยัง Repository หรือไม่
echo.
pause
exit /b 1

:end
echo.
pause
