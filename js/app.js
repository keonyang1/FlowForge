let currentProjects = [];
let currentTasks = [];

document.addEventListener("DOMContentLoaded", () => {

    initTheme();
    initDragAndDrop();
    initAuth();
    initProject();
    initTask();

    document.getElementById("global-search").addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase();
        document.querySelectorAll(".search-target").forEach(card => {
            const text = Array.from(card.querySelectorAll(".search-text")).map(el => el.textContent.toLowerCase()).join(" ");
            card.style.display = text.includes(query) ? "" : "none";
        });
    });
});

// 앱 초기화 유틸
function resetAppUI() {
    currentProjects = [];
    currentTasks = [];
    document.getElementById('stat-total').textContent = '0';
    document.getElementById('stat-active').textContent = '0';
    document.getElementById('stat-done').textContent = '0';
    document.getElementById('stat-tasks').textContent = '0';
    document.getElementById('dashboard-recent-tasks').innerHTML = '';
    document.getElementById('project-container').innerHTML = '';
    document.getElementById('col-todo').innerHTML = '';
    document.getElementById('col-inprogress').innerHTML = '';
    document.getElementById('col-done').innerHTML = '';
    document.getElementById('analytics-projects-content').innerHTML = '';
    document.getElementById('analytics-tasks-content').innerHTML = '';
            
    document.getElementById('header-nickname').textContent = '로딩중...';
    document.getElementById('header-avatar-initial').textContent = 'U';
            
    UI.switchPage('dashboard');
    document.getElementById('view-register').classList.remove('active');
    document.getElementById('view-login').classList.add('active');
            
    // 폼 리셋 및 비밀번호 아이콘 복구
    document.getElementById('form-login').reset();
    document.getElementById('form-register').reset();
    document.getElementById('form-profile').reset();
    document.querySelectorAll('.pw-input-wrapper input').forEach(input => { input.type = 'password'; });
    document.querySelectorAll('.pw-toggle-btn i').forEach(icon => { icon.className = 'fas fa-eye'; });
}