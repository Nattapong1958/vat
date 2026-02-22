# 🚀 คู่มือการ Deploy ไปยัง GitHub Pages

## ขั้นตอนที่ 1: ติดตั้ง Git

### Windows
1. ดาวน์โหลด Git จาก: https://git-scm.com/download/win
2. รันไฟล์ติดตั้งที่ดาวน์โหลดมา
3. ติดตั้งด้วยค่า Default (กด Next ไปเรื่อยๆ)
4. เปิด PowerShell ใหม่หลังจากติดตั้งเสร็จ
5. ทดสอบว่าติดตั้งสำเร็จ: `git --version`

## ขั้นตอนที่ 2: Initialize Git Repository

เปิด PowerShell ในโฟลเดอร์ VAT และรันคำสั่งเหล่านี้:

```powershell
# 1. Initialize git repository
git init

# 2. Add all files
git add .

# 3. Commit files
git commit -m "Initial commit: VAT Tax Filing Verification System"

# 4. Rename branch to main
git branch -M main

# 5. Add remote repository
git remote add origin https://github.com/Nattapong1958/vat.git

# 6. Push to GitHub
git push -u origin main
```

## ขั้นตอนที่ 3: เปิดใช้งาน GitHub Pages

### วิธีที่ 1: ผ่าน GitHub Website
1. ไปที่ https://github.com/Nattapong1958/vat
2. คลิก **Settings** (เกียร์ด้านบน)
3. ไปที่หัวข้อ **Pages** (เมนูด้านซ้าย)
4. ในส่วน **Source**:
   - เลือก **main** branch
   - เลือก **/ (root)** folder
5. คลิก **Save**
6. รอสักครู่ แล้วรีเฟรชหน้า จะเห็น URL สำหรับเข้าถึงเว็บ:
   ```
   https://nattapong1958.github.io/vat/
   ```

### วิธีที่ 2: ผ่าน Command Line (ถ้าติดตั้ง GitHub CLI)
```bash
gh repo create Nattapong1958/vat --public --source=. --remote=origin
gh repo edit --enable-pages --pages-branch main
```

## ขั้นตอนที่ 4: ตรวจสอบการ Deploy

1. ไปที่ **Actions** tab ใน GitHub Repository
2. ดูว่า Deployment สำเร็จหรือไม่ (มี ✅)
3. เปิด URL: https://nattapong1958.github.io/vat/

## การอัปเดตโค้ดในอนาคต

เมื่อแก้ไขโค้ดแล้วต้องการอัปเดตบน GitHub:

```powershell
# 1. Add changes
git add .

# 2. Commit with message
git commit -m "Update: คำอธิบายการแก้ไข"

# 3. Push to GitHub
git push
```

GitHub Pages จะอัปเดตเว็บอัตโนมัติภายใน 1-2 นาที

## การ Config Google Sheets (Optional)

หากต้องการเชื่อมต่อ Google Sheets:

1. สร้าง Google Sheets ใหม่
2. ไปที่ **Extensions** → **Apps Script**
3. Copy โค้ดจาก `google-apps-script.js` ไปวาง
4. **Deploy** → **New deployment**:
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy **Web app URL** ที่ได้
6. แก้ไขไฟล์ `js/config.js`:
   ```javascript
   APPS_SCRIPT_URL: 'URL_ที่ได้จาก_Google_Apps_Script'
   ```
7. Commit และ Push การเปลี่ยนแปลง

## Troubleshooting

### ปัญหา: git command not found
**แก้ไข**: ติดตั้ง Git แล้วปิด-เปิด PowerShell ใหม่

### ปัญหา: Permission denied (publickey)
**แก้ไข**: ตั้งค่า SSH key หรือใช้ HTTPS URL แทน

### ปัญหา: Repository not found
**แก้ไข**: ตรวจสอบว่าสร้าง Repository บน GitHub แล้ว

### ปัญหา: GitHub Pages ไม่แสดงผล
**แก้ไข**:
1. ตรวจสอบว่าเปิดใช้งาน GitHub Pages แล้ว
2. ตรวจสอบว่า `index.html` อยู่ใน root folder
3. รอ 2-3 นาที แล้วลองใหม่
4. ลองเคลียร์ Cache เบราว์เซอร์

## ทดสอบก่อน Deploy

ทดสอบในเครื่องก่อนเสมอ:

```powershell
# เปิด Local Server
python -m http.server 8080

# เปิดเบราว์เซอร์ไปที่
http://localhost:8080
```

## ข้อมูลเพิ่มเติม

- **GitHub Pages Docs**: https://docs.github.com/pages
- **Git Docs**: https://git-scm.com/doc
- **Markdown Guide**: https://www.markdownguide.org/

---

## คำสั่ง Git ที่ใช้บ่อย

```powershell
# ดูสถานะไฟล์
git status

# ดูประวัติ commit
git log --oneline

# ยกเลิกการเปลี่ยนแปลงที่ยังไม่ commit
git restore <file>

# ดู remote URL
git remote -v

# Pull การเปลี่ยนแปลงจาก GitHub
git pull

# สร้าง branch ใหม่
git checkout -b feature/new-feature

# Merge branch
git merge <branch-name>
```

---

**สำเร็จ!** 🎉 เว็บของคุณจะพร้อมใช้งานที่: https://nattapong1958.github.io/vat/
