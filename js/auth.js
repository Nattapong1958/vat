// ============================================================
// AUTH - User Identity & Session Management
// ============================================================

class AuthManager {
    constructor() {
        this.storageKey = 'vat_tax_session';
        this.auditKey = 'vat_tax_audit_log';
        this.currentUser = null;
        this.isAdmin = false;

        // Admin PIN (เปลี่ยนได้ตามต้องการ)
        this.ADMIN_PIN = '1919';
    }

    // ===== SESSION MANAGEMENT =====

    // โหลด session จาก localStorage
    loadSession() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const session = JSON.parse(stored);
                // ตรวจสอบว่า session ยังไม่หมดอายุ (24 ชม.)
                const now = Date.now();
                const sessionAge = now - new Date(session.loginTime).getTime();
                const MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

                if (sessionAge < MAX_AGE) {
                    this.currentUser = session.user;
                    this.isAdmin = session.isAdmin || false;
                    return true;
                } else {
                    // Session expired
                    this.logout();
                    return false;
                }
            }
            return false;
        } catch (error) {
            console.error('Error loading session:', error);
            return false;
        }
    }

    // บันทึก session
    saveSession(user, isAdmin = false) {
        try {
            const session = {
                user: user,
                isAdmin: isAdmin,
                loginTime: new Date().toISOString(),
                userAgent: navigator.userAgent
            };
            localStorage.setItem(this.storageKey, JSON.stringify(session));
            this.currentUser = user;
            this.isAdmin = isAdmin;
            return true;
        } catch (error) {
            console.error('Error saving session:', error);
            return false;
        }
    }

    // ออกจากระบบ
    logout() {
        localStorage.removeItem(this.storageKey);
        this.currentUser = null;
        this.isAdmin = false;
    }

    // ตรวจสอบว่าล็อกอินอยู่หรือไม่
    isLoggedIn() {
        return this.currentUser !== null;
    }

    // ตรวจสอบว่าเป็น Admin หรือไม่
    isAdminMode() {
        return this.isAdmin;
    }

    // ตรวจสอบว่า user นี้เป็นเจ้าของ person นี้หรือไม่
    isOwnRecord(personId) {
        if (this.isAdmin) return true; // Admin แก้ได้ทุกคน
        return this.currentUser && this.currentUser.id === personId;
    }

    // ค้นหา User จากรายชื่อทั้งหมด
    findPersonById(personId) {
        for (const key of Object.keys(DEFAULT_DATA)) {
            const page = DEFAULT_DATA[key];
            const person = page.personnel.find(p => p.id === personId);
            if (person) {
                return { ...person, pageKey: key, unit: page.subtitle };
            }
        }
        return null;
    }

    // ค้นหา User จากชื่อ
    findPersonByName(firstName, lastName) {
        const results = [];
        for (const key of Object.keys(DEFAULT_DATA)) {
            const page = DEFAULT_DATA[key];
            page.personnel.forEach(p => {
                if (p.firstName === firstName && p.lastName === lastName) {
                    results.push({ ...p, pageKey: key, unit: page.subtitle });
                }
            });
        }
        return results;
    }

    // รวมรายชื่อทั้งหมดสำหรับ dropdown
    getAllPersonnel() {
        const all = [];
        for (const key of Object.keys(DEFAULT_DATA)) {
            const page = DEFAULT_DATA[key];
            page.personnel.forEach(p => {
                all.push({
                    id: p.id,
                    rank: p.rank,
                    firstName: p.firstName,
                    lastName: p.lastName,
                    pageKey: key,
                    unit: page.subtitle
                });
            });
        }
        return all;
    }

    // ===== AUDIT LOG =====

    // บันทึก audit log
    logAction(action, personId, details = {}) {
        try {
            const logs = this.getAuditLogs();
            const entry = {
                timestamp: new Date().toISOString(),
                action: action,
                personId: personId,
                performedBy: this.currentUser ? {
                    id: this.currentUser.id,
                    rank: this.currentUser.rank,
                    name: `${this.currentUser.firstName} ${this.currentUser.lastName}`
                } : null,
                isAdmin: this.isAdmin,
                isSelfVerification: this.currentUser && this.currentUser.id === personId,
                details: details,
                userAgent: navigator.userAgent.substring(0, 120)
            };
            logs.push(entry);

            // เก็บแค่ 1000 entries ล่าสุด
            if (logs.length > 1000) {
                logs.splice(0, logs.length - 1000);
            }

            localStorage.setItem(this.auditKey, JSON.stringify(logs));
            return entry;
        } catch (error) {
            console.error('Error logging action:', error);
            return null;
        }
    }

    // ดึง audit logs
    getAuditLogs() {
        try {
            const stored = localStorage.getItem(this.auditKey);
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            return [];
        }
    }

    // ดึง logs สำหรับคนใดคนหนึ่ง
    getPersonLogs(personId) {
        return this.getAuditLogs().filter(log => log.personId === personId);
    }

    // ดึง logs ล่าสุด
    getRecentLogs(count = 20) {
        const logs = this.getAuditLogs();
        return logs.slice(-count).reverse();
    }

    // ตรวจสอบว่า person นี้ยืนยันตัวเอง (self-verified) หรือไม่
    isSelfVerified(personId) {
        const logs = this.getPersonLogs(personId);
        // หา log ล่าสุดที่เป็น status_change
        const statusLogs = logs.filter(l => l.action === 'status_change');
        if (statusLogs.length === 0) return false;

        const lastLog = statusLogs[statusLogs.length - 1];
        return lastLog.isSelfVerification === true &&
               lastLog.details.newStatus === CONFIG.STATUS.FILED;
    }

    // ดึงข้อมูลการยืนยันของ person
    getVerificationInfo(personId) {
        const logs = this.getPersonLogs(personId);
        const statusLogs = logs.filter(l => l.action === 'status_change');
        if (statusLogs.length === 0) return null;

        const lastLog = statusLogs[statusLogs.length - 1];
        return {
            isSelfVerified: lastLog.isSelfVerification,
            verifiedBy: lastLog.performedBy,
            verifiedAt: lastLog.timestamp,
            isAdmin: lastLog.isAdmin,
            status: lastLog.details.newStatus
        };
    }

    // Export audit log เป็น CSV
    exportAuditLog() {
        const logs = this.getAuditLogs();
        const headers = [
            'วัน-เวลา', 'การดำเนินการ', 'รหัสบุคคล',
            'ดำเนินการโดย', 'ยืนยันตนเอง', 'เป็น Admin',
            'สถานะใหม่', 'สถานะเก่า'
        ];

        const rows = logs.map(log => [
            new Date(log.timestamp).toLocaleString('th-TH'),
            log.action,
            log.personId,
            log.performedBy ? log.performedBy.name : '-',
            log.isSelfVerification ? 'ใช่' : 'ไม่ใช่',
            log.isAdmin ? 'ใช่' : 'ไม่ใช่',
            log.details.newStatus || '-',
            log.details.oldStatus || '-'
        ]);

        const BOM = '\uFEFF';
        const csv = BOM + [headers, ...rows]
            .map(row => row.map(cell => `"${cell}"`).join(','))
            .join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `audit_log_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    }
}

// Initialize
const authManager = new AuthManager();
