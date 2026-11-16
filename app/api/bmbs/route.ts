import { NextResponse } from 'next/server';
import {
  getAllSheetsData,
  appendSheetRow,
  updateSheetRange,
  deleteSheetRow,
} from '../../../src/lib/googleSheets';

function normalizeCompare(str: unknown): string {
  return String(str ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ');
}

function nowVN(): string {
  return new Date().toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour12: false,
  });
}

function todayVN(): string {
  return new Date().toLocaleDateString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
  });
}

const CHI_DOAN_MAP: Record<string, string> = {
  Chiên: 'Chiên 1',
  Ấu: 'Ấu 1',
  Thiếu: 'Thiếu 1',
  Nghĩa: 'Nghĩa 1',
};

export async function GET() {
  try {
    const data = await getAllSheetsData();
    return NextResponse.json({
      success: true,
      soNhanSu: (data.DANH_SACH?.length || 1) - 1,
      soCaTruc: (data.LICH?.length || 1) - 1,
      sheetsLoaded: Object.keys(data),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const fn: string = body.functionName || body.action || '';
    const args: any[] = Array.isArray(body.args) ? body.args : body.payload ? [body.payload] : [];
    const allData = await getAllSheetsData();

    switch (fn) {
      // 1. ĐĂNG NHẬP (apiLogin(username, password))
      case 'apiLogin': {
        const [username, password] = args;
        const uClean = String(username || '').trim().toLowerCase();
        const uNorm = normalizeCompare(username);
        const pClean = String(password || '').trim();

        const tkRows = (allData.TAI_KHOAN || []).slice(1);
        const dsRows = (allData.DANH_SACH || []).slice(1);

        const matchedMember = dsRows.find((r) => {
          const code = String(r[13] || '').trim().toLowerCase();
          const email = String(r[3] || '').trim().toLowerCase();
          const name = normalizeCompare(r[0]);
          return (code && code === uClean) || (email && email === uClean) || name === uNorm;
        });

        for (const r of tkRows) {
          const tkUser = String(r[0] || '').trim().toLowerCase();
          const tkPass = String(r[1] || '').trim();
          const tkName = String(r[2] || '').trim();
          const active = String(r[5]).toUpperCase() === 'TRUE';

          if (active && (tkUser === uClean || normalizeCompare(tkName) === uNorm) && tkPass === pClean) {
            const role = String(r[3] || 'MEMBER').trim();
            const nganh = String(r[4] || 'Tất cả').trim();
            const isAdmin = role === 'ADMIN';
            const roleTitle = matchedMember ? String(matchedMember[7] || r[6] || '') : String(r[6] || '');
            const isTreasurer = role === 'THU_QUY' || normalizeCompare(roleTitle).includes('thu quy');

            return NextResponse.json({
              success: true,
              user: {
                username: String(r[0] || '').trim(),
                fullName: tkName,
                baptismalName: matchedMember ? String(matchedMember[9] || '') : '',
                capBac: matchedMember ? String(matchedMember[10] || 'Dự trưởng') : isAdmin ? 'Huynh trưởng' : 'Dự trưởng',
                roleTitle,
                status: matchedMember ? String(matchedMember[11] || 'Tốt') : 'Tốt',
                avatarUrl: matchedMember ? String(matchedMember[14] || '') : '',
                phone: matchedMember ? String(matchedMember[15] || '') : '',
                email: matchedMember ? String(matchedMember[3] || '') : '',
                role,
                nganh,
                note: String(r[6] || '').trim(),
                isAdmin,
                isTreasurer,
                canManageDiscipline: isAdmin || role === 'KY_LUAT',
                canManageKHSH: isAdmin || role === 'TRUONG_NGANH',
                canManageSchedule: isAdmin || role === 'TRUONG_NGANH',
                canManageProfiles: isAdmin || role === 'TRUONG_NGANH',
                canManageTreasury: isAdmin || isTreasurer || role === 'TRUONG_NGANH',
                canManageAllTreasuryBranches: isAdmin || isTreasurer || nganh === 'Tất cả',
                canSubmitShiftSwap: role !== 'HT_DONG_HANH',
              },
            });
          }
        }

        if (matchedMember) {
          const pin = String(matchedMember[8] || '0000').trim() || '0000';
          if (pin === pClean) {
            const roleTitle = String(matchedMember[7] || 'Dự trưởng').trim();
            const capBac = String(matchedMember[10] || 'Dự trưởng').trim();
            const nganh = String(matchedMember[1] || '').trim();
            const isTreasurer = normalizeCompare(roleTitle).includes('thu quy');

            return NextResponse.json({
              success: true,
              user: {
                username: String(matchedMember[13] || matchedMember[3] || matchedMember[0]).trim(),
                fullName: String(matchedMember[0] || '').trim(),
                baptismalName: String(matchedMember[9] || '').trim(),
                capBac,
                roleTitle,
                status: String(matchedMember[11] || 'Tốt').trim(),
                avatarUrl: String(matchedMember[14] || '').trim(),
                phone: String(matchedMember[15] || '').trim(),
                email: String(matchedMember[3] || '').trim(),
                role: isTreasurer ? 'THU_QUY' : 'MEMBER',
                nganh,
                note: roleTitle,
                isAdmin: false,
                isTreasurer,
                canManageTreasury: isTreasurer,
                canManageAllTreasuryBranches: isTreasurer,
                canSubmitShiftSwap: capBac !== 'Huynh trưởng Đồng hành',
              },
            });
          }
        }

        return NextResponse.json({
          success: false,
          message: 'Sai Tài khoản / Họ tên hoặc Mật khẩu!',
        });
      }

      // 2. TẢI TOÀN BỘ DỮ LIỆU APP (apiGetAppData())
      case 'apiGetAppData': {
        const danhSach = (allData.DANH_SACH || []).slice(1).map((r, idx) => ({
          rowIndex: idx + 2,
          name: String(r[0] || '').trim(),
          nganh: String(r[1] || '').trim(),
          active: String(r[2]).toUpperCase() === 'TRUE',
          email: String(r[3] || '').trim(),
          busyFixed: String(r[4] || '').trim(),
          busyDates: String(r[5] || '').trim(),
          canWeekday: String(r[6]).toUpperCase() !== 'FALSE',
          roleTitle: String(r[7] || 'Dự trưởng').trim(),
          baptismalName: String(r[9] || '').trim(),
          capBac: String(r[10] || 'Dự trưởng').trim(),
          status: String(r[11] || 'Tốt').trim(),
          promotionNotes: String(r[12] || '').trim(),
          username: String(r[13] || '').trim(),
          avatarUrl: String(r[14] || '').trim(),
          phone: String(r[15] || '').trim(),
          diligenceScore: Number(r[16] ?? 90),
          totalDuesPaid: Number(r[17] ?? 0),
        }));

        const lich = (allData.LICH || []).slice(1).map((r, idx) => ({
          rowIndex: idx + 2,
          tuan: String(r[0] || '').trim(),
          nganh: String(r[1] || '').trim(),
          ngayStr: String(r[2] || '').trim(),
          thu: String(r[3] || '').trim(),
          congViec: String(r[4] || '').trim(),
          suat: Number(r[5] || 1),
          nguoi: String(r[6] || '').trim(),
        }));

        const logTruc = (allData.LOG_TRUC || []).slice(1).map((r) => ({
          id: String(r[0] || ''),
          maLog: String(r[0] || ''),
          committedAt: String(r[1] || ''),
          thangNam: String(r[2] || ''),
          tuan: String(r[3] || ''),
          nganh: String(r[4] || ''),
          ngayStr: String(r[5] || ''),
          ngay: String(r[5] || ''),
          thu: String(r[6] || ''),
          congViec: String(r[7] || ''),
          nguoi: String(r[8] || '').trim(),
        })).reverse();

        const thongKe = (allData.THONG_KE || []).slice(1).map((r) => ({
          name: String(r[0] || '').trim(),
          nganh: String(r[1] || '').trim(),
          logCount: Number(r[2] || 0),
          currentCount: Number(r[3] || 0),
          total: Number(r[4] || 0),
          status: String(r[5] || ''),
          diligenceScore: Number(r[6] ?? 90),
          leaderStatus: String(r[7] || 'Tốt'),
          promotionEligible: String(r[8] || ''),
          promotionNotes: String(r[9] || ''),
          totalDuesPaid: Number(r[10] || 0),
        }));

        const phanHoi = (allData.PHAN_HOI || []).slice(1).map((r, idx) => ({
          rowIndex: idx + 2,
          id: String(r[0] || ''),
          time: String(r[1] || ''),
          name: String(r[2] || '').trim(),
          nganh: String(r[3] || '').trim(),
          ngayTruc: String(r[4] || '').trim(),
          congViec: String(r[5] || '').trim(),
          noiDung: String(r[6] || '').trim(),
          trangThai: String(r[7] || 'Chờ xử lý').trim(),
        })).reverse();

        const kyLuat = (allData.KY_LUAT || []).slice(1).map((r, idx) => ({
          rowIndex: idx + 2,
          id: String(r[0] || ''),
          createdAt: String(r[1] || ''),
          ngay: String(r[2] || '').trim(),
          name: String(r[3] || '').trim(),
          nganh: String(r[4] || '').trim(),
          loai: String(r[5] || '').trim(),
          lyDo: String(r[6] || '').trim(),
          nguoiGhi: String(r[7] || '').trim(),
        })).reverse();

        const khsh = (allData.KH_SINH_HOAT || []).slice(1).map((r, idx) => ({
          rowIndex: idx + 2,
          id: String(r[0] || ''),
          tuan: String(r[1] || '').trim(),
          ngayCN: String(r[2] || '').trim(),
          chiDoan: String(r[3] || '').trim(),
          nganh: String(r[4] || '').trim(),
          noiDung: String(r[5] || ''),
          keHoachChiTiet: String(r[6] || ''),
          phanCongNhanSu: String(r[7] || ''),
          vatDung: String(r[8] || ''),
          nguoiLap: String(r[9] || ''),
          updatedAt: String(r[10] || ''),
          trangThai: String(r[11] || 'Đã gửi'),
        })).reverse();

        const quanLyQuy = (allData.QUAN_LY_QUY || []).slice(1).map((r, idx) => ({
          rowIndex: idx + 2,
          transactionId: String(r[0] || '').trim(),
          timestamp: String(r[1] || '').trim(),
          billingCycle: String(r[2] || '').trim(),
          memberName: String(r[3] || '').trim(),
          branch: String(r[4] || '').trim(),
          amountPaid: Number(r[5] || 0),
          paymentStatus: String(r[6] || 'PAID').trim().toUpperCase(),
          paymentMethod: String(r[7] || 'Cash').trim(),
          recordedBy: String(r[8] || '').trim(),
        })).reverse();

        const startNganhDefault = String(allData.CAU_HINH?.[1]?.[6] || 'Chiên').trim() || 'Chiên';

        return NextResponse.json({
          dbVersion: '2.3.0',
          duesWeeklyRate: 5000,
          danhSach,
          lich,
          logTruc,
          khsh,
          thongKe,
          phanHoi,
          kyLuat,
          quanLyQuy,
          startNganhDefault,
        });
      }

      // 3. THÔNG BÁO IN-APP (apiGetThongBao & apiMarkThongBaoRead)
      case 'apiGetThongBao': {
        const [identifier] = args;
        const target = normalizeCompare(identifier);
        const rows = (allData.THONG_BAO || []).slice(1);
        const notifications = [];
        let unreadCount = 0;

        for (let i = rows.length - 1; i >= 0; i--) {
          const r = rows[i];
          const rec = normalizeCompare(r[2]);
          if (!target || rec === target || rec === 'all' || rec === 'tat ca') {
            const isUnread = normalizeCompare(r[5]) !== 'read';
            if (isUnread) unreadCount++;
            notifications.push({
              rowIndex: i + 2,
              notificationId: String(r[0] || ''),
              timestamp: String(r[1] || ''),
              recipient: String(r[2] || ''),
              title: String(r[3] || ''),
              content: String(r[4] || ''),
              status: isUnread ? 'Unread' : 'Read',
            });
          }
        }
        return NextResponse.json({ success: true, notifications: notifications.slice(0, 60), unreadCount });
      }

      case 'apiMarkThongBaoRead': {
        const [notificationId, usernameOptional] = args;
        const rows = (allData.THONG_BAO || []).slice(1);
        let updatedCount = 0;

        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          const isMatch =
            notificationId === 'ALL'
              ? normalizeCompare(r[2]) === normalizeCompare(usernameOptional) && normalizeCompare(r[5]) !== 'read'
              : String(r[0] || '').trim() === String(notificationId || '').trim();

          if (isMatch) {
            await updateSheetRange(`THONG_BAO!F${i + 2}`, [['Read']]);
            updatedCount++;
            if (notificationId !== 'ALL') break;
          }
        }
        return NextResponse.json({
          success: true,
          updatedCount,
          message: `Đã đánh dấu đã đọc ${updatedCount} thông báo!`,
        });
      }

      // 4. ĐỔI NGƯỜI TRỰC (apiCapNhatNguoiTruc)
      case 'apiCapNhatNguoiTruc': {
        const [, , rowIndex, tenNguoiMoi, phanHoiRowIndex, callerName] = args;
        await updateSheetRange(`LICH!G${rowIndex}`, [[tenNguoiMoi]]);
        if (phanHoiRowIndex) {
          await updateSheetRange(`PHAN_HOI!H${phanHoiRowIndex}`, [['Đã xử lý']]);
        }
        await appendSheetRow('THONG_BAO', [
          `TB-${Date.now()}`,
          nowVN(),
          tenNguoiMoi,
          '[BMBS - Phân công trực] Cập nhật ca trực mới',
          `Bạn vừa được ${callerName || 'Ban Điều Hành'} phân công đảm nhận ca trực thay thế.`,
          'Unread',
        ]);
        return NextResponse.json({ success: true, message: `Đã cập nhật người trực sang [${tenNguoiMoi}]!` });
      }

      // 5. GỬI & DUYỆT PHẢN HỒI / BÁO BẬN
      case 'apiGuiPhanHoi': {
        const [payload] = args;
        await appendSheetRow('PHAN_HOI', [
          `PH-${Date.now()}`,
          nowVN(),
          payload.name || '',
          payload.nganh || '',
          payload.ngayTruc || '',
          payload.congViec || '',
          payload.noiDung || '',
          'Chờ xử lý',
        ]);
        return NextResponse.json({ success: true, message: 'Đã gửi báo bận / xin đổi ca thành công!' });
      }

      case 'apiCapNhatTrangThaiPhanHoi': {
        const [, , rowIndex, trangThaiMoi] = args;
        await updateSheetRange(`PHAN_HOI!H${rowIndex}`, [[trangThaiMoi]]);
        return NextResponse.json({ success: true, message: `Đã cập nhật trạng thái thành [${trangThaiMoi}]!` });
      }

      // 6. KỶ LUẬT & CHUYÊN CẦN
      case 'apiThemKyLuat': {
        const [, fullName, payload] = args;
        await appendSheetRow('KY_LUAT', [
          `KL-${Date.now()}`,
          nowVN(),
          payload.ngay || todayVN(),
          payload.name || '',
          payload.nganh || '',
          payload.loai || 'Đi trễ',
          payload.lyDo || '',
          fullName || '',
        ]);
        await appendSheetRow('THONG_BAO', [
          `TB-${Date.now() + 1}`,
          nowVN(),
          payload.name || '',
          `[BMBS - Chuyên cần] Ghi nhận "${payload.loai}"`,
          `Ghi nhận ${payload.loai} ngày ${payload.ngay || todayVN()} bởi ${fullName || 'Phụ trách'}.`,
          'Unread',
        ]);
        return NextResponse.json({ success: true, message: `Đã ghi nhận [${payload.loai}] cho ${payload.name}!` });
      }

      case 'apiXoaKyLuat': {
        const [, , rowIndex] = args;
        await deleteSheetRow('KY_LUAT', Number(rowIndex));
        return NextResponse.json({ success: true, message: 'Đã xóa bản ghi kỷ luật!' });
      }

      // 7. KẾ HOẠCH SINH HOẠT (KHSH)
      case 'apiLuuKHSH': {
        const [role, , fullName, payload] = args;
        const chiDoan = CHI_DOAN_MAP[payload.nganh] || `${payload.nganh} 1`;
        const tuanClean = String(payload.tuan || 'TUẦN 1').trim().toUpperCase();

        if (payload.rowIndex) {
          await updateSheetRange(`KH_SINH_HOAT!B${payload.rowIndex}:K${payload.rowIndex}`, [[
            tuanClean,
            payload.ngayCN || '',
            chiDoan,
            payload.nganh || '',
            payload.noiDung || '',
            payload.keHoachChiTiet || '',
            payload.phanCongNhanSu || '',
            payload.vatDung || 'Không có',
            fullName || '',
            nowVN(),
          ]]);
          return NextResponse.json({ success: true, message: `Đã cập nhật KHSH [${tuanClean} - ${chiDoan}]!` });
        }

        await appendSheetRow('KH_SINH_HOAT', [
          `KHSH-${Date.now()}`,
          tuanClean,
          payload.ngayCN || '',
          chiDoan,
          payload.nganh || '',
          payload.noiDung || '',
          payload.keHoachChiTiet || '',
          payload.phanCongNhanSu || '',
          payload.vatDung || 'Không có',
          fullName || '',
          nowVN(),
          role === 'ADMIN' ? 'Đã duyệt' : 'Đã báo cáo',
        ]);
        return NextResponse.json({ success: true, message: `Đã gửi báo cáo KHSH [${tuanClean} - ${chiDoan}]!` });
      }

      case 'apiDuyetHoacXoaKHSH': {
        const [, , rowIndex, action] = args;
        if (action === 'APPROVE') {
          await updateSheetRange(`KH_SINH_HOAT!L${rowIndex}`, [['Đã duyệt']]);
          return NextResponse.json({ success: true, message: 'Đã duyệt Kế hoạch sinh hoạt!' });
        }
        if (action === 'DELETE') {
          await deleteSheetRow('KH_SINH_HOAT', Number(rowIndex));
          return NextResponse.json({ success: true, message: 'Đã xóa bản ghi KHSH!' });
        }
        return NextResponse.json({ success: false, message: 'Thao tác không hợp lệ.' });
      }

      // 8. QUẢN LÝ THU QUỸ 5.000Đ/TUẦN
      case 'apiGhiNhanThuQuy': {
        const [, , callerName, , payload] = args;
        const rows = (allData.QUAN_LY_QUY || []).slice(1);
        const amt = payload.paymentStatus === 'PAID' ? Number(payload.amountPaid ?? 5000) : 0;

        for (let i = 0; i < rows.length; i++) {
          if (
            normalizeCompare(rows[i][2]) === normalizeCompare(payload.billingCycle) &&
            normalizeCompare(rows[i][3]) === normalizeCompare(payload.memberName)
          ) {
            await updateSheetRange(`QUAN_LY_QUY!B${i + 2}:I${i + 2}`, [[
              nowVN(),
              payload.billingCycle,
              payload.memberName,
              payload.branch,
              amt,
              payload.paymentStatus,
              payload.paymentMethod || 'Cash',
              callerName,
            ]]);
            return NextResponse.json({ success: true, message: `Đã cập nhật quỹ cho ${payload.memberName}!` });
          }
        }

        await appendSheetRow('QUAN_LY_QUY', [
          `Q-${Date.now()}`,
          nowVN(),
          payload.billingCycle,
          payload.memberName,
          payload.branch,
          amt,
          payload.paymentStatus,
          payload.paymentMethod || 'Cash',
          callerName,
        ]);
        return NextResponse.json({ success: true, message: `Đã ghi nhận thu quỹ cho ${payload.memberName}!` });
      }

      case 'apiChotThuQuyHangLoat': {
        const [, , callerName, , payload] = args;
        const items: any[] = payload.items || [];
        for (let idx = 0; idx < items.length; idx++) {
          const item = items[idx];
          const amt = item.paymentStatus === 'PAID' ? Number(item.amountPaid ?? 5000) : 0;
          await appendSheetRow('QUAN_LY_QUY', [
            `Q-${Date.now()}-${idx + 1}`,
            nowVN(),
            payload.billingCycle,
            item.memberName,
            item.branch || payload.branch,
            amt,
            item.paymentStatus,
            item.paymentMethod || 'Cash',
            callerName,
          ]);
        }
        return NextResponse.json({
          success: true,
          message: `Đã chốt sổ quỹ [${payload.billingCycle}] cho ${items.length} thành viên!`,
        });
      }

      case 'apiXoaGiaoDichQuy': {
        const [, , , , rowIndex] = args;
        await deleteSheetRow('QUAN_LY_QUY', Number(rowIndex));
        return NextResponse.json({ success: true, message: 'Đã xóa giao dịch quỹ!' });
      }

      // 9. HỒ SƠ CÁ NHÂN, LỊCH BẬN & ĐỔI MẬT KHẨU (PIN)
      case 'apiCapNhatLichBanCaNhan': {
        const [, , callerName, payload] = args;
        const targetName = normalizeCompare(payload.name || callerName);
        const rows = (allData.DANH_SACH || []).slice(1);
        for (let i = 0; i < rows.length; i++) {
          if (normalizeCompare(rows[i][0]) === targetName) {
            await updateSheetRange(`DANH_SACH!E${i + 2}:G${i + 2}`, [[
              String(payload.busyFixed || '').toUpperCase(),
              String(payload.busyDates || ''),
              payload.canWeekday === false ? false : true,
            ]]);
            return NextResponse.json({ success: true, message: 'Đã lưu cấu hình lịch bận thành công!' });
          }
        }
        return NextResponse.json({ success: false, message: 'Không tìm thấy hồ sơ trong DANH_SACH.' });
      }

      case 'apiCapNhatHoSoCaNhanSelfService': {
        const [callerName, payload] = args;
        const targetName = normalizeCompare(payload.name || callerName);
        const rows = (allData.DANH_SACH || []).slice(1);
        for (let i = 0; i < rows.length; i++) {
          if (normalizeCompare(rows[i][0]) === targetName) {
            const rIdx = i + 2;
            if (payload.email !== undefined) await updateSheetRange(`DANH_SACH!D${rIdx}`, [[payload.email]]);
            if (payload.baptismalName !== undefined) await updateSheetRange(`DANH_SACH!J${rIdx}`, [[payload.baptismalName]]);
            if (payload.avatarUrl !== undefined) await updateSheetRange(`DANH_SACH!O${rIdx}`, [[payload.avatarUrl]]);
            if (payload.phone !== undefined) await updateSheetRange(`DANH_SACH!P${rIdx}`, [[payload.phone]]);
            return NextResponse.json({ success: true, message: 'Đã cập nhật thông tin Trang cá nhân!' });
          }
        }
        return NextResponse.json({ success: false, message: 'Không tìm thấy hồ sơ cá nhân.' });
      }

      case 'apiDoiMatKhau': {
        const [username, fullName, oldPin, newPin] = args;
        const uClean = String(username || '').trim().toLowerCase();
        const fNorm = normalizeCompare(fullName);
        const dsRows = (allData.DANH_SACH || []).slice(1);
        let updated = false;

        for (let i = 0; i < dsRows.length; i++) {
          const r = dsRows[i];
          if (normalizeCompare(r[0]) === fNorm || String(r[13] || '').toLowerCase() === uClean) {
            const curPin = String(r[8] || '0000').trim() || '0000';
            if (curPin !== String(oldPin).trim()) {
              return NextResponse.json({ success: false, message: 'Mật khẩu hiện tại không đúng!' });
            }
            await updateSheetRange(`DANH_SACH!I${i + 2}`, [[String(newPin).trim()]]);
            updated = true;
          }
        }
        return NextResponse.json({
          success: updated,
          message: updated ? 'Đã đổi mật khẩu thành công!' : 'Không tìm thấy tài khoản cá nhân!',
        });
      }

      default:
        return NextResponse.json(
          { success: false, message: `Chức năng [${fn}] đang được cập nhật trên phiên bản Vercel.` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}