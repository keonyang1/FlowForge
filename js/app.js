// js/app.js

let currentProjects = [];
let currentTasks = [];
let currentChecklists = [];

document.addEventListener("DOMContentLoaded", () => {

    initTheme();
    initDragAndDrop();
    initAuth();
    initProject();
    initTask();
    if (typeof initCalendar === 'function') initCalendar();
    initMobileMenu();

    document.getElementById("global-search").addEventListener("input", (e) => {
        const activeSection = document.querySelector(".page-section.active");
        if (activeSection && activeSection.id === "tasks-page") {
            renderTasks();
        } else {
            const query = e.target.value.toLowerCase();
            document.querySelectorAll(".search-target").forEach(card => {
                const text = Array.from(card.querySelectorAll(".search-text")).map(el => el.textContent.toLowerCase()).join(" ");
                card.style.display = text.includes(query) ? "" : "none";
            });
        }
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
    currentChecklists = [];
    document.getElementById('stat-total').textContent = '0';
    document.getElementById('stat-active').textContent = '0';
    document.getElementById('stat-done').textContent = '0';
    document.getElementById('stat-tasks').textContent = '0';
    const setElemText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    const setElemHtml = (id, val) => { const el = document.getElementById(id); if (el) el.innerHTML = val; };
    setElemText('stat-tasks-total', '0');
    setElemText('stat-tasks-done', '0');
    setElemText('stat-tasks-pending', '0');
    setElemText('stat-avg-progress', '0%');
    const elAvgBar = document.getElementById('stat-avg-progress-bar');
    if (elAvgBar) elAvgBar.style.width = '0%';
    setElemText('stat-alert-total', '0');
    setElemText('stat-overdue-count', '0');
    setElemText('stat-urgent-count', '0');
    setElemText('badge-overdue-count', '0');
    setElemText('badge-urgent-count', '0');
    setElemHtml('dashboard-active-projects', '');
    setElemHtml('dashboard-overdue-tasks', '');
    setElemHtml('dashboard-urgent-tasks', '');
    setElemHtml('dashboard-recent-tasks', '');
    document.getElementById('project-container').innerHTML = '';
    document.getElementById('col-todo').innerHTML = '';
    document.getElementById('col-inprogress').innerHTML = '';
    document.getElementById('col-done').innerHTML = '';
    setElemHtml('analytics-tasks-content', '');
    setElemText('analytics-stat-projects', '0');
    setElemText('analytics-stat-avg-progress', '0%');
    setElemText('analytics-stat-tasks', '0');
    setElemText('analytics-stat-completion-rate', '0%');
    setElemText('analytics-stat-completion-sub', '0 / 0 완료');
    setElemText('analytics-stat-overdue', '0');
    setElemHtml('analytics-priority-content', '');
    setElemHtml('analytics-due-content', '');
    setElemHtml('analytics-summary-content', '');
    setElemHtml('analytics-project-tasks-content', '');
            
    document.getElementById('header-nickname').textContent = '로딩중...';
    document.getElementById('header-avatar-initial').textContent = 'U';
    
    if (typeof resetTaskFilters === 'function') resetTaskFilters();
    const projFilterSelect = document.getElementById('task-filter-project');
    if (projFilterSelect) projFilterSelect.innerHTML = '<option value="all">전체</option>';
    if (typeof currentProjectId !== 'undefined') currentProjectId = null;
    if (typeof currentDetailTaskId !== 'undefined') currentDetailTaskId = null;
    const detailModal = document.getElementById('task-detail-modal');
    if (detailModal) detailModal.classList.remove('show');
    const detailContainer = document.getElementById('project-detail-container');
    if (detailContainer) detailContainer.innerHTML = '';
    if (typeof resetCalendarUI === 'function') resetCalendarUI();
    if (typeof setMobileKanbanPage === 'function') setMobileKanbanPage(0);
    
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
        const [pRes, tRes, cRes] = await Promise.all([
            AppAPI.getProjects(user.user_id),
            AppAPI.getTasks(user.user_id),
            AppAPI.getChecklists(user.user_id)
        ]);

        if (!pRes.success) {
            throw new Error(pRes.message || "프로젝트 데이터를 불러오지 못했습니다.");
        }

        if (!tRes.success) {
            throw new Error(tRes.message || "작업 데이터를 불러오지 못했습니다.");
        }
        currentProjects = pRes.projects;
        currentTasks = tRes.tasks;
        const rawChecklists = (cRes && cRes.success && Array.isArray(cRes.checklists)) ? cRes.checklists : [];
        const seenChecklistIds = new Set();
        currentChecklists = [];
        for (let i = rawChecklists.length - 1; i >= 0; i--) {
            const item = rawChecklists[i];
            const id = String(item.id || '').trim();
            if (!id || seenChecklistIds.has(id)) continue;
            seenChecklistIds.add(id);
            currentChecklists.push(item);
        }
        currentChecklists.reverse();

        renderProjects();
        renderTasks();
        renderDashboard();
        renderAnalytics();
        if (typeof renderCalendar === 'function') {
            renderCalendar();
        }
        if (typeof currentProjectId !== 'undefined' && currentProjectId) {
            renderProjectDetail(currentProjectId);
        }
        if (typeof currentDetailTaskId !== 'undefined' && currentDetailTaskId) {
            const updatedTask = currentTasks.find(t => t.id === currentDetailTaskId);
            if (updatedTask && typeof renderTaskDetailContent === 'function') {
                renderTaskDetailContent(updatedTask);
            } else if (!updatedTask) {
                currentDetailTaskId = null;
                UI.closeModal('task-detail-modal');
            }
        }
    } catch (e) {UI.showToast(e.message, "error"); }
    finally {UI.setGlobalLoading(false); }
}

function getTaskChecklist(taskId) {
    const items = (currentChecklists || []).filter(item => item.task_id === taskId);
    const unique = [];
    const seen = new Set();
    for (const item of items) {
        const id = String(item.id || '').trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        unique.push(item);
    }
    return unique;
}

function getTaskChecklistStats(taskId) {
    const items = getTaskChecklist(taskId);
    const total = items.length;
    const completed = items.filter(item => Boolean(item.is_completed)).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, percent };
}

window.getTaskChecklist = getTaskChecklist;
window.getTaskChecklistStats = getTaskChecklistStats;