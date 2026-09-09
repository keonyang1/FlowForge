// js/utils.js

// 날짜 파싱 유틸리티 함수
function getFormatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
}

function formatFriendlyDate(dateStr) {
    if (!dateStr) return '날짜 없음';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '날짜 없음';
    return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function getDueDateDiff(dateStr) {
    if (!dateStr) return null;
    const parts = String(dateStr).trim().split(/[-T :]/);
    if (parts.length >= 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
            const target = new Date(y, m, d);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return Math.round((target - today) / 86400000);
        }
    }
    const dt = new Date(dateStr);
    if (isNaN(dt.getTime())) return null;
    const target = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((target - today) / 86400000);
}

function validateUserId(userId) {
    userId = userId.trim();
    return AUTH.USER_ID_REGEX.test(userId);
}

function validatePassword(password) {
    return AUTH.PASSWORD_REGEX.test(password);
}