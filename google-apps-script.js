// ============================================================
// Google Apps Script - สำหรับ Deploy เป็น Web App
// ============================================================
// วิธีใช้งาน:
// 1. ไปที่ https://script.google.com
// 2. สร้างโปรเจคใหม่
// 3. คัดลอกโค้ดนี้ไปวาง
// 4. แก้ไข SPREADSHEET_ID ให้เป็น ID ของ Google Sheet ที่สร้างไว้
// 5. Deploy > New deployment > Web app
//    - Execute as: Me
//    - Who has access: Anyone
// 6. คัดลอก URL ที่ได้ไปใส่ในไฟล์ config.js (APPS_SCRIPT_URL)
// ============================================================

// ===== ตั้งค่า =====
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';

// ชื่อ Sheet ที่ต้องสร้างใน Google Sheets (5 sheets)
const SHEET_NAMES = {
    'นายทหารสัญญาบัตร': 'นายทหารสัญญาบัตร',
    'ร้อย.1': 'ร้อย.1',
    'ร้อย.อวบ.2': 'ร้อย.อวบ.2',
    'ร้อย.อวบ.3': 'ร้อย.อวบ.3',
    'ร้อย.บก.': 'ร้อย.บก.'
};

// ===== HTTP GET Handler =====
function doGet(e) {
    const action = e.parameter.action;

    try {
        switch (action) {
            case 'ping':
                return jsonResponse({ status: 'ok', message: 'Connected' });

            case 'getData':
                const sheetName = e.parameter.sheet;
                const data = getSheetData(sheetName);
                return jsonResponse({ status: 'ok', data: data });

            case 'getAllData':
                const allData = {};
                Object.keys(SHEET_NAMES).forEach(name => {
                    allData[name] = getSheetData(name);
                });
                return jsonResponse({ status: 'ok', data: allData });

            default:
                return jsonResponse({ status: 'error', message: 'Unknown action' });
        }
    } catch (error) {
        return jsonResponse({ status: 'error', message: error.message });
    }
}

// ===== HTTP POST Handler =====
function doPost(e) {
    try {
        const body = JSON.parse(e.postData.contents);
        const action = body.action;

        switch (action) {
            case 'updateStatus':
                updatePersonStatus(body.sheet, body.id, body.status);
                return jsonResponse({ status: 'ok' });

            case 'batchUpdate':
                batchUpdateStatus(body.sheet, body.updates);
                return jsonResponse({ status: 'ok' });

            default:
                return jsonResponse({ status: 'error', message: 'Unknown action' });
        }
    } catch (error) {
        return jsonResponse({ status: 'error', message: error.message });
    }
}

// ===== Helper Functions =====

function jsonResponse(data) {
    return ContentService
        .createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
}

function getSheetData(sheetName) {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return [];

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return []; // Header only

    const headers = data[0];
    const idCol = headers.indexOf('id');
    const rankCol = headers.indexOf('rank');
    const firstNameCol = headers.indexOf('firstName');
    const lastNameCol = headers.indexOf('lastName');
    const statusCol = headers.indexOf('taxStatus');

    return data.slice(1).map(row => ({
        id: row[idCol] || '',
        rank: row[rankCol] || '',
        firstName: row[firstNameCol] || '',
        lastName: row[lastNameCol] || '',
        taxStatus: row[statusCol] || ''
    }));
}

function updatePersonStatus(sheetName, personId, status) {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idCol = headers.indexOf('id');
    const statusCol = headers.indexOf('taxStatus');

    for (let i = 1; i < data.length; i++) {
        if (data[i][idCol] === personId) {
            sheet.getRange(i + 1, statusCol + 1).setValue(status);
            break;
        }
    }
}

function batchUpdateStatus(sheetName, updates) {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idCol = headers.indexOf('id');
    const statusCol = headers.indexOf('taxStatus');

    updates.forEach(update => {
        for (let i = 1; i < data.length; i++) {
            if (data[i][idCol] === update.id) {
                sheet.getRange(i + 1, statusCol + 1).setValue(update.status);
                break;
            }
        }
    });
}

// ===== Setup Function =====
// เรียกฟังก์ชันนี้ครั้งแรกเพื่อสร้าง Sheet และ Header
function setupSheets() {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const headers = ['id', 'rank', 'firstName', 'lastName', 'taxStatus'];

    Object.values(SHEET_NAMES).forEach(name => {
        let sheet = ss.getSheetByName(name);
        if (!sheet) {
            sheet = ss.insertSheet(name);
        }
        // Set headers
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        // Format header
        sheet.getRange(1, 1, 1, headers.length)
            .setFontWeight('bold')
            .setBackground('#f5f5f7');
    });

    Logger.log('Sheets setup complete!');
}
