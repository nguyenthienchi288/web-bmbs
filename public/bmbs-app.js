 // =========================================================================
  // MODULE FRONTEND JAVASCRIPT CHUYÊN NGHIỆP (AppJS.html - BMBS v2.3.0 iOS 27)
  // =========================================================================
  const STORAGE_KEY_USER = 'BMBS_SAVED_USER_V2';
  const DUES_RATE_DEFAULT = 5000;
  let currentUser = null;
  let appData = {
    dbVersion: '2.3.0',
    duesWeeklyRate: 5000,
    danhSach: [],
    lich: [],
    logTruc: [],
    khsh: [],
    thongKe: [],
    phanHoi: [],
    kyLuat: [],
    quanLyQuy: [],
    startNganhDefault: 'Chiên'
  };
  let selectedWeekTab = 'ALL';
  let filterMyScheduleOnly = false;
  let selectedFilterKhshNganh = 'ALL';
  let selectedKlLoai = 'Đi trễ';
  let selectedFixedDaysSet = new Set();
  let profileInlineFixedDaysSet = new Set();
  let selectedProfileAuditSubTab = 'UPCOMING';
  let treasuryChecklistState = {};

  // Trạng thái Hệ thống Thông báo In-App (iOS 27 Lock-Screen Notification Center)
  let userNotifications = [];
  let unreadNotificationCount = 0;
  let notificationFilterMode = 'ALL';

  // =========================================================================
  // KHỞI TẠO ỨNG DỤNG & TIỆN ÍCH GIAO DIỆN (TOAST, CONFIRM, ESCAPE HTML)
  // =========================================================================
  window.onload = function() {
    document.getElementById('loginLogo').src = LOGO_URL;
    document.getElementById('headerLogo').src = LOGO_URL;
    initMonthYearSelectors();
    initBillingCycleOptions();
    document.getElementById('klNgay').valueAsDate = new Date();
    restoreSavedSession();
  };

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeText(str) {
    return String(str || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd');
  }

  function formatVND(amount) {
    return Number(amount || 0).toLocaleString('vi-VN') + 'đ';
  }

  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const styles = {
      success: 'bg-emerald-600/90 text-white border-white/40 shadow-[0_12px_32px_rgba(5,150,105,0.3)]',
      error: 'bg-rose-600/90 text-white border-white/40 shadow-[0_12px_32px_rgba(225,29,72,0.3)]',
      warning: 'bg-amber-500/90 text-white border-white/40 shadow-[0_12px_32px_rgba(245,158,11,0.3)]',
      info: 'bg-slate-900/90 text-white border-white/30 shadow-[0_12px_32px_rgba(15,23,42,0.28)]'
    };
    const icons = {
      success: 'fa-circle-check',
      error: 'fa-circle-exclamation',
      warning: 'fa-triangle-exclamation',
      info: 'fa-bell'
    };

    const cleanMsg = String(message || '').replace(/^[✅🗑️ℹ️⚠️]+\s*/, '');
    const toast = document.createElement('div');
    toast.className = `toast-enter pointer-events-auto backdrop-blur-2xl flex items-center gap-2.5 px-4 py-3 rounded-3xl border text-xs font-bold ${styles[type] || styles.info}`;
    toast.innerHTML = `
      <i class="fa-solid ${icons[type] || icons.info} text-sm shrink-0"></i>
      <span class="flex-1 leading-snug">${escapeHtml(cleanMsg)}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.25s ease';
      setTimeout(() => toast.remove(), 260);
    }, 3400);
  }

  function askConfirm(title, message, onConfirm) {
    const modal = document.getElementById('confirmModal');
    document.getElementById('confirmModalTitle').textContent = title || 'Xác nhận';
    document.getElementById('confirmModalMessage').textContent = message || '';
    modal.classList.remove('hidden');

    const okBtn = document.getElementById('confirmOkBtn');
    const cancelBtn = document.getElementById('confirmCancelBtn');

    const cleanup = () => {
      modal.classList.add('hidden');
      okBtn.onclick = null;
      cancelBtn.onclick = null;
    };

    cancelBtn.onclick = cleanup;
    okBtn.onclick = () => {
      cleanup();
      if (typeof onConfirm === 'function') onConfirm();
    };
  }

  function initMonthYearSelectors() {
    const now = new Date();
    const mSel = document.getElementById('genMonth');
    const ySel = document.getElementById('genYear');
    if (!mSel || !ySel) return;
    mSel.innerHTML = '';
    ySel.innerHTML = '';

    for (let m = 1; m <= 12; m++) {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = 'Tháng ' + m;
      if (m === now.getMonth() + 1) opt.selected = true;
      mSel.appendChild(opt);
    }
    for (let y = now.getFullYear() - 1; y <= now.getFullYear() + 2; y++) {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = 'Năm ' + y;
      if (y === now.getFullYear()) opt.selected = true;
      ySel.appendChild(opt);
    }
  }

  function showLoading(text) {
    document.getElementById('loadingText').textContent = text || 'Đang xử lý...';
    document.getElementById('loadingOverlay').classList.remove('hidden');
  }

  function hideLoading() {
    document.getElementById('loadingOverlay').classList.add('hidden');
  }

  function togglePasswordVisibility() {
    const passInput = document.getElementById('loginPass');
    const eyeIcon = document.getElementById('loginPassEye');
    if (passInput.type === 'password') {
      passInput.type = 'text';
      eyeIcon.className = 'fa-regular fa-eye-slash';
    } else {
      passInput.type = 'password';
      eyeIcon.className = 'fa-regular fa-eye';
    }
  }

  // =========================================================================
  // 1. ĐĂNG NHẬP, LƯU PHIÊN & THIẾT LẬP PHÂN QUYỀN GIAO DIỆN (RBAC)
  // =========================================================================
  function restoreSavedSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_USER);
      if (raw) {
        const savedUser = JSON.parse(raw);
        if (savedUser && savedUser.fullName && savedUser.role) {
          currentUser = savedUser;
          setupUserPermissionsUI();
          loadAppData();
        }
      }
    } catch (e) {}
  }

  function handleLogin() {
    const u = document.getElementById('loginUser').value.trim();
    const p = document.getElementById('loginPass').value.trim();
    if (!u || !p) {
      showToast('Vui lòng nhập Tài khoản/Họ tên và Mật khẩu!', 'warning');
      return;
    }
    showLoading('Đang xác thực tài khoản...');
    google.script.run
      .withSuccessHandler(res => {
        hideLoading();
        if (!res.success) {
          showToast(res.message, 'error');
          return;
        }
        currentUser = res.user;
        if (document.getElementById('rememberMe').checked) {
          try { localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(currentUser)); } catch (e) {}
        }
        showToast('Xin chào ' + currentUser.fullName + '!', 'success');
        setupUserPermissionsUI();
        loadAppData();
      })
      .withFailureHandler(err => {
        hideLoading();
        showToast('Lỗi kết nối: ' + err.message, 'error');
      })
      .apiLogin(u, p);
  }

  function setupUserPermissionsUI() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    document.getElementById('userFullName').textContent = currentUser.fullName;

    const headerAvatar = document.getElementById('headerLogo');
    if (headerAvatar) {
      headerAvatar.src = currentUser.avatarUrl || LOGO_URL;
    }

    let badgeLabel = currentUser.note || 'Dự Trưởng';
    if (currentUser.isAdmin) {
      badgeLabel = 'System Admin';
    } else if (currentUser.role === 'THU_QUY' || currentUser.isTreasurer) {
      badgeLabel = 'Thư Ký - Thủ Quỹ (' + (currentUser.nganh || 'Toàn Đoàn') + ')';
    } else if (currentUser.role === 'TRUONG_NGANH') {
      badgeLabel = 'Trưởng Ngành ' + currentUser.nganh + ' (Quản trị ngành)';
    } else if (currentUser.role === 'KY_LUAT') {
      badgeLabel = 'Phụ Trách Kỷ Luật ';
    } else if (currentUser.role === 'HT_DONG_HANH') {
      badgeLabel = 'Huynh Trưởng Đồng Hành • Ngành ' + (currentUser.nganh || 'Chung');
    } else {
      badgeLabel = `${currentUser.capBac || 'Dự Trưởng'} • ${currentUser.roleTitle || 'Dự trưởng'} (Ngành ${currentUser.nganh || 'Chung'})`;
    }
    document.getElementById('userRoleBadge').textContent = badgeLabel;

    document.getElementById('phName').value = currentUser.fullName;
    if (['Chiên', 'Ấu', 'Thiếu', 'Nghĩa'].includes(currentUser.nganh)) {
      document.getElementById('phNganh').value = currentUser.nganh;
      document.getElementById('genTargetNganh').value = currentUser.nganh;
      document.getElementById('klNganh').value = currentUser.nganh;
      document.getElementById('khshNganh').value = currentUser.nganh;
      document.getElementById('duesBranchSelect').value = currentUser.nganh;
    }

    const availCard = document.getElementById('mySelfAvailabilityCard');
    const quickAvailBtn = document.getElementById('btnQuickOpenAvailCust');
    const custAvailTabBtn = document.getElementById('tabBtnCustAvailability');
    if (currentUser.role === 'HT_DONG_HANH') {
      document.getElementById('boxGuiPhanHoi').classList.add('hidden');
      if (availCard) availCard.classList.add('hidden');
      if (quickAvailBtn) quickAvailBtn.classList.add('hidden');
      if (custAvailTabBtn) custAvailTabBtn.classList.add('hidden');
    } else {
      document.getElementById('boxGuiPhanHoi').classList.remove('hidden');
      if (availCard) availCard.classList.remove('hidden');
      if (quickAvailBtn) quickAvailBtn.classList.remove('hidden');
      if (custAvailTabBtn) custAvailTabBtn.classList.remove('hidden');
    }

    if (currentUser.canManageDiscipline) {
      document.getElementById('formKyLuatBox').classList.remove('hidden');
    } else {
      document.getElementById('formKyLuatBox').classList.add('hidden');
    }

    if (currentUser.canManageKHSH) {
      document.getElementById('btnOpenKHSHForm').classList.remove('hidden');
      document.getElementById('khshNganh').disabled = (currentUser.role === 'TRUONG_NGANH' && !currentUser.isSupervisor);
    } else {
      document.getElementById('btnOpenKHSHForm').classList.add('hidden');
      document.getElementById('formKHSHBox').classList.add('hidden');
    }

    const canAllScheduleBranches = Boolean(currentUser.isAdmin || currentUser.isSupervisor);
    const canManageTreasury = Boolean(
      currentUser.canManageTreasury ||
      currentUser.isAdmin ||
      currentUser.isSupervisor ||
      currentUser.role === 'THU_QUY' ||
      currentUser.role === 'TRUONG_NGANH' ||
      normalizeText(currentUser.roleTitle || '').includes('thu quy') ||
      normalizeText(currentUser.roleTitle || '').includes('thu ky')
    );
    const canManageAllTreasuryBranches = Boolean(
      currentUser.canManageAllTreasuryBranches ||
      currentUser.isAdmin ||
      currentUser.isSupervisor ||
      currentUser.role === 'THU_QUY' ||
      currentUser.isTreasurer ||
      currentUser.nganh === 'Tất cả'
    );
    currentUser.canManageTreasury = canManageTreasury;
    currentUser.canManageAllTreasuryBranches = canManageAllTreasuryBranches;

    const batchBox = document.getElementById('boxTreasurerBatchChecklist');
    if (batchBox) {
      if (canManageTreasury) {
        batchBox.classList.remove('hidden');
        const branchSel = document.getElementById('duesBranchSelect');
        if (branchSel) {
          branchSel.disabled = !canManageAllTreasuryBranches;
          if (!canManageAllTreasuryBranches && ['Chiên', 'Ấu', 'Thiếu', 'Nghĩa'].includes(currentUser.nganh)) {
            branchSel.value = currentUser.nganh;
          }
        }
      } else {
        batchBox.classList.add('hidden');
      }
    }

    if (currentUser.canManageSchedule) {
      document.getElementById('boxChiaLich').classList.remove('hidden');
      document.getElementById('genTargetNganh').disabled = !canAllScheduleBranches;
      if (canAllScheduleBranches) {
        document.getElementById('btnAdminChotLich').classList.remove('hidden');
        document.getElementById('genTargetNganh').value = 'Tất cả';
      } else {
        document.getElementById('btnAdminChotLich').classList.add('hidden');
      }
    } else {
      document.getElementById('boxChiaLich').classList.add('hidden');
    }

    if (currentUser.isAdmin || currentUser.isSupervisor) {
      document.getElementById('boxCapPhatTaiKhoan').classList.remove('hidden');
    } else {
      document.getElementById('boxCapPhatTaiKhoan').classList.add('hidden');
    }
  }

  function handleLogout() {
    currentUser = null;
    userNotifications = [];
    unreadNotificationCount = 0;
    try { localStorage.removeItem(STORAGE_KEY_USER); } catch (e) {}
    document.getElementById('loginPass').value = '';
    document.getElementById('mainApp').classList.add('hidden');
    document.getElementById('loginScreen').classList.remove('hidden');
    showToast('Đã đăng xuất khỏi hệ thống.', 'info');
  }

  // =========================================================================
  // 2. ĐỒNG BỘ DỮ LIỆU, CHUYỂN TAB DYNAMIC ISLAND & HỆ THỐNG THÔNG BÁO IN-APP
  // =========================================================================
  function loadAppData() {
    showLoading('Đang đồng bộ dữ liệu...');
    google.script.run
      .withSuccessHandler(data => {
        hideLoading();
        appData = data || {
          dbVersion: '2.3.0',
          duesWeeklyRate: 5000,
          danhSach: [],
          lich: [],
          logTruc: [],
          khsh: [],
          thongKe: [],
          phanHoi: [],
          kyLuat: [],
          quanLyQuy: []
        };

        if (appData.startNganhDefault) {
          document.getElementById('genStartNganh').value = appData.startNganhDefault;
        }
        const verEl = document.getElementById('dbVersionBadge');
        if (verEl) verEl.textContent = 'v' + (appData.dbVersion || '2.3.0');

        syncCurrentUserFromDanhSach();

        populateKyLuatMembers();
        fillQuickMembersForKHSH();
        buildWeekSelectorTabs();
        renderMyUpcomingBanner();
        renderLich();
        populateKhshTuanFilter();
        renderKHSH();
        renderKyLuat();
        initBillingCycleOptions();
        renderQuyTab();
        renderThongKe();
        renderCaNhan();
        populateMyQuickShiftsForPhanHoi();
        renderPhanHoi();
        updatePendingFeedbackBadge();

        // Đồng bộ danh sách thông báo In-App của người dùng hiện tại
        refreshNotifications(false);
      })
      .withFailureHandler(err => {
        hideLoading();
        showToast('Lỗi tải dữ liệu: ' + err.message, 'error');
      })
      .apiGetAppData();
  }

  function syncCurrentUserFromDanhSach() {
    if (!currentUser) return;
    const myProfile = (appData.danhSach || []).find(
      m => normalizeText(m.name) === normalizeText(currentUser.fullName)
    );
    if (myProfile) {
      currentUser.avatarUrl = myProfile.avatarUrl || currentUser.avatarUrl || '';
      currentUser.phone = myProfile.phone || currentUser.phone || '';
      currentUser.email = myProfile.email || currentUser.email || '';
      currentUser.baptismalName = myProfile.baptismalName || currentUser.baptismalName || '';
      currentUser.roleTitle = myProfile.roleTitle || currentUser.roleTitle || 'Dự trưởng';
      currentUser.status = myProfile.status || 'Tốt';
      currentUser.statusState = myProfile.statusState || 'GOOD';
      currentUser.diligenceScore = myProfile.diligenceScore !== undefined ? myProfile.diligenceScore : 90;
      currentUser.totalDuesPaid = myProfile.totalDuesPaid || 0;

      const headerAvatar = document.getElementById('headerLogo');
      if (headerAvatar) {
        headerAvatar.src = currentUser.avatarUrl || LOGO_URL;
      }
      try {
        if (localStorage.getItem(STORAGE_KEY_USER)) {
          localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(currentUser));
        }
      } catch (e) {}
    }
  }

  /**
   * Chuyển Tab trên thanh Floating Dynamic Island Navigation Dock
   */
  function switchTab(tabName) {
    const allTabs = ['Lich', 'KHSH', 'KyLuat', 'Quy', 'ThongKe', 'CaNhan', 'PhanHoi'];
    allTabs.forEach(t => {
      const sec = document.getElementById('tab' + t);
      if (sec) sec.classList.add('hidden');
      const nav = document.getElementById('nav' + t);
      if (nav) {
        nav.className = 'nav-item flex flex-col items-center justify-center rounded-full text-slate-500 hover:text-slate-800 font-medium text-[10px] py-1.5 px-2.5 transition-all duration-200 relative';
      }
    });

    const targetSec = document.getElementById('tab' + tabName);
    if (targetSec) targetSec.classList.remove('hidden');

    const activeNav = document.getElementById('nav' + tabName);
    if (activeNav) {
      activeNav.className = 'nav-item flex flex-col items-center justify-center rounded-full bg-blue-600/12 text-blue-600 font-bold text-[10px] py-1.5 px-2.5 transition-all duration-200 relative shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)]';
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updatePendingFeedbackBadge() {
    const badge = document.getElementById('badgePendingPhanHoi');
    if (!badge || !currentUser) return;
    const pendingList = (appData.phanHoi || []).filter(item => {
      if (item.trangThai === 'Đã xử lý') return false;
      if (currentUser.role === 'TRUONG_NGANH' && !currentUser.isSupervisor && item.nganh !== currentUser.nganh) return false;
      return true;
    });

    if (pendingList.length > 0 && (currentUser.canManageSchedule || currentUser.isAdmin)) {
      badge.textContent = pendingList.length;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  // =========================================================================
  // 2B. TRUNG TÂM THÔNG BÁO IN-APP (iOS LOCK-SCREEN NOTIFICATION CENTER)
  // =========================================================================

  /**
   * Tải danh sách thông báo của người dùng từ apiGetThongBao(username)
   */
  function refreshNotifications(showToastFeedback) {
    if (!currentUser) return;
    const identifier = currentUser.username || currentUser.fullName;

    google.script.run
      .withSuccessHandler(res => {
        if (res && res.success) {
          userNotifications = res.notifications || [];
          unreadNotificationCount = Number(res.unreadCount || 0);
          updateNotificationBellBadge();
          renderNotificationCenter();
          if (showToastFeedback) {
            showToast('Đã cập nhật Trung tâm Thông báo!', 'info');
          }
        }
      })
      .withFailureHandler(err => {
        if (showToastFeedback) {
          showToast('Không thể tải thông báo: ' + err.message, 'error');
        }
      })
      .apiGetThongBao(identifier);
  }

  function updateNotificationBellBadge() {
    const badge = document.getElementById('badgeUnreadThongBao');
    const subtitle = document.getElementById('notifCenterSubtitle');
    if (!badge) return;

    const unread = userNotifications.filter(n => n.status === 'Unread').length;
    unreadNotificationCount = unread;

    if (unread > 0) {
      badge.textContent = unread > 99 ? '99+' : String(unread);
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }

    if (subtitle) {
      subtitle.textContent = unread > 0
        ? `Bạn có ${unread} thông báo chưa đọc • Chạm vào thẻ để đánh dấu đã đọc`
        : `Tất cả ${userNotifications.length} thông báo đã được đọc`;
    }
  }

  function openNotificationCenter() {
    const modal = document.getElementById('notificationCenterModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    renderNotificationCenter();
    refreshNotifications(false);
  }

  function closeNotificationCenter() {
    const modal = document.getElementById('notificationCenterModal');
    if (modal) modal.classList.add('hidden');
  }

  function setNotificationFilter(mode) {
    notificationFilterMode = mode || 'ALL';
    const btnAll = document.getElementById('btnNotifFilterAll');
    const btnUnread = document.getElementById('btnNotifFilterUnread');

    if (btnAll && btnUnread) {
      if (notificationFilterMode === 'UNREAD') {
        btnUnread.className = 'px-3 py-1 rounded-full text-[11px] font-bold bg-slate-900 text-white transition';
        btnAll.className = 'px-3 py-1 rounded-full text-[11px] font-semibold text-slate-600 hover:text-slate-900 transition';
      } else {
        btnAll.className = 'px-3 py-1 rounded-full text-[11px] font-bold bg-slate-900 text-white transition';
        btnUnread.className = 'px-3 py-1 rounded-full text-[11px] font-semibold text-slate-600 hover:text-slate-900 transition';
      }
    }
    renderNotificationCenter();
  }

  function getNotificationCategoryMeta(title) {
    const t = normalizeText(title);
    if (t.includes('chuyen can') || t.includes('ky luat') || t.includes('di tre') || t.includes('dong phuc')) {
      return {
        icon: 'fa-shield-halved',
        iconBg: 'bg-amber-500 text-white',
        tag: 'Sổ Chuyên Cần'
      };
    }
    if (t.includes('doi ca') || t.includes('phan hoi') || t.includes('bao ban')) {
      return {
        icon: 'fa-arrows-rotate',
        iconBg: 'bg-emerald-500 text-white',
        tag: 'Đổi Ca & Phản Hồi'
      };
    }
    if (t.includes('lich truc') || t.includes('chot lich') || t.includes('phan cong')) {
      return {
        icon: 'fa-calendar-check',
        iconBg: 'bg-blue-600 text-white',
        tag: 'Lịch Trực Dự Trưởng'
      };
    }
    return {
      icon: 'fa-bell',
      iconBg: 'bg-indigo-600 text-white',
      tag: 'Hệ Thống BMBS'
    };
  }

  /**
   * Hiển thị danh sách thẻ thông báo xếp chồng phong cách iOS 27 Lock Screen
   */
  function renderNotificationCenter() {
    const container = document.getElementById('notificationStackContainer');
    if (!container) return;

    const filtered = userNotifications.filter(n => {
      if (notificationFilterMode === 'UNREAD') return n.status === 'Unread';
      return true;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="bg-white/55 backdrop-blur-xl p-8 rounded-3xl border border-white/50 text-center space-y-2 my-2">
          <div class="w-12 h-12 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center mx-auto text-lg">
            <i class="fa-regular fa-bell-slash"></i>
          </div>
          <p class="text-xs font-bold text-slate-700">Không có thông báo nào</p>
          <p class="text-[11px] text-slate-500">Khi có lịch trực mới, duyệt đổi ca hoặc ghi nhận chuyên cần, thông báo sẽ xuất hiện tại đây.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(item => {
      const isUnread = item.status === 'Unread';
      const meta = getNotificationCategoryMeta(item.title);

      return `
        <div onclick="handleClickNotificationCard('${escapeHtml(item.notificationId)}')" class="ios-notif-card cursor-pointer p-3.5 rounded-3xl border transition relative ${isUnread ? 'bg-white/85 border-blue-300/80 shadow-[0_10px_28px_rgba(37,99,235,0.10)]' : 'bg-white/50 border-white/50 opacity-85 hover:opacity-100'}">
          <div class="flex items-start justify-between gap-2.5">
            <div class="flex items-center gap-2 min-w-0">
              <div class="w-7 h-7 rounded-xl ${meta.iconBg} flex items-center justify-center text-xs shrink-0 shadow-2xs">
                <i class="fa-solid ${meta.icon}"></i>
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-1.5">
                  <span class="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">${escapeHtml(meta.tag)}</span>
                  ${isUnread ? `<span class="w-2 h-2 rounded-full bg-blue-600 inline-block animate-pulse" title="Chưa đọc"></span>` : ''}
                </div>
                <p class="text-[10px] text-slate-400 font-medium">${escapeHtml(item.timestamp)}</p>
              </div>
            </div>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${isUnread ? 'bg-blue-600 text-white' : 'bg-slate-200/70 text-slate-600'}">
              ${isUnread ? 'Mới' : 'Đã đọc'}
            </span>
          </div>

          <h4 class="text-xs font-extrabold text-slate-900 mt-2 leading-snug">${escapeHtml(item.title)}</h4>
          <div class="text-[11px] text-slate-600 mt-1 leading-relaxed pre-line bg-white/50 p-2.5 rounded-2xl border border-white/60">${escapeHtml(item.content)}</div>
        </div>
      `;
    }).join('');
  }

  /**
   * Chạm vào 1 thẻ thông báo để đánh dấu đã đọc thông qua apiMarkThongBaoRead(notificationId)
   */
  function handleClickNotificationCard(notificationId) {
    if (!notificationId) return;
    const target = userNotifications.find(n => n.notificationId === notificationId);
    if (!target || target.status === 'Read') return;

    // Optimistic UI update
    target.status = 'Read';
    updateNotificationBellBadge();
    renderNotificationCenter();

    const identifier = currentUser ? (currentUser.username || currentUser.fullName) : '';
    google.script.run
      .withSuccessHandler(() => {})
      .withFailureHandler(() => {})
      .apiMarkThongBaoRead(notificationId, identifier);
  }

  /**
   * Đánh dấu toàn bộ thông báo đang chưa đọc của người dùng thành Đã đọc
   */
  function handleMarkAllNotificationsRead() {
    const unreadItems = userNotifications.filter(n => n.status === 'Unread');
    if (unreadItems.length === 0) {
      showToast('Tất cả thông báo đều đã được đọc!', 'info');
      return;
    }

    unreadItems.forEach(n => { n.status = 'Read'; });
    updateNotificationBellBadge();
    renderNotificationCenter();

    const identifier = currentUser ? (currentUser.username || currentUser.fullName) : '';
    google.script.run
      .withSuccessHandler(res => {
        showToast(res && res.message ? res.message : 'Đã đánh dấu đọc tất cả thông báo!', 'success');
      })
      .withFailureHandler(err => {
        showToast('Lỗi cập nhật thông báo: ' + err.message, 'error');
      })
      .apiMarkThongBaoRead('ALL', identifier);
  }


  // =========================================================================
  // 3. GIAO DIỆN LỊCH TRỰC TRỰC QUAN (iOS 27 GLASS), XUẤT ẢNH PNG & COPY ZALO
  // =========================================================================
  function getNganhTheme(nganh) {
    if (nganh === 'Chiên') return {
      badge: 'bg-pink-500/15 text-pink-800 border-pink-300/60',
      cardBorder: 'border-pink-200/70',
      headerBg: 'bg-pink-500/10 text-pink-900 backdrop-blur-md',
      banner: 'from-pink-600 to-rose-500'
    };
    if (nganh === 'Ấu') return {
      badge: 'bg-emerald-500/15 text-emerald-800 border-emerald-300/60',
      cardBorder: 'border-emerald-200/70',
      headerBg: 'bg-emerald-500/10 text-emerald-900 backdrop-blur-md',
      banner: 'from-emerald-600 to-teal-500'
    };
    if (nganh === 'Thiếu') return {
      badge: 'bg-blue-500/15 text-blue-800 border-blue-300/60',
      cardBorder: 'border-blue-200/70',
      headerBg: 'bg-blue-500/10 text-blue-900 backdrop-blur-md',
      banner: 'from-blue-600 to-indigo-500'
    };
    return {
      badge: 'bg-amber-500/15 text-amber-800 border-amber-300/60',
      cardBorder: 'border-amber-200/70',
      headerBg: 'bg-amber-500/10 text-amber-900 backdrop-blur-md',
      banner: 'from-amber-500 to-orange-500'
    };
  }

  function renderMyUpcomingBanner() {
    const el = document.getElementById('myUpcomingBanner');
    if (!currentUser || !el) return;

    const myNorm = normalizeText(currentUser.fullName);
    const myShifts = (appData.lich || []).filter(item => normalizeText(item.nguoi) === myNorm);

    if (myShifts.length === 0) {
      el.innerHTML = '';
      return;
    }

    const nextShift = myShifts[0];
    el.innerHTML = `
      <div class="bg-white/65 backdrop-blur-2xl p-3.5 rounded-3xl border border-white/60 shadow-[0_12px_32px_rgba(37,99,235,0.08)] flex items-center justify-between gap-2">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex flex-col items-center justify-center shrink-0 font-extrabold text-xs shadow-sm">
            <span>${myShifts.length}</span>
            <span class="text-[8px] font-medium uppercase">Ca</span>
          </div>
          <div class="min-w-0">
            <p class="text-xs font-extrabold text-slate-800 truncate">Bạn có ${myShifts.length} ca trực trong lịch này</p>
            <p class="text-[11px] text-slate-500 truncate">Gần nhất: <b class="text-blue-600">${escapeHtml(nextShift.thu)} (${escapeHtml(nextShift.ngayStr)})</b> • ${escapeHtml(nextShift.congViec)}</p>
          </div>
        </div>
        <button onclick="toggleMyScheduleOnly()" class="px-3 py-1.5 rounded-full bg-blue-500/15 hover:bg-blue-500/25 text-blue-700 text-[11px] font-bold shrink-0 transition">
          ${filterMyScheduleOnly ? 'Xem tất cả' : 'Xem ngay'}
        </button>
      </div>
    `;
  }

  function buildWeekSelectorTabs() {
    const container = document.getElementById('weekTabsContainer');
    const lich = appData.lich || [];
    const weekMap = {};

    lich.forEach(item => {
      if (!weekMap[item.tuan]) {
        weekMap[item.tuan] = { tuan: item.tuan, nganh: item.nganh, start: item.ngayStr, end: item.ngayStr };
      } else {
        weekMap[item.tuan].end = item.ngayStr;
      }
    });

    const weeks = Object.values(weekMap);
    if (weeks.length === 0) {
      container.innerHTML = '';
      return;
    }

    if (selectedWeekTab !== 'ALL' && !weekMap[selectedWeekTab]) {
      selectedWeekTab = 'ALL';
    }

    let html = `
      <button onclick="selectWeekTab('ALL')" class="px-3.5 py-2 rounded-2xl text-xs font-bold shrink-0 border transition ${selectedWeekTab === 'ALL' ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white/55 text-slate-600 border-white/60 hover:bg-white/80'}">
        Cả tháng (${lich.length})
      </button>
    `;

    weeks.forEach(w => {
      const isSelected = selectedWeekTab === w.tuan;
      const shortStart = w.start.slice(0, 5);
      const shortEnd = w.end.slice(0, 5);
      html += `
        <button onclick="selectWeekTab('${escapeHtml(w.tuan)}')" class="px-3.5 py-1.5 rounded-2xl text-left shrink-0 border transition ${isSelected ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-500 shadow-sm' : 'bg-white/55 text-slate-700 border-white/60 hover:bg-white/80'}">
          <div class="text-xs font-bold">${escapeHtml(w.tuan)} • ${escapeHtml(w.nganh)}</div>
          <div class="text-[10px] ${isSelected ? 'text-blue-100' : 'text-slate-400'}">${escapeHtml(shortStart)} ➔ ${escapeHtml(shortEnd)}</div>
        </button>
      `;
    });

    container.innerHTML = html;
  }

  function selectWeekTab(tuan) {
    selectedWeekTab = tuan;
    buildWeekSelectorTabs();
    renderLich();
  }

  function toggleMyScheduleOnly() {
    filterMyScheduleOnly = !filterMyScheduleOnly;
    const btn = document.getElementById('btnMySchedule');
    if (filterMyScheduleOnly) {
      btn.className = 'text-[11px] font-bold px-3 py-1 rounded-full bg-blue-600 text-white shadow-2xs transition';
    } else {
      btn.className = 'text-[11px] font-semibold px-3 py-1 rounded-full bg-white/65 border border-white/60 text-slate-600 transition';
    }
    renderMyUpcomingBanner();
    renderLich();
  }

  function getFilteredSchedule() {
    const keyword = normalizeText(document.getElementById('searchName').value);
    const myNorm = currentUser ? normalizeText(currentUser.fullName) : '';

    return (appData.lich || []).filter(item => {
      if (selectedWeekTab !== 'ALL' && item.tuan !== selectedWeekTab) return false;
      if (filterMyScheduleOnly && myNorm && normalizeText(item.nguoi) !== myNorm) return false;
      if (keyword) {
        const matchName = normalizeText(item.nguoi).includes(keyword);
        const matchJob = normalizeText(item.congViec).includes(keyword);
        const matchDate = item.ngayStr.toLowerCase().includes(keyword);
        if (!matchName && !matchJob && !matchDate) return false;
      }
      return true;
    });
  }

  function renderLich() {
    const container = document.getElementById('lichContainer');
    const banner = document.getElementById('weekSummaryBanner');
    const searchVal = document.getElementById('searchName').value;
    const clearBtn = document.getElementById('clearSearchBtn');
    if (clearBtn) {
      if (searchVal) clearBtn.classList.remove('hidden');
      else clearBtn.classList.add('hidden');
    }

    const filtered = getFilteredSchedule();

    if (filtered.length === 0) {
      banner.innerHTML = '';
      container.innerHTML = `
        <div class="bg-white/60 backdrop-blur-2xl p-8 rounded-3xl border border-white/50 text-center space-y-2 shadow-[0_8px_30px_rgb(0,0,0,0.03)]">
          <i class="fa-regular fa-calendar-xmark text-2xl text-slate-300"></i>
          <p class="text-xs font-medium text-slate-400">Không tìm thấy ca trực nào phù hợp bộ lọc.</p>
        </div>
      `;
      return;
    }

    const memberRoleMap = {};
    (appData.danhSach || []).forEach(m => {
      memberRoleMap[normalizeText(m.name)] = m;
    });

    if (selectedWeekTab !== 'ALL') {
      const sample = filtered[0];
      const last = filtered[filtered.length - 1];
      const theme = getNganhTheme(sample.nganh);
      banner.innerHTML = `
        <div class="bg-gradient-to-r ${theme.banner} text-white p-4 rounded-3xl shadow-[0_12px_28px_rgba(37,99,235,0.16)] flex items-center justify-between">
          <div>
            <p class="text-[10px] uppercase tracking-wider font-semibold opacity-90">${escapeHtml(sample.tuan)} (${escapeHtml(sample.ngayStr)} ➔ ${escapeHtml(last.ngayStr)})</p>
            <h4 class="text-sm font-extrabold mt-0.5">Ngành trực: Chi Đoàn ${escapeHtml(sample.nganh)} 1</h4>
          </div>
          <div class="text-right">
            <span class="text-xs font-bold bg-white/20 backdrop-blur-md px-3 py-1 rounded-full border border-white/25">${filtered.length} suất trực</span>
          </div>
        </div>
      `;
    } else {
      banner.innerHTML = '';
    }

    const now = new Date();
    const todayStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    const myNorm = currentUser ? normalizeText(currentUser.fullName) : '';

    const dayGroups = [];
    const dayMap = {};
    filtered.forEach(item => {
      const key = item.tuan + '_' + item.ngayStr;
      if (!dayMap[key]) {
        dayMap[key] = {
          tuan: item.tuan,
          nganh: item.nganh,
          ngayStr: item.ngayStr,
          thu: item.thu,
          tasks: []
        };
        dayGroups.push(dayMap[key]);
      }
      dayMap[key].tasks.push(item);
    });

    container.innerHTML = dayGroups.map(group => {
      const isCN = group.thu === 'CN';
      const isToday = group.ngayStr === todayStr;
      const theme = getNganhTheme(group.nganh);
      const thuLabel = isCN ? 'CHÚA NHẬT' : `Thứ ${group.thu.replace('T', '')}`;

      const canEditGroup = currentUser && (
        currentUser.isAdmin ||
        currentUser.isSupervisor ||
        (currentUser.role === 'TRUONG_NGANH' && currentUser.nganh === group.nganh)
      );

      const tasksHtml = group.tasks.map(t => {
        const isMe = myNorm && normalizeText(t.nguoi) === myNorm;
        const memberInfo = memberRoleMap[normalizeText(t.nguoi)];
        const roleTag = memberInfo && memberInfo.roleTitle && memberInfo.roleTitle !== 'Dự trưởng'
          ? memberInfo.roleTitle
          : '';
        const isTruong = roleTag.toLowerCase().includes('trưởng ngành') || roleTag.toLowerCase().includes('trưởng nhóm');

        const iconJob = t.congViec.toLowerCase().includes('còi') ? 'fa-bullhorn text-amber-600' :
                        t.congViec.toLowerCase().includes('mic') ? 'fa-microphone-lines text-blue-600' :
                        t.congViec.toLowerCase().includes('cầm cờ') ? 'fa-flag text-rose-600' : 'fa-shield-heart text-emerald-600';

        return `
          <div class="py-2.5 px-3.5 flex items-center justify-between gap-2 ${isMe ? 'bg-blue-500/10' : 'hover:bg-white/60'} transition">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5">
                <i class="fa-solid ${iconJob} text-[11px]"></i>
                <span class="text-xs font-semibold text-slate-700">${escapeHtml(t.congViec)}</span>
                ${t.suat > 1 ? `<span class="text-[10px] text-slate-400 font-medium">(Suất ${t.suat})</span>` : ''}
              </div>
              <div class="mt-0.5 flex items-center gap-1.5 flex-wrap">
                <span class="text-xs font-bold ${isMe ? 'text-blue-700 underline' : 'text-slate-900'}">${escapeHtml(t.nguoi)}</span>
                ${isMe ? `<span class="text-[9px] bg-blue-600 text-white px-2 py-0.5 rounded-full font-bold">Ca của bạn</span>` : ''}
                ${isTruong ? `<span class="text-[9px] bg-purple-500/15 text-purple-700 px-2 py-0.5 rounded-full font-semibold">${escapeHtml(roleTag)}</span>` : ''}
                ${!isTruong && roleTag ? `<span class="text-[9px] bg-slate-500/10 text-slate-600 px-2 py-0.5 rounded-full font-medium">${escapeHtml(roleTag)}</span>` : ''}
              </div>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              ${isMe && currentUser.canSubmitShiftSwap ? `
                <button onclick="quickReportBusy('${escapeHtml(t.ngayStr)}', '${escapeHtml(t.congViec)}')" class="px-2.5 py-1 rounded-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 text-[10px] font-semibold transition" title="Báo bận ca này">
                  Báo bận
                </button>
              ` : ''}
              ${canEditGroup ? `
                <button onclick="openEditModal(${t.rowIndex}, '${escapeHtml(t.nganh)}', '${escapeHtml(t.ngayStr)}', '${escapeHtml(t.congViec)}', '${escapeHtml(t.nguoi)}', '')" class="px-2.5 py-1 rounded-full bg-white/80 hover:bg-blue-50 text-blue-600 border border-white/60 text-[11px] font-semibold shadow-2xs transition">
                  <i class="fa-solid fa-arrows-rotate mr-0.5 text-[10px]"></i>Đổi
                </button>
              ` : ''}
            </div>
          </div>
        `;
      }).join('<div class="border-t border-white/50"></div>');

      return `
        <div class="bg-white/65 backdrop-blur-2xl rounded-3xl border ${isCN ? 'border-2 border-blue-400/80 shadow-[0_12px_32px_rgba(37,99,235,0.10)]' : 'border-white/50 shadow-[0_8px_28px_rgb(0,0,0,0.04)]'} overflow-hidden">
          <div class="px-3.5 py-2.5 ${isCN ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white' : theme.headerBg} flex items-center justify-between">
            <div class="flex items-center gap-1.5">
              <span class="text-xs font-extrabold">${thuLabel} • ${escapeHtml(group.ngayStr)}</span>
              ${isToday ? `<span class="text-[9px] bg-rose-500 text-white px-2 py-0.5 rounded-full font-extrabold uppercase">Hôm nay</span>` : ''}
            </div>
            <span class="text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${isCN ? 'bg-white/95 text-blue-700 border-white' : theme.badge}">
              ${escapeHtml(group.tuan)} • Ngành ${escapeHtml(group.nganh)}
            </span>
          </div>
          <div class="divide-y divide-white/50">
            ${tasksHtml}
          </div>
        </div>
      `;
    }).join('');
  }

  function copyScheduleToClipboard() {
    const filtered = getFilteredSchedule();
    if (filtered.length === 0) {
      showToast('Không có dữ liệu lịch để sao chép!', 'warning');
      return;
    }

    const titleScope = selectedWeekTab === 'ALL' ? 'CẢ THÁNG' : `${selectedWeekTab.toUpperCase()} (NGÀNH ${filtered[0].nganh.toUpperCase()})`;
    let lines = [`LỊCH TRỰC DỰ TRƯỞNG GX BẾN SIÊU - ${titleScope}`, `────────────────────`];

    const byDay = {};
    filtered.forEach(item => {
      const k = `${item.thu} (${item.ngayStr}) - ${item.tuan} [Ngành ${item.nganh}]`;
      if (!byDay[k]) byDay[k] = [];
      byDay[k].push(`  • ${item.congViec}${item.suat > 1 ? ` (Suất ${item.suat})` : ''}: ${item.nguoi}`);
    });

    Object.keys(byDay).forEach(dayHeader => {
      lines.push(`📅 ${dayHeader}:`);
      lines.push(...byDay[dayHeader]);
    });

    const text = lines.join('\n');
    navigator.clipboard.writeText(text)
      .then(() => showToast('Đã sao chép lịch trực! Bạn có thể dán ngay vào nhóm Zalo/Messenger.', 'success'))
      .catch(() => showToast('Không thể truy cập bộ nhớ tạm.', 'error'));
  }

  function exportSchedulePNG() {
    const target = document.getElementById('scheduleCaptureArea');
    if (!target || (appData.lich || []).length === 0) {
      showToast('Chưa có lịch trực để xuất ảnh!', 'warning');
      return;
    }
    showLoading('Đang tạo hình ảnh lịch trực sắc nét (2x)...');
    html2canvas(target, { scale: 2, backgroundColor: '#eef2ff', useCORS: true })
      .then(canvas => {
        hideLoading();
        const link = document.createElement('a');
        const suffix = selectedWeekTab === 'ALL' ? 'Ca_Thang' : selectedWeekTab.replace(/\s+/g, '_');
        link.download = `Lich_Truc_BMBS_${suffix}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        showToast('Đã tải hình ảnh lịch trực (PNG) về thiết bị!', 'success');
      })
      .catch(err => {
        hideLoading();
        showToast('Lỗi tạo ảnh: ' + err.message, 'error');
      });
  }

  function quickReportBusy(ngayStr, congViec) {
    switchTab('PhanHoi');
    document.getElementById('phNgay').value = ngayStr;
    document.getElementById('phCongViec').value = congViec;
    document.getElementById('phNoiDung').focus();
    showToast('Đã điền sẵn ca trực cần báo bận. Hãy nhập lý do bên dưới!', 'info');
  }

  // =========================================================================
  // 4. MODULE CẤU HÌNH LỊCH BẬN CÁ NHÂN (MODAL & INLINE)
  // =========================================================================
  function openAvailabilityModal(targetMemberName) {
    if (!currentUser) return;
    if (currentUser.role === 'HT_DONG_HANH') {
      showToast('Tài khoản Huynh trưởng Đồng hành không tham gia chia ca trực Dự trưởng.', 'info');
      return;
    }

    const nameToEdit = targetMemberName || currentUser.fullName;
    const member = (appData.danhSach || []).find(m => normalizeText(m.name) === normalizeText(nameToEdit));

    if (!member || member.capBac === 'Huynh trưởng Đồng hành') {
      showToast('Tài khoản này không tham gia chia ca trực Dự trưởng trong DANH_SACH.', 'warning');
      return;
    }

    document.getElementById('availTargetName').textContent = `${member.name} (Ngành ${member.nganh})`;
    document.getElementById('availTargetName').dataset.exactName = member.name;
    document.getElementById('availTargetNganh').value = member.nganh;
    document.getElementById('availBusyDates').value = member.busyDates || '';
    document.getElementById('availCanWeekday').checked = member.canWeekday !== false;

    selectedFixedDaysSet = new Set(
      (member.busyFixed || '')
        .split(/[,;|]/)
        .map(s => s.trim().toUpperCase())
        .filter(Boolean)
    );
    renderFixedDayButtons();
    document.getElementById('availabilityModal').classList.remove('hidden');
  }

  function closeAvailabilityModal() {
    document.getElementById('availabilityModal').classList.add('hidden');
  }

  function toggleFixedDayBtn(day) {
    if (selectedFixedDaysSet.has(day)) selectedFixedDaysSet.delete(day);
    else selectedFixedDaysSet.add(day);
    renderFixedDayButtons();
  }

  function renderFixedDayButtons() {
    document.querySelectorAll('.avail-day-btn').forEach(btn => {
      const d = btn.dataset.day;
      if (selectedFixedDaysSet.has(d)) {
        btn.className = 'avail-day-btn py-1.5 rounded-xl text-xs font-bold border border-rose-500 bg-rose-50 text-rose-700 shadow-2xs';
      } else {
        btn.className = 'avail-day-btn py-1.5 rounded-xl text-xs font-bold border border-white/60 bg-white/60 text-slate-600';
      }
    });
  }

  function handleSaveAvailability() {
    const exactName = document.getElementById('availTargetName').dataset.exactName || currentUser.fullName;
    const targetNganh = document.getElementById('availTargetNganh').value;
    const busyFixed = Array.from(selectedFixedDaysSet).join(', ');
    const busyDates = document.getElementById('availBusyDates').value.trim();
    const canWeekday = document.getElementById('availCanWeekday').checked;

    showLoading('Đang lưu cấu hình lịch bận...');
    google.script.run
      .withSuccessHandler(res => {
        hideLoading();
        if (res.success) {
          showToast(res.message, 'success');
          closeAvailabilityModal();
          loadAppData();
        } else {
          showToast(res.message, 'error');
        }
      })
      .withFailureHandler(err => {
        hideLoading();
        showToast('Lỗi: ' + err.message, 'error');
      })
      .apiCapNhatLichBanCaNhan(currentUser.role, currentUser.nganh, currentUser.fullName, {
        name: exactName,
        nganh: targetNganh,
        busyFixed: busyFixed,
        busyDates: busyDates,
        canWeekday: canWeekday
      });
  }

  // =========================================================================
  // 5. MODULE KẾ HOẠCH SINH HOẠT TUẦN (KHSH)
  // =========================================================================
  function toggleKHSHForm() {
    const box = document.getElementById('formKHSHBox');
    if (box.classList.contains('hidden')) {
      resetKHSHForm();
      box.classList.remove('hidden');
    } else {
      box.classList.add('hidden');
    }
  }

  function closeKHSHForm() {
    document.getElementById('formKHSHBox').classList.add('hidden');
  }

  function resetKHSHForm() {
    document.getElementById('khshRowIndex').value = '';
    document.getElementById('khshFormTitle').innerHTML = '<i class="fa-solid fa-file-signature"></i> Soạn Kế Hoạch Sinh Hoạt Mới';
    document.getElementById('khshTuan').value = '';
    document.getElementById('khshNgayCN').value = '';
    if (currentUser && ['Chiên', 'Ấu', 'Thiếu', 'Nghĩa'].includes(currentUser.nganh)) {
      document.getElementById('khshNganh').value = currentUser.nganh;
    }
    document.getElementById('khshNoiDung').value = '';
    document.getElementById('khshChiTiet').value = '';
    document.getElementById('khshPhanCong').value = '';
    document.getElementById('khshVatDung').value = '';
    fillQuickMembersForKHSH();
  }

  function insertTemplateNoiDung() {
    const el = document.getElementById('khshNoiDung');
    if (!el.value.trim()) {
      el.value = "I. Ôn tập Phong Trào: \nII. Kỹ Năng Chuyên Môn: \nIII. Sinh Hoạt: \nIV. Vị Trí: ";
    }
  }

  function insertTemplatePhanCong() {
    const el = document.getElementById('khshPhanCong');
    if (!el.value.trim()) {
      el.value = "- Ôn tập phong trào: \n- Kỹ năng: \n- Sinh hoạt: \n- Giữ trật tự: \n- Truyền thông: ";
    }
  }

  function fillQuickMembersForKHSH() {
    const nganh = document.getElementById('khshNganh').value;
    const container = document.getElementById('khshMemberQuickTags');
    if (!container) return;
    const members = (appData.danhSach || []).filter(m => m.nganh === nganh && m.capBac === 'Dự trưởng');

    container.innerHTML = members.map(m => {
      const shortName = m.name.split(' ').slice(-2).join(' ');
      return `<button type="button" onclick="appendMemberToPhanCong('${escapeHtml(shortName)}')" class="px-2.5 py-1 rounded-full bg-white/75 hover:bg-blue-50 border border-white/60 text-slate-700 text-[10px] font-semibold shrink-0 transition">+ ${escapeHtml(shortName)}</button>`;
    }).join('');
  }

  function appendMemberToPhanCong(shortName) {
    const el = document.getElementById('khshPhanCong');
    el.value = el.value + (el.value.endsWith(' ') || el.value.endsWith(':') || !el.value ? '' : ', ') + shortName;
    el.focus();
  }

  function handleLuuKHSH() {
    const payload = {
      rowIndex: document.getElementById('khshRowIndex').value,
      tuan: document.getElementById('khshTuan').value.trim(),
      nganh: document.getElementById('khshNganh').value,
      ngayCN: document.getElementById('khshNgayCN').value.trim(),
      noiDung: document.getElementById('khshNoiDung').value.trim(),
      keHoachChiTiet: document.getElementById('khshChiTiet').value.trim(),
      phanCongNhanSu: document.getElementById('khshPhanCong').value.trim(),
      vatDung: document.getElementById('khshVatDung').value.trim()
    };

    if (!payload.tuan || !payload.noiDung || !payload.phanCongNhanSu) {
      showToast('Vui lòng nhập đầy đủ: Tuần, Nội dung và Phân công nhân sự!', 'warning');
      return;
    }

    showLoading('Đang lưu báo cáo KHSH...');
    google.script.run
      .withSuccessHandler(res => {
        hideLoading();
        if (res.success) {
          showToast(res.message, 'success');
          closeKHSHForm();
          loadAppData();
        } else {
          showToast(res.message, 'error');
        }
      })
      .withFailureHandler(err => {
        hideLoading();
        showToast('Lỗi: ' + err.message, 'error');
      })
      .apiLuuKHSH(currentUser.role, currentUser.nganh, currentUser.fullName, payload);
  }

  function editKHSHRecord(rowIndex) {
    const item = (appData.khsh || []).find(k => k.rowIndex === rowIndex);
    if (!item) return;

    document.getElementById('khshRowIndex').value = item.rowIndex;
    document.getElementById('khshFormTitle').innerHTML = `<i class="fa-solid fa-pen"></i> Cập nhật KHSH (${escapeHtml(item.tuan)} - ${escapeHtml(item.chiDoan)})`;
    document.getElementById('khshTuan').value = item.tuan;
    document.getElementById('khshNganh').value = item.nganh;
    document.getElementById('khshNgayCN').value = item.ngayCN;
    document.getElementById('khshNoiDung').value = item.noiDung;
    document.getElementById('khshChiTiet').value = item.keHoachChiTiet;
    document.getElementById('khshPhanCong').value = item.phanCongNhanSu;
    document.getElementById('khshVatDung').value = item.vatDung;

    fillQuickMembersForKHSH();
    document.getElementById('formKHSHBox').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function copyKHSHItem(rowIndex) {
    const item = (appData.khsh || []).find(k => k.rowIndex === rowIndex);
    if (!item) return;

    const text = [
      `KẾ HOẠCH SINH HOẠT ${item.tuan} - CHI ĐOÀN ${item.chiDoan.toUpperCase()}`,
      item.ngayCN ? `Ngày Chúa Nhật: ${item.ngayCN}` : '',
      `────────────────────`,
      `1️⃣ NỘI DUNG & VỊ TRÍ:\n${item.noiDung}`,
      item.keHoachChiTiet ? `\n2️⃣ KẾ HOẠCH CHI TIẾT:\n${item.keHoachChiTiet}` : '',
      `\n3️⃣ PHÂN CÔNG NHÂN SỰ:\n${item.phanCongNhanSu}`,
      `\nVật dụng: ${item.vatDung || 'Không có'}`
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(text)
      .then(() => showToast(`Đã copy KHSH [${item.tuan} - ${item.chiDoan}]!`, 'success'))
      .catch(() => showToast('Không thể sao chép.', 'error'));
  }

  function populateKhshTuanFilter() {
    const sel = document.getElementById('filterKhshTuan');
    if (!sel) return;
    const currentVal = sel.value;
    const tuans = [...new Set((appData.khsh || []).map(k => k.tuan))];

    sel.innerHTML = '<option value="ALL">Tất cả các Tuần</option>';
    tuans.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      if (t === currentVal) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  function setFilterKhshNganh(nganh) {
    selectedFilterKhshNganh = nganh;
    document.querySelectorAll('.khsh-chip').forEach(btn => {
      if (btn.dataset.nganh === nganh) {
        btn.className = 'khsh-chip px-3 py-1 rounded-full text-[11px] font-bold bg-blue-600 text-white shadow-2xs';
      } else {
        btn.className = 'khsh-chip px-3 py-1 rounded-full text-[11px] font-semibold bg-white/60 border border-white/50 text-slate-600';
      }
    });
    renderKHSH();
  }

  function renderKHSH() {
    const container = document.getElementById('khshContainer');
    const filterTuan = document.getElementById('filterKhshTuan').value;

    const filtered = (appData.khsh || []).filter(item => {
      if (filterTuan !== 'ALL' && item.tuan !== filterTuan) return false;
      if (selectedFilterKhshNganh !== 'ALL' && item.nganh !== selectedFilterKhshNganh) return false;
      return true;
    });

    if (filtered.length === 0) {
      container.innerHTML = `<div class="bg-white/60 backdrop-blur-2xl p-6 rounded-3xl border border-white/50 text-center text-xs text-slate-400">Chưa có báo cáo Kế hoạch sinh hoạt nào cho bộ lọc này.</div>`;
      return;
    }

    container.innerHTML = filtered.map(item => {
      const theme = getNganhTheme(item.nganh);
      const canEditItem = currentUser && (
        currentUser.isAdmin ||
        currentUser.isSupervisor ||
        (currentUser.role === 'TRUONG_NGANH' && currentUser.nganh === item.nganh)
      );

      const isApproved = item.trangThai === 'Đã duyệt';

      return `
        <div class="bg-white/65 backdrop-blur-2xl rounded-3xl border border-white/50 overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <div class="px-4 py-2.5 ${theme.headerBg} flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-xs font-extrabold uppercase">${escapeHtml(item.tuan)} • CHI ĐOÀN ${escapeHtml(item.chiDoan.toUpperCase())}</span>
              ${item.ngayCN ? `<span class="text-[11px] opacity-80">(${escapeHtml(item.ngayCN)})</span>` : ''}
            </div>
            <div class="flex items-center gap-1.5">
              <button onclick="copyKHSHItem(${item.rowIndex})" class="px-2.5 py-0.5 rounded-full bg-white/80 hover:bg-white text-slate-700 text-[10px] font-semibold border border-white/60" title="Copy gửi nhóm">
                <i class="fa-regular fa-copy"></i> Copy
              </button>
              <span class="text-[10px] font-bold px-2.5 py-0.5 rounded-full ${isApproved ? 'bg-emerald-500/15 text-emerald-800' : 'bg-amber-500/15 text-amber-800'}">
                ${escapeHtml(item.trangThai)}
              </span>
            </div>
          </div>

          <div class="p-4 space-y-2.5 text-xs">
            <div>
              <p class="text-[10px] font-bold uppercase text-slate-400 mb-1">I. Nội dung & Vị trí</p>
              <div class="text-slate-800 bg-white/60 border border-white/60 p-3 rounded-2xl pre-line leading-relaxed">${escapeHtml(item.noiDung)}</div>
            </div>

            ${item.keHoachChiTiet ? `
              <div>
                <p class="text-[10px] font-bold uppercase text-slate-400 mb-1">II. Kế hoạch chi tiết & Thời lượng</p>
                <div class="text-slate-700 bg-white/60 border border-white/60 p-3 rounded-2xl pre-line leading-relaxed">${escapeHtml(item.keHoachChiTiet)}</div>
              </div>
            ` : ''}

            <div>
              <p class="text-[10px] font-bold uppercase text-slate-400 mb-1">III. Phân công nhân sự chi tiết</p>
              <div class="text-slate-900 font-medium bg-blue-500/5 border border-blue-200/60 p-3 rounded-2xl pre-line leading-relaxed">${escapeHtml(item.phanCongNhanSu)}</div>
            </div>

            <div class="flex items-center justify-between text-[11px] text-slate-500 pt-1">
              <span><i class="fa-solid fa-toolbox text-slate-400 mr-1"></i><b>Vật dụng:</b> ${escapeHtml(item.vatDung || 'Không có')}</span>
            </div>

            <div class="pt-2.5 border-t border-white/50 flex items-center justify-between text-[10px] text-slate-400">
              <span>Báo cáo: <b class="text-slate-600">${escapeHtml(item.nguoiLap)}</b> (${escapeHtml(item.updatedAt)})</span>
              <div class="flex items-center gap-1.5">
                ${currentUser && (currentUser.isAdmin || currentUser.isSupervisor) && !isApproved ? `
                  <button onclick="handleActionKHSH(${item.rowIndex}, 'APPROVE')" class="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-700 font-bold">✓ Duyệt</button>
                ` : ''}
                ${canEditItem ? `
                  <button onclick="editKHSHRecord(${item.rowIndex})" class="px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 font-bold">Sửa</button>
                  <button onclick="handleActionKHSH(${item.rowIndex}, 'DELETE')" class="px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-600 font-bold">Xóa</button>
                ` : ''}
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function handleActionKHSH(rowIndex, action) {
    const execAction = () => {
      showLoading('Đang xử lý...');
      google.script.run
        .withSuccessHandler(res => {
          hideLoading();
          showToast(res.message, res.success ? 'success' : 'error');
          if (res.success) loadAppData();
        })
        .withFailureHandler(err => {
          hideLoading();
          showToast('Lỗi: ' + err.message, 'error');
        })
        .apiDuyetHoacXoaKHSH(currentUser.role, currentUser.nganh, rowIndex, action, currentUser.fullName);
    };

    if (action === 'DELETE') {
      askConfirm('Xóa Kế hoạch sinh hoạt', 'Bạn có chắc chắn muốn xóa bản báo cáo KHSH này không?', execAction);
    } else {
      execAction();
    }
  }

  // =========================================================================
  // 6. MODULE KỶ LUẬT, NGHỈ PHÉP & THÀNH TÍCH CHUYÊN CẦN
  // =========================================================================
  function populateKyLuatMembers() {
    const nganh = document.getElementById('klNganh').value;
    const sel = document.getElementById('klMember');
    if (!sel) return;
    sel.innerHTML = '';
    const members = (appData.danhSach || []).filter(m => m.nganh === nganh && m.capBac === 'Dự trưởng');
    members.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.name;
      opt.textContent = m.name;
      sel.appendChild(opt);
    });
  }

  function selectKlLoai(loai) {
    selectedKlLoai = loai;
    document.querySelectorAll('.kl-loai-btn').forEach(btn => {
      const l = btn.dataset.loai;
      if (l === loai) {
        const activeClass = l === 'Đi trễ' ? 'border-amber-500 bg-amber-50 text-amber-700' :
                            l === 'Không đồng phục' ? 'border-rose-500 bg-rose-50 text-rose-700' :
                            l === 'Khen thưởng' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' :
                            'border-blue-500 bg-blue-50 text-blue-700';
        btn.className = `kl-loai-btn py-2 px-2 rounded-2xl text-xs font-bold border ${activeClass}`;
      } else {
        btn.className = 'kl-loai-btn py-2 px-2 rounded-2xl text-xs font-semibold border border-white/60 bg-white/60 text-slate-600';
      }
    });
  }

  function handleThemKyLuat() {
    const nganh = document.getElementById('klNganh').value;
    const name = document.getElementById('klMember').value;
    const rawDate = document.getElementById('klNgay').value;
    const lyDo = document.getElementById('klLyDo').value.trim();

    if (!name) {
      showToast('Vui lòng chọn thành viên!', 'warning');
      return;
    }

    let ngayFormatted = rawDate;
    if (rawDate && rawDate.includes('-')) {
      const parts = rawDate.split('-');
      ngayFormatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    showLoading('Đang ghi vào sổ kỷ luật, gửi thông báo & tính điểm chuyên cần...');
    google.script.run
      .withSuccessHandler(res => {
        hideLoading();
        showToast(res.message, res.success ? 'success' : 'error');
        if (res.success) {
          document.getElementById('klLyDo').value = '';
          loadAppData();
        }
      })
      .withFailureHandler(err => {
        hideLoading();
        showToast('Lỗi: ' + err.message, 'error');
      })
      .apiThemKyLuat(currentUser.role, currentUser.fullName, {
        nganh: nganh, name: name, ngay: ngayFormatted, loai: selectedKlLoai, lyDo: lyDo
      });
  }

  function renderKyLuat() {
    const list = appData.kyLuat || [];
    let countTre = 0, countDP = 0, countPhep = 0, countKT = 0;
    list.forEach(item => {
      if (item.loai === 'Đi trễ') countTre++;
      else if (item.loai === 'Không đồng phục') countDP++;
      else if (item.loai === 'Nghỉ phép') countPhep++;
      else if (item.loai === 'Khen thưởng' || item.loai === 'Thành tích') countKT++;
    });

    document.getElementById('statDiTre').textContent = countTre;
    document.getElementById('statDongPhuc').textContent = countDP;
    document.getElementById('statNghiPhep').textContent = countPhep;
    document.getElementById('statKhenThuong').textContent = countKT;

    const filterLoai = document.getElementById('filterKlLoai').value;
    const filterNganh = document.getElementById('filterKlNganh').value;
    const kw = normalizeText(document.getElementById('searchKlName').value);

    const filtered = list.filter(item => {
      if (filterLoai !== 'ALL' && item.loai !== filterLoai) return false;
      if (filterNganh !== 'ALL' && item.nganh !== filterNganh) return false;
      if (kw && !normalizeText(item.name).includes(kw)) return false;
      return true;
    });

    const container = document.getElementById('kyLuatContainer');
    if (filtered.length === 0) {
      container.innerHTML = `<div class="bg-white/60 backdrop-blur-2xl p-5 rounded-3xl border border-white/50 text-center text-xs text-slate-400">Chưa có ghi nhận kỷ luật / nghỉ phép / thành tích nào phù hợp.</div>`;
      return;
    }

    const canManage = currentUser && currentUser.canManageDiscipline;

    container.innerHTML = filtered.map(item => {
      const badge = item.loai === 'Đi trễ' ? 'bg-amber-500/15 text-amber-800 border-amber-300/60' :
                    item.loai === 'Không đồng phục' ? 'bg-rose-500/15 text-rose-800 border-rose-300/60' :
                    item.loai === 'Khen thưởng' ? 'bg-emerald-500/15 text-emerald-800 border-emerald-300/60' :
                    'bg-blue-500/15 text-blue-800 border-blue-300/60';
      return `
        <div class="bg-white/65 backdrop-blur-2xl p-3.5 rounded-3xl border border-white/50 flex items-start justify-between gap-2 shadow-[0_8px_24px_rgb(0,0,0,0.03)]">
          <div class="space-y-1 min-w-0">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${badge}">${escapeHtml(item.loai)}</span>
              <span class="text-xs font-bold text-slate-800">${escapeHtml(item.name)}</span>
              <span class="text-[11px] text-slate-400">• Ngành ${escapeHtml(item.nganh)}</span>
            </div>
            ${item.lyDo ? `<p class="text-xs text-slate-600">${escapeHtml(item.lyDo)}</p>` : ''}
            <p class="text-[10px] text-slate-400">Ngày: <b>${escapeHtml(item.ngay)}</b> • Ghi bởi: ${escapeHtml(item.nguoiGhi)}</p>
          </div>
          ${canManage ? `
            <button onclick="handleXoaKyLuat(${item.rowIndex})" class="text-slate-300 hover:text-rose-600 p-1.5 text-xs shrink-0 transition" title="Xóa">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  function handleXoaKyLuat(rowIndex) {
    askConfirm('Xóa bản ghi chuyên cần / kỷ luật', 'Bạn có chắc muốn xóa bản ghi này khỏi sổ theo dõi?', () => {
      showLoading('Đang xóa...');
      google.script.run
        .withSuccessHandler(res => {
          hideLoading();
          showToast(res.message, res.success ? 'success' : 'error');
          if (res.success) loadAppData();
        })
        .withFailureHandler(err => {
          hideLoading();
          showToast('Lỗi: ' + err.message, 'error');
        })
        .apiXoaKyLuat(currentUser.role, currentUser.fullName, rowIndex);
    });
  }

  // =========================================================================
  // 7. MODULE QUẢN LÝ THU QUỸ DỰ TRƯỞNG (5.000 VNĐ / TUẦN - QUAN_LY_QUY)
  // =========================================================================
  function initBillingCycleOptions() {
    const sel = document.getElementById('duesBillingCycleSelect');
    if (!sel) return;

    const currentSelected = sel.value;
    const now = new Date();
    const monthStr = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    const currentWeekOfMonth = Math.min(5, Math.max(1, Math.ceil(now.getDate() / 7)));
    const defaultCycle = `Tuần ${currentWeekOfMonth} - Tháng ${monthStr}`;

    const cycleSet = new Set();
    for (let w = 1; w <= 5; w++) {
      cycleSet.add(`Tuần ${w} - Tháng ${monthStr}`);
    }
    (appData.quanLyQuy || []).forEach(q => {
      if (q.billingCycle) cycleSet.add(q.billingCycle);
    });

    sel.innerHTML = '';
    Array.from(cycleSet).forEach(cycle => {
      const opt = document.createElement('option');
      opt.value = cycle;
      opt.textContent = cycle;
      if (currentSelected ? cycle === currentSelected : cycle === defaultCycle) {
        opt.selected = true;
      }
      sel.appendChild(opt);
    });

    const customOpt = document.createElement('option');
    customOpt.value = 'CUSTOM';
    customOpt.textContent = '+ Nhập kỳ thu quỹ khác...';
    sel.appendChild(customOpt);
  }

  function getActiveBillingCycle() {
    const sel = document.getElementById('duesBillingCycleSelect');
    if (!sel) return '';
    if (sel.value === 'CUSTOM') {
      return document.getElementById('duesCustomCycleInput').value.trim();
    }
    return sel.value;
  }

  function onChangeBillingCycleSelect() {
    const sel = document.getElementById('duesBillingCycleSelect');
    const customBox = document.getElementById('customBillingCycleBox');
    if (sel.value === 'CUSTOM') {
      customBox.classList.remove('hidden');
      document.getElementById('duesCustomCycleInput').focus();
    } else {
      customBox.classList.add('hidden');
    }
    treasuryChecklistState = {};
    renderTreasuryChecklist();
  }

  function renderQuyTab() {
    renderMyPersonalDuesSummary();
    renderTreasuryHealthDashboard();
    if (currentUser && currentUser.canManageTreasury) {
      renderTreasuryChecklist();
    }
    renderTreasuryLedgerHistory();
  }

  function renderMyPersonalDuesSummary() {
    const el = document.getElementById('myDuesSummaryCard');
    if (!el || !currentUser) return;

    const myNorm = normalizeText(currentUser.fullName);
    const myRecords = (appData.quanLyQuy || []).filter(r => normalizeText(r.memberName) === myNorm);
    const weeklyRate = appData.duesWeeklyRate || DUES_RATE_DEFAULT;

    let totalPaid = 0;
    let unpaidWeeksCount = 0;
    let prepaidCredit = 0;

    myRecords.forEach(r => {
      const amt = Number(r.amountPaid) || 0;
      if (r.paymentStatus === 'PAID') {
        totalPaid += amt;
        if (amt > weeklyRate) {
          prepaidCredit += (amt - weeklyRate);
        }
      } else if (r.paymentStatus === 'UNPAID' || r.paymentStatus === 'OVERDUE') {
        unpaidWeeksCount++;
      }
    });

    const arrearsAmount = unpaidWeeksCount * weeklyRate;

    el.innerHTML = `
      <div class="flex items-center justify-between">
        <div>
          <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-500/15 px-2.5 py-0.5 rounded-full border border-emerald-300/60">
            Sổ Quỹ Cá Nhân • Định mức ${formatVND(weeklyRate)}/Tuần
          </span>
          <h3 class="text-xs font-extrabold text-slate-900 mt-1.5">${escapeHtml(currentUser.fullName)}</h3>
        </div>
        <button onclick="switchTab('CaNhan'); switchProfileAuditSubTab('DUES');" class="text-[11px] font-semibold text-blue-600 hover:underline">
          Chi tiết <i class="fa-solid fa-chevron-right text-[9px]"></i>
        </button>
      </div>
      <div class="grid grid-cols-3 gap-2 pt-1">
        <div class="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-200/70 text-center">
          <p class="text-[10px] font-semibold text-emerald-800">Đã đóng tích lũy</p>
          <p class="text-sm font-extrabold text-emerald-700 mt-0.5">${formatVND(totalPaid)}</p>
        </div>
        <div class="p-2.5 rounded-2xl ${unpaidWeeksCount > 0 ? 'bg-rose-500/10 border-rose-200/70' : 'bg-white/60 border-white/60'} border text-center">
          <p class="text-[10px] font-semibold ${unpaidWeeksCount > 0 ? 'text-rose-700' : 'text-slate-600'}">Tuần chưa đóng</p>
          <p class="text-sm font-extrabold ${unpaidWeeksCount > 0 ? 'text-rose-600' : 'text-slate-800'} mt-0.5">${unpaidWeeksCount} tuần (${formatVND(arrearsAmount)})</p>
        </div>
        <div class="p-2.5 rounded-2xl bg-blue-500/10 border border-blue-200/70 text-center">
          <p class="text-[10px] font-semibold text-blue-800">Đóng trước (Credit)</p>
          <p class="text-sm font-extrabold text-blue-700 mt-0.5">${formatVND(prepaidCredit)}</p>
        </div>
      </div>
    `;
  }

  function renderTreasuryHealthDashboard() {
    const el = document.getElementById('treasuryHealthDashboard');
    if (!el) return;

    const records = appData.quanLyQuy || [];
    const branches = ['Chiên', 'Ấu', 'Thiếu', 'Nghĩa'];
    let grandTotalCollected = 0;
    let totalUnpaidRecords = 0;

    const branchStats = {};
    branches.forEach(b => {
      branchStats[b] = { collected: 0, paidCount: 0, totalEntries: 0 };
    });

    records.forEach(r => {
      const b = r.branch;
      const amt = Number(r.amountPaid) || 0;
      if (r.paymentStatus === 'PAID') {
        grandTotalCollected += amt;
        if (branchStats[b]) {
          branchStats[b].collected += amt;
          branchStats[b].paidCount++;
          branchStats[b].totalEntries++;
        }
      } else {
        totalUnpaidRecords++;
        if (branchStats[b]) {
          branchStats[b].totalEntries++;
        }
      }
    });

    const branchCardsHtml = branches.map(b => {
      const st = branchStats[b];
      const rate = st.totalEntries > 0 ? Math.round((st.paidCount / st.totalEntries) * 100) : 100;
      const theme = getNganhTheme(b);
      return `
        <div class="p-3 rounded-2xl border border-white/60 bg-white/55 space-y-1.5">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-bold text-slate-800">Ngành ${b}</span>
            <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full ${theme.badge}">${rate}%</span>
          </div>
          <p class="text-xs font-extrabold text-emerald-700">${formatVND(st.collected)}</p>
          <div class="w-full h-1.5 bg-slate-200/70 rounded-full overflow-hidden">
            <div class="h-full bg-emerald-500 rounded-full" style="width:${rate}%"></div>
          </div>
        </div>
      `;
    }).join('');

    el.innerHTML = `
      <div class="flex items-center justify-between">
        <div>
          <h4 class="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <i class="fa-solid fa-chart-pie text-emerald-600"></i> Tổng Quan Quỹ Dự Trưởng Toàn Đoàn
          </h4>
          <p class="text-[11px] text-slate-500">Tổng thu thực tế & tỷ lệ hoàn thành theo 4 Chi đoàn</p>
        </div>
        <div class="text-right">
          <span class="text-xs font-extrabold bg-emerald-500/15 text-emerald-800 px-3 py-1 rounded-full border border-emerald-300/60">
            ${formatVND(grandTotalCollected)}
          </span>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-2 pt-1">
        ${branchCardsHtml}
      </div>
    `;
  }

  function renderTreasuryChecklist() {
    const container = document.getElementById('treasuryChecklistContainer');
    if (!container) return;

    const branch = document.getElementById('duesBranchSelect').value;
    const cycle = getActiveBillingCycle();
    const defaultMethod = document.getElementById('duesDefaultMethod').value || 'Cash';
    const weeklyRate = appData.duesWeeklyRate || DUES_RATE_DEFAULT;

    const members = (appData.danhSach || []).filter(m => m.nganh === branch && m.capBac === 'Dự trưởng');
    if (members.length === 0) {
      container.innerHTML = `<div class="p-4 text-center text-xs text-slate-400">Không có Dự trưởng nào trong ngành ${escapeHtml(branch)}.</div>`;
      return;
    }

    const existingMap = {};
    (appData.quanLyQuy || []).forEach(r => {
      if (normalizeText(r.billingCycle) === normalizeText(cycle)) {
        existingMap[normalizeText(r.memberName)] = r;
      }
    });

    container.innerHTML = members.map((m, idx) => {
      const norm = normalizeText(m.name);
      const existing = existingMap[norm];
      const stateItem = treasuryChecklistState[norm] || {
        memberName: m.name,
        branch: m.nganh,
        paymentStatus: existing ? existing.paymentStatus : 'PAID',
        amountPaid: existing ? Number(existing.amountPaid) : weeklyRate,
        paymentMethod: existing ? existing.paymentMethod : defaultMethod
      };
      treasuryChecklistState[norm] = stateItem;

      const isPaid = stateItem.paymentStatus === 'PAID';
      const isOverdue = stateItem.paymentStatus === 'OVERDUE';

      return `
        <div class="p-3 flex items-center justify-between gap-2 ${isPaid ? 'bg-emerald-500/5' : isOverdue ? 'bg-rose-500/5' : 'bg-white/40'}">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5">
              <span class="text-[10px] font-bold text-slate-400">${idx + 1}.</span>
              <span class="text-xs font-bold text-slate-800 truncate">${escapeHtml(m.name)}</span>
              ${existing ? `<span class="text-[9px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-700 font-semibold">Đã lưu</span>` : ''}
            </div>
            <div class="flex items-center gap-1.5 mt-1">
              <select onchange="updateMemberChecklistStatus('${escapeHtml(m.name)}', this.value)" class="text-[11px] font-bold px-2.5 py-1 rounded-xl border ${isPaid ? 'bg-emerald-600 text-white border-emerald-600' : isOverdue ? 'bg-rose-600 text-white border-rose-600' : 'bg-amber-100 text-amber-800 border-amber-300'}">
                <option value="PAID" ${stateItem.paymentStatus === 'PAID' ? 'selected' : ''}>PAID (Đã đóng)</option>
                <option value="UNPAID" ${stateItem.paymentStatus === 'UNPAID' ? 'selected' : ''}> UNPAID (Chưa đóng)</option>
                <option value="OVERDUE" ${stateItem.paymentStatus === 'OVERDUE' ? 'selected' : ''}> OVERDUE (Quá hạn)</option>
              </select>
              <select onchange="updateMemberChecklistAmount('${escapeHtml(m.name)}', this.value)" ${!isPaid ? 'disabled' : ''} class="text-[11px] font-bold px-2.5 py-1 rounded-xl border border-white/60 bg-white/80 text-slate-700">
                <option value="5000" ${stateItem.amountPaid === 5000 ? 'selected' : ''}>5.000đ (1 tuần)</option>
                <option value="10000" ${stateItem.amountPaid === 10000 ? 'selected' : ''}>10.000đ (2 tuần)</option>
                <option value="15000" ${stateItem.amountPaid === 15000 ? 'selected' : ''}>15.000đ (3 tuần)</option>
                <option value="20000" ${stateItem.amountPaid === 20000 ? 'selected' : ''}>20.000đ (1 tháng)</option>
                <option value="0" ${stateItem.amountPaid === 0 ? 'selected' : ''}>0đ</option>
              </select>
            </div>
          </div>
          <button type="button" onclick="handleQuickSaveSingleMemberDues('${escapeHtml(m.name)}')" class="px-3 py-1.5 rounded-full bg-white/80 hover:bg-emerald-100 border border-white/60 text-slate-700 hover:text-emerald-800 text-[10px] font-bold shrink-0 transition" title="Lưu nhanh dòng này">
            <i class="fa-solid fa-check mr-0.5"></i>Lưu
          </button>
        </div>
      `;
    }).join('');
  }

  function updateMemberChecklistStatus(memberName, status) {
    const norm = normalizeText(memberName);
    if (!treasuryChecklistState[norm]) return;
    treasuryChecklistState[norm].paymentStatus = status;
    if (status !== 'PAID') {
      treasuryChecklistState[norm].amountPaid = 0;
    } else if (treasuryChecklistState[norm].amountPaid === 0) {
      treasuryChecklistState[norm].amountPaid = appData.duesWeeklyRate || DUES_RATE_DEFAULT;
    }
    renderTreasuryChecklist();
  }

  function updateMemberChecklistAmount(memberName, amount) {
    const norm = normalizeText(memberName);
    if (!treasuryChecklistState[norm]) return;
    treasuryChecklistState[norm].amountPaid = Number(amount);
  }

  function markAllChecklistStatus(status) {
    const branch = document.getElementById('duesBranchSelect').value;
    const defaultMethod = document.getElementById('duesDefaultMethod').value || 'Cash';
    const weeklyRate = appData.duesWeeklyRate || DUES_RATE_DEFAULT;

    (appData.danhSach || [])
      .filter(m => m.nganh === branch && m.capBac === 'Dự trưởng')
      .forEach(m => {
        const norm = normalizeText(m.name);
        treasuryChecklistState[norm] = {
          memberName: m.name,
          branch: m.nganh,
          paymentStatus: status,
          amountPaid: status === 'PAID' ? weeklyRate : 0,
          paymentMethod: defaultMethod
        };
      });
    renderTreasuryChecklist();
    showToast(`Đã đánh dấu tất cả thành viên ngành ${branch} là [${status}]. Nhấn "Chốt Sổ Thu Quỹ" để lưu!`, 'info');
  }

  function handleQuickSaveSingleMemberDues(memberName) {
    const cycle = getActiveBillingCycle();
    if (!cycle) {
      showToast('Vui lòng chọn hoặc nhập Kỳ thu quỹ (Billing Cycle)!', 'warning');
      return;
    }
    const norm = normalizeText(memberName);
    const item = treasuryChecklistState[norm];
    if (!item) return;

    const method = document.getElementById('duesDefaultMethod').value || 'Cash';
    showLoading(`Đang lưu quỹ cho ${memberName}...`);
    google.script.run
      .withSuccessHandler(res => {
        hideLoading();
        showToast(res.message, res.success ? 'success' : 'error');
        if (res.success) loadAppData();
      })
      .withFailureHandler(err => {
        hideLoading();
        showToast('Lỗi: ' + err.message, 'error');
      })
      .apiGhiNhanThuQuy(currentUser.role, currentUser.nganh, currentUser.fullName, currentUser.roleTitle, {
        billingCycle: cycle,
        memberName: item.memberName,
        branch: item.branch,
        amountPaid: item.amountPaid,
        paymentStatus: item.paymentStatus,
        paymentMethod: method
      });
  }

  function handleSaveBatchDues() {
    const branch = document.getElementById('duesBranchSelect').value;
    const cycle = getActiveBillingCycle();
    const method = document.getElementById('duesDefaultMethod').value || 'Cash';

    if (!cycle) {
      showToast('Vui lòng chọn hoặc nhập Kỳ thu quỹ (Billing Cycle)!', 'warning');
      return;
    }

    const members = (appData.danhSach || []).filter(m => m.nganh === branch && m.capBac === 'Dự trưởng');
    const items = members.map(m => {
      const norm = normalizeText(m.name);
      const st = treasuryChecklistState[norm] || {
        memberName: m.name,
        branch: branch,
        paymentStatus: 'PAID',
        amountPaid: appData.duesWeeklyRate || DUES_RATE_DEFAULT
      };
      return {
        memberName: m.name,
        branch: branch,
        paymentStatus: st.paymentStatus,
        amountPaid: st.paymentStatus === 'PAID' ? Number(st.amountPaid) : 0,
        paymentMethod: method
      };
    });

    askConfirm(
      'Chốt sổ thu quỹ Chi đoàn',
      `Hệ thống sẽ ghi nhận trạng thái thu quỹ kỳ [${cycle}] cho ${items.length} Dự trưởng thuộc Ngành ${branch}. Tiếp tục?`,
      () => {
        showLoading('Đang chốt sổ thu quỹ hàng loạt...');
        google.script.run
          .withSuccessHandler(res => {
            hideLoading();
            showToast(res.message, res.success ? 'success' : 'error');
            if (res.success) loadAppData();
          })
          .withFailureHandler(err => {
            hideLoading();
            showToast('Lỗi: ' + err.message, 'error');
          })
          .apiChotThuQuyHangLoat(currentUser.role, currentUser.nganh, currentUser.fullName, currentUser.roleTitle, {
            branch: branch,
            billingCycle: cycle,
            items: items
          });
      }
    );
  }

  function copyTreasuryArrearsReport() {
    const branch = document.getElementById('duesBranchSelect').value;
    const cycle = getActiveBillingCycle() || 'Tuần hiện tại';
    const members = (appData.danhSach || []).filter(m => m.nganh === branch && m.capBac === 'Dự trưởng');

    const paidList = [];
    const unpaidList = [];
    let totalCollectedCycle = 0;

    members.forEach(m => {
      const norm = normalizeText(m.name);
      const st = treasuryChecklistState[norm];
      if (st && st.paymentStatus === 'PAID') {
        paidList.push(`  ✅ ${m.name} (${formatVND(st.amountPaid)})`);
        totalCollectedCycle += Number(st.amountPaid || 0);
      } else {
        unpaidList.push(`  ⏳ ${m.name}`);
      }
    });

    const lines = [
      `BÁO CÁO QUỸ DỰ TRƯỞNG CHI ĐOÀN ${branch.toUpperCase()} 1`,
      `Kỳ thu: ${cycle} (Định mức: 5.000đ/tuần)`,
      `────────────────────`,
      `ĐÃ ĐÓNG (${paidList.length}/${members.length} - Tổng: ${formatVND(totalCollectedCycle)}):`,
      ...(paidList.length ? paidList : ['  (Chưa có)']),
      `────────────────────`,
      `CHƯA ĐÓNG / CẦN NHẮC (${unpaidList.length}):`,
      ...(unpaidList.length ? unpaidList : ['  Tất cả thành viên đã hoàn tất đóng quỹ!'])
    ];

    navigator.clipboard.writeText(lines.join('\n'))
      .then(() => showToast(`Đã copy báo cáo quỹ Ngành ${branch} để gửi nhóm Zalo/Messenger!`, 'success'))
      .catch(() => showToast('Không thể sao chép báo cáo.', 'error'));
  }

  function renderTreasuryLedgerHistory() {
    const container = document.getElementById('treasuryHistoryContainer');
    if (!container) return;

    const statusFilter = document.getElementById('filterQuyStatus').value;
    const branchFilter = document.getElementById('filterQuyBranch').value;
    const kw = normalizeText(document.getElementById('searchQuyMember').value);

    const filtered = (appData.quanLyQuy || []).filter(r => {
      if (statusFilter !== 'ALL' && r.paymentStatus !== statusFilter) return false;
      if (branchFilter !== 'ALL' && r.branch !== branchFilter) return false;
      if (kw) {
        const matchName = normalizeText(r.memberName).includes(kw);
        const matchCycle = normalizeText(r.billingCycle).includes(kw);
        const matchTx = normalizeText(r.transactionId).includes(kw);
        if (!matchName && !matchCycle && !matchTx) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      container.innerHTML = `<div class="bg-white/60 backdrop-blur-2xl p-5 rounded-3xl border border-white/50 text-center text-xs text-slate-400">Chưa có giao dịch quỹ nào khớp bộ lọc.</div>`;
      return;
    }

    const canManage = currentUser && currentUser.canManageTreasury;

    container.innerHTML = filtered.slice(0, 60).map(item => {
      const statusBadge =
        item.paymentStatus === 'PAID' ? 'bg-emerald-500/15 text-emerald-800 border-emerald-300/60' :
        item.paymentStatus === 'OVERDUE' ? 'bg-rose-500/15 text-rose-800 border-rose-300/60' :
        'bg-amber-500/15 text-amber-800 border-amber-300/60';

      const canDeleteRow = canManage && (
        currentUser.isAdmin ||
        currentUser.isSupervisor ||
        currentUser.canManageAllTreasuryBranches ||
        item.branch === currentUser.nganh
      );

      return `
        <div class="bg-white/65 backdrop-blur-2xl p-3.5 rounded-3xl border border-white/50 flex items-center justify-between gap-2 shadow-[0_8px_24px_rgb(0,0,0,0.03)]">
          <div class="min-w-0 flex-1 space-y-0.5">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${statusBadge}">${escapeHtml(item.paymentStatus)}</span>
              <span class="text-xs font-bold text-slate-900">${escapeHtml(item.memberName)}</span>
              <span class="text-[10px] text-slate-500 font-semibold">• Ngành ${escapeHtml(item.branch)}</span>
            </div>
            <p class="text-[11px] text-slate-600">
              Kỳ: <b>${escapeHtml(item.billingCycle)}</b> • Số tiền: <b class="text-emerald-700">${formatVND(item.amountPaid)}</b> (${escapeHtml(item.paymentMethod)})
            </p>
            <p class="text-[10px] text-slate-400">
              Mã GD: <span class="font-mono">${escapeHtml(item.transactionId)}</span> • ${escapeHtml(item.timestamp)} • Thu bởi: ${escapeHtml(item.recordedBy)}
            </p>
          </div>
          ${canDeleteRow ? `
            <button onclick="handleDeleteQuyRow(${item.rowIndex})" class="text-slate-300 hover:text-rose-600 p-1.5 text-xs shrink-0 transition" title="Xóa giao dịch">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  function handleDeleteQuyRow(rowIndex) {
    askConfirm('Xóa giao dịch quỹ', 'Bạn có chắc muốn xóa dòng giao dịch quỹ này khỏi QUAN_LY_QUY?', () => {
      showLoading('Đang xóa giao dịch quỹ...');
      google.script.run
        .withSuccessHandler(res => {
          hideLoading();
          showToast(res.message, res.success ? 'success' : 'error');
          if (res.success) loadAppData();
        })
        .withFailureHandler(err => {
          hideLoading();
          showToast('Lỗi: ' + err.message, 'error');
        })
        .apiXoaGiaoDichQuy(currentUser.role, currentUser.nganh, currentUser.fullName, currentUser.roleTitle, rowIndex);
    });
  }


  // =========================================================================
  // 8. MODULE TRANG CÁ NHÂN & THÔNG TIN DỰ TRƯỞNG (TAB 6: USER PROFILE)
  // =========================================================================
  function getStatusStatePresentation(stateCodeOrLabel) {
    const raw = String(stateCodeOrLabel || 'GOOD').toUpperCase();
    if (raw.includes('SUSPENDED') || raw.includes('TẠM NGƯNG')) {
      return {
        code: 'SUSPENDED',
        label: 'SUSPENDED • TẠM NGƯNG',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-300',
        barColor: 'bg-rose-500'
      };
    }
    if (raw.includes('NEEDS_IMPROVEMENT') || raw.includes('CẦN CỐ GẮNG')) {
      return {
        code: 'NEEDS_IMPROVEMENT',
        label: 'NEEDS_IMPROVEMENT • CẦN CỐ GẮNG',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-300',
        barColor: 'bg-amber-500'
      };
    }
    if (raw.includes('SATISFACTORY') || raw.includes('ĐẠT')) {
      return {
        code: 'SATISFACTORY',
        label: 'SATISFACTORY • ĐẠT',
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-300',
        barColor: 'bg-blue-500'
      };
    }
    return {
      code: 'GOOD',
      label: 'GOOD • TỐT',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-300',
      barColor: 'bg-emerald-500'
    };
  }

  function renderCaNhan() {
    if (!currentUser) return;

    const myNorm = normalizeText(currentUser.fullName);
    const member = (appData.danhSach || []).find(m => normalizeText(m.name) === myNorm) || {
      name: currentUser.fullName,
      baptismalName: currentUser.baptismalName || '',
      nganh: currentUser.nganh || 'Chung',
      capBac: currentUser.capBac || 'Dự trưởng',
      roleTitle: currentUser.roleTitle || 'Dự trưởng',
      status: currentUser.status || 'Tốt',
      statusState: currentUser.statusState || 'GOOD',
      email: currentUser.email || '',
      phone: currentUser.phone || '',
      avatarUrl: currentUser.avatarUrl || '',
      busyFixed: '',
      busyDates: '',
      canWeekday: true,
      diligenceScore: 90,
      totalDuesPaid: 0,
      promotionNotes: ''
    };

    const tk = (appData.thongKe || []).find(t => normalizeText(t.name) === myNorm) || {
      logCount: 0,
      currentCount: 0,
      total: 0,
      diligenceScore: member.diligenceScore || 90,
      leaderStatus: member.status || 'Tốt',
      statusState: member.statusState || 'GOOD',
      promotionEligible: 'Xét duyệt tốt',
      totalDuesPaid: member.totalDuesPaid || 0
    };

    // 1. Render Cover Banner, Avatar & Identity Header
    const activeAvatarUrl = member.avatarUrl || currentUser.avatarUrl || LOGO_URL;
    const avatarEl = document.getElementById('myProfileAvatar');
    if (avatarEl) avatarEl.src = activeAvatarUrl;

    const previewEl = document.getElementById('customizerAvatarPreview');
    if (previewEl) previewEl.src = activeAvatarUrl;

    const coverEl = document.getElementById('myProfileCoverBanner');
    if (coverEl) {
      let coverGrad = 'from-blue-600 via-indigo-600 to-blue-700';
      if (currentUser.role === 'THU_QUY' || currentUser.isTreasurer) {
        coverGrad = 'from-emerald-600 via-teal-600 to-cyan-700';
      } else if (member.nganh === 'Chiên') {
        coverGrad = 'from-pink-600 via-rose-500 to-pink-700';
      } else if (member.nganh === 'Ấu') {
        coverGrad = 'from-emerald-600 via-teal-500 to-emerald-700';
      } else if (member.nganh === 'Thiếu') {
        coverGrad = 'from-blue-600 via-indigo-600 to-blue-700';
      } else if (member.nganh === 'Nghĩa') {
        coverGrad = 'from-amber-500 via-orange-500 to-amber-600';
      }
      coverEl.className = `h-24 bg-gradient-to-r ${coverGrad} px-4 pt-3 flex items-start justify-between relative`;
    }

    const stPres = getStatusStatePresentation(tk.statusState || member.status);
    const stateBadge = document.getElementById('myProfileStateBadge');
    if (stateBadge) {
      stateBadge.className = `text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-white/95 shadow-2xs border ${stPres.badgeClass}`;
      stateBadge.textContent = stPres.label;
    }

    document.getElementById('myProfileBranchBadge').textContent =
      member.nganh === 'Tất cả' ? 'Toàn Xứ Đoàn' : `Chi đoàn ${member.nganh || 'Chung'}`;
    document.getElementById('myProfileFullName').textContent = member.name;
    document.getElementById('myProfileRoleText').textContent =
      `${member.capBac || 'Dự trưởng'} • ${member.roleTitle || 'Dự trưởng'} (TK: ${member.username || currentUser.username || 'N/A'})`;

    // Render 4 Chip Thông tin Định danh & Liên hệ nhanh trên Hero Card
    const chipsEl = document.getElementById('myProfileQuickInfoChips');
    if (chipsEl) {
      const bapText = member.baptismalName || currentUser.baptismalName || 'Chưa cập nhật';
      const phoneText = member.phone || currentUser.phone || 'Chưa cập nhật';
      const emailText = member.email || currentUser.email || 'Chưa cập nhật';
      const modeText = member.canWeekday !== false ? 'Cả tuần (T2 ➔ CN)' : 'Hệ ĐH';

      chipsEl.innerHTML = `
        <div class="p-2.5 rounded-2xl bg-white/60 border border-white/60 flex items-center gap-2 min-w-0">
          <div class="w-7 h-7 rounded-xl bg-blue-500/15 text-blue-600 flex items-center justify-center text-xs shrink-0">
            <i class="fa-solid fa-cross"></i>
          </div>
          <div class="min-w-0">
            <p class="text-[9px] font-semibold uppercase text-slate-400">Tên Thánh</p>
            <p class="text-xs font-bold text-slate-800 truncate">${escapeHtml(bapText)}</p>
          </div>
        </div>
        <div class="p-2.5 rounded-2xl bg-white/60 border border-white/60 flex items-center gap-2 min-w-0">
          <div class="w-7 h-7 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center text-xs shrink-0">
            <i class="fa-solid fa-phone"></i>
          </div>
          <div class="min-w-0">
            <p class="text-[9px] font-semibold uppercase text-slate-400">Số điện thoại</p>
            <p class="text-xs font-bold text-slate-800 truncate">${escapeHtml(phoneText)}</p>
          </div>
        </div>
        <div class="p-2.5 rounded-2xl bg-white/60 border border-white/60 flex items-center gap-2 min-w-0">
          <div class="w-7 h-7 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center text-xs shrink-0">
            <i class="fa-regular fa-envelope"></i>
          </div>
          <div class="min-w-0">
            <p class="text-[9px] font-semibold uppercase text-slate-400">Email thông báo</p>
            <p class="text-[11px] font-semibold text-slate-700 truncate">${escapeHtml(emailText)}</p>
          </div>
        </div>
        <div class="p-2.5 rounded-2xl bg-white/60 border border-white/60 flex items-center gap-2 min-w-0">
          <div class="w-7 h-7 rounded-xl bg-purple-500/15 text-purple-600 flex items-center justify-center text-xs shrink-0">
            <i class="fa-solid fa-calendar-week"></i>
          </div>
          <div class="min-w-0">
            <p class="text-[9px] font-semibold uppercase text-slate-400">Chế độ trực</p>
            <p class="text-[11px] font-bold text-slate-800 truncate">${escapeHtml(modeText)}</p>
          </div>
        </div>
      `;
    }

    document.getElementById('selfBaptismal').value = member.baptismalName || currentUser.baptismalName || '';
    document.getElementById('selfPhone').value = member.phone || currentUser.phone || '';
    document.getElementById('selfEmail').value = member.email || currentUser.email || '';
    document.getElementById('selfAvatarUrl').value = member.avatarUrl || currentUser.avatarUrl || '';

    // 2. Render Competency & Promotion Progression Engine Card
    const engineEl = document.getElementById('myPromotionEngineCard');
    if (engineEl) {
      const score = Number(tk.diligenceScore !== undefined ? tk.diligenceScore : 90);
      const totalShifts = Number(tk.total || 0);
      const targetShifts = 4; // Mốc ca trực tích lũy chuẩn
      const scoreProgress = Math.min(100, Math.round((score / 75) * 60));
      const shiftProgress = Math.min(40, Math.round((Math.min(totalShifts, targetShifts) / targetShifts) * 40));
      const overallMilestonePct = stPres.code === 'SUSPENDED' ? 0 : Math.min(100, scoreProgress + shiftProgress);

      engineEl.innerHTML = `
        <div class="flex items-center justify-between">
          <div>
            <h4 class="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <i class="fa-solid fa-gauge-high text-blue-600"></i> Tiến Trình Thăng Cấp Huynh Trưởng
            </h4>
            <p class="text-[11px] text-slate-500">State Machine & Điểm Chuyên Cần Thời Gian Thực</p>
          </div>
          <span class="text-xs font-extrabold px-3 py-1 rounded-full bg-blue-500/15 text-blue-700 border border-blue-200/70">
            ${overallMilestonePct}%
          </span>
        </div>

        <div class="w-full h-2.5 bg-white/70 rounded-full overflow-hidden p-0.5 border border-white/60">
          <div class="h-full ${stPres.barColor} rounded-full transition-all duration-500" style="width: ${overallMilestonePct}%"></div>
        </div>

        <div class="grid grid-cols-3 gap-2 pt-1">
          <div class="p-2.5 rounded-2xl bg-white/60 border border-white/60 text-center">
            <p class="text-[10px] font-semibold text-slate-500">Điểm Chuyên Cần</p>
            <p class="text-sm font-extrabold text-emerald-600 mt-0.5">${score} / 100đ</p>
          </div>
          <div class="p-2.5 rounded-2xl bg-white/60 border border-white/60 text-center">
            <p class="text-[10px] font-semibold text-slate-500">Tổng Ca Tích Lũy</p>
            <p class="text-sm font-extrabold text-blue-600 mt-0.5">${totalShifts} ca</p>
          </div>
          <div class="p-2.5 rounded-2xl bg-white/60 border border-white/60 text-center">
            <p class="text-[10px] font-semibold text-slate-500">Xét Tuyên Hứa</p>
            <p class="text-[11px] font-extrabold text-purple-700 mt-1">${escapeHtml(tk.promotionEligible || 'Đủ ĐK')}</p>
          </div>
        </div>

        ${member.promotionNotes ? `
          <div class="text-[11px] text-slate-600 bg-amber-500/10 border border-amber-200/70 p-3 rounded-2xl">
            <i class="fa-solid fa-star text-amber-500 mr-1"></i><b>Nhận xét BĐH:</b> ${escapeHtml(member.promotionNotes)}
          </div>
        ` : ''}
      `;
    }

    // 3. Render Self-Service Availability Inline Controls
    profileInlineFixedDaysSet = new Set(
      (member.busyFixed || '')
        .split(/[,;|]/)
        .map(s => s.trim().toUpperCase())
        .filter(Boolean)
    );
    renderProfileInlineFixedButtons();
    document.getElementById('profileBusyDatesInput').value = member.busyDates || '';
    renderProfileBusyDateChipsFromInput();
    setProfileWeekdayMode(member.canWeekday !== false);

    // 4. Render Historical Audit & Upcoming Schedule Sub-View
    renderProfileAuditHistory();
  }

  function openProfileCustomizer(mode) {
    const box = document.getElementById('profileCustomizerBox');
    if (!box) return;
    box.classList.remove('hidden');
    switchProfileCustomizerTab(mode || 'IDENTITY');
    setTimeout(() => {
      box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 60);
  }

  function closeProfileCustomizer() {
    const box = document.getElementById('profileCustomizerBox');
    if (box) box.classList.add('hidden');
  }

  function switchProfileCustomizerTab(mode) {
    const pIdentity = document.getElementById('custPanelIdentity');
    const pAvail = document.getElementById('custPanelAvailability');
    const btnIdentity = document.getElementById('tabBtnCustIdentity');
    const btnAvail = document.getElementById('tabBtnCustAvailability');

    if (mode === 'AVAILABILITY' && currentUser && currentUser.role !== 'HT_DONG_HANH') {
      pIdentity.classList.add('hidden');
      pAvail.classList.remove('hidden');
      btnAvail.className = 'py-2 px-3 rounded-xl text-xs font-bold bg-white text-blue-700 shadow-2xs transition flex items-center justify-center gap-1.5';
      btnIdentity.className = 'py-2 px-3 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 transition flex items-center justify-center gap-1.5';
    } else {
      pAvail.classList.add('hidden');
      pIdentity.classList.remove('hidden');
      btnIdentity.className = 'py-2 px-3 rounded-xl text-xs font-bold bg-white text-blue-700 shadow-2xs transition flex items-center justify-center gap-1.5';
      btnAvail.className = 'py-2 px-3 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 transition flex items-center justify-center gap-1.5';
    }
  }

  function previewCustomAvatarUrl(url) {
    const previewEl = document.getElementById('customizerAvatarPreview');
    if (previewEl) {
      previewEl.src = String(url || '').trim() || LOGO_URL;
    }
  }

  function selectPresetAvatarTheme(hexColor) {
    if (!currentUser) return;
    const words = String(currentUser.fullName || 'DT').trim().split(/\s+/);
    const shortName = words.slice(-2).join(' ');
    const presetUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(shortName)}&background=${hexColor}&color=fff&size=256&bold=true`;
    document.getElementById('selfAvatarUrl').value = presetUrl;
    previewCustomAvatarUrl(presetUrl);
    showToast('Đã chọn mẫu Avatar theo màu ngành! Nhấn "Lưu Tùy Chỉnh Hồ Sơ" để áp dụng.', 'info');
  }

  function resetMyAvatarToDefault() {
    document.getElementById('selfAvatarUrl').value = '';
    previewCustomAvatarUrl(LOGO_URL);
    showToast('Đã đặt lại ảnh mặc định. Nhấn "Lưu Tùy Chỉnh Hồ Sơ" để lưu.', 'info');
  }

  function selectQuickSaintName(saintName) {
    const el = document.getElementById('selfBaptismal');
    if (el) {
      el.value = saintName;
      el.focus();
    }
  }

  function addProfileBusyDateFromPicker() {
    const picker = document.getElementById('profileBusyDatePicker');
    if (!picker || !picker.value) {
      showToast('Vui lòng chọn một ngày trên lịch trước khi bấm Thêm!', 'warning');
      return;
    }
    const parts = picker.value.split('-');
    if (parts.length !== 3) return;
    const formatted = `${parts[2]}/${parts[1]}`;

    const inputEl = document.getElementById('profileBusyDatesInput');
    const currentTokens = (inputEl.value || '')
      .split(/[,;|]/)
      .map(s => s.trim())
      .filter(Boolean);

    if (!currentTokens.includes(formatted)) {
      currentTokens.push(formatted);
      inputEl.value = currentTokens.join(', ');
      renderProfileBusyDateChipsFromInput();
    }
    picker.value = '';
  }

  function renderProfileBusyDateChipsFromInput() {
    const inputEl = document.getElementById('profileBusyDatesInput');
    const chipsContainer = document.getElementById('profileBusyDateChips');
    if (!inputEl || !chipsContainer) return;

    const tokens = (inputEl.value || '')
      .split(/[,;|]/)
      .map(s => s.trim())
      .filter(Boolean);

    if (tokens.length === 0) {
      chipsContainer.innerHTML = `<span class="text-[10px] text-slate-400 italic">Chưa có ngày bận đột xuất nào trong tháng.</span>`;
      return;
    }

    chipsContainer.innerHTML = tokens.map(t => `
      <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-800 text-[11px] font-bold border border-rose-300/60">
        <i class="fa-regular fa-calendar-xmark text-[10px]"></i>
        <span>${escapeHtml(t)}</span>
        <button type="button" onclick="removeProfileBusyDateChip('${escapeHtml(t)}')" class="ml-0.5 text-rose-500 hover:text-rose-900 font-extrabold">×</button>
      </span>
    `).join('');
  }

  function removeProfileBusyDateChip(tokenToRemove) {
    const inputEl = document.getElementById('profileBusyDatesInput');
    if (!inputEl) return;
    const remaining = (inputEl.value || '')
      .split(/[,;|]/)
      .map(s => s.trim())
      .filter(s => s && s !== tokenToRemove);
    inputEl.value = remaining.join(', ');
    renderProfileBusyDateChipsFromInput();
  }

  function setProfileWeekdayMode(canWeekdayBool) {
    const checkEl = document.getElementById('profileCanWeekdayCheck');
    const btnFull = document.getElementById('btnModeFullWeek');
    const btnSun = document.getElementById('btnModeSundayOnly');
    if (checkEl) checkEl.checked = Boolean(canWeekdayBool);

    if (btnFull && btnSun) {
      if (canWeekdayBool) {
        btnFull.className = 'p-2.5 rounded-2xl border-2 border-emerald-500 bg-emerald-50/70 text-left transition';
        btnSun.className = 'p-2.5 rounded-2xl border border-white/60 bg-white/60 text-left transition';
      } else {
        btnSun.className = 'p-2.5 rounded-2xl border-2 border-indigo-500 bg-indigo-50/70 text-left transition';
        btnFull.className = 'p-2.5 rounded-2xl border border-white/60 bg-white/60 text-left transition';
      }
    }
  }

  function toggleProfileFixedDay(day) {
    if (profileInlineFixedDaysSet.has(day)) profileInlineFixedDaysSet.delete(day);
    else profileInlineFixedDaysSet.add(day);
    renderProfileInlineFixedButtons();
  }

  function renderProfileInlineFixedButtons() {
    document.querySelectorAll('.prof-avail-btn').forEach(btn => {
      const d = btn.dataset.day;
      if (profileInlineFixedDaysSet.has(d)) {
        btn.className = 'prof-avail-btn py-2 rounded-xl text-xs font-bold border-2 border-rose-500 bg-rose-50 text-rose-700 shadow-2xs';
      } else {
        btn.className = 'prof-avail-btn py-2 rounded-xl text-xs font-bold border border-white/60 bg-white/60 text-slate-600';
      }
    });
  }

  function handleSaveSelfProfileIdentity() {
    if (!currentUser) return;
    const payload = {
      name: currentUser.fullName,
      baptismalName: document.getElementById('selfBaptismal').value.trim(),
      phone: document.getElementById('selfPhone').value.trim(),
      email: document.getElementById('selfEmail').value.trim(),
      avatarUrl: document.getElementById('selfAvatarUrl').value.trim()
    };

    showLoading('Đang lưu tùy chỉnh Trang cá nhân...');
    google.script.run
      .withSuccessHandler(res => {
        hideLoading();
        showToast(res.message, res.success ? 'success' : 'error');
        if (res.success) {
          currentUser.baptismalName = payload.baptismalName;
          currentUser.phone = payload.phone;
          currentUser.email = payload.email;
          currentUser.avatarUrl = payload.avatarUrl;
          try {
            if (localStorage.getItem(STORAGE_KEY_USER)) {
              localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(currentUser));
            }
          } catch (e) {}
          closeProfileCustomizer();
          loadAppData();
        }
      })
      .withFailureHandler(err => {
        hideLoading();
        showToast('Lỗi: ' + err.message, 'error');
      })
      .apiCapNhatHoSoCaNhanSelfService(currentUser.fullName, payload);
  }

  function handleSaveProfileAvailabilityInline() {
    if (!currentUser) return;
    const busyFixed = Array.from(profileInlineFixedDaysSet).join(', ');
    const busyDates = document.getElementById('profileBusyDatesInput').value.trim();
    const canWeekday = document.getElementById('profileCanWeekdayCheck').checked;

    showLoading('Đang lưu cấu hình lịch bận & chế độ học ĐH...');
    google.script.run
      .withSuccessHandler(res => {
        hideLoading();
        showToast(res.message, res.success ? 'success' : 'error');
        if (res.success) {
          closeProfileCustomizer();
          loadAppData();
        }
      })
      .withFailureHandler(err => {
        hideLoading();
        showToast('Lỗi: ' + err.message, 'error');
      })
      .apiCapNhatLichBanCaNhan(currentUser.role, currentUser.nganh, currentUser.fullName, {
        name: currentUser.fullName,
        nganh: currentUser.nganh,
        busyFixed: busyFixed,
        busyDates: busyDates,
        canWeekday: canWeekday
      });
  }

  function handleAvatarFileSelected(event) {
    const file = event.target.files && event.target.files[0];
    if (!file || !currentUser) return;

    showLoading('Đang nén và tải ảnh đại diện lên Google Drive...');
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        const canvas = document.createElement('canvas');
        const maxDim = 360;
        let w = img.width;
        let h = img.height;
        if (w > h && w > maxDim) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else if (h >= w && h > maxDim) {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.84);

        google.script.run
          .withSuccessHandler(res => {
            hideLoading();
            showToast(res.message, res.success ? 'success' : 'error');
            if (res.success && res.avatarUrl) {
              document.getElementById('selfAvatarUrl').value = res.avatarUrl;
              document.getElementById('myProfileAvatar').src = res.avatarUrl;
              document.getElementById('headerLogo').src = res.avatarUrl;
              loadAppData();
            }
          })
          .withFailureHandler(err => {
            hideLoading();
            showToast('Lỗi tải ảnh lên Drive: ' + err.message, 'error');
          })
          .apiUploadAvatarToDrive(currentUser.fullName, compressedBase64, 'image/jpeg', file.name);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function switchProfileAuditSubTab(subTab) {
    selectedProfileAuditSubTab = subTab;
    const mapBtn = {
      UPCOMING: 'subTabAuditUpcoming',
      LOG_HISTORY: 'subTabAuditLog',
      DISCIPLINE: 'subTabAuditDiscipline',
      DUES: 'subTabAuditDues'
    };
    Object.keys(mapBtn).forEach(k => {
      const btn = document.getElementById(mapBtn[k]);
      if (!btn) return;
      if (k === subTab) {
        btn.className = 'px-3 py-1.5 rounded-full text-[11px] font-bold bg-blue-600 text-white shrink-0 shadow-2xs';
      } else {
        btn.className = 'px-3 py-1.5 rounded-full text-[11px] font-semibold bg-white/60 border border-white/50 text-slate-600 shrink-0';
      }
    });
    renderProfileAuditHistory();
  }

  function renderProfileAuditHistory() {
    const container = document.getElementById('profileAuditHistoryContainer');
    if (!container || !currentUser) return;
    const myNorm = normalizeText(currentUser.fullName);

    if (selectedProfileAuditSubTab === 'UPCOMING') {
      const upcoming = (appData.lich || []).filter(s => normalizeText(s.nguoi) === myNorm);
      if (upcoming.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-400 text-center py-4">Bạn chưa có ca trực nào được phân công trong lịch hiện tại.</p>`;
        return;
      }
      container.innerHTML = upcoming.map(s => `
        <div class="p-3 rounded-2xl bg-white/60 border border-white/60 flex items-center justify-between">
          <div>
            <p class="text-xs font-bold text-slate-800">${escapeHtml(s.thu)} (${escapeHtml(s.ngayStr)}) • ${escapeHtml(s.tuan)}</p>
            <p class="text-[11px] text-blue-600 font-semibold">${escapeHtml(s.congViec)} ${s.suat > 1 ? `(Suất ${s.suat})` : ''}</p>
          </div>
          <button onclick="quickReportBusy('${escapeHtml(s.ngayStr)}', '${escapeHtml(s.congViec)}')" class="px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-600 text-[10px] font-bold">
            Báo bận
          </button>
        </div>
      `).join('');
      return;
    }

    if (selectedProfileAuditSubTab === 'LOG_HISTORY') {
      const logs = (appData.logTruc || []).filter(l => normalizeText(l.nguoi) === myNorm);
      if (logs.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-400 text-center py-4">Chưa có lịch sử ca trực đã chốt trong LOG_TRUC.</p>`;
        return;
      }
      container.innerHTML = logs.map(l => `
        <div class="p-3 rounded-2xl bg-white/60 border border-white/60 flex items-center justify-between">
          <div>
            <p class="text-xs font-bold text-slate-800">${escapeHtml(l.congViec)} • Ngày ${escapeHtml(l.ngay)}</p>
            <p class="text-[10px] text-slate-500">${escapeHtml(l.tuan)} • Ngành ${escapeHtml(l.nganh)} • Mã: ${escapeHtml(l.maLog)}</p>
          </div>
          <span class="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700">+2đ CC</span>
        </div>
      `).join('');
      return;
    }

    if (selectedProfileAuditSubTab === 'DISCIPLINE') {
      const kl = (appData.kyLuat || []).filter(k => normalizeText(k.name) === myNorm);
      if (kl.length === 0) {
        container.innerHTML = `<p class="text-xs text-emerald-600 font-semibold text-center py-4">🎉 Tuyệt vời! Bạn không có vi phạm kỷ luật nào.</p>`;
        return;
      }
      container.innerHTML = kl.map(k => `
        <div class="p-3 rounded-2xl bg-white/60 border border-white/60">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-slate-800">${escapeHtml(k.loai)}</span>
            <span class="text-[10px] text-slate-500">${escapeHtml(k.ngay)}</span>
          </div>
          ${k.lyDo ? `<p class="text-[11px] text-slate-600 mt-0.5">${escapeHtml(k.lyDo)}</p>` : ''}
        </div>
      `).join('');
      return;
    }

    if (selectedProfileAuditSubTab === 'DUES') {
      const dues = (appData.quanLyQuy || []).filter(q => normalizeText(q.memberName) === myNorm);
      if (dues.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-400 text-center py-4">Chưa có lịch sử giao dịch quỹ cá nhân.</p>`;
        return;
      }
      container.innerHTML = dues.map(q => `
        <div class="p-3 rounded-2xl bg-white/60 border border-white/60 flex items-center justify-between">
          <div>
            <p class="text-xs font-bold text-slate-800">${escapeHtml(q.billingCycle)}</p>
            <p class="text-[10px] text-slate-500">${escapeHtml(q.timestamp)} • ${escapeHtml(q.paymentMethod)}</p>
          </div>
          <div class="text-right">
            <p class="text-xs font-extrabold ${q.paymentStatus === 'PAID' ? 'text-emerald-700' : 'text-rose-600'}">${formatVND(q.amountPaid)}</p>
            <span class="text-[9px] font-bold uppercase">${escapeHtml(q.paymentStatus)}</span>
          </div>
        </div>
      `).join('');
    }
  }

  // =========================================================================
  // 9. CHIA LỊCH, ĐỔI NGƯỜI THÔNG MINH, HỒ SƠ CẤP BẬC, XÉT TUYÊN HỨA & BACKUP
  // =========================================================================
  function handleTaoLich() {
    const month = document.getElementById('genMonth').value;
    const year = document.getElementById('genYear').value;
    const targetNganh = document.getElementById('genTargetNganh').value;
    const startNganh = document.getElementById('genStartNganh').value;

    askConfirm(
      'Chia lịch tự động theo Tuần',
      `Hệ thống sẽ chia lịch Tháng ${month}/${year} (Tuần 1 khởi đầu: Ngành ${startNganh}, Phạm vi: ${targetNganh}). Tiếp tục?`,
      () => {
        showLoading('Đang chạy thuật toán chia lịch tối ưu...');
        google.script.run
          .withSuccessHandler(res => {
            hideLoading();
            showToast(res.message, res.success ? 'success' : 'error');
            if (res.success) {
              selectedWeekTab = 'ALL';
              loadAppData();
              switchTab('Lich');
            }
          })
          .withFailureHandler(err => {
            hideLoading();
            showToast('Lỗi: ' + err.message, 'error');
          })
          .apiTaoLichTuApp(currentUser.role, currentUser.nganh, year, month, targetNganh, startNganh, currentUser.fullName);
      }
    );
  }

  function handleChotLich() {
    askConfirm(
      'Chốt lịch chính thức & Gửi thông báo',
      'Hệ thống sẽ lưu các ca trực hiện tại vào LOG_TRUC và tự động tạo Thông báo In-App + gửi Email lịch trực chính thức đến từng Dự trưởng. Tiếp tục?',
      () => {
        showLoading('Đang chốt lịch vào LOG_TRUC & gửi thông báo...');
        google.script.run
          .withSuccessHandler(res => {
            hideLoading();
            showToast(res.message, res.success ? 'success' : 'error');
            if (res.success) loadAppData();
          })
          .withFailureHandler(err => {
            hideLoading();
            showToast('Lỗi: ' + err.message, 'error');
          })
          .apiChotLichTuApp(currentUser.role, currentUser.fullName);
      }
    );
  }

  function handleGuiEmailLich() {
    askConfirm(
      'Gửi Email & Thông báo lịch trực',
      'Hệ thống sẽ tạo Thông báo In-App và gửi Email lịch trực cá nhân đến các thành viên trong danh sách. Tiếp tục?',
      () => {
        showLoading('Đang tạo thông báo & gửi Email...');
        google.script.run
          .withSuccessHandler(res => {
            hideLoading();
            showToast(res.message, res.success ? 'success' : 'error');
            if (res.success) refreshNotifications(false);
          })
          .withFailureHandler(err => {
            hideLoading();
            showToast('Lỗi gửi Email: ' + err.message, 'error');
          })
          .apiGuiEmailTuApp(currentUser.role, currentUser.nganh, currentUser.fullName);
      }
    );
  }

  function handleTriggerDriveBackup() {
    askConfirm(
      'Sao lưu Zero-Loss lên Google Drive',
      'Hệ thống sẽ tạo một bản sao lưu toàn bộ Spreadsheet hiện tại vào thư mục /Backups trên Google Drive (Backup_BMBS_YYYYMMDD_HHmm). Tiếp tục?',
      () => {
        showLoading('Đang tạo bản sao lưu vào thư mục /Backups trên Google Drive...');
        google.script.run
          .withSuccessHandler(res => {
            hideLoading();
            showToast(res.message, res.success ? 'success' : 'error');
          })
          .withFailureHandler(err => {
            hideLoading();
            showToast('Lỗi sao lưu Drive: ' + err.message, 'error');
          })
          .apiTaoBanSaoLuuDrive(currentUser.role, currentUser.fullName);
      }
    );
  }

  function openEditModal(rowIndex, nganh, ngayStr, congViec, nguoiHienTai, phanHoiRowIndex) {
    if (currentUser.role === 'TRUONG_NGANH' && !currentUser.isSupervisor && currentUser.nganh !== nganh) {
      showToast(`Bạn chỉ được đổi lịch của ngành ${currentUser.nganh}!`, 'warning');
      return;
    }

    document.getElementById('editRowIndex').value = rowIndex;
    document.getElementById('editPhanHoiRowIndex').value = phanHoiRowIndex || '';

    const shiftRow = (appData.lich || []).find(r => r.rowIndex === Number(rowIndex));
    const thuStr = shiftRow ? shiftRow.thu : '';
    const isWeekdayShift = thuStr && thuStr !== 'CN';

    document.getElementById('editModalInfo').innerHTML = `
      <div><b>Ngày trực:</b> ${escapeHtml(thuStr ? thuStr + ' - ' : '')}${escapeHtml(ngayStr)} (Ngành ${escapeHtml(nganh)})</div>
      <div><b>Công việc:</b> ${escapeHtml(congViec)}</div>
      <div><b>Hiện tại:</b> <span class="text-blue-700 font-bold">${escapeHtml(nguoiHienTai)}</span></div>
    `;

    const busySameDaySet = new Set(
      (appData.lich || [])
        .filter(r => r.ngayStr === ngayStr && r.rowIndex !== Number(rowIndex))
        .map(r => normalizeText(r.nguoi))
    );

    const totalLoadMap = {};
    (appData.thongKe || []).forEach(tk => {
      totalLoadMap[normalizeText(tk.name)] = tk.total || 0;
    });

    const candidates = (appData.danhSach || [])
      .filter(m => m.nganh === nganh && m.capBac === 'Dự trưởng' && m.status !== 'Tạm ngưng')
      .map(m => {
        const norm = normalizeText(m.name);
        const total = totalLoadMap[norm] || 0;
        const alreadyWorkingToday = busySameDaySet.has(norm);
        const cannotWeekday = isWeekdayShift && !m.canWeekday;
        const isBusyToday = checkMemberBusyClient(m, ngayStr, thuStr);

        let priority = 1;
        let statusTag = `Rảnh • ${total} ca`;

        if (m.name === nguoiHienTai) {
          priority = 0;
          statusTag = `Đang phân công (${total} ca)`;
        } else if (alreadyWorkingToday) {
          priority = 2;
          statusTag = `Đang trực ca khác ngày này (${total} ca)`;
        } else if (cannotWeekday) {
          priority = 3;
          statusTag = `Hệ ĐH(${total} ca)`;
        } else if (isBusyToday) {
          priority = 3;
          statusTag = `Báo bận ngày này (${total} ca)`;
        }

        return {
          name: m.name,
          total: total,
          priority: priority,
          label: `${m.name} — [${statusTag}]`
        };
      });

    candidates.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.total - b.total;
    });

    const sel = document.getElementById('editSelectMember');
    sel.innerHTML = '';
    candidates.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.name;
      opt.textContent = c.label;
      if (c.name === nguoiHienTai) opt.selected = true;
      sel.appendChild(opt);
    });

    document.getElementById('editModal').classList.remove('hidden');
  }

  function checkMemberBusyClient(member, ngayStr, thuStr) {
    if (member.busyFixed && thuStr) {
      const arr = member.busyFixed.split(/[,;|]/).map(s => s.trim().toUpperCase());
      if (arr.includes(thuStr.toUpperCase())) return true;
    }
    if (member.busyDates && ngayStr) {
      const shortDate = ngayStr.slice(0, 5);
      const dayOnly = String(Number(ngayStr.slice(0, 2)));
      const arr = member.busyDates.split(/[,;|]/).map(s => s.trim());
      if (arr.includes(ngayStr) || arr.includes(shortDate) || arr.includes(dayOnly)) return true;
    }
    return false;
  }

  function closeEditModal() {
    document.getElementById('editModal').classList.add('hidden');
  }

  function confirmCapNhatNguoi() {
    const rowIndex = Number(document.getElementById('editRowIndex').value);
    const phanHoiRowIndex = document.getElementById('editPhanHoiRowIndex').value;
    const tenMoi = document.getElementById('editSelectMember').value;
    closeEditModal();
    showLoading('Đang cập nhật người trực & gửi thông báo...');
    google.script.run
      .withSuccessHandler(res => {
        hideLoading();
        showToast(res.message, res.success ? 'success' : 'error');
        if (res.success) loadAppData();
      })
      .withFailureHandler(err => {
        hideLoading();
        showToast('Lỗi: ' + err.message, 'error');
      })
      .apiCapNhatNguoiTruc(currentUser.role, currentUser.nganh, rowIndex, tenMoi, phanHoiRowIndex, currentUser.fullName);
  }

  // =========================================================================
  // RENDER HỒ SƠ CẤP BẬC, ĐIỂM CHUYÊN CẦN & XÉT DUYỆT TUYÊN HỨA
  // =========================================================================
  function renderThongKe() {
    const container = document.getElementById('thongKeContainer');
    const summaryEl = document.getElementById('thongKeSummaryCards');
    const filterNganh = document.getElementById('filterTkNganh').value;
    const filterCapBac = document.getElementById('filterTkCapBac') ? document.getElementById('filterTkCapBac').value : 'DU_TRUONG';
    const kw = normalizeText(document.getElementById('searchTkName').value);
    const sortBy = document.getElementById('sortTkBy').value;

    const tkStatsMap = {};
    (appData.thongKe || []).forEach(tk => {
      tkStatsMap[normalizeText(tk.name)] = tk;
    });

    const klCountMap = {};
    (appData.kyLuat || []).forEach(k => {
      const norm = normalizeText(k.name);
      if (!klCountMap[norm]) klCountMap[norm] = { tre: 0, dp: 0, phep: 0, kt: 0 };
      if (k.loai === 'Đi trễ') klCountMap[norm].tre++;
      else if (k.loai === 'Không đồng phục') klCountMap[norm].dp++;
      else if (k.loai === 'Nghỉ phép') klCountMap[norm].phep++;
      else if (k.loai === 'Khen thưởng' || k.loai === 'Thành tích') klCountMap[norm].kt++;
    });

    let mergedList = (appData.danhSach || [])
      .filter(m => !m.roleTitle.includes('Admin Hệ Thống'))
      .map(m => {
        const norm = normalizeText(m.name);
        const tk = tkStatsMap[norm] || {
          logCount: 0,
          currentCount: 0,
          total: 0,
          status: m.capBac === 'Huynh trưởng Đồng hành' ? ' Đồng hành' : ' Chưa có ca trực',
          diligenceScore: m.diligenceScore !== undefined ? m.diligenceScore : 90,
          leaderStatus: m.status || 'Tốt',
          statusState: m.statusState || 'GOOD',
          promotionEligible: 'Xét duyệt tốt',
          totalDuesPaid: m.totalDuesPaid || 0
        };
        return {
          ...m,
          logCount: tk.logCount || 0,
          currentCount: tk.currentCount || 0,
          total: tk.total || 0,
          loadStatus: tk.status || '',
          diligenceScore: tk.diligenceScore !== undefined ? tk.diligenceScore : 90,
          statusState: tk.statusState || m.statusState || 'GOOD',
          promotionEligible: tk.promotionEligible || 'Xét duyệt tốt',
          totalDuesPaid: tk.totalDuesPaid !== undefined ? tk.totalDuesPaid : (m.totalDuesPaid || 0)
        };
      });

    mergedList = mergedList.filter(item => {
      if (filterNganh !== 'ALL' && item.nganh !== filterNganh) return false;
      if (filterCapBac === 'DU_TRUONG' && item.capBac !== 'Dự trưởng') return false;
      if (filterCapBac === 'HT_DONG_HANH' && item.capBac !== 'Huynh trưởng Đồng hành') return false;
      if (filterCapBac === 'ELIGIBLE' && (item.capBac !== 'Dự trưởng' || !item.promotionEligible.includes('Đủ điều kiện'))) return false;
      if (kw) {
        const matchName = normalizeText(item.name).includes(kw);
        const matchUser = normalizeText(item.username || '').includes(kw);
        const matchRole = normalizeText(item.roleTitle || '').includes(kw);
        if (!matchName && !matchUser && !matchRole) return false;
      }
      return true;
    });

    if (sortBy === 'SCORE_DESC') {
      mergedList.sort((a, b) => b.diligenceScore - a.diligenceScore);
    } else if (sortBy === 'TOTAL_ASC') {
      mergedList.sort((a, b) => a.total - b.total);
    } else if (sortBy === 'TOTAL_DESC') {
      mergedList.sort((a, b) => b.total - a.total);
    }

    if (summaryEl) {
      const duTruongList = mergedList.filter(r => r.capBac === 'Dự trưởng');
      const totalMembers = mergedList.length;
      const totalShifts = duTruongList.reduce((acc, r) => acc + (r.total || 0), 0);
      const avgScore = duTruongList.length > 0
        ? Math.round(duTruongList.reduce((acc, r) => acc + (r.diligenceScore || 90), 0) / duTruongList.length)
        : 90;
      const eligibleCount = duTruongList.filter(r => (r.promotionEligible || '').includes('Đủ điều kiện')).length;

      summaryEl.innerHTML = `
        <div class="bg-white/60 backdrop-blur-2xl p-2.5 rounded-3xl border border-white/50 text-center shadow-[0_8px_24px_rgb(0,0,0,0.03)]">
          <p class="text-[10px] text-slate-500 font-semibold uppercase">Hồ sơ</p>
          <p class="text-sm font-extrabold text-slate-800 mt-0.5">${totalMembers}</p>
        </div>
        <div class="bg-white/60 backdrop-blur-2xl p-2.5 rounded-3xl border border-white/50 text-center shadow-[0_8px_24px_rgb(0,0,0,0.03)]">
          <p class="text-[10px] text-slate-500 font-semibold uppercase">Tổng Ca</p>
          <p class="text-sm font-extrabold text-blue-600 mt-0.5">${totalShifts}</p>
        </div>
        <div class="bg-white/60 backdrop-blur-2xl p-2.5 rounded-3xl border border-white/50 text-center shadow-[0_8px_24px_rgb(0,0,0,0.03)]">
          <p class="text-[10px] text-slate-500 font-semibold uppercase">Điểm CC TB</p>
          <p class="text-sm font-extrabold text-emerald-600 mt-0.5">${avgScore}đ</p>
        </div>
        <div class="bg-white/60 backdrop-blur-2xl p-2.5 rounded-3xl border border-white/50 text-center shadow-[0_8px_24px_rgb(0,0,0,0.03)]">
          <p class="text-[10px] text-slate-500 font-semibold uppercase">Đủ ĐK Hứa</p>
          <p class="text-sm font-extrabold text-purple-600 mt-0.5">${eligibleCount}/${duTruongList.length || 0}</p>
        </div>
      `;
    }

    if (mergedList.length === 0) {
      container.innerHTML = `<div class="bg-white/60 backdrop-blur-2xl p-5 rounded-3xl border border-white/50 text-center text-xs text-slate-400">Chưa có hồ sơ nhân sự phù hợp bộ lọc.</div>`;
      return;
    }

    const maxTotal = Math.max(...mergedList.map(i => i.total || 0), 1);

    container.innerHTML = mergedList.map(item => {
      const norm = normalizeText(item.name);
      const kl = klCountMap[norm] || { tre: 0, dp: 0, phep: 0, kt: 0 };
      const hasKl = kl.tre > 0 || kl.dp > 0 || kl.phep > 0 || kl.kt > 0;
      const barWidth = Math.min(100, Math.round(((item.total || 0) / maxTotal) * 100));
      const isHTDH = item.capBac === 'Huynh trưởng Đồng hành';
      const stPres = getStatusStatePresentation(item.statusState || item.status);

      const canEditAvail = !isHTDH && currentUser && (
        currentUser.isAdmin ||
        currentUser.isSupervisor ||
        (currentUser.role === 'TRUONG_NGANH' && currentUser.nganh === item.nganh) ||
        normalizeText(currentUser.fullName) === norm
      );

      const canEditProfile = currentUser && (
        currentUser.isAdmin ||
        currentUser.isSupervisor ||
        (currentUser.role === 'TRUONG_NGANH' && currentUser.nganh === item.nganh)
      );

      return `
        <div class="bg-white/65 backdrop-blur-2xl p-3.5 rounded-3xl border border-white/50 space-y-2 shadow-[0_8px_24px_rgb(0,0,0,0.03)]">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5 flex-wrap">
                <p class="text-xs font-bold text-slate-900 truncate">${escapeHtml(item.name)}</p>
                <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/80 border border-white/60 text-slate-700">Ngành ${escapeHtml(item.nganh)}</span>
                <span class="text-[9px] font-bold px-2 py-0.5 rounded-full border ${stPres.badgeClass}">${escapeHtml(stPres.code)} • ${escapeHtml(item.status || 'Tốt')}</span>
                ${!isHTDH && !item.canWeekday ? `<span class="text-[9px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-700">Hệ ĐH (Chỉ CN)</span>` : ''}
              </div>

              <div class="flex items-center gap-1.5 flex-wrap mt-1 text-[10px] text-slate-500">
                <span class="font-semibold text-blue-700">${escapeHtml(item.capBac)} • ${escapeHtml(item.roleTitle)}</span>
                ${item.username ? `<span class="px-2 py-0.5 rounded-full bg-white/70 text-slate-600 font-mono">TK: ${escapeHtml(item.username)}</span>` : ''}
                ${!isHTDH ? `<span class="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 font-bold">Quỹ: ${formatVND(item.totalDuesPaid)}</span>` : ''}
              </div>

              ${!isHTDH ? `
                <p class="text-[11px] text-slate-500 mt-1">
                  Log: <b>${item.logCount}</b> • Tháng này: <b>${item.currentCount}</b> • Điểm CC: <b class="text-emerald-700">${item.diligenceScore}đ</b> • <span>${escapeHtml(item.promotionEligible)}</span>
                </p>
              ` : `
                <p class="text-[11px] text-slate-500 mt-1">Huynh trưởng Đồng hành • Quyền xem lịch trực & chương trình sinh hoạt</p>
              `}

              ${!isHTDH && (item.busyFixed || item.busyDates) ? `
                <p class="text-[10px] text-rose-600 mt-0.5">
                  <i class="fa-regular fa-calendar-minus mr-0.5"></i>Bận: ${escapeHtml([item.busyFixed, item.busyDates].filter(Boolean).join(' | '))}
                </p>
              ` : ''}

              ${hasKl ? `
                <div class="flex gap-1.5 mt-1 text-[10px] font-semibold flex-wrap">
                  ${kl.tre ? `<span class="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700">Trễ: ${kl.tre}</span>` : ''}
                  ${kl.dp ? `<span class="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-700">👕 Đồng phục: ${kl.dp}</span>` : ''}
                  ${kl.phep ? `<span class="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-700">Phép: ${kl.phep}</span>` : ''}
                  ${kl.kt ? `<span class="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700"> Thành tích: ${kl.kt}</span>` : ''}
                </div>
              ` : ''}

              ${item.promotionNotes ? `
                <p class="text-[10px] text-slate-500 bg-white/60 px-2.5 py-1 rounded-xl mt-1 border border-white/60">
                  <i class="fa-solid fa-star text-amber-400 mr-1"></i>${escapeHtml(item.promotionNotes)}
                </p>
              ` : ''}
            </div>

            <div class="flex flex-col items-end gap-1 shrink-0">
              ${!isHTDH ? `
                <span class="px-3 py-1 rounded-full bg-blue-500/15 text-blue-700 font-extrabold text-xs">${item.total} ca</span>
              ` : `
                <span class="px-2.5 py-1 rounded-full bg-purple-500/15 text-purple-700 font-bold text-[10px]">Đồng hành</span>
              `}
              <div class="flex items-center gap-1.5 mt-0.5">
                ${canEditAvail ? `
                  <button onclick="openAvailabilityModal('${escapeHtml(item.name)}')" class="text-[10px] px-2.5 py-0.5 rounded-full bg-white/80 hover:bg-blue-50 border border-white/60 text-slate-600 hover:text-blue-600 font-semibold">
                    Lịch bận
                  </button>
                ` : ''}
                ${canEditProfile ? `
                  <button onclick="openProfilePromotionModal(${item.rowIndex})" class="text-[10px] px-2.5 py-0.5 rounded-full bg-blue-500/15 hover:bg-blue-500/25 text-blue-700 font-semibold">
                    Xét duyệt
                  </button>
                ` : ''}
              </div>
            </div>
          </div>

          ${!isHTDH ? `
            <div class="w-full h-1.5 bg-slate-200/70 rounded-full overflow-hidden">
              <div class="h-full bg-blue-500 rounded-full transition-all duration-300" style="width: ${barWidth}%"></div>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  function openProfilePromotionModal(rowIndex) {
    const member = (appData.danhSach || []).find(m => m.rowIndex === Number(rowIndex));
    if (!member) return;

    document.getElementById('profRowIndex').value = member.rowIndex;
    document.getElementById('profBaptismal').value = member.baptismalName || '';
    document.getElementById('profFullName').value = member.name || '';
    document.getElementById('profNganh').value = member.nganh || 'Chiên';
    document.getElementById('profCapBac').value = member.capBac || 'Dự trưởng';
    document.getElementById('profRoleTitle').value = member.roleTitle || 'Dự trưởng';
    document.getElementById('profStatus').value = member.status || 'Tốt';
    document.getElementById('profPhone').value = member.phone || '';
    document.getElementById('profEmail').value = member.email || '';
    document.getElementById('profNotes').value = member.promotionNotes || '';

    const canAll = currentUser && (currentUser.isAdmin || currentUser.isSupervisor);
    document.getElementById('profNganh').disabled = !canAll;
    document.getElementById('profCapBac').disabled = !canAll;

    document.getElementById('profilePromotionModal').classList.remove('hidden');
  }

  function closeProfilePromotionModal() {
    document.getElementById('profilePromotionModal').classList.add('hidden');
  }

  function handleSaveProfilePromotion() {
    const payload = {
      rowIndex: Number(document.getElementById('profRowIndex').value),
      baptismalName: document.getElementById('profBaptismal').value.trim(),
      name: document.getElementById('profFullName').value.trim(),
      nganh: document.getElementById('profNganh').value,
      capBac: document.getElementById('profCapBac').value,
      roleTitle: document.getElementById('profRoleTitle').value.trim(),
      status: document.getElementById('profStatus').value,
      phone: document.getElementById('profPhone').value.trim(),
      email: document.getElementById('profEmail').value.trim(),
      promotionNotes: document.getElementById('profNotes').value.trim()
    };

    if (!payload.name) {
      showToast('Họ và tên không được để trống!', 'warning');
      return;
    }

    showLoading('Đang lưu hồ sơ cấp bậc & đánh giá tuyên hứa...');
    google.script.run
      .withSuccessHandler(res => {
        hideLoading();
        showToast(res.message, res.success ? 'success' : 'error');
        if (res.success) {
          closeProfilePromotionModal();
          loadAppData();
        }
      })
      .withFailureHandler(err => {
        hideLoading();
        showToast('Lỗi: ' + err.message, 'error');
      })
      .apiCapNhatHoSoVaXetTuyenHua(currentUser.role, currentUser.nganh, currentUser.fullName, payload);
  }

  // =========================================================================
  // CẤP PHÁT TÀI KHOẢN TỰ ĐỘNG (PROGRAMMATIC ACCOUNT PROVISIONING - ADMIN)
  // =========================================================================
  function openProvisionModal() {
    document.getElementById('provBaptismal').value = '';
    document.getElementById('provFullName').value = '';
    document.getElementById('provCapBac').value = 'Dự trưởng';
    document.getElementById('provUsername').value = '';
    document.getElementById('provPin').value = '0000';
    document.getElementById('provRoleTitle').value = 'Dự trưởng';
    document.getElementById('provEmail').value = '';
    document.getElementById('provisionModal').classList.remove('hidden');
  }

  function onChangeProvisionCapBac() {
    const val = document.getElementById('provCapBac').value;
    if (val === 'Thư ký - Thủ quỹ') {
      document.getElementById('provRoleTitle').value = 'Thư ký - Thủ quỹ (BTT)';
      document.getElementById('provPin').value = '6666';
    } else if (val === 'Huynh trưởng Đồng hành') {
      document.getElementById('provRoleTitle').value = 'Huynh trưởng Đồng hành';
      document.getElementById('provPin').value = '1111';
    } else {
      document.getElementById('provRoleTitle').value = 'Dự trưởng';
      document.getElementById('provPin').value = '0000';
    }
  }

  function closeProvisionModal() {
    document.getElementById('provisionModal').classList.add('hidden');
  }

  function handleCreateProvisionAccount() {
    const payload = {
      mode: 'CREATE_ONE',
      baptismalName: document.getElementById('provBaptismal').value.trim(),
      name: document.getElementById('provFullName').value.trim(),
      capBac: document.getElementById('provCapBac').value,
      nganh: document.getElementById('provNganh').value,
      username: document.getElementById('provUsername').value.trim(),
      pin: document.getElementById('provPin').value.trim(),
      roleTitle: document.getElementById('provRoleTitle').value.trim(),
      email: document.getElementById('provEmail').value.trim()
    };

    if (!payload.name || !payload.username) {
      showToast('Vui lòng nhập đầy đủ Họ tên và Mã tài khoản (Username)!', 'warning');
      return;
    }

    showLoading('Đang cấp phát tài khoản mới...');
    google.script.run
      .withSuccessHandler(res => {
        hideLoading();
        showToast(res.message, res.success ? 'success' : 'error');
        if (res.success) {
          closeProvisionModal();
          loadAppData();
        }
      })
      .withFailureHandler(err => {
        hideLoading();
        showToast('Lỗi: ' + err.message, 'error');
      })
      .apiCapPhatTaiKhoanTuApp(currentUser.role, currentUser.fullName, payload);
  }

  function handleSyncAllAccounts() {
    askConfirm(
      'Đồng bộ Zero-Loss từ DANH_SACH sang TAI_KHOAN',
      'Hệ thống sẽ đọc trực tiếp danh sách nhân sự từ bảng DANH_SACH, đối chiếu với TAI_KHOAN để cấp phát tài khoản mới và đồng bộ quyền RBAC mà KHÔNG ghi đè mật khẩu (PIN) hay trạng thái hiện có. Tiếp tục?',
      () => {
        showLoading('Đang đối chiếu DANH_SACH & TAI_KHOAN (Zero-Loss Sync)...');
        google.script.run
          .withSuccessHandler(res => {
            hideLoading();
            showToast(res.message, res.success ? 'success' : 'error');
            if (res.success) loadAppData();
          })
          .withFailureHandler(err => {
            hideLoading();
            showToast('Lỗi: ' + err.message, 'error');
          })
          .apiCapPhatTaiKhoanTuApp(currentUser.role, currentUser.fullName, { mode: 'SYNC_ALL' });
      }
    );
  }

  // =========================================================================
  // 10. MODULE BÁO BẬN / ĐỔI CA THÔNG MINH (1-CLICK SWAP RESOLUTION)
  // =========================================================================
  function populateMyQuickShiftsForPhanHoi() {
    const box = document.getElementById('quickSelectMyShiftBox');
    const sel = document.getElementById('phQuickSelectShift');
    if (!currentUser || !box || !sel) return;

    const myNorm = normalizeText(currentUser.fullName);
    const myShifts = (appData.lich || []).filter(item => normalizeText(item.nguoi) === myNorm);

    if (myShifts.length === 0) {
      box.classList.add('hidden');
      return;
    }

    box.classList.remove('hidden');
    sel.innerHTML = `<option value="">-- Chọn nhanh ca trực của bạn (${myShifts.length} ca) --</option>`;
    myShifts.forEach(s => {
      const opt = document.createElement('option');
      opt.value = `${s.ngayStr}|${s.congViec}`;
      opt.textContent = `${s.thu} (${s.ngayStr}) - ${s.congViec} [${s.tuan}]`;
      sel.appendChild(opt);
    });
  }

  function onSelectQuickMyShift() {
    const val = document.getElementById('phQuickSelectShift').value;
    if (!val) return;
    const parts = val.split('|');
    document.getElementById('phNgay').value = parts[0] || '';
    document.getElementById('phCongViec').value = parts[1] || '';
  }

  function handleGuiPhanHoi() {
    if (currentUser && !currentUser.canSubmitShiftSwap) {
      showToast('Tài khoản Huynh trưởng Đồng hành không sử dụng chức năng báo bận ca trực Dự trưởng.', 'warning');
      return;
    }

    const payload = {
      name: document.getElementById('phName').value.trim(),
      nganh: document.getElementById('phNganh').value,
      ngayTruc: document.getElementById('phNgay').value.trim(),
      congViec: document.getElementById('phCongViec').value.trim(),
      noiDung: document.getElementById('phNoiDung').value.trim(),
      autoAddBusyDate: document.getElementById('phAutoBusy').checked
    };
    if (!payload.name || !payload.noiDung) {
      showToast('Vui lòng nhập Họ tên và Lý do bận / đổi ca!', 'warning');
      return;
    }
    showLoading('Đang gửi báo bận...');
    google.script.run
      .withSuccessHandler(res => {
        hideLoading();
        showToast(res.message, res.success ? 'success' : 'error');
        if (res.success) {
          document.getElementById('phNoiDung').value = '';
          loadAppData();
        }
      })
      .withFailureHandler(err => {
        hideLoading();
        showToast('Lỗi: ' + err.message, 'error');
      })
      .apiGuiPhanHoi(payload);
  }

  function renderPhanHoi() {
    const container = document.getElementById('phanHoiContainer');
    const statusFilter = document.getElementById('filterPhStatus') ? document.getElementById('filterPhStatus').value : 'ALL';

    const list = (appData.phanHoi || []).filter(item => {
      if (statusFilter !== 'ALL' && item.trangThai !== statusFilter) return false;
      return true;
    });

    if (list.length === 0) {
      container.innerHTML = `<div class="bg-white/60 backdrop-blur-2xl p-5 rounded-3xl border border-white/50 text-center text-xs text-slate-400">Chưa có phản hồi / báo bận nào.</div>`;
      return;
    }

    container.innerHTML = list.map(item => {
      const canResolve = currentUser && (
        currentUser.isAdmin ||
        currentUser.isSupervisor ||
        (currentUser.role === 'TRUONG_NGANH' && currentUser.nganh === item.nganh)
      );

      const matchingShift = (appData.lich || []).find(s =>
        normalizeText(s.nguoi) === normalizeText(item.name) &&
        (s.ngayStr === item.ngayTruc || s.ngayStr.startsWith(item.ngayTruc))
      );

      const isDone = item.trangThai === 'Đã xử lý';

      return `
        <div class="bg-white/65 backdrop-blur-2xl p-4 rounded-3xl border border-white/50 space-y-2 shadow-[0_8px_24px_rgb(0,0,0,0.03)]">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-1.5">
              <span class="text-xs font-bold text-slate-800">${escapeHtml(item.name)}</span>
              <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/75 border border-white/60 text-slate-600">Ngành ${escapeHtml(item.nganh)}</span>
            </div>
            <span class="text-[10px] font-bold px-2.5 py-0.5 rounded-full ${isDone ? 'bg-emerald-500/15 text-emerald-700' : 'bg-amber-500/15 text-amber-700'}">
              ${escapeHtml(item.trangThai)}
            </span>
          </div>
          <p class="text-[11px] text-slate-500">
            <i class="fa-regular fa-clock mr-1"></i>Ngày cần báo: <b>${escapeHtml(item.ngayTruc || 'Không rõ')}</b> ${item.congViec ? '• ' + escapeHtml(item.congViec) : ''}
          </p>
          <p class="text-xs text-slate-700 bg-white/60 p-3 rounded-2xl border border-white/60">${escapeHtml(item.noiDung)}</p>
          ${canResolve && !isDone ? `
            <div class="flex items-center justify-end gap-2 pt-1">
              ${matchingShift ? `
                <button onclick="openEditModal(${matchingShift.rowIndex}, '${escapeHtml(matchingShift.nganh)}', '${escapeHtml(matchingShift.ngayStr)}', '${escapeHtml(matchingShift.congViec)}', '${escapeHtml(matchingShift.nguoi)}', ${item.rowIndex})" class="px-3 py-1.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-[11px] font-semibold shadow-2xs transition">
                  <i class="fa-solid fa-user-check mr-1"></i>Đổi người thay ngay
                </button>
              ` : ''}
              <button onclick="markPhanHoiDone(${item.rowIndex})" class="px-3 py-1.5 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 text-[11px] font-semibold transition">
                ✓ Đánh dấu Đã xử lý
              </button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  function markPhanHoiDone(rowIndex) {
    showLoading('Đang cập nhật & gửi thông báo...');
    google.script.run
      .withSuccessHandler(res => {
        hideLoading();
        showToast(res.message, res.success ? 'success' : 'error');
        if (res.success) loadAppData();
      })
      .withFailureHandler(err => {
        hideLoading();
        showToast('Lỗi: ' + err.message, 'error');
      })
      .apiCapNhatTrangThaiPhanHoi(currentUser.role, currentUser.nganh, rowIndex, 'Đã xử lý', currentUser.fullName);
  }

  // =========================================================================
  // 11. ĐỔI MẬT KHẨU (PIN) CÁ NHÂN (CREDENTIAL SELF-MANAGEMENT)
  // =========================================================================
  function openPinModal() {
    document.getElementById('pinModalUser').textContent = currentUser.fullName;
    document.getElementById('oldPinInput').value = '';
    document.getElementById('newPinInput').value = '';
    document.getElementById('confirmPinInput').value = '';
    document.getElementById('pinModal').classList.remove('hidden');
  }

  function closePinModal() {
    document.getElementById('pinModal').classList.add('hidden');
  }

  function handleChangePin() {
    const oldPin = document.getElementById('oldPinInput').value.trim();
    const newPin = document.getElementById('newPinInput').value.trim();
    const confirmPin = document.getElementById('confirmPinInput').value.trim();

    if (!oldPin || !newPin) {
      showToast('Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới!', 'warning');
      return;
    }
    if (newPin.length < 4) {
      showToast('Mật khẩu (PIN) mới phải có ít nhất 4 ký tự!', 'warning');
      return;
    }
    if (newPin !== confirmPin) {
      showToast('Mật khẩu mới nhập lại không khớp!', 'warning');
      return;
    }

    showLoading('Đang cập nhật mật khẩu...');
    google.script.run
      .withSuccessHandler(res => {
        hideLoading();
        showToast(res.message, res.success ? 'success' : 'error');
        if (res.success) closePinModal();
      })
      .withFailureHandler(err => {
        hideLoading();
        showToast('Lỗi: ' + err.message, 'error');
      })
      .apiDoiMatKhau(currentUser.username, currentUser.fullName, oldPin, newPin);
  }