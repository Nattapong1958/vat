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
            const response = await fetch(`${this.baseUrl}?action=ping`);
            const data = await response.json();
            this.isConnected = data.status === 'ok';
            return this.isConnected;
        } catch (error) {
            console.warn('Cannot connect to Google Sheets:', error);
            this.isConnected = false;
            return false;
        }
    }

    // ดึงข้อมูลจาก Google Sheets
    async fetchData(sheetName) {
        if (!this.isConnected) return null;
        try {
            const response = await fetch(
                `${this.baseUrl}?action=getData&sheet=${encodeURIComponent(sheetName)}`
            );
            const data = await response.json();
            if (data.status === 'ok') {
                return data.data;
            }
            return null;
        } catch (error) {
            console.error('Error fetching data:', error);
            return null;
        }
    }

    // อัปเดตสถานะการยื่นภาษี
    async updateStatus(sheetName, personId, status) {
        if (!this.isConnected) return false;
        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'updateStatus',
                    sheet: sheetName,
                    id: personId,
                    status: status
                })
            });
            const data = await response.json();
            return data.status === 'ok';
        } catch (error) {
            console.error('Error updating status:', error);
            return false;
        }
    }

    // อัปเดตสถานะหลายรายการพร้อมกัน
    async batchUpdateStatus(sheetName, updates) {
        if (!this.isConnected) return false;
        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'batchUpdate',
                    sheet: sheetName,
                    updates: updates
                })
            });
            const data = await response.json();
            return data.status === 'ok';
        } catch (error) {
            console.error('Error batch updating:', error);
            return false;
        }
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
