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
    return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function validateUserId(userId) {
    userId = userId.trim();
    return AUTH.USER_ID_REGEX.test(userId);
}

function validatePassword(password) {
    return AUTH.PASSWORD_REGEX.test(password);
}