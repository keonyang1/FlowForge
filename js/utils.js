// js/utils.js

// 날짜 문자열 정규화 (YYYY-MM-DD)
// ISO UTC 문자열(T/Z 포함)과 순수 날짜 문자열(YYYY-MM-DD)을 모두 로컬 기준 날짜로 안전하게 해석
function normalizeDateStr(dateStr) {
    if (!dateStr) return '';
    if (dateStr instanceof Date) {
        if (isNaN(dateStr.getTime())) return '';
        const yy = dateStr.getFullYear();
        const mm = String(dateStr.getMonth() + 1).padStart(2, '0');
        const dd = String(dateStr.getDate()).padStart(2, '0');
        return `${yy}-${mm}-${dd}`;
    }
    const str = String(dateStr).trim();
    // 1. ISO 포맷 (T 또는 Z 포함: 예: 2026-09-14T15:00:00.000Z)
    // GAS가 시트 날짜를 직렬화할 때 생성한 UTC 타임스탬프이므로 로컬 Date로 변환하여 로컬 날짜 추출
    if (str.includes('T') || str.includes('Z')) {
        const dt = new Date(str);
        if (!isNaN(dt.getTime())) {
            const yy = dt.getFullYear();
            const mm = String(dt.getMonth() + 1).padStart(2, '0');
            const dd = String(dt.getDate()).padStart(2, '0');
            return `${yy}-${mm}-${dd}`;
        }
    }
    // 2. 순수 날짜 문자열 (예: 2026-09-15, 2026.09.15, 2026/09/15)
    // new Date('YYYY-MM-DD')의 UTC 자정 파싱에 의한 시차 오차를 방지하기 위해 정규식으로 직접 추출
    const match = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (match) {
        const yy = match[1];
        const mm = String(match[2]).padStart(2, '0');
        const dd = String(match[3]).padStart(2, '0');
        return `${yy}-${mm}-${dd}`;
    }
    // 3. 기타 날짜 포맷 폴백
    const dt = new Date(str);
    if (!isNaN(dt.getTime())) {
        const yy = dt.getFullYear();
        const mm = String(dt.getMonth() + 1).padStart(2, '0');
        const dd = String(dt.getDate()).padStart(2, '0');
        return `${yy}-${mm}-${dd}`;
    }
    return '';
}

// 날짜 포맷 유틸리티 함수 (YYYY-MM-DD)
function getFormatDate(dateStr) {
    return normalizeDateStr(dateStr);
}

function formatFriendlyDate(dateStr) {
    const norm = normalizeDateStr(dateStr);
    if (!norm) return '날짜 없음';
    const parts = norm.split('-');
    if (parts.length < 3) return '날짜 없음';
    const mm = parseInt(parts[1], 10);
    const dd = parseInt(parts[2], 10);
    return `${mm}월 ${dd}일`;
}

function getDueDateDiff(dateStr) {
    const norm = normalizeDateStr(dateStr);
    if (!norm) return null;
    const parts = norm.split('-');
    if (parts.length < 3) return null;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (isNaN(y) || isNaN(m) || isNaN(d)) return null;

    const target = new Date(y, m, d);
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

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}