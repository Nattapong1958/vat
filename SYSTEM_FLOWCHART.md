# ระบบยืนยันการยื่นภาษี ภ.ง.ด. 90/91
## System Flowchart & Architecture Documentation

---

## 📐 สถาปัตยกรรมระบบ (Architecture Overview)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER DEVICES                                 │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐            │
│  │   มือถือ A   │   │   มือถือ B   │   │  คอมพิวเตอร์  │            │
│  │  (ผู้ใช้)    │   │  (ผู้ใช้)    │   │   (Admin)    │            │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘            │
│         │                  │                  │                     │
│         └──────────────────┼──────────────────┘                    │
│                            │ HTTPS                                  │
└────────────────────────────┼────────────────────────────────────────┘
                             │
              ┌──────────────▼──────────────┐
              │   GitHub Pages (Frontend)    │
              │  nattapong1958.github.io/vat │
              │                             │
              │  index.html                 │
              │  css/style.css              │
              │  js/config.js               │
              │  js/data.js                 │
              │  js/auth.js                 │
              │  js/api.js                  │
              │  js/app.js                  │
              └──────────────┬──────────────┘
                             │ fetch() HTTPS GET/POST
                             │
              ┌──────────────▼──────────────┐
              │  Google Apps Script (Backend)│
              │  script.google.com/macros/s/ │
              │  AKfycbxx.../exec            │
              │                             │
              │  doGet(e)                   │
              │  doPost(e)                  │
              └──────────────┬──────────────┘
                             │ SpreadsheetApp API
                             │
              ┌──────────────▼──────────────┐
              │    Google Sheets (Database)  │
              │  Spreadsheet ID:             │
              │  15Ti8w2twHK2EwmtcFH4...    │
              │                             │
              │  Sheet: นายทหารสัญญาบัตร    │
              │  Sheet: ร้อย.1              │
              │  Sheet: ร้อย.อวบ.2          │
              │  Sheet: ร้อย.อวบ.3          │
              │  Sheet: ร้อย.บก.            │
              │  Sheet: AuditLog            │
              └─────────────────────────────┘
```

---

## 📁 โครงสร้างไฟล์ (File Structure)

```
VAT/
├── index.html                  ← หน้าเว็บหลัก (UI ทั้งหมด)
├── css/
│   └── style.css               ← Apple-inspired design + Responsive
├── js/
│   ├── config.js               ← ค่าตั้งค่าระบบ (URL, Sheet names)
│   ├── data.js                 ← ข้อมูลเริ่มต้น 233 คน (DEFAULT_DATA)
│   ├── auth.js                 ← AuthManager (Login/Session/AuditLog)
│   ├── api.js                  ← SheetsAPI + LocalStorageManager
│   └── app.js                  ← TaxVerificationApp (Main Logic)
├── google-apps-script.js       ← โค้ดสำหรับ deploy บน Apps Script
├── SYSTEM_FLOWCHART.md         ← ไฟล์นี้
└── .github/
    └── workflows/              ← GitHub Pages auto-deploy
```

---

## 🔄 FLOW 1: การโหลดระบบครั้งแรก (App Initialization)

```
เปิดเว็บ https://nattapong1958.github.io/vat/
          │
          ▼
┌─────────────────────┐
│  โหลด HTML/CSS/JS   │
│  - index.html       │
│  - style.css        │
│  - config.js        │    ← APPS_SCRIPT_URL, SHEET_NAMES, STATUS
│  - data.js          │    ← DEFAULT_DATA (233 คน)
│  - auth.js          │    ← AuthManager class
│  - api.js           │    ← SheetsAPI, LocalStorageManager
│  - app.js           │    ← TaxVerificationApp class
└──────────┬──────────┘
           │ DOMContentLoaded
           ▼
┌─────────────────────┐
│  app = new           │
│  TaxVerificationApp()│
│  app.init()          │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  showLoading()       │  ← แสดง loading spinner
│  loadData()          │  ← โหลดจาก localStorage หรือ DEFAULT_DATA
└──────────┬──────────┘
           │
           ▼
┌────────────────────────────┐
│  authManager.loadSession() │
│  ตรวจสอบ localStorage      │
│  'vat_tax_session'         │
└──────────┬─────────────────┘
           │
    ┌──────┴───────┐
    │              │
    ▼              ▼
 มี session     ไม่มี session
 ไม่หมดอายุ    หรือหมดอายุ
 (< 24 ชม.)    (>= 24 ชม.)
    │              │
    ▼              ▼
onLoginSuccess() showLoginScreen()
    │              │
    ▼              └──→ (ไปที่ FLOW 2: Login)
renderNavTabs()
renderPage()
bindGlobalEvents()
hideLoading()
startAutoSave()       ← auto-save ทุก 30 วินาที
updateUserHeader()
    │
    ▼
checkConnection()     ← ping Apps Script
    │
    ├── ✅ Connected → syncFromSheets() + startPolling()
    └── ❌ Offline   → ใช้ข้อมูล localStorage
```

---

## 🔄 FLOW 2: การ Login (Authentication)

```
หน้า Login แสดง
      │
      ├──── แสดงรายชื่อกำลังพล 233 คน (จาก DEFAULT_DATA)
      │     แยกกลุ่มตาม Unit
      │
      ├──── ช่องค้นหาชื่อ (filterLoginList)
      │
      ▼
ผู้ใช้เลือก
      │
      ├─── คลิก ชื่อตัวเอง ──────────────────────────────┐
      │                                                   │
      │                                                   ▼
      │                                    selectLoginUser(personId)
      │                                           │
      │                                    findPersonById(personId)
      │                                    ← ค้นหาใน DEFAULT_DATA
      │                                           │
      │                                    saveSession(person, false)
      │                                    ← localStorage 'vat_tax_session'
      │                                    ← isAdmin = false
      │                                    ← loginTime = now
      │                                           │
      │                                    logAction('login', personId)
      │                                    ← บันทึก audit log
      │                                           │
      │                                    onLoginSuccess()
      │                                    ← currentPage = user's pageKey
      │                                    ← แสดงเฉพาะหน้าของตัวเอง
      │
      └─── กรอก Admin PIN ──────────────────────────────┐
           (ค่าเริ่มต้น: 1919)                          │
                                                         ▼
                                              loginAsAdmin()
                                                    │
                                              ตรวจ PIN = '1919' ?
                                                    │
                                          ┌─────────┴────────┐
                                          │                  │
                                         ถูก               ผิด
                                          │                  │
                                          ▼                  ▼
                                  saveSession(              showToast
                                  adminUser, true)         'PIN ไม่ถูก'
                                  ← isAdmin = true
                                          │
                                  onLoginSuccess()
                                  ← เข้าถึงได้ทุกหน้า
                                  ← แก้ไขได้ทุกคน
                                  ← เห็น checkbox batch
```

---

## 🔄 FLOW 3: การโหลดและ Sync ข้อมูล (Data Loading & Sync)

```
loadData()
     │
     ▼
สำหรับแต่ละ pageKey (page1-page5)
     │
     ├── มีข้อมูลใน localStorage? ──── ใช่ ──→ data[key] = localStorage data
     │   ('vat_tax_page1' ฯลฯ)
     │
     └── ไม่มี ──→ data[key] = DEFAULT_DATA[key] (deep copy)
                   savePageData(key, data)

          ↓↓ หลัง loadData() ↓↓

syncFromSheets()  [เรียกครั้งแรก + ทุก 30 วินาที]
     │
     ▼
sheetsAPI.fetchAllData()
     │
     └→ GET: APPS_SCRIPT_URL?action=getAllData
            │
            ▼ (Google Apps Script)
            getAllData()
            ├── getPageData('page1') → Sheet นายทหารสัญญาบัตร
            ├── getPageData('page2') → Sheet ร้อย.1
            ├── getPageData('page3') → Sheet ร้อย.อวบ.2
            ├── getPageData('page4') → Sheet ร้อย.อวบ.3
            └── getPageData('page5') → Sheet ร้อย.บก.
            │
            ▼
            return { status:'ok', data: { page1:{...}, page2:{...}, ... } }

     │
     ▼ (กลับที่ Frontend)
สำหรับแต่ละ pageKey
     │
     ▼
mergeData(pageKey, remoteData)
     │
     ├── remoteData.personnel.forEach(remote)
     │        │
     │        ├── หา local person ด้วย remote.id
     │        │
     │        ├── remote.taxStatus ≠ local.taxStatus ?
     │        │   └── ✅ อัพเดท local.taxStatus
     │        │
     │        ├── remote.verifiedBy ≠ local.verifiedBy ?
     │        │   └── ✅ อัพเดท local.verifiedBy
     │        │
     │        └── remote.verifiedAt ≠ local.verifiedAt ?
     │            └── ✅ อัพเดท local.verifiedAt
     │
     └── มีการเปลี่ยนแปลง? → savePageData() → re-render UI
```

---

## 🔄 FLOW 4: การเปลี่ยนสถานะ (Status Update)

```
ผู้ใช้เปลี่ยน dropdown สถานะ
         │
         ▼
updateStatus(personId, status)
         │
         ▼
canEditPerson(personId)?
         │
    ┌────┴──────────┐
    │               │
   ✅              ❌
isAdmin           ไม่ใช่เจ้าของ
หรือ              ของตัวเอง
isOwnRecord           │
    │             showToast('ไม่มีสิทธิ์')
    │             resetDropdown()
    │
    ▼
หา person ใน data[currentPage].personnel
    │
    ├── person.taxStatus = status (ใหม่)
    ├── person.verifiedBy = { id, rank, name } ของผู้กด
    ├── person.verifiedAt = ISO timestamp ปัจจุบัน
    ├── person.isSelfVerified = (currentUser.id === personId)
    └── person.isAdminVerified = isAdminMode()
    │
    ▼
storageManager.savePageData(currentPage, page)
← บันทึกใน localStorage ทันที
    │
    ▼
authManager.logAction('status_change', personId, {
    oldStatus, newStatus, pageKey
})
← บันทึก audit log ใน localStorage
    │
    ▼
sheetsAPI.isConnected?
    │
  ┌─┴──────────┐
  │            │
 ✅           ❌
Online        Offline
  │            │
  ▼            └→ ข้ามไป re-render
sheetsAPI.updateStatus(pageKey, personId, {
    status, verifiedBy, verifiedAt, verifyType
})
  │
  └→ POST: APPS_SCRIPT_URL
     body: { action:'updateStatus', page, id, status,
             verifiedBy, verifiedAt, verifyType }
     Content-Type: text/plain  ← หลีกเลี่ยง CORS preflight
         │
         ▼ (Google Apps Script)
     updatePersonStatus(params)
         ├── เปิด Spreadsheet
         ├── หา Sheet ตาม pageKey
         ├── ค้นหาแถวที่ id ตรงกัน
         └── อัพเดทคอลัมน์: taxStatus, verifiedBy,
                            verifiedAt, verifyType
    │
    ▼
Re-render UI:
  ├── renderStats()      ← อัพเดทตัวเลขสถิติ
  ├── renderProgressBar() ← อัพเดท progress bar
  ├── renderNavTabs()    ← อัพเดท % ใน tab
  ├── renderTable()      ← อัพเดทตาราง
  └── renderFooter()     ← อัพเดท footer
    │
    ▼
showToast('สถานะ - ยื่นภาษีแล้ว (ยืนยันด้วยตนเอง)')
```

---

## 🔄 FLOW 5: Real-Time Polling (Cross-Device Sync)

```
startPolling() ←── เรียกหลัง login สำเร็จ
     │
     ▼
setInterval(30,000 ms)  ← ทุก 30 วินาที
     │
     ▼
sheetsAPI.isConnected?
     │
  ┌──┴───────────┐
  │              │
 ✅             ❌
Connected       Disconnected
  │              │
  ▼              ▼
syncFromSheets  checkConnection()
(silent=true)       │
  │            ┌────┴───────┐
  │            │            │
  │           ✅           ❌
  │         reconnect     ยังคง offline
  │         updateConnectionStatus(true)
  │
  ▼
fetchAllData() จาก Google Sheets
  │
  ▼
mergeData() ทีละ page
  │ (เปรียบเทียบแต่ละคน)
  │
  ├── ไม่มีการเปลี่ยนแปลง → ไม่ทำอะไร
  │
  └── มีการเปลี่ยนแปลง →
       savePageData()
       renderPage()
       renderNavTabs()
       updateStorageIndicator()
       [ไม่แสดง toast เพราะ silent=true]
```

---

## 🔄 FLOW 6: Batch Update (Admin เท่านั้น)

```
Admin เลือก checkbox หลายคน
     │
     ▼
toggleRowSelection(personId, checked)
     ├── checked → selectedRows.add(personId)
     └── unchecked → selectedRows.delete(personId)
     │
     ▼
updateBatchBar()
     ├── selectedRows.size > 0 → แสดง batch bar
     └── selectedRows.size = 0 → ซ่อน batch bar
     │
     ▼
กด "ยื่นภาษีแล้ว" หรือ "ยังไม่ยื่น"
     │
     ▼
batchUpdateStatus(status)
     │
     ├── isAdminMode()? → ✅ ดำเนินการ / ❌ showToast error
     │
     ▼
สำหรับแต่ละ id ใน selectedRows
     ├── person.taxStatus = status
     ├── person.verifiedBy = { id:'ADMIN', name:'Admin' }
     ├── person.verifiedAt = now
     ├── person.isAdminVerified = true
     └── authManager.logAction('status_change', id, { batch:true })
     │
     ▼
storageManager.savePageData(currentPage, page)
     │
     ▼
sheetsAPI.batchUpdateStatus(pageKey, fullUpdates)
     └→ POST: { action:'batchUpdate', page, updates:[...] }
          │
          ▼ (Google Apps Script)
      batchUpdateStatus(params)
          ├── สร้าง id→row mapping
          ├── อัพเดทแต่ละแถวใน Sheet
          └── return { successCount, failedIds }
     │
     ▼
selectedRows.clear()
Re-render UI ทั้งหมด
showToast('อัปเดต N รายการ')
```

---

## 🔄 FLOW 7: Auto-Save

```
startAutoSave()  ← เรียกหลัง login
     │
     ▼
setInterval(30,000 ms)
     │
     ▼
saveAllPages()
     └── สำหรับแต่ละ key ใน pageKeys
              │
              ▼
         storageManager.savePageData(key, data[key])
         ← localStorage.setItem('vat_tax_page1', JSON)
              │
              ▼
         updateStorageIndicator()
         ← แสดง "บันทึก HH:MM" ใน header

+++ Events เพิ่มเติมที่ trigger saveAllPages() +++
     ├── visibilitychange (hidden) ← ปิด tab/app
     └── offline event ← หลุดอินเทอร์เน็ต
```

---

## 🔄 FLOW 8: Logout

```
กด ปุ่ม logout ใน header
     │
     ▼
handleLogout()
     │
     ├── authManager.logAction('logout', userId)
     ├── authManager.logout()
     │       ├── localStorage.removeItem('vat_tax_session')
     │       ├── currentUser = null
     │       └── isAdmin = false
     │
     ├── selectedRows.clear()
     ├── searchTerm = ''
     ├── filterStatus = 'all'
     │
     └── showLoginScreen()
             ├── loginOverlay.display = 'flex'
             └── mainApp.display = 'none'
```

---

## 🗄️ โครงสร้าง Data (Data Structures)

### localStorage Keys
```
vat_tax_session     ← session ผู้ใช้ปัจจุบัน
vat_tax_page1       ← ข้อมูล นายทหารสัญญาบัตร
vat_tax_page2       ← ข้อมูล ร้อย.1
vat_tax_page3       ← ข้อมูล ร้อย.อวบ.2
vat_tax_page4       ← ข้อมูล ร้อย.อวบ.3
vat_tax_page5       ← ข้อมูล ร้อย.บก.
vat_tax_audit_log   ← audit log (max 1000 entries)
```

### Page Data Structure
```json
{
  "data": {
    "title": "นายทหารสัญญาบัตร",
    "subtitle": "สัญญาบัตร",
    "personnel": [
      {
        "id": "P1-001",
        "rank": "พ.ท.",
        "firstName": "เอกพจน์",
        "lastName": "นามถาวร",
        "taxStatus": "ดำเนินการยื่นภาษีแล้ว",
        "verifiedBy": {
          "id": "P1-001",
          "rank": "พ.ท.",
          "name": "เอกพจน์ นามถาวร"
        },
        "verifiedAt": "2026-02-23T10:30:00.000Z",
        "isSelfVerified": true,
        "isAdminVerified": false
      }
    ]
  },
  "lastUpdated": "2026-02-23T10:30:00.000Z"
}
```

### Session Structure
```json
{
  "user": {
    "id": "P1-001",
    "rank": "พ.ท.",
    "firstName": "เอกพจน์",
    "lastName": "นามถาวร",
    "pageKey": "page1",
    "unit": "สัญญาบัตร"
  },
  "isAdmin": false,
  "loginTime": "2026-02-23T10:00:00.000Z",
  "userAgent": "Mozilla/5.0..."
}
```

### Audit Log Entry
```json
{
  "timestamp": "2026-02-23T10:30:00.000Z",
  "action": "status_change",
  "personId": "P1-001",
  "performedBy": {
    "id": "P1-001",
    "rank": "พ.ท.",
    "name": "เอกพจน์ นามถาวร"
  },
  "isAdmin": false,
  "isSelfVerification": true,
  "details": {
    "oldStatus": "",
    "newStatus": "ดำเนินการยื่นภาษีแล้ว",
    "pageKey": "page1"
  }
}
```

---

## 🌐 Google Apps Script API Endpoints

### GET Endpoints
```
?action=ping
  → { status:'ok', message:'Connected to VAT Tax System', version:'1.0' }

?action=getData&page=page1
  → { status:'ok', data:{ personnel:[...], lastUpdated:'...' } }

?action=getAllData
  → { status:'ok', data:{ page1:{...}, page2:{...}, ..., page5:{...} } }

?action=getAuditLog&limit=100
  → { status:'ok', data:[...entries] }

?action=getStats
  → { status:'ok', data:{ total:233, filed:N, notFiled:N, pending:N,
                           progress:N%, byPage:{...} } }
```

### POST Endpoints (Content-Type: text/plain)
```
body: { action:'updateStatus', page:'page1', id:'P1-001',
        status:'ดำเนินการยื่นภาษีแล้ว',
        verifiedBy:'เอกพจน์ นามถาวร',
        verifiedAt:'2026-02-23T10:30:00Z',
        verifyType:'self' }
  → { status:'ok', message:'Updated successfully', id:'P1-001' }

body: { action:'batchUpdate', page:'page2',
        updates:[{ id, status, verifiedBy, verifiedAt, verifyType }, ...] }
  → { status:'ok', successCount:N, failedIds:[] }

body: { action:'syncData', data:{ page1:{personnel:[...]}, ... } }
  → { status:'ok', syncedPages:[...], totalUpdates:N }

body: { action:'addAuditLog', timestamp, action, userId, userName,
        targetId, targetName, oldValue, newValue, verifyType }
  → { status:'ok', message:'Audit log entry added' }

body: { action:'clearAuditLog' }
  → { status:'ok', message:'Audit log cleared' }
```

---

## 📊 Google Sheets Structure

### Personnel Sheets (5 sheets)
| Column | Field | ตัวอย่าง |
|--------|-------|---------|
| A | id | P1-001 |
| B | rank | พ.ท. |
| C | firstName | เอกพจน์ |
| D | lastName | นามถาวร |
| E | taxStatus | ดำเนินการยื่นภาษีแล้ว |
| F | verifiedBy | เอกพจน์ นามถาวร |
| G | verifiedAt | 2026-02-23T10:30:00Z |
| H | verifyType | self / admin |

### AuditLog Sheet (1 sheet)
| Column | Field |
|--------|-------|
| A | timestamp |
| B | action |
| C | userId |
| D | userName |
| E | targetId |
| F | targetName |
| G | oldValue |
| H | newValue |
| I | verifyType |
| J | ipAddress |
| K | userAgent |

---

## 🔐 Permission & Access Control

```
┌─────────────────────────────────────────────────────┐
│                  ACCESS LEVELS                       │
├─────────────────────────────────────────────────────┤
│  ผู้ใช้ทั่วไป (User Mode)                            │
│  ├── เห็นข้อมูลทุกคนในหน้าของตัวเอง                 │
│  ├── เปลี่ยนสถานะได้เฉพาะของตัวเอง                  │
│  ├── ไม่เห็น checkbox batch                          │
│  ├── ไม่เห็น toolbar admin buttons                   │
│  └── Session หมดอายุใน 24 ชั่วโมง                   │
├─────────────────────────────────────────────────────┤
│  Admin Mode (PIN: 1919)                              │
│  ├── เข้าถึงได้ทุก 5 หน้า                           │
│  ├── เปลี่ยนสถานะได้ทุกคน                           │
│  ├── Batch update หลายคนพร้อมกัน                    │
│  ├── Mark All as Filed (ทั้งหน้า)                   │
│  ├── Reset All Status (ทั้งหน้า)                    │
│  ├── Reset All Data (factory reset)                  │
│  ├── ดู Audit Log                                    │
│  └── Export CSV                                      │
└─────────────────────────────────────────────────────┘
```

---

## 📱 UI Components

```
┌────────────────────────────────────────────────────────┐
│  HEADER                                                │
│  ├── ชื่อระบบ "ระบบยืนยันการยื่นภาษี ภ.ง.ด. 90/91"  │
│  ├── Connection indicator (● Google Sheets / Offline)  │
│  ├── Storage indicator (บันทึก HH:MM ● N/233 ยื่นแล้ว)│
│  └── User info (Badge + ชื่อ + ปุ่ม logout)            │
├────────────────────────────────────────────────────────┤
│  NAV TABS                                              │
│  สัญญาบัตร N%  ร้อย.1 N%  ร้อย.อวบ.2 N%  etc.       │
├────────────────────────────────────────────────────────┤
│  STATS CARDS (4 card)                                  │
│  กำลังพลทั้งหมด | ยื่นภาษีแล้ว | ยังไม่ยื่น | รอ     │
├────────────────────────────────────────────────────────┤
│  PROGRESS BAR  N%                                      │
├────────────────────────────────────────────────────────┤
│  TOOLBAR                                               │
│  ├── ค้นหา (search)                                   │
│  ├── Filter: ทั้งหมด | ยื่นแล้ว | ยังไม่ยื่น | รอ    │
│  └── Admin: [บันทึก] [Export] [Mark All] [Reset]       │
├────────────────────────────────────────────────────────┤
│  TABLE                                                 │
│  │ ☐ │ # │ ยศ │ ชื่อ-นามสกุล │ สถานะ │ ยืนยัน │    │
│  (dropdown เปลี่ยนสถานะ + verify badge)                │
├────────────────────────────────────────────────────────┤
│  BATCH BAR (Admin, เมื่อเลือก checkbox)               │
│  เลือก N คน [ยื่นภาษีแล้ว] [ยังไม่ยื่น] [ยกเลิก]    │
├────────────────────────────────────────────────────────┤
│  FOOTER                                                │
│  ยื่นแล้ว N/Total | ยังไม่ยื่น N | รอ N              │
└────────────────────────────────────────────────────────┘
```

---

## ⚠️ ข้อจำกัดและปัญหาที่รู้จัก

### 1. mergeData ใช้ ID จาก DEFAULT_DATA เท่านั้น
```
ถ้าเพิ่มคนใหม่ใน Google Sheets โดยที่ ID ไม่มีใน DEFAULT_DATA
→ คนนั้นจะไม่แสดงในเว็บ เพราะ mergeData() หา id ไม่เจอ

วิธีแก้: เพิ่มคนลงใน js/data.js ด้วย แล้ว push GitHub
```

### 2. LocalStorage เป็น Cache
```
ถ้าแก้ไขข้อมูลใน Google Sheets ตรงๆ (ไม่ผ่านเว็บ)
→ ต้องรอ polling (30 วินาที) เพื่อให้เว็บอัพเดท
→ หรือกด refresh
```

### 3. Google Apps Script Quota
```
ฟรีแพลนมีขีดจำกัด:
- 90 นาที/วัน (execution time)
- 20,000 ครั้ง/วัน (URL fetch)
→ เพียงพอสำหรับ 233 คน
```

---

## 🚀 Deployment Summary

| Layer | Service | URL |
|-------|---------|-----|
| Frontend | GitHub Pages | https://nattapong1958.github.io/vat/ |
| Backend | Google Apps Script | https://script.google.com/macros/s/AKfycbxx.../exec |
| Database | Google Sheets | https://docs.google.com/spreadsheets/d/15Ti8w2twHK2EwmtcFH4.../edit |
| Source Code | GitHub | https://github.com/Nattapong1958/vat |

---

*อัพเดทล่าสุด: 23 กุมภาพันธ์ 2026*
