// ============================================================
// API - Google Sheets Integration
// ============================================================

class SheetsAPI {
    constructor() {
        this.baseUrl = CONFIG.APPS_SCRIPT_URL;
        this.isConnected = false;
    }

    // ตรวจสอบการเชื่อมต่อ
    async checkConnection() {
        if (!this.baseUrl) {
            console.log('Google Sheets API URL not configured. Using local data.');
            return false;
        }
        try {
            const response = await fetch(`${this.baseUrl}?action=ping`, { cache: 'no-store' });
            const data = await response.json();
            this.isConnected = data.status === 'ok';
            return this.isConnected;
        } catch (error) {
            console.warn('Cannot connect to Google Sheets:', error);
            this.isConnected = false;
            return false;
        }
    }

    // ส่ง POST request - ใช้ Content-Type: text/plain เพื่อหลีกเลี่ยง CORS preflight
    async _post(payload) {
        if (!this.baseUrl) return null;
        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                // text/plain = simple request = ไม่มี preflight OPTIONS
                // Google Apps Script ไม่รองรับ OPTIONS preflight
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(payload)
            });
            return await response.json();
        } catch (error) {
            console.error('API POST error:', error);
            return null;
        }
    }

    // ดึงข้อมูลทุก page พร้อมกันใน 1 request
    async fetchAllData() {
        if (!this.isConnected) return null;
        try {
            const response = await fetch(`${this.baseUrl}?action=getAllData`, { cache: 'no-store' });
            const result = await response.json();
            if (result.status === 'ok') return result.data;
            return null;
        } catch (error) {
            console.error('Error fetching all data:', error);
            return null;
        }
    }

    // ดึงข้อมูล page เดียว (ใช้ pageKey เช่น 'page1')
    async fetchData(pageKey) {
        if (!this.isConnected) return null;
        try {
            const response = await fetch(
                `${this.baseUrl}?action=getData&page=${encodeURIComponent(pageKey)}`,
                { cache: 'no-store' }
            );
            const result = await response.json();
            if (result.status === 'ok') return result.data;
            return null;
        } catch (error) {
            console.error('Error fetching data:', error);
            return null;
        }
    }

    // อัปเดตสถานะการยื่นภาษี (พร้อม verifiedBy / verifiedAt / verifyType)
    async updateStatus(pageKey, personId, statusData) {
        if (!this.isConnected) return false;
        const result = await this._post({
            action: 'updateStatus',
            page: pageKey,
            id: personId,
            status: statusData.status,
            verifiedBy: statusData.verifiedBy || '',
            verifiedAt: statusData.verifiedAt || new Date().toISOString(),
            verifyType: statusData.verifyType || ''
        });
        return result && result.status === 'ok';
    }

    // อัปเดตสถานะหลายรายการพร้อมกัน
    async batchUpdateStatus(pageKey, updates) {
        if (!this.isConnected) return false;
        const result = await this._post({
            action: 'batchUpdate',
            page: pageKey,
            updates: updates
        });
        return result && result.status === 'ok';
    }

    // Sync ข้อมูลทั้งหมดจาก LocalStorage ขึ้น Sheets
    async syncAllDataToSheets(allData) {
        if (!this.isConnected) return false;
        const result = await this._post({
            action: 'syncData',
            data: allData
        });
        return result && result.status === 'ok';
    }
}

// ============================================================
// Local Storage Manager - สำรองข้อมูลใน Browser
// ============================================================

class LocalStorageManager {
    constructor() {
        this.prefix = 'vat_tax_';
    }

    // บันทึกข้อมูลทั้งหมดของหน้า
    savePageData(pageKey, data) {
        try {
            const storageData = {
                data: data,
                lastUpdated: new Date().toISOString()
            };
            localStorage.setItem(
                this.prefix + pageKey,
                JSON.stringify(storageData)
            );
            return true;
        } catch (error) {
            console.error('Error saving to localStorage:', error);
            return false;
        }
    }

    // โหลดข้อมูลของหน้า
    loadPageData(pageKey) {
        try {
            const stored = localStorage.getItem(this.prefix + pageKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                return parsed.data;
            }
            return null;
        } catch (error) {
            console.error('Error loading from localStorage:', error);
            return null;
        }
    }

    // ดึงเวลาอัปเดตล่าสุด
    getLastUpdated(pageKey) {
        try {
            const stored = localStorage.getItem(this.prefix + pageKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                return parsed.lastUpdated;
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    // บันทึกสถานะของบุคคล
    updatePersonStatus(pageKey, personId, status) {
        const data = this.loadPageData(pageKey);
        if (data && data.personnel) {
            const person = data.personnel.find(p => p.id === personId);
            if (person) {
                person.taxStatus = status;
                this.savePageData(pageKey, data);
                return true;
            }
        }
        return false;
    }

    // ล้างข้อมูลทั้งหมด
    clearAll() {
        const keys = Object.keys(localStorage).filter(k => k.startsWith(this.prefix));
        keys.forEach(k => localStorage.removeItem(k));
    }

    // Export ข้อมูลทั้งหมด
    exportAll() {
        const allData = {};
        const keys = Object.keys(localStorage).filter(k => k.startsWith(this.prefix));
        keys.forEach(k => {
            const pageKey = k.replace(this.prefix, '');
            allData[pageKey] = this.loadPageData(pageKey);
        });
        return allData;
    }
}

// Initialize
const sheetsAPI = new SheetsAPI();
const storageManager = new LocalStorageManager();
