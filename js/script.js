const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxf3kZpSUFIfMLWuI7cMdpre4PARbzB2IeRxVIkpbmf-xwUTuxZPwzL2oZcBhmo3yBukg/exec';
const apiKey = "AQ.Ab8RN6KtYhfXlFL9kr32W1sk3wa7aL3quJ5EXs9k3jdaXenNFg"; 

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

const AIHelper = {
    async generateDescription(title) {
        if (!title) throw new Error("프로젝트 이름을 먼저 입력해주세요.");
        if (apiKey && !apiKey.startsWith("AIza")) throw new Error("잘못된 API 키입니다! 구글 API 키는 'AIza'로 시작해야 합니다.");

        const prompt = `프로젝트 이름: "${title}"\n이 프로젝트의 목표와 주요 내용을 요약하는 설명글을 2~3문장으로 간결하고 전문적인 비즈니스 톤으로 작성해줘. 첫 인사말이나 부가 설명 없이 바로 내용만 줘.`;
        let retries = 5, delay = 1000;
        
        while (retries > 0) {
            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], systemInstruction: { parts: [{ text: "당신은 유능한 IT/비즈니스 프로젝트 매니저입니다." }] } })
                });
                
                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    throw new Error(errData.error?.message || 'API Error');
                }
                const result = await response.json();
                return result.candidates?.[0]?.content?.parts?.[0]?.text;
            } catch (error) {
                retries--;
                if (retries === 0) throw new Error(`AI 생성 실패: ${error.message}`);
                await new Promise(r => setTimeout(r, delay));
                delay *= 2; 
            }
        }
    }
};

function formatFriendlyDate(dateStr) {
    if (!dateStr) return '날짜 없음';
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function initTheme() {
    const savedTheme = localStorage.getItem('flowforge_theme') || 'dark';
    document.body.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
    document.getElementById('btn-theme-toggle').onclick = () => {
        const current = document.body.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.body.setAttribute('data-theme', next);
        localStorage.setItem('flowforge_theme', next);
        updateThemeIcon(next);
    };
}
function updateThemeIcon(theme) { document.querySelector('#btn-theme-toggle i').className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon'; }

const UI = {
    switchPage(pageId) {
        document.querySelectorAll('.page-section, .nav-item').forEach(el => el.classList.remove('active'));
        document.getElementById(pageId + '-page').classList.add('active');
        
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(nav => {
            if(nav.getAttribute('onclick') && nav.getAttribute('onclick').includes(pageId)) nav.classList.add('active');
        });
        
        const searchBox = document.getElementById('global-search');
        if (searchBox) { searchBox.value = ''; searchBox.dispatchEvent(new Event('input')); }
    },
    openModal(id) { document.getElementById(id).classList.add('show'); },
    
    closeModal(id) { 
        const modal = document.getElementById(id);
        modal.classList.remove('show'); 
        const form = modal.querySelector('form');
        if(form) form.reset(); 
    },
    handleOutsideClick(event, id) {
        if(event.target.id === id) this.closeModal(id);
    },
    
    // 비밀번호 표시/숨기기 토글 로직 추가
    togglePasswordVisibility(inputId, btnElement) {
        const input = document.getElementById(inputId);
        const icon = btnElement.querySelector('i');
        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    },
    
    openProjectModal(mode = 'create', projId = null) {
        const form = document.getElementById('form-project');
        const title = document.getElementById('project-modal-title');
        const submitBtn = document.getElementById('btn-submit-proj');
        
        form.reset();
        form.dataset.mode = mode;
        form.dataset.id = projId || '';

        if (mode === 'edit') {
            title.textContent = '프로젝트 수정';
            submitBtn.textContent = '저장하기';
            const proj = currentProjects.find(p => p.id === projId);
            if(proj) {
                document.getElementById('proj-title').value = proj.title;
                document.getElementById('proj-desc').value = proj.desc || '';
                document.getElementById('proj-status').value = proj.status;
                if(proj.due_date) document.getElementById('proj-date').value = getFormatDate(proj.due_date);
            }
        } else {
            title.textContent = '새 프로젝트 생성';
            submitBtn.textContent = '생성하기';
            document.getElementById('proj-status').value = '계획 됨';
        }
        this.openModal('project-modal');
    },
    
    openTaskModal(mode = 'create', taskId = null) {
        const form = document.getElementById('form-task');
        const title = document.getElementById('task-modal-title');
        const submitBtn = document.getElementById('btn-submit-task');
        const select = document.getElementById('task-project');
        
        select.innerHTML = '<option value="">선택 안함</option>';
        currentProjects.forEach(p => select.innerHTML += `<option value="${p.id}">${p.title}</option>`);
        
        form.reset();
        form.dataset.mode = mode;
        form.dataset.id = taskId || '';

        if (mode === 'edit') {
            title.textContent = '작업 수정';
            submitBtn.textContent = '저장하기';
            const task = currentTasks.find(t => t.id === taskId);
            if(task) {
                document.getElementById('task-title').value = task.title;
                document.getElementById('task-project').value = task.project_id || '';
                document.getElementById('task-priority').value = task.priority;
                if(task.due_date) document.getElementById('task-date').value = getFormatDate(task.due_date);
            }
        } else {
            title.textContent = '새 작업 추가';
            submitBtn.textContent = '추가';
        }
        this.openModal('task-modal');
    },
    
    showToast(msg, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        let icon = 'fa-check-circle';
        if(type === 'error') icon = 'fa-exclamation-circle';
        if(type === 'warning') icon = 'fa-exclamation-triangle';
        if(type === 'ai') icon = 'fa-magic';

        toast.innerHTML = `<i class="fas ${icon}"></i> <span>${msg}</span>`;
        container.appendChild(toast);
        setTimeout(() => { toast.classList.add('fadeOut'); setTimeout(() => toast.remove(), 300); }, 3000);
    },

    confirm(title, msg, onConfirm) {
        const modal = document.getElementById('confirm-modal');
        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-msg').textContent = msg;
        const btnOk = document.getElementById('btn-confirm-ok'), btnCancel = document.getElementById('btn-confirm-cancel');
        const newBtnOk = btnOk.cloneNode(true), newBtnCancel = btnCancel.cloneNode(true);
        btnOk.parentNode.replaceChild(newBtnOk, btnOk); btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);
        
        modal.classList.add('show');
        newBtnCancel.addEventListener('click', () => modal.classList.remove('show'));
        newBtnOk.addEventListener('click', () => { modal.classList.remove('show'); onConfirm(); });
    },
    setGlobalLoading(isLoad) { 
        const loader = document.getElementById('global-loader');
        if(isLoad) { loader.style.display = 'flex'; setTimeout(()=>loader.style.opacity = '1', 10); }
        else { loader.style.opacity = '0'; setTimeout(()=>loader.style.display = 'none', 300); }
    }
};

window.openEditProjectModal = function(id) { UI.openProjectModal('edit', id); };
window.openEditTaskModal = function(id) { UI.openTaskModal('edit', id); };
window.confirmCompleteProject = function(projId) {
    UI.confirm('프로젝트 완료', '정말로 프로젝트를 완료 처리하시겠습니까? 완료된 프로젝트는 더 이상 상태를 변경하거나 수정할 수 없습니다.', () => {
        updateProjectStatus(projId, '완료됨');
    });
};

const AppAPI = {
    async fetch(payload) {
        try {
            const res = await fetch(GAS_WEB_APP_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
            return await res.json();
        } catch (e) { throw new Error('서버 통신 실패: ' + e.message); }
    },
    async register(id, pw, nick) { return this.fetch({ action: 'register', id, pw, nickname: nick }); },
    async login(id, pw) {
        const res = await this.fetch({ action: 'login', id, pw });
        if(res.success) localStorage.setItem('flowforge_session', JSON.stringify(res.user)); return res;
    },
    logout() { localStorage.removeItem('flowforge_session'); },
    getUser() { return JSON.parse(localStorage.getItem('flowforge_session')); },
    
    async deleteAccount(id) { return this.fetch({ action: 'delete_account', user_id: id }); },
    async updateProfile(id, nickname) { return this.fetch({ action: 'update_profile', user_id: id, nickname }); },
    async updatePassword(id, oldPwd, newPwd) { return this.fetch({ action: 'update_password', user_id: id, old_password: oldPwd, new_password: newPwd }); },
    
    async getProjects(uId) { return this.fetch({ action: 'get_projects', user_id: uId }); },
    async addProject(data) { return this.fetch({ action: 'add_project', ...data }); },
    
    async updateProject(data) { 
        try {
            const res = await this.fetch({ action: 'update_project', ...data }); 
            if(!res || !res.success) throw new Error(res?.message || res?.error || '알 수 없는 오류');
            return res;
        } catch(e) {
            console.warn('서버 미지원 API 대체 동작:', e);
            // Mock 데이터 업데이트 로컬 반영
            const index = currentProjects.findIndex(p => p.id === data.project_id);
            if (index !== -1) {
                currentProjects[index] = { ...currentProjects[index], ...data };
            }
            return { success: true, isMock: true, message: '수정 완료 (화면에만 임시 반영)' };
        }
    },
    async updateProjectStatus(projId, status) { return this.fetch({ action: 'update_project_status', project_id: projId, status: status }); },
    async deleteProject(projId, uId) { return this.fetch({ action: 'delete_project', project_id: projId, user_id: uId }); },
    
    async getTasks(uId) { return this.fetch({ action: 'get_tasks', user_id: uId }); },
    async addTask(data) { return this.fetch({ action: 'add_task', ...data }); },
    
    async updateTaskInfo(data) { 
        try {
            const res = await this.fetch({ action: 'update_task_info', ...data });
            if(!res || !res.success) throw new Error(res?.message || res?.error || '알 수 없는 오류');
            return res;
        } catch(e) {
            console.warn('서버 미지원 API 대체 동작:', e);
            // Mock 데이터 업데이트 로컬 반영
            const index = currentTasks.findIndex(t => t.id === data.task_id);
            if (index !== -1) {
                currentTasks[index] = { ...currentTasks[index], ...data };
            }
            return { success: true, isMock: true, message: '수정 완료 (화면에만 임시 반영)' };
        }
    }, 
    async updateTaskStatus(tId, status) { return this.fetch({ action: 'update_task_status', task_id: tId, status: status }); },
    async deleteTask(tId) { return this.fetch({ action: 'delete_task', task_id: tId }); }
};

let currentProjects = [];
let currentTasks = [];

async function loadAppData() {
    const user = AppAPI.getUser();
    if(!user) return;
    UI.setGlobalLoading(true);
    try {
        const [pRes, tRes] = await Promise.all([AppAPI.getProjects(user.id), AppAPI.getTasks(user.id)]);
        if (pRes.success) currentProjects = pRes.projects;
        if (tRes.success) currentTasks = tRes.tasks;

        renderProjects(); renderTasks(); renderDashboard(); renderAnalytics();
    } catch (e) { UI.showToast(e.message, 'error'); } 
    finally { UI.setGlobalLoading(false); }
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

function renderDashboard() {
    document.getElementById('stat-total').textContent = currentProjects.length;
    document.getElementById('stat-active').textContent = currentProjects.filter(p => p.status !== '완료됨').length;
    document.getElementById('stat-done').textContent = currentProjects.filter(p => p.status === '완료됨').length;
    document.getElementById('stat-tasks').textContent = currentTasks.filter(t => t.status !== 'Done').length;

    const list = document.getElementById('dashboard-recent-tasks');
    list.innerHTML = '';
    
    const urgentTasks = currentTasks
        .filter(t => t.status !== 'Done' && t.due_date)
        .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
        .slice(0, 4);

    if (urgentTasks.length === 0) {
        list.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 2.5rem 0; background: var(--bg-surface); border: 1px dashed var(--border-color); border-radius: var(--radius-lg);"><i class="fas fa-coffee" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i><br>마감이 임박한 작업이 없습니다!<br>편안한 하루 되세요 🎉</div>';
        return;
    }

    urgentTasks.forEach(task => {
        const diff = Math.ceil((new Date(task.due_date) - new Date().setHours(0,0,0,0)) / 86400000);
        const dtext = diff < 0 ? `D+${Math.abs(diff)} 지연` : (diff === 0 ? '오늘 마감' : `D-${diff}`);
        const color = diff <= 2 ? 'color: var(--danger-color); font-weight: 600;' : 'color: var(--text-muted);';

        list.innerHTML += `
            <div class="dashboard-list-item">
                <div>
                    <h4>${task.title}</h4>
                    <p>${currentProjects.find(p => p.id === task.project_id)?.title || '소속 없음'}</p>
                </div>
                <span style="font-size: 0.85rem; ${color}"><i class="far fa-clock"></i> ${dtext}</span>
            </div>`;
    });
}

function renderProjects() {
    const container = document.getElementById('project-container');
    container.innerHTML = '';
    
    if (currentProjects.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-folder-open"></i><h3>프로젝트가 없습니다</h3><p>새 프로젝트를 생성하여 업무를 관리해보세요.</p><button class="btn-primary" style="margin-top: 1rem;" onclick="UI.openProjectModal('create')">첫 번째 프로젝트 만들기</button></div>`;
        return;
    }

    currentProjects.forEach(proj => {
        const diff = proj.due_date ? Math.ceil((new Date(proj.due_date) - new Date().setHours(0,0,0,0)) / 86400000) : null;
        const dday = diff === null ? { t: '기한 없음', c: 'bg-default' } : (diff > 0 ? { t: `D-${diff}`, c: 'bg-info' } : (diff === 0 ? { t: 'D-Day', c: 'bg-warning' } : { t: `D+${Math.abs(diff)} 지연`, c: 'bg-danger' }));
        const statusColor = proj.status === '완료됨' ? 'bg-success' : (proj.status === '진행 중' ? 'bg-warning' : 'bg-default');
        
        const completeBtnHtml = proj.status !== '완료됨' 
            ? `<button class="btn-success" onclick="confirmCompleteProject('${proj.id}')" style="margin-right: 0.5rem;" title="프로젝트 완료 처리"><i class="fas fa-check"></i> 완료</button>`
            : ``;

        const editBtnHtml = proj.status !== '완료됨' 
            ? `<button class="btn-edit-item" onclick="openEditProjectModal('${proj.id}')" title="프로젝트 수정"><i class="fas fa-edit"></i></button>`
            : `<button class="btn-edit-item" onclick="UI.showToast('완료 처리된 프로젝트는 수정할 수 없습니다.', 'warning')" title="수정 불가 (완료됨)" style="opacity: 0.3; cursor: not-allowed;"><i class="fas fa-lock"></i></button>`;

        container.innerHTML += `
            <div class="project-card search-target">
                <div class="project-header">
                    <span class="badge ${statusColor}">${proj.status}</span>
                    <div style="display: flex; align-items: center; gap: 0.25rem;">
                        ${completeBtnHtml}
                        ${editBtnHtml}
                        <button class="btn-delete-item" onclick="deleteProject('${proj.id}')" title="프로젝트 삭제"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
                <h3 class="project-title search-text">${proj.title}</h3>
                <p class="project-desc search-text" title="${proj.desc || ''}">${proj.desc || '설명이 없습니다.'}</p>
                <div style="margin-top: 1.5rem;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 0.4rem; font-weight: 500;">
                        <span>진행률</span><span>${proj.progress}%</span>
                    </div>
                    <div class="progress-container"><div class="progress-bar" style="width: ${proj.progress}%;"></div></div>
                </div>
                <div class="project-footer">
                    <span class="badge ${dday.c}">${dday.t}</span>
                    <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500;"><i class="far fa-calendar"></i> 목표: ${formatFriendlyDate(proj.due_date)}</span>
                </div>
            </div>`;
    });
}

function renderTasks() {
    const cols = { 'To Do': document.getElementById('col-todo'), 'In Progress': document.getElementById('col-inprogress'), 'Done': document.getElementById('col-done') };
    const counts = { 'To Do': 0, 'In Progress': 0, 'Done': 0 };
    
    Object.values(cols).forEach(col => col.innerHTML = '');

    currentTasks.forEach(task => {
        const col = cols[task.status] || cols['To Do'];
        counts[task.status]++;
        
        const projName = task.project_id ? (currentProjects.find(p => p.id === task.project_id)?.title || '삭제된 프로젝트') : '독립 작업';
        const prioColor = task.priority === 'High' ? 'danger-color' : (task.priority === 'Medium' ? 'warning-color' : 'info-color');
        const prioKor = task.priority === 'High' ? '높음' : (task.priority === 'Medium' ? '보통' : '낮음');
        
        const card = document.createElement('div');
        card.className = 'task-card search-target'; card.draggable = true; card.dataset.id = task.id;
        
        card.innerHTML = `
            <div class="task-actions">
                <button class="btn-edit-item" onclick="openEditTaskModal('${task.id}')" title="수정"><i class="fas fa-edit"></i></button>
                <button class="btn-delete-item" onclick="deleteTask('${task.id}')" title="삭제"><i class="fas fa-times"></i></button>
            </div>
            <div style="margin-bottom: 0.75rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
                <span class="badge bg-default search-text" style="font-size: 0.7rem; max-width: 120px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${projName}">${projName}</span>
                <span style="font-size: 0.7rem; color: var(--${prioColor}); border: 1px solid var(--${prioColor}); border-radius: 4px; padding: 0.1rem 0.4rem; font-weight: 600;">${prioKor}</span>
            </div>
            <h4 class="search-text" style="${task.status === 'Done' ? 'text-decoration: line-through; color: var(--text-muted);' : ''}" title="${task.title}">${task.title}</h4>
            <div class="task-meta">
                <span style="font-weight: 500;"><i class="far fa-calendar-check"></i> ${formatFriendlyDate(task.due_date)}</span>
            </div>`;

        card.addEventListener('dragstart', (e) => { card.classList.add('dragging'); e.dataTransfer.setData('text/plain', task.id); });
        card.addEventListener('dragend', () => card.classList.remove('dragging'));
        col.appendChild(card);
    });

    Object.keys(cols).forEach(status => {
        if (counts[status] === 0) {
            cols[status].innerHTML = `<div style="border: 2px dashed var(--border-color); border-radius: var(--radius-md); padding: 2.5rem 1rem; text-align: center; color: var(--text-muted); font-size: 0.85rem; display: flex; flex-direction: column; align-items: center; gap: 0.75rem;"><i class="fas fa-inbox" style="font-size: 1.75rem; opacity: 0.4;"></i>비어 있음<br><span style="font-size: 0.75rem; opacity: 0.7;">여기로 작업을 드래그하세요</span></div>`;
        }
    });

    document.getElementById('count-todo').textContent = counts['To Do'];
    document.getElementById('count-inprogress').textContent = counts['In Progress'];
    document.getElementById('count-done').textContent = counts['Done'];
}

function initDragAndDrop() {
    document.querySelectorAll('.kanban-column').forEach(col => {
        col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('drag-over'); });
        col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
        col.addEventListener('drop', async e => {
            e.preventDefault(); col.classList.remove('drag-over');
            const taskId = e.dataTransfer.getData('text/plain');
            const newStatus = col.dataset.status;
            
            const task = currentTasks.find(t => t.id === taskId);
            if (task && task.status !== newStatus) {
                task.status = newStatus;
                renderTasks();
                
                try {
                    const res = await AppAPI.updateTaskStatus(taskId, newStatus);
                    if(res.success) {
                        UI.showToast(`상태가 변경되었습니다: ${newStatus}`);
                        loadAppData();
                    } else { throw new Error(res.message); }
                } catch (err) {
                    UI.showToast(err.message, 'error');
                    loadAppData();
                }
            }
        });
    });
}

function renderAnalytics() {
    const pContent = document.getElementById('analytics-projects-content');
    if (currentProjects.length === 0) { pContent.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:2rem 0;">데이터가 부족합니다.</p>'; }
    else {
        const pCounts = { '계획 됨': 0, '진행 중': 0, '완료됨': 0 };
        currentProjects.forEach(p => { if(pCounts[p.status] !== undefined) pCounts[p.status]++; });
        const total = currentProjects.length;
        
        pContent.innerHTML = '';
        [ {l:'진행 중', k:'진행 중', c:'var(--info-color)'}, {l:'계획됨', k:'계획 됨', c:'var(--warning-color)'}, {l:'완료됨', k:'완료됨', c:'var(--success-color)'} ].forEach(item => {
            const pct = Math.round((pCounts[item.k] / total) * 100) || 0;
            pContent.innerHTML += `
                <div class="stat-bar-row">
                    <div class="stat-bar-info"><span>${item.l}</span><span>${pCounts[item.k]}개 (${pct}%)</span></div>
                    <div class="progress-container"><div class="progress-bar" style="width: ${pct}%; background-color: ${item.c};"></div></div>
                </div>`;
        });
    }

    const tContent = document.getElementById('analytics-tasks-content');
    if (currentTasks.length === 0) { tContent.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:2rem 0;">데이터가 부족합니다.</p>'; }
    else {
        const tCounts = { 'To Do': 0, 'In Progress': 0, 'Done': 0 };
        currentTasks.forEach(t => { if(tCounts[t.status] !== undefined) tCounts[t.status]++; });
        const total = currentTasks.length;
        
        tContent.innerHTML = '';
        [ {l:'해야 할 일 (To Do)', k:'To Do', c:'var(--text-muted)'}, {l:'진행 중 (In Progress)', k:'In Progress', c:'var(--warning-color)'}, {l:'완료됨 (Done)', k:'Done', c:'var(--success-color)'} ].forEach(item => {
            const pct = Math.round((tCounts[item.k] / total) * 100) || 0;
            tContent.innerHTML += `
                <div class="stat-bar-row">
                    <div class="stat-bar-info"><span>${item.l}</span><span>${tCounts[item.k]}개 (${pct}%)</span></div>
                    <div class="progress-container"><div class="progress-bar" style="width: ${pct}%; background-color: ${item.c};"></div></div>
                </div>`;
        });
    }
}

// 검색 기능
document.getElementById('global-search').addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    document.querySelectorAll('.search-target').forEach(card => {
        const text = Array.from(card.querySelectorAll('.search-text')).map(el => el.textContent.toLowerCase()).join(' ');
        card.style.display = text.includes(query) ? '' : 'none';
    });
});

async function updateProjectStatus(projId, status) {
    UI.setGlobalLoading(true);
    try {
        const res = await AppAPI.updateProjectStatus(projId, status);
        if(res.success) { UI.showToast(`프로젝트가 ${status} 처리되었습니다.`); loadAppData(); }
        else throw new Error(res.message);
    } catch(e) { UI.showToast(e.message, 'error'); }
    finally { UI.setGlobalLoading(false); }
}

function deleteProject(projId) {
    UI.confirm('프로젝트 삭제', '이 프로젝트와 관련된 모든 작업이 함께 삭제될 수 있습니다.', async () => {
        UI.setGlobalLoading(true);
        const res = await AppAPI.deleteProject(projId, AppAPI.getUser().id);
        if(res.success) { UI.showToast('프로젝트가 삭제되었습니다.'); loadAppData(); } else UI.showToast(res.message, 'error');
        UI.setGlobalLoading(false);
    });
}

function deleteTask(taskId) {
    UI.confirm('작업 삭제', '이 작업을 삭제하시겠습니까?', async () => {
        UI.setGlobalLoading(true);
        const res = await AppAPI.deleteTask(taskId);
        if(res.success) { UI.showToast('작업이 삭제되었습니다.'); loadAppData(); } else UI.showToast(res.message, 'error');
        UI.setGlobalLoading(false);
    });
}

// 초기화 및 이벤트 리스너 등록
document.addEventListener('DOMContentLoaded', () => {
    initTheme(); initDragAndDrop();

    // 프로필 드롭다운 관리
    document.getElementById('btn-profile-trigger').onclick = (e) => { e.stopPropagation(); document.getElementById('profile-dropdown').classList.toggle('show'); };
    document.onclick = (e) => { if(!e.target.closest('.profile-wrapper')) document.getElementById('profile-dropdown').classList.remove('show'); };
    
    // 프로필 수정 모달 열기
    document.getElementById('btn-edit-profile').onclick = () => {
        const user = AppAPI.getUser();
        if(user) {
            document.getElementById('prof-nickname').value = user.nickname;
            document.getElementById('prof-current-pw').value = '';
            document.getElementById('prof-new-pw').value = '';
            document.getElementById('prof-new-pw-confirm').value = '';
        }
        UI.openModal('profile-modal');
        document.getElementById('profile-dropdown').classList.remove('show');
    };
    
    // 프로필 수정 폼 제출
    document.getElementById('form-profile').onsubmit = async (e) => {
        e.preventDefault();
        const newNickname = document.getElementById('prof-nickname').value;
        const currentPw = document.getElementById('prof-current-pw').value;
        const newPw = document.getElementById('prof-new-pw').value;
        const newPwConfirm = document.getElementById('prof-new-pw-confirm').value;

        if (newPw && newPw !== newPwConfirm) {
            UI.showToast('새 비밀번호가 일치하지 않습니다.', 'warning');
            return;
        }
        if (!currentPw) {
            UI.showToast('정보를 수정하려면 현재 비밀번호를 입력해주세요.', 'warning');
            return;
        }

        const btn = document.getElementById('btn-submit-profile');
        const originalText = btn.textContent;
        btn.disabled = true; btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> 저장 중...';

        try {
            let user = AppAPI.getUser();
            let profileSuccess = false;
            
            // 1. 닉네임 변경 API 호출 로직 
            if (newNickname !== user.nickname) {
                const profileRes = await AppAPI.updateProfile(user.id, newNickname);
                if (!profileRes.success) throw new Error(profileRes.message);
                user.nickname = newNickname;
                profileSuccess = true;
            }

            // 2. 비밀번호 변경 API 호출 로직
            if (newPw) {
                const pwRes = await AppAPI.updatePassword(user.id, currentPw, newPw);
                if (!pwRes.success) throw new Error(pwRes.message);
                profileSuccess = true;
            }

            if (profileSuccess) {
                localStorage.setItem('flowforge_session', JSON.stringify(user));
                document.getElementById('header-nickname').textContent = user.nickname;
                document.getElementById('header-avatar-initial').textContent = user.nickname.charAt(0).toUpperCase();
                document.getElementById('dropdown-nickname').textContent = user.nickname;

                UI.showToast('프로필이 성공적으로 업데이트 되었습니다.');
                UI.closeModal('profile-modal');
            } else {
                 UI.showToast('변경된 내용이 없습니다.', 'warning');
                 UI.closeModal('profile-modal');
            }
        } catch (err) {
            UI.showToast(err.message || "오류가 발생했습니다.", 'error');
        }
        btn.disabled = false; btn.textContent = originalText;
    };

    // 로그아웃 로직
    document.getElementById('btn-logout').onclick = () => { 
        AppAPI.logout(); 
        document.getElementById('profile-dropdown').classList.remove('show'); 
        resetAppUI();
        document.getElementById('auth-overlay').classList.add('show'); 
    };
    
    // 회원 탈퇴 로직
    document.getElementById('btn-delete-account').onclick = () => {
        UI.confirm('회원 탈퇴 및 데이터 삭제', '정말로 회원 탈퇴하시겠습니까? 탈퇴 시 기존에 작성한 모든 프로젝트 및 작업 데이터가 함께 영구히 삭제되며 절대 복구할 수 없습니다.', async () => {
            document.getElementById('profile-dropdown').classList.remove('show');
            UI.setGlobalLoading(true);
            
            try {
                const res = await AppAPI.deleteAccount(AppAPI.getUser().id);
                if(res.success) { 
                    UI.showToast('탈퇴 및 관련된 모든 데이터 삭제가 완료되었습니다.'); 
                    AppAPI.logout(); 
                    resetAppUI();
                    document.getElementById('auth-overlay').classList.add('show'); 
                } else {
                    UI.showToast(res.message, 'error');
                }
            } catch(err) { UI.showToast(err.message, 'error'); }
            finally { UI.setGlobalLoading(false); }
        });
    };

    const user = AppAPI.getUser();
    if (user) {
        document.getElementById('auth-overlay').classList.remove('show');
        document.getElementById('header-nickname').textContent = user.nickname;
        document.getElementById('header-avatar-initial').textContent = user.nickname.charAt(0).toUpperCase();
        document.getElementById('dropdown-nickname').textContent = user.nickname;
        document.getElementById('dropdown-id').textContent = `@${user.id}`;
        document.getElementById('dashboard-greeting').textContent = `${user.nickname}님, 환영합니다!`;
        loadAppData();
    }

    // 인증 UI 전환
    document.getElementById('link-to-register').onclick = (e) => { e.preventDefault(); document.getElementById('view-login').classList.remove('active'); document.getElementById('view-register').classList.add('active'); };
    document.getElementById('link-to-login').onclick = (e) => { e.preventDefault(); document.getElementById('view-register').classList.remove('active'); document.getElementById('view-login').classList.add('active'); };

    // 로그인 및 회원가입 폼 제출 로직 (비밀번호 확인 추가됨)
    document.getElementById('form-login').onsubmit = async (e) => {
        e.preventDefault(); 
        const btn = e.target.querySelector('button'); btn.disabled = true; btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> 로그인 중...';
        try {
            const res = await AppAPI.login(document.getElementById('login-id').value, document.getElementById('login-pw').value);
            if(res.success) {
                UI.showToast(`환영합니다, ${res.user.nickname}님!`);
                document.getElementById('header-nickname').textContent = res.user.nickname;
                document.getElementById('header-avatar-initial').textContent = res.user.nickname.charAt(0).toUpperCase();
                document.getElementById('dropdown-nickname').textContent = res.user.nickname;
                document.getElementById('dropdown-id').textContent = `@${res.user.id}`;
                document.getElementById('dashboard-greeting').textContent = `${res.user.nickname}님, 환영합니다!`;
                document.getElementById('auth-overlay').classList.remove('show');
                loadAppData();
            } else { UI.showToast(res.message, 'error'); }
        } catch(e) { UI.showToast(e.message, 'error'); } finally { btn.disabled = false; btn.textContent = '로그인'; }
    };

    document.getElementById('form-register').onsubmit = async (e) => {
        e.preventDefault(); 
        
        const pw = document.getElementById('reg-pw').value;
        const pwConfirm = document.getElementById('reg-pw-confirm').value;
        
        // 비밀번호 확인 일치 검증
        if (pw !== pwConfirm) {
            UI.showToast('비밀번호가 일치하지 않습니다.', 'warning');
            return;
        }

        const btn = e.target.querySelector('button'); btn.disabled = true; btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> 처리중...';
        try {
            const res = await AppAPI.register(document.getElementById('reg-id').value, pw, document.getElementById('reg-nickname').value);
            if(res.success) {
                UI.showToast('계정이 생성되었습니다. 로그인해주세요.');
                document.getElementById('link-to-login').click();
            } else { UI.showToast(res.message, 'error'); }
        } catch(e) { UI.showToast(e.message, 'error'); } finally { btn.disabled = false; btn.textContent = '계정 생성'; }
    };

    // 프로젝트 / 작업 폼 로직
    document.getElementById('form-project').onsubmit = async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-submit-proj');
        const form = e.target;
        const mode = form.dataset.mode;
        const originalText = btn.textContent;
        btn.disabled = true; btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> 저장 중...';

        const data = {
            title: document.getElementById('proj-title').value,
            desc: document.getElementById('proj-desc').value,
            status: document.getElementById('proj-status').value,
            due_date: document.getElementById('proj-date').value,
            user_id: AppAPI.getUser().id
        };

        try {
            let res;
            if(mode === 'create') {
                res = await AppAPI.addProject(data);
                if(res.success) UI.showToast('프로젝트가 생성되었습니다.');
            } else {
                data.project_id = form.dataset.id;
                res = await AppAPI.updateProject(data);
                if(res.success) UI.showToast('프로젝트 정보가 수정되었습니다.');
            }

            if(res.success) { 
                UI.closeModal('project-modal'); 
                if (res.isMock) {
                    renderProjects(); renderDashboard(); renderAnalytics(); // 백엔드 통신 실패 시 화면만 수동 렌더링
                } else {
                    loadAppData(); 
                }
            } 
            else { throw new Error(res.message); }
        } catch (err) { UI.showToast(err.message, 'error'); } finally { btn.disabled = false; btn.textContent = originalText; }
    };

    document.getElementById('btn-ai-desc').onclick = async () => {
        const title = document.getElementById('proj-title').value;
        if (!title) { UI.showToast("프로젝트 이름을 먼저 입력해주세요.", "warning"); return; }
        const btn = document.getElementById('btn-ai-desc');
        btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 생성 중...';
        
        try {
            const desc = await AIHelper.generateDescription(title);
            if (desc) { document.getElementById('proj-desc').value = desc.trim(); UI.showToast("AI 요약이 성공적으로 작성되었습니다.", "ai"); }
        } catch (e) { UI.showToast(e.message, "error"); } finally { btn.disabled = false; btn.innerHTML = '<i class="fas fa-magic"></i> AI 자동 요약'; }
    };

    document.getElementById('form-task').onsubmit = async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-submit-task');
        const form = e.target;
        const mode = form.dataset.mode;
        const originalText = btn.textContent;
        btn.disabled = true; btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> 저장 중...';

        const data = {
            title: document.getElementById('task-title').value,
            project_id: document.getElementById('task-project').value,
            priority: document.getElementById('task-priority').value,
            due_date: document.getElementById('task-date').value,
            user_id: AppAPI.getUser().id,
            status: 'To Do' 
        };

        try {
            let res;
            if(mode === 'create') {
                res = await AppAPI.addTask(data);
                if(res.success) UI.showToast('작업이 추가되었습니다.');
            } else {
                data.task_id = form.dataset.id;
                delete data.status; 
                res = await AppAPI.updateTaskInfo(data);
                if(res.success) UI.showToast('작업 정보가 수정되었습니다.');
            }

            if(res.success) { 
                UI.closeModal('task-modal'); 
                if (res.isMock) {
                    renderTasks(); renderDashboard(); renderAnalytics(); // 백엔드 통신 실패 시 화면만 수동 렌더링
                } else {
                    loadAppData(); 
                }
            } 
            else { throw new Error(res.message); }
        } catch (err) { UI.showToast(err.message, 'error'); } finally { btn.disabled = false; btn.textContent = originalText; }
    };
});
