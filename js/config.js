// ============================================================
// CONFIG - ตั้งค่าการเชื่อมต่อ Google Sheets API
// ============================================================

const CONFIG = {
    // Google Apps Script Web App URL
    // ให้นำ URL ที่ได้จากการ Deploy Apps Script มาใส่ที่นี่
    APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbxxQy5ZHuUy_UoAnferxhzsF1eUJpgB_gQMhs3eumDOGE2bW1liDGxuHsl_qw1GACkX8A/exec',

    // Google Sheets ID (สำหรับ direct API - optional)
    SHEET_ID: '15Ti8w2twHK2EwmtcFH4RgF3Nfk0hfms1iguaw42l8a8',

    // Google API Key (สำหรับ direct API - optional)
    API_KEY: '',

    // ชื่อ Sheet แต่ละหน้า
    SHEET_NAMES: {
        page1: 'นายทหารสัญญาบัตร',
        page2: 'ร้อย.1',
        page3: 'ร้อย.อวบ.2',
        page4: 'ร้อย.อวบ.3',
        page5: 'ร้อย.บก.'
    },

    // ใช้ข้อมูล Local (ถ้ายังไม่ได้เชื่อมต่อ Google Sheets)
    USE_LOCAL_DATA: false,

    // Auto-save interval (ms)
    AUTO_SAVE_INTERVAL: 30000,

    // หน่วยงาน
    UNIT_NAME: 'ร.19 พัน.1',
    UNIT_FULL_NAME: 'กองพันทหารราบที่ 1 กรมทหารราบที่ 19',

    // Tax form type
    TAX_FORM: 'ภ.ง.ด. 90/91',

    // Status options
    STATUS: {
        FILED: 'ดำเนินการยื่นภาษีแล้ว',
        NOT_FILED: 'ยังไม่ยื่น'
    }
};
