// ============================================================
// APP - Main Application Logic
// ============================================================

class TaxVerificationApp {
    constructor() {
        this.currentPage = 'page1';
        this.data = {};
        this.filteredData = {};
        this.searchTerm = '';
        this.filterStatus = 'all';
        this.selectedRows = new Set();
        this.isLoading = true;

        this.pageKeys = ['page1', 'page2', 'page3', 'page4', 'page5'];
        this.pageLabels = {
            page1: 'สัญญาบัตร',
            page2: 'ร้อย.1',
            page3: 'ร้อย.อวบ.2',
            page4: 'ร้อย.อวบ.3',
            page5: 'ร้อย.บก.'
        };
    }

    // Initialize the app
    async init() {
        this.showLoading();
        await this.loadData();

        // Check if user has existing session
        const hasSession = authManager.loadSession();

        if (hasSession) {
            // User is logged in - show main app
            this.onLoginSuccess();
        } else {
            // Show login screen
            this.hideLoading();
            this.showLoginScreen();
        }
    }

    // Called after successful login
    onLoginSuccess() {
        // If user mode, navigate to their page
        if (!authManager.isAdminMode() && authManager.currentUser) {
            const userPageKey = authManager.currentUser.pageKey;
            if (userPageKey) {
                this.currentPage = userPageKey;
            }
        }

        this.renderNavTabs();
        this.renderPage(this.currentPage);
        this.bindGlobalEvents();
        this.hideLoading();
        this.startAutoSave();
        this.updateUserHeader();

        // Show restore message
        const hasLocalData = this.pageKeys.some(key => storageManager.getLastUpdated(key) !== null);
        if (hasLocalData) {
            const overall = this.getOverallStats();
            if (overall.filed > 0 || overall.notFiled > 0) {
                this.showToast(`โหลดข้อมูลที่บันทึกไว้ - ${overall.filed}/${overall.total} ยื่นแล้ว`, 'success');
            }
        }

        // เชื่อมต่อ Google Sheets และ sync ข้อมูล
        if (CONFIG.APPS_SCRIPT_URL) {
            sheetsAPI.checkConnection().then(connected => {
                this.updateConnectionStatus(connected);
                if (connected) {
                    this.syncFromSheets();
                    this.startPolling(); // เริ่ม polling ทุก 30 วินาที
                }
            });
        }
    }

    // Update header to show logged-in user
    updateUserHeader() {
        const el = document.getElementById('userInfo');
        if (!el) return;

        if (authManager.isLoggedIn()) {
            const u = authManager.currentUser;
            const mode = authManager.isAdminMode() ? 'Admin' : 'ผู้ใช้';
            const modeClass = authManager.isAdminMode() ? 'admin-badge' : 'user-badge';
            el.innerHTML = `
                <span class="user-info-badge ${modeClass}">${mode}</span>
                <span class="user-info-name">${u.rank} ${u.firstName} ${u.lastName}</span>
                <button class="btn-icon" onclick="app.handleLogout()" title="ออกจากระบบ">
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"
                            d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"/>
                    </svg>
                </button>
            `;
            el.style.display = 'flex';
        } else {
            el.style.display = 'none';
        }
    }

    // ===== LOGIN / LOGOUT =====

    showLoginScreen() {
        document.getElementById('loginOverlay').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
        this.renderLoginPersonnelList();
    }

    hideLoginScreen() {
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
    }

    renderLoginPersonnelList() {
        const container = document.getElementById('loginPersonnelList');
        if (!container) return;

        const allPersonnel = authManager.getAllPersonnel();
        const grouped = {};

        allPersonnel.forEach(p => {
            if (!grouped[p.unit]) grouped[p.unit] = [];
            grouped[p.unit].push(p);
        });

        container.innerHTML = Object.keys(grouped).map(unit => `
            <div class="login-unit-group">
                <div class="login-unit-label">${unit}</div>
                ${grouped[unit].map(p => `
                    <button class="login-person-btn" onclick="app.selectLoginUser('${p.id}')" data-id="${p.id}">
                        <span class="login-person-rank">${p.rank}</span>
                        <span class="login-person-name">${p.firstName} ${p.lastName}</span>
                    </button>
                `).join('')}
            </div>
        `).join('');
    }

    filterLoginList(searchTerm) {
        const buttons = document.querySelectorAll('.login-person-btn');
        const groups = document.querySelectorAll('.login-unit-group');
        const term = searchTerm.toLowerCase().trim();

        groups.forEach(group => {
            let hasVisible = false;
            const btns = group.querySelectorAll('.login-person-btn');
            btns.forEach(btn => {
                const name = btn.querySelector('.login-person-name').textContent.toLowerCase();
                const rank = btn.querySelector('.login-person-rank').textContent.toLowerCase();
                const match = !term || name.includes(term) || rank.includes(term);
                btn.style.display = match ? '' : 'none';
                if (match) hasVisible = true;
            });
            group.style.display = hasVisible ? '' : 'none';
        });
    }

    selectLoginUser(personId) {
        const person = authManager.findPersonById(personId);
        if (!person) return;

        // Save session as user (not admin)
        authManager.saveSession(person, false);
        authManager.logAction('login', personId, { mode: 'user' });

        this.hideLoginScreen();
        this.onLoginSuccess();
        this.showToast(`ยินดี ${person.rank} ${person.firstName} ${person.lastName}`, 'success');
    }

    loginAsAdmin() {
        const pin = document.getElementById('adminPinInput').value;
        if (pin !== authManager.ADMIN_PIN) {
            this.showToast('รหัส PIN ไม่ถูกต้อง', 'error');
            document.getElementById('adminPinInput').value = '';
            return;
        }

        // Admin uses first person as placeholder identity
        const adminUser = {
            id: 'ADMIN',
            rank: '',
            firstName: 'Admin',
            lastName: 'ผู้ดูแลระบบ',
            pageKey: 'page1',
            unit: 'ทุกหน่วย'
        };

        authManager.saveSession(adminUser, true);
        authManager.logAction('login', 'ADMIN', { mode: 'admin' });

        document.getElementById('adminPinInput').value = '';
        this.hideLoginScreen();
        this.onLoginSuccess();
        this.showToast('เข้าสู่ระบบในโหมด Admin', 'success');
    }

    handleLogout() {
        if (!confirm('ต้องการออกจากระบบหรือไม่?')) return;
        authManager.logAction('logout', authManager.currentUser?.id || 'ADMIN', {});
        authManager.logout();
        this.showLoginScreen();
        this.showToast('ออกจากระบบแล้ว', 'success');
    }

    toggleAdminLogin() {
        const section = document.getElementById('adminLoginSection');
        section.style.display = section.style.display === 'none' ? 'block' : 'none';
        if (section.style.display !== 'none') {
            document.getElementById('adminPinInput').focus();
        }
    }

    // Load data from localStorage or default
    async loadData() {
        // โหลดข้อมูลจาก DEFAULT_DATA หรือ localStorage ก่อน (fallback)
        for (const key of this.pageKeys) {
            const localData = storageManager.loadPageData(key);
            if (localData) {
                this.data[key] = localData;
            } else {
                this.data[key] = JSON.parse(JSON.stringify(DEFAULT_DATA[key]));
                storageManager.savePageData(key, this.data[key]);
            }
        }
    }

    // Sync data from Google Sheets (fetch all pages in 1 request)
    async syncFromSheets(silent = false) {
        try {
            // ดึงข้อมูลทุก page ใน 1 request
            const allSheetsData = await sheetsAPI.fetchAllData();
            if (!allSheetsData) return;

            let hasChanges = false;
            for (const key of this.pageKeys) {
                if (allSheetsData[key]) {
                    const changed = this.mergeData(key, allSheetsData[key]);
                    if (changed) hasChanges = true;
                }
            }

            if (hasChanges) {
                this.renderPage(this.currentPage);
                this.renderNavTabs();
                this.updateStorageIndicator();
            }

            if (!silent) this.showToast('ซิงค์ข้อมูลจาก Google Sheets แล้ว', 'success');
        } catch (err) {
            console.warn('syncFromSheets error:', err);
        }
    }

    // Polling - ดึงข้อมูลใหม่ทุก 30 วินาที (ให้เห็นการเปลี่ยนแปลงจากอุปกรณ์อื่น)
    startPolling() {
        if (!CONFIG.APPS_SCRIPT_URL) return;
        setInterval(async () => {
            if (sheetsAPI.isConnected) {
                await this.syncFromSheets(true); // silent = ไม่แสดง toast
            } else {
                // ลองเชื่อมต่อใหม่ถ้าหลุด
                const ok = await sheetsAPI.checkConnection();
                this.updateConnectionStatus(ok);
            }
        }, 30000); // ทุก 30 วินาที
    }

    // Merge remote sheet data into local data
    // คืนค่า true ถ้ามีการเปลี่ยนแปลง
    mergeData(pageKey, remoteData) {
        // remoteData = { personnel: [...], lastUpdated: '...' }
        const personnel = remoteData.personnel || remoteData;
        if (!personnel || !personnel.length) return false;

        const localPage = this.data[pageKey];
        if (!localPage) return false;

        let changed = false;
        personnel.forEach(remote => {
            const local = localPage.personnel.find(p => p.id === remote.id);
            if (local) {
                // อัปเดตสถานะจาก Sheets เสมอ (Sheets = source of truth)
                if (remote.taxStatus !== local.taxStatus) {
                    local.taxStatus = remote.taxStatus || '';
                    changed = true;
                }
                if (remote.verifiedBy && remote.verifiedBy !== local.verifiedBy) {
                    local.verifiedBy = remote.verifiedBy;
                    changed = true;
                }
                if (remote.verifiedAt && remote.verifiedAt !== local.verifiedAt) {
                    local.verifiedAt = remote.verifiedAt;
                    changed = true;
                }
            }
        });

        if (changed) storageManager.savePageData(pageKey, localPage);
        return changed;
    }

    // Get stats for a page
    getPageStats(pageKey) {
        const page = this.data[pageKey];
        if (!page) return { total: 0, filed: 0, notFiled: 0, pending: 0, percentage: 0 };

        const total = page.personnel.length;
        const filed = page.personnel.filter(p => p.taxStatus === CONFIG.STATUS.FILED).length;
        const notFiled = page.personnel.filter(p => p.taxStatus === CONFIG.STATUS.NOT_FILED).length;
        const pending = total - filed - notFiled;
        const percentage = total > 0 ? Math.round((filed / total) * 100) : 0;

        return { total, filed, notFiled, pending, percentage };
    }

    // Get overall stats
    getOverallStats() {
        let total = 0, filed = 0, notFiled = 0, pending = 0;
        for (const key of this.pageKeys) {
            const stats = this.getPageStats(key);
            total += stats.total;
            filed += stats.filed;
            notFiled += stats.notFiled;
            pending += stats.pending;
        }
        const percentage = total > 0 ? Math.round((filed / total) * 100) : 0;
        return { total, filed, notFiled, pending, percentage };
    }

    // ===== RENDERING =====

    // Render navigation tabs
    renderNavTabs() {
        const container = document.getElementById('navTabs');
        container.innerHTML = this.pageKeys.map(key => {
            const stats = this.getPageStats(key);
            const isActive = key === this.currentPage;
            const isComplete = stats.percentage === 100 && stats.total > 0;
            return `
                <button class="nav-tab ${isActive ? 'active' : ''}"
                        data-page="${key}"
                        onclick="app.switchPage('${key}')">
                    ${this.pageLabels[key]}
                    <span class="nav-tab-badge ${isComplete ? '' : 'incomplete'}">
                        ${stats.percentage}%
                    </span>
                </button>
            `;
        }).join('');
    }

    // Switch page
    switchPage(pageKey) {
        if (pageKey === this.currentPage) return;

        this.selectedRows.clear();
        this.searchTerm = '';
        this.filterStatus = 'all';
        this.currentPage = pageKey;

        // Animate transition
        const content = document.getElementById('pageContent');
        content.classList.add('entering');

        setTimeout(() => {
            this.renderNavTabs();
            this.renderPage(pageKey);
            content.classList.remove('entering');
        }, 150);

        this.updateBatchBar();
    }

    // Render a full page
    renderPage(pageKey) {
        const page = this.data[pageKey];
        if (!page) return;

        const stats = this.getPageStats(pageKey);
        const overall = this.getOverallStats();

        document.getElementById('pageTitle').textContent = page.title;
        document.getElementById('pageSubtitle').textContent = page.subtitle;

        this.renderStats(stats, overall);
        this.renderProgressBar(stats);
        this.renderToolbar(stats);
        this.renderTable(pageKey);
        this.renderFooter(stats);
    }

    // Render statistics cards
    renderStats(stats, overall) {
        const container = document.getElementById('statsRow');
        container.innerHTML = `
            <div class="stat-card animate-slide-up">
                <div class="stat-label">กำลังพลทั้งหมด</div>
                <div class="stat-value">${stats.total}</div>
                <div class="stat-detail">รวมทุกหน่วย ${overall.total} นาย</div>
            </div>
            <div class="stat-card animate-slide-up">
                <div class="stat-label">ยื่นภาษีแล้ว</div>
                <div class="stat-value success">${stats.filed}</div>
                <div class="stat-detail">${stats.percentage}% ของทั้งหมด</div>
            </div>
            <div class="stat-card animate-slide-up">
                <div class="stat-label">ยังไม่ยื่น</div>
                <div class="stat-value warning">${stats.notFiled}</div>
                <div class="stat-detail">${stats.total > 0 ? Math.round((stats.notFiled / stats.total) * 100) : 0}% ของทั้งหมด</div>
            </div>
            <div class="stat-card animate-slide-up">
                <div class="stat-label">รอดำเนินการ</div>
                <div class="stat-value accent">${stats.pending}</div>
                <div class="stat-detail">ยังไม่ระบุสถานะ</div>
            </div>
        `;
    }

    // Render progress bar
    renderProgressBar(stats) {
        document.getElementById('progressPercentage').textContent = `${stats.percentage}%`;
        document.getElementById('progressFill').style.width = `${stats.percentage}%`;
    }

    // Render toolbar
    renderToolbar(stats) {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.value = this.searchTerm;
    }

    // Get filtered personnel
    getFilteredPersonnel(pageKey) {
        const page = this.data[pageKey];
        if (!page) return [];

        let personnel = [...page.personnel];

        // Apply search filter
        if (this.searchTerm) {
            const term = this.searchTerm.toLowerCase();
            personnel = personnel.filter(p =>
                p.firstName.toLowerCase().includes(term) ||
                p.lastName.toLowerCase().includes(term) ||
                p.rank.toLowerCase().includes(term) ||
                `${p.firstName} ${p.lastName}`.toLowerCase().includes(term)
            );
        }

        // Apply status filter
        if (this.filterStatus === 'filed') {
            personnel = personnel.filter(p => p.taxStatus === CONFIG.STATUS.FILED);
        } else if (this.filterStatus === 'not-filed') {
            personnel = personnel.filter(p => p.taxStatus === CONFIG.STATUS.NOT_FILED);
        } else if (this.filterStatus === 'pending') {
            personnel = personnel.filter(p => !p.taxStatus);
        }

        return personnel;
    }

    // Render data table
    renderTable(pageKey) {
        const tbody = document.getElementById('tableBody');
        const personnel = this.getFilteredPersonnel(pageKey);

        // Show/hide admin-only header checkbox
        const headerCheckbox = document.querySelector('thead .checkbox-input');
        if (headerCheckbox) {
            headerCheckbox.parentElement.parentElement.style.visibility = authManager.isAdminMode() ? '' : 'hidden';
        }

        // Show/hide admin-only toolbar buttons
        const adminButtons = document.querySelectorAll('.toolbar-right .btn');
        adminButtons.forEach(btn => {
            btn.style.display = authManager.isAdminMode() ? '' : 'none';
        });

        if (personnel.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6">
                        <div class="empty-state">
                            <svg class="empty-state-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                                    d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/>
                            </svg>
                            <div class="empty-state-text">ไม่พบข้อมูลที่ตรงกับการค้นหา</div>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        const allPage = this.data[pageKey].personnel;
        const isAdmin = authManager.isAdminMode();
        const currentUserId = authManager.currentUser?.id;

        tbody.innerHTML = personnel.map((person, index) => {
            const globalIndex = allPage.indexOf(person) + 1;
            const isSelected = this.selectedRows.has(person.id);
            const isFiled = person.taxStatus === CONFIG.STATUS.FILED;
            const statusClass = isFiled ? 'status-filed' : (person.taxStatus === CONFIG.STATUS.NOT_FILED ? 'status-not-filed' : '');
            const rowClass = isFiled ? 'row-filed' : '';
            const canEdit = this.canEditPerson(person.id);
            const isMe = currentUserId === person.id;

            // Verification info
            const vInfo = person.verifiedBy ? {
                name: person.verifiedBy.name,
                time: person.verifiedAt ? new Date(person.verifiedAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '',
                isSelf: person.isSelfVerified,
                isAdmin: person.isAdminVerified
            } : null;

            // Build verification badge
            let verifyBadge = '';
            if (person.taxStatus === CONFIG.STATUS.FILED && vInfo) {
                if (vInfo.isSelf) {
                    verifyBadge = `
                        <div class="verify-badge self-verified" title="ยืนยันด้วยตนเองเมื่อ ${vInfo.time}">
                            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                            <span>ยืนยันด้วยตนเอง</span>
                        </div>
                        <div class="verify-time">${vInfo.time}</div>`;
                } else {
                    verifyBadge = `
                        <div class="verify-badge admin-verified" title="ยืนยันโดย ${vInfo.name} เมื่อ ${vInfo.time}">
                            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                            <span>โดย ${vInfo.isAdmin ? 'Admin' : vInfo.name}</span>
                        </div>
                        <div class="verify-time">${vInfo.time}</div>`;
                }
            } else if (person.taxStatus === CONFIG.STATUS.NOT_FILED && vInfo) {
                verifyBadge = `
                    <div class="verify-badge not-filed-verified">
                        <span>แจ้งโดย ${vInfo.isSelf ? 'ตนเอง' : vInfo.name}</span>
                    </div>
                    <div class="verify-time">${vInfo.time}</div>`;
            } else if (!person.taxStatus) {
                verifyBadge = `<span class="status-badge pending">รอดำเนินการ</span>`;
            }

            return `
                <tr class="${rowClass} ${isMe ? 'row-me' : ''}" data-id="${person.id}">
                    <td>
                        ${isAdmin ? `
                        <div class="checkbox-wrapper">
                            <input type="checkbox" class="checkbox-input"
                                ${isSelected ? 'checked' : ''}
                                onchange="app.toggleRowSelection('${person.id}', this.checked)">
                        </div>` : `
                        <div class="checkbox-wrapper">
                            ${isMe ? '<span class="me-indicator">◀</span>' : ''}
                        </div>`}
                    </td>
                    <td>
                        <span class="row-number">${globalIndex}</span>
                    </td>
                    <td>
                        <span class="rank-text">${person.rank}</span>
                    </td>
                    <td>
                        <div class="name-cell">
                            <span class="name-full">${person.firstName} ${person.lastName}</span>
                            ${isMe ? '<span class="me-tag">คุณ</span>' : ''}
                        </div>
                    </td>
                    <td>
                        ${canEdit ? `
                        <select class="status-select ${statusClass}"
                                onchange="app.updateStatus('${person.id}', this.value)"
                                data-person-id="${person.id}">
                            <option value="" ${!person.taxStatus ? 'selected' : ''}>-- เลือกสถานะ --</option>
                            <option value="${CONFIG.STATUS.FILED}" ${person.taxStatus === CONFIG.STATUS.FILED ? 'selected' : ''}>
                                ${CONFIG.STATUS.FILED}
                            </option>
                            <option value="${CONFIG.STATUS.NOT_FILED}" ${person.taxStatus === CONFIG.STATUS.NOT_FILED ? 'selected' : ''}>
                                ${CONFIG.STATUS.NOT_FILED}
                            </option>
                        </select>` : `
                        <span class="status-badge ${isFiled ? 'filed' : (person.taxStatus === CONFIG.STATUS.NOT_FILED ? 'not-filed' : 'pending')}">
                            ${person.taxStatus || 'รอดำเนินการ'}
                        </span>`}
                    </td>
                    <td class="hide-mobile">
                        <div class="verify-cell">
                            ${verifyBadge}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Render footer
    renderFooter(stats) {
        const footer = document.getElementById('pageFooter');
        const lastUpdated = storageManager.getLastUpdated(this.currentPage);
        const timeStr = lastUpdated ? new Date(lastUpdated).toLocaleString('th-TH') : '-';

        footer.innerHTML = `
            <div class="footer-info">
                <div class="footer-stat">
                    <span class="footer-stat-dot filed"></span>
                    ยื่นแล้ว ${stats.filed} นาย
                </div>
                <div class="footer-stat">
                    <span class="footer-stat-dot not-filed"></span>
                    ยังไม่ยื่น ${stats.notFiled} นาย
                </div>
                <div class="footer-stat" style="color: var(--color-text-tertiary);">
                    อัปเดตล่าสุด: ${timeStr}
                </div>
            </div>
            <div class="footer-actions">
                <button class="btn btn-secondary" onclick="app.exportData()">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                    Export
                </button>
                <button class="btn btn-primary" onclick="app.saveCurrentPage()">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M5 13l4 4L19 7"/>
                    </svg>
                    บันทึก
                </button>
            </div>
        `;
    }

    // ===== EVENT HANDLERS =====

    // Bind global events
    bindGlobalEvents() {
        // Search input
        const searchInput = document.getElementById('searchInput');
        searchInput.addEventListener('input', this.debounce((e) => {
            this.searchTerm = e.target.value;
            this.renderTable(this.currentPage);
        }, 200));

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl+S to save
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                this.saveAllPages();
            }
            // Escape to deselect
            if (e.key === 'Escape') {
                this.selectedRows.clear();
                this.renderTable(this.currentPage);
                this.updateBatchBar();
            }
        });

        // Save before page close/refresh
        window.addEventListener('beforeunload', () => {
            this.saveAllPages();
        });

        // Save when user switches tabs or minimizes
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.saveAllPages();
            }
        });

        // Save when user goes offline
        window.addEventListener('offline', () => {
            this.saveAllPages();
            this.showToast('Offline - ข้อมูลบันทึกอัตโนมัติแล้ว', 'success');
        });

        // Detect storage changes from other tabs
        window.addEventListener('storage', (e) => {
            if (e.key && e.key.startsWith('vat_tax_')) {
                this.loadData().then(() => {
                    this.renderPage(this.currentPage);
                    this.renderNavTabs();
                });
            }
        });
    }

    // Filter by status
    setFilter(status) {
        this.filterStatus = status;

        // Update active filter button
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === status);
        });

        this.renderTable(this.currentPage);
    }

    // Check if current user can edit a person
    canEditPerson(personId) {
        if (authManager.isAdminMode()) return true;
        return authManager.isOwnRecord(personId);
    }

    // Update individual status (with auth check + audit log)
    updateStatus(personId, status) {
        // Auth check
        if (!this.canEditPerson(personId)) {
            this.showToast('คุณสามารถเปลี่ยนสถานะได้เฉพาะของตัวเองเท่านั้น', 'error');
            this.renderTable(this.currentPage); // reset the dropdown
            return;
        }

        const page = this.data[this.currentPage];
        const person = page.personnel.find(p => p.id === personId);
        if (person) {
            const oldStatus = person.taxStatus;
            person.taxStatus = status;

            // Record verification info
            person.verifiedBy = authManager.currentUser ? {
                id: authManager.currentUser.id,
                rank: authManager.currentUser.rank,
                name: `${authManager.currentUser.firstName} ${authManager.currentUser.lastName}`
            } : null;
            person.verifiedAt = new Date().toISOString();
            person.isSelfVerified = authManager.currentUser && authManager.currentUser.id === personId;
            person.isAdminVerified = authManager.isAdminMode();

            storageManager.savePageData(this.currentPage, page);

            // Audit log
            authManager.logAction('status_change', personId, {
                oldStatus: oldStatus,
                newStatus: status,
                pageKey: this.currentPage
            });

            // Sync to Google Sheets
            if (sheetsAPI.isConnected) {
                sheetsAPI.updateStatus(this.currentPage, personId, {
                    status: person.taxStatus,
                    verifiedBy: person.verifiedBy ? person.verifiedBy.name : '',
                    verifiedAt: person.verifiedAt,
                    verifyType: person.isSelfVerified ? 'self' : 'admin'
                });
            }

            // Re-render
            const stats = this.getPageStats(this.currentPage);
            const overall = this.getOverallStats();
            this.renderStats(stats, overall);
            this.renderProgressBar(stats);
            this.renderNavTabs();
            this.renderTable(this.currentPage);
            this.renderFooter(stats);
            this.updateStorageIndicator();

            const isSelf = person.isSelfVerified;
            const statusText = status === CONFIG.STATUS.FILED ? 'ยื่นภาษีแล้ว' :
                              status === CONFIG.STATUS.NOT_FILED ? 'ยังไม่ยื่น' : 'รีเซ็ต';
            const verifyText = isSelf ? ' (ยืนยันด้วยตนเอง)' : '';
            this.showToast(`${person.rank} ${person.firstName} - ${statusText}${verifyText}`, 'success');
        }
    }

    // Toggle row selection
    toggleRowSelection(personId, checked) {
        if (checked) {
            this.selectedRows.add(personId);
        } else {
            this.selectedRows.delete(personId);
        }
        this.updateBatchBar();
    }

    // Select/deselect all visible rows
    toggleSelectAll(checked) {
        const personnel = this.getFilteredPersonnel(this.currentPage);
        if (checked) {
            personnel.forEach(p => this.selectedRows.add(p.id));
        } else {
            this.selectedRows.clear();
        }
        this.renderTable(this.currentPage);
        this.updateBatchBar();
    }

    // Batch update selected rows
    batchUpdateStatus(status) {
        if (!authManager.isAdminMode()) {
            this.showToast('เฉพาะ Admin เท่านั้นที่สามารถอัปเดตแบบกลุ่มได้', 'error');
            return;
        }

        const page = this.data[this.currentPage];
        const updates = [];

        this.selectedRows.forEach(id => {
            const person = page.personnel.find(p => p.id === id);
            if (person) {
                const oldStatus = person.taxStatus;
                person.taxStatus = status;
                person.verifiedBy = { id: 'ADMIN', rank: '', name: 'Admin' };
                person.verifiedAt = new Date().toISOString();
                person.isSelfVerified = false;
                person.isAdminVerified = true;
                updates.push({ id, status });
                authManager.logAction('status_change', id, { oldStatus, newStatus: status, pageKey: this.currentPage, batch: true });
            }
        });

        storageManager.savePageData(this.currentPage, page);

        // Sync batch to Sheets
        if (sheetsAPI.isConnected && updates.length) {
            const fullUpdates = updates.map(u => ({
                ...u,
                verifiedBy: 'Admin',
                verifiedAt: new Date().toISOString(),
                verifyType: 'admin'
            }));
            sheetsAPI.batchUpdateStatus(this.currentPage, fullUpdates);
        }

        const count = this.selectedRows.size;
        this.selectedRows.clear();

        // Re-render everything
        const stats = this.getPageStats(this.currentPage);
        const overall = this.getOverallStats();
        this.renderStats(stats, overall);
        this.renderProgressBar(stats);
        this.renderNavTabs();
        this.renderTable(this.currentPage);
        this.renderFooter(stats);
        this.updateBatchBar();

        const statusText = status === CONFIG.STATUS.FILED ? 'ยื่นภาษีแล้ว' : 'ยังไม่ยื่น';
        this.showToast(`อัปเดต ${count} รายการ - ${statusText}`, 'success');
    }

    // Update batch action bar visibility
    updateBatchBar() {
        const bar = document.getElementById('batchBar');
        const countEl = document.getElementById('batchCount');

        if (this.selectedRows.size > 0) {
            bar.classList.add('visible');
            countEl.textContent = this.selectedRows.size;
        } else {
            bar.classList.remove('visible');
        }
    }

    // ===== SAVE / EXPORT =====

    // Save current page data
    saveCurrentPage() {
        this.saveAllPages();
        const stats = this.getPageStats(this.currentPage);
        this.renderFooter(stats);
        this.showToast('บันทึกข้อมูลทั้งหมดเรียบร้อย', 'success');
    }

    // Export data as CSV (with verification info)
    exportData() {
        const page = this.data[this.currentPage];
        const headers = ['ลำดับ', 'ยศ', 'ชื่อ', 'นามสกุล', 'สถานะการยื่นภาษี', 'ยืนยันตัวเอง', 'ยืนยันโดย', 'เวลายืนยัน'];
        const rows = page.personnel.map((p, i) => [
            i + 1,
            p.rank,
            p.firstName,
            p.lastName,
            p.taxStatus || 'รอดำเนินการ',
            p.isSelfVerified ? 'ใช่' : 'ไม่ใช่',
            p.verifiedBy ? p.verifiedBy.name : '-',
            p.verifiedAt ? new Date(p.verifiedAt).toLocaleString('th-TH') : '-'
        ]);

        // BOM for UTF-8
        const BOM = '\uFEFF';
        const csv = BOM + [headers, ...rows]
            .map(row => row.map(cell => `"${cell}"`).join(','))
            .join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${page.subtitle}_สถานะยื่นภาษี_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);

        this.showToast('Export สำเร็จ', 'success');
    }

    // Export all pages
    exportAllData() {
        const allData = [];
        const headers = ['หน่วย', 'ลำดับ', 'ยศ', 'ชื่อ', 'นามสกุล', 'สถานะการยื่นภาษี'];

        for (const key of this.pageKeys) {
            const page = this.data[key];
            page.personnel.forEach((p, i) => {
                allData.push([
                    page.subtitle,
                    i + 1,
                    p.rank,
                    p.firstName,
                    p.lastName,
                    p.taxStatus || 'รอดำเนินการ'
                ]);
            });
        }

        const BOM = '\uFEFF';
        const csv = BOM + [headers, ...allData]
            .map(row => row.map(cell => `"${cell}"`).join(','))
            .join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `ร19พัน1_สถานะยื่นภาษีทั้งหมด_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);

        this.showToast('Export ทั้งหมดสำเร็จ', 'success');
    }

    // ===== UTILITIES =====

    // Save all pages to localStorage
    saveAllPages() {
        for (const key of this.pageKeys) {
            if (this.data[key]) {
                storageManager.savePageData(key, this.data[key]);
            }
        }
        this.updateStorageIndicator();
    }

    // Auto-save timer - saves ALL pages, not just current
    startAutoSave() {
        setInterval(() => {
            this.saveAllPages();
        }, CONFIG.AUTO_SAVE_INTERVAL);

        // Also update storage indicator on init
        this.updateStorageIndicator();
    }

    // Update storage indicator in header
    updateStorageIndicator() {
        const el = document.getElementById('storageIndicator');
        if (!el) return;

        const totalSaved = this.pageKeys.filter(key => {
            return storageManager.getLastUpdated(key) !== null;
        }).length;

        const overall = this.getOverallStats();
        const lastUpdated = storageManager.getLastUpdated(this.currentPage);
        const timeStr = lastUpdated
            ? new Date(lastUpdated).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
            : '--:--';

        el.innerHTML = `
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="opacity: 0.6;">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/>
            </svg>
            <span>บันทึก ${timeStr}</span>
            <span style="color: var(--color-success);">&#x2022;</span>
            <span>${overall.filed}/${overall.total} ยื่นแล้ว</span>
        `;
    }

    // Show loading state
    showLoading() {
        this.isLoading = true;
    }

    // Hide loading state
    hideLoading() {
        this.isLoading = false;
        const loader = document.getElementById('appLoader');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.remove(), 300);
        }
    }

    // Update connection status dot
    updateConnectionStatus(connected) {
        const dot = document.getElementById('connectionDot');
        const text = document.getElementById('connectionText');
        if (dot) {
            dot.classList.toggle('connected', connected);
        }
        if (text) {
            text.textContent = connected ? 'Google Sheets' : 'Offline';
        }
    }

    // Show toast notification
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = 'toast';

        const iconSvg = type === 'success'
            ? `<svg class="toast-icon success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
               </svg>`
            : `<svg class="toast-icon error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
               </svg>`;

        toast.innerHTML = `${iconSvg}<span>${message}</span>`;
        container.appendChild(toast);

        // Trigger animation
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Auto remove
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, 2500);
    }

    // Debounce utility
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Show audit log modal
    showAuditLog() {
        const logs = authManager.getRecentLogs(50);
        const modal = document.getElementById('auditLogModal');
        const body = document.getElementById('auditLogBody');

        body.innerHTML = logs.length === 0
            ? '<tr><td colspan="5" style="text-align: center; padding: 32px; color: var(--color-text-tertiary);">ยังไม่มีประวัติการใช้งาน</td></tr>'
            : logs.map(log => {
                const time = new Date(log.timestamp).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
                const person = authManager.findPersonById(log.personId);
                const personName = person ? `${person.rank} ${person.firstName}` : log.personId;
                const actionLabel = log.action === 'login' ? 'เข้าระบบ' :
                                   log.action === 'logout' ? 'ออกจากระบบ' :
                                   log.action === 'status_change' ? 'เปลี่ยนสถานะ' : log.action;
                const selfBadge = log.isSelfVerification
                    ? '<span class="verify-badge self-verified" style="display:inline-flex;font-size:10px;padding:1px 6px;"><span>ตนเอง</span></span>'
                    : (log.isAdmin ? '<span class="verify-badge admin-verified" style="display:inline-flex;font-size:10px;padding:1px 6px;"><span>Admin</span></span>' : '');
                const detail = log.details.newStatus || log.details.mode || '';

                return `<tr>
                    <td style="white-space:nowrap;">${time}</td>
                    <td>${log.performedBy ? log.performedBy.name : '-'}</td>
                    <td>${actionLabel} ${selfBadge}</td>
                    <td>${personName}</td>
                    <td>${detail}</td>
                </tr>`;
            }).join('');

        modal.style.display = 'flex';
    }

    closeAuditLog() {
        document.getElementById('auditLogModal').style.display = 'none';
    }

    exportAuditLog() {
        authManager.exportAuditLog();
        this.showToast('Export Audit Log สำเร็จ', 'success');
    }

    // Mark all as filed (Admin only)
    markAllAsFiled() {
        if (!authManager.isAdminMode()) {
            this.showToast('เฉพาะ Admin เท่านั้นที่ใช้ฟังก์ชั่นนี้ได้', 'error');
            return;
        }
        if (!confirm('ต้องการทำเครื่องหมายว่ากำลังพลทั้งหมดในหน้านี้ยื่นภาษีแล้วหรือไม่?\n(จะบันทึกว่า Admin เป็นผู้ยืนยัน ไม่ใช่การยืนยันตัวเอง)')) return;

        const page = this.data[this.currentPage];
        page.personnel.forEach(p => {
            p.taxStatus = CONFIG.STATUS.FILED;
            p.verifiedBy = { id: 'ADMIN', rank: '', name: 'Admin' };
            p.verifiedAt = new Date().toISOString();
            p.isSelfVerified = false;
            p.isAdminVerified = true;
            authManager.logAction('status_change', p.id, { oldStatus: '', newStatus: CONFIG.STATUS.FILED, pageKey: this.currentPage, batch: true });
        });

        storageManager.savePageData(this.currentPage, page);

        const stats = this.getPageStats(this.currentPage);
        const overall = this.getOverallStats();
        this.renderStats(stats, overall);
        this.renderProgressBar(stats);
        this.renderNavTabs();
        this.renderTable(this.currentPage);
        this.renderFooter(stats);

        this.showToast(`อัปเดตทั้งหมด ${page.personnel.length} นาย - ยื่นภาษีแล้ว`, 'success');
    }

    // Reset all statuses (Admin only)
    resetAllStatus() {
        if (!authManager.isAdminMode()) {
            this.showToast('เฉพาะ Admin เท่านั้นที่ใช้ฟังก์ชั่นนี้ได้', 'error');
            return;
        }
        if (!confirm('ต้องการรีเซ็ตสถานะทั้งหมดในหน้านี้หรือไม่?')) return;

        const page = this.data[this.currentPage];
        page.personnel.forEach(p => {
            p.taxStatus = '';
            p.verifiedBy = null;
            p.verifiedAt = null;
            p.isSelfVerified = false;
            p.isAdminVerified = false;
        });

        authManager.logAction('reset_page', 'ALL', { pageKey: this.currentPage });
        storageManager.savePageData(this.currentPage, page);
        this.updateStorageIndicator();

        const stats = this.getPageStats(this.currentPage);
        const overall = this.getOverallStats();
        this.renderStats(stats, overall);
        this.renderProgressBar(stats);
        this.renderNavTabs();
        this.renderTable(this.currentPage);
        this.renderFooter(stats);

        this.showToast('รีเซ็ตสถานะทั้งหมดแล้ว', 'success');
    }

    // Reset ALL data (factory reset, Admin only)
    resetAllData() {
        if (!authManager.isAdminMode()) {
            this.showToast('เฉพาะ Admin เท่านั้นที่ใช้ฟังก์ชั่นนี้ได้', 'error');
            return;
        }
        if (!confirm('ต้องการลบข้อมูลทั้งหมดและกลับค่าเริ่มต้น?\n\nข้อมูลสถานะที่เคยบันทึกไว้จะหายทั้งหมด!')) return;
        if (!confirm('ยืนยันอีกครั้ง - ลบข้อมูลทั้งหมด?')) return;
        authManager.logAction('factory_reset', 'ALL', {});

        storageManager.clearAll();
        for (const key of this.pageKeys) {
            this.data[key] = JSON.parse(JSON.stringify(DEFAULT_DATA[key]));
            storageManager.savePageData(key, this.data[key]);
        }

        this.renderNavTabs();
        this.renderPage(this.currentPage);
        this.updateStorageIndicator();
        this.showToast('ลบข้อมูลทั้งหมดและรีเซ็ตกลับค่าเริ่มต้นแล้ว', 'success');
    }
}

// Initialize app when DOM loaded
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new TaxVerificationApp();
    app.init();
});
