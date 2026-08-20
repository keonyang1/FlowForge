// js/app.js

let currentProjects = [];
let currentTasks = [];

document.addEventListener("DOMContentLoaded", () => {

    initTheme();
    initDragAndDrop();
    initAuth();
    initProject();
    initTask();
    initMobileMenu();

    document.getElementById("global-search").addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase();
        document.querySelectorAll(".search-target").forEach(card => {
            const text = Array.from(card.querySelectorAll(".search-text")).map(el => el.textContent.toLowerCase()).join(" ");
            card.style.display = text.includes(query) ? "" : "none";
        });
    });
});

function initMobileMenu() {
    const mobileMenuBtn = document.getElementById("btn-mobile-menu");
    const sidebar = document.querySelector(".sidebar");
    const sidebarOverlay = document.getElementById("sidebar-overlay");

    if (!mobileMenuBtn || !sidebar || !sidebarOverlay) return;

    mobileMenuBtn.addEventListener("click", () => {
        sidebar.classList.toggle("mobile-open");
        sidebarOverlay.classList.toggle("show");
    });

    sidebarOverlay.addEventListener("click", () => {
        sidebar.classList.remove("mobile-open");
        sidebarOverlay.classList.remove("show");
    });

    document.querySelectorAll(".sidebar .nav-item").forEach(item => {
        item.addEventListener("click", () => {
            sidebar.classList.remove("mobile-open");
            sidebarOverlay.classList.remove("show");
        });
    });
}

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
    
    sessionStorage.removeItem("flowforge_current_page");
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

async function loadAppData() {
    const user = AppAPI.getUser();
    if (!user) return;
    UI.setGlobalLoading(true);
    try {
        const [pRes, tRes] = await Promise.all([
            AppAPI.getProjects(user.user_id),
            AppAPI.getTasks(user.user_id)
        ]);

        if (!pRes.success) {
            throw new Error(pRes.message || "프로젝트 데이터를 불러오지 못했습니다.");
        }

        if (!tRes.success) {
            throw new Error(tRes.message || "작업 데이터를 불러오지 못했습니다.");
        }
        currentProjects = pRes.projects;
        currentTasks = tRes.tasks;

        renderProjects();
        renderTasks();
        renderDashboard();
        renderAnalytics();
    } catch (e) {UI.showToast(e.message, "error"); }
    finally {UI.setGlobalLoading(false); }
}