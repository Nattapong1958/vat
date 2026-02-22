# VAT Tax Filing System - Git Deploy Script
# PowerShell Script for deploying to GitHub

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  🚀 Git Setup & Deploy to GitHub" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if git is installed
try {
    $gitVersion = git --version
    Write-Host "✅ Git is installed: $gitVersion" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "❌ Git ยังไม่ถูกติดตั้ง" -ForegroundColor Red
    Write-Host ""
    Write-Host "กรุณาดาวน์โหลดและติดตั้ง Git จาก:" -ForegroundColor Yellow
    Write-Host "https://git-scm.com/download/win" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "หลังจากติดตั้งแล้ว ให้เปิด PowerShell ใหม่แล้วรันสคริปต์นี้อีกครั้ง" -ForegroundColor Yellow
    Read-Host "กด Enter เพื่อออก"
    exit 1
}

# GitHub repository URL
$repoUrl = "https://github.com/Nattapong1958/vat.git"
$branch = "main"

# Check if .git directory exists
if (Test-Path ".git") {
    Write-Host "⚠️  Git repository มีอยู่แล้ว" -ForegroundColor Yellow
    Write-Host ""
    $response = Read-Host "ต้องการ Push การเปลี่ยนแปลงใหม่หรือไม่? (Y/N)"
    
    if ($response -ne "Y" -and $response -ne "y") {
        Write-Host "ยกเลิกการดำเนินการ" -ForegroundColor Yellow
        Read-Host "กด Enter เพื่อออก"
        exit 0
    }
    
    # Update existing repository
    Write-Host ""
    Write-Host "📄 กำลังเพิ่มไฟล์ที่เปลี่ยนแปลง..." -ForegroundColor Cyan
    git add .
    
    Write-Host ""
    $commitMessage = Read-Host "ใส่ commit message (หรือกด Enter ใช้ข้อความ default)"
    if ([string]::IsNullOrWhiteSpace($commitMessage)) {
        $commitMessage = "Update: $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
    }
    
    Write-Host ""
    Write-Host "💾 กำลัง Commit..." -ForegroundColor Cyan
    try {
        git commit -m $commitMessage
    } catch {
        Write-Host "⚠️  ไม่มีการเปลี่ยนแปลงให้ commit" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "🚀 กำลัง Push ไปยัง GitHub..." -ForegroundColor Cyan
    git push
    
} else {
    # Initialize new repository
    Write-Host "📦 กำลัง Initialize Git Repository..." -ForegroundColor Cyan
    git init
    
    Write-Host ""
    Write-Host "📄 กำลังเพิ่มไฟล์ทั้งหมด..." -ForegroundColor Cyan
    git add .
    
    Write-Host ""
    Write-Host "💾 กำลัง Commit..." -ForegroundColor Cyan
    git commit -m "Initial commit: VAT Tax Filing Verification System"
    
    Write-Host ""
    Write-Host "🔄 กำลังเปลี่ยน branch เป็น $branch..." -ForegroundColor Cyan
    git branch -M $branch
    
    Write-Host ""
    Write-Host "🔗 กำลังเพิ่ม Remote Repository..." -ForegroundColor Cyan
    try {
        git remote add origin $repoUrl
    } catch {
        Write-Host "⚠️  Remote มีอยู่แล้ว กำลังอัปเดต..." -ForegroundColor Yellow
        git remote set-url origin $repoUrl
    }
    
    Write-Host ""
    Write-Host "🚀 กำลัง Push ไปยัง GitHub..." -ForegroundColor Cyan
    Write-Host ""
    Write-Host "⚠️  คุณอาจต้องกรอก Username และ Personal Access Token ของ GitHub" -ForegroundColor Yellow
    Write-Host "    (ไม่ใช่รหัสผ่านธรรมดา - ต้องเป็น Token)" -ForegroundColor Yellow
    Write-Host ""
    git push -u origin $branch
}

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  ✅ Deploy สำเร็จ!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "🌐 เว็บของคุณจะพร้อมใช้งานที่:" -ForegroundColor Cyan
    Write-Host "   https://nattapong1958.github.io/vat/" -ForegroundColor White
    Write-Host ""
    Write-Host "📝 ขั้นตอนต่อไป (ถ้ายังไม่ได้ทำ):" -ForegroundColor Yellow
    Write-Host "   1. ไปที่ https://github.com/Nattapong1958/vat/settings/pages" -ForegroundColor White
    Write-Host "   2. ในส่วน Source:" -ForegroundColor White
    Write-Host "      - เลือก branch: main" -ForegroundColor White
    Write-Host "      - เลือก folder: / (root)" -ForegroundColor White
    Write-Host "   3. คลิก Save" -ForegroundColor White
    Write-Host "   4. รอ 1-2 นาที แล้วเปิด URL ด้านบน" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ เกิดข้อผิดพลาด!" -ForegroundColor Red
    Write-Host ""
    Write-Host "กรุณาตรวจสอบ:" -ForegroundColor Yellow
    Write-Host " - เชื่อมต่ออินเทอร์เน็ตหรือไม่" -ForegroundColor White
    Write-Host " - สร้าง Repository บน GitHub แล้วหรือยัง" -ForegroundColor White
    Write-Host " - มีสิทธิ์ Push ไปยัง Repository หรือไม่" -ForegroundColor White
    Write-Host " - ใช้ Personal Access Token แทนรหัสผ่าน" -ForegroundColor White
    Write-Host ""
    Write-Host "วิธีสร้าง Personal Access Token:" -ForegroundColor Cyan
    Write-Host "https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token" -ForegroundColor White
    Write-Host ""
}

Read-Host "กด Enter เพื่อออก"
