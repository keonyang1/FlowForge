'use strict';

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
            if(nav.getAttribute('onclick').includes(pageId)) nav.classList.add('active');
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
                
                // 서버에서 '완료됨'으로 넘어왔을 수 있지만, 수정 모달에선 완료됨 옵션을 뺐으므로 
                // 예외처리가 필요하다면 (완료된 프로젝트는 애초에 수정버튼이 막혀있어 열릴 일이 없긴 함)
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
        
        // 완료 처리 버튼 (진행/계획 상태에서만 렌더링)
        const completeBtnHtml = proj.status !== '완료됨' 
            ? `<button class="btn-success" onclick="confirmCompleteProject('${proj.id}')" style="margin-right: 0.5rem;" title="프로젝트 완료 처리"><i class="fas fa-check"></i> 완료</button>`
            : ``;

        // 수정 버튼 렌더링 방식 개선 (완료된 프로젝트는 시각적으로 명확히 수정 불가 알림)
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

function renderAnalytics() {
    const projContainer = document.getElementById('analytics-projects-content');
    projContainer.innerHTML = '';
    
    if (currentProjects.length === 0) {
        projContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem; padding: 1rem 0; text-align: center; border: 1px dashed var(--border-color); border-radius: var(--radius-md);">데이터가 충분하지 않습니다.</p>';
    } else {
        currentProjects.forEach(p => {
            projContainer.innerHTML += `
                <div class="stat-bar-row">
                    <div class="stat-bar-info"><span>${p.title}</span><span>${p.progress}%</span></div>
                    <div class="progress-container"><div class="progress-bar" style="width: ${p.progress}%;"></div></div>
                </div>`;
        });
    }

    const taskContainer = document.getElementById('analytics-tasks-content');
    const total = currentTasks.length;
    if (total === 0) {
        taskContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem; padding: 1rem 0; text-align: center; border: 1px dashed var(--border-color); border-radius: var(--radius-md);">작업 데이터가 없습니다.</p>';
    } else {
        const todo = currentTasks.filter(t => t.status === 'To Do').length;
        const inprog = currentTasks.filter(t => t.status === 'In Progress').length;
        const done = currentTasks.filter(t => t.status === 'Done').length;
        
        taskContainer.innerHTML = `
            <div class="stat-bar-row">
                <div class="stat-bar-info"><span>해야 할 일 (To Do)</span><span>${Math.round((todo/total)*100)}% (${todo}건)</span></div>
                <div class="progress-container"><div class="progress-bar bg-info" style="width: ${(todo/total)*100}%; background-color: var(--info-color);"></div></div>
            </div>
            <div class="stat-bar-row">
                <div class="stat-bar-info"><span>진행 중 (In Progress)</span><span>${Math.round((inprog/total)*100)}% (${inprog}건)</span></div>
                <div class="progress-container"><div class="progress-bar bg-warning" style="width: ${(inprog/total)*100}%; background-color: var(--warning-color);"></div></div>
            </div>
            <div class="stat-bar-row">
                <div class="stat-bar-info"><span>완료됨 (Done)</span><span>${Math.round((done/total)*100)}% (${done}건)</span></div>
                <div class="progress-container"><div class="progress-bar bg-success" style="width: ${(done/total)*100}%; background-color: var(--success-color);"></div></div>
            </div>`;
    }
}

function initDragAndDrop() {
    document.querySelectorAll('.kanban-column').forEach(col => {
        col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('drag-over'); });
        col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
        col.addEventListener('drop', async e => {
            e.preventDefault(); col.classList.remove('drag-over');
            const taskId = e.dataTransfer.getData('text/plain');
            if(!taskId) return;
            
            const newStatus = col.dataset.status;
            const taskIndex = currentTasks.findIndex(t => t.id === taskId);
            
            if (taskIndex > -1 && currentTasks[taskIndex].status !== newStatus) {
                currentTasks[taskIndex].status = newStatus;
                renderTasks(); renderDashboard(); renderAnalytics();
                
                try {
                    const res = await AppAPI.updateTaskStatus(taskId, newStatus);
                    if (!res.success) throw new Error(res.message);
                } catch (err) { UI.showToast('상태 변경 실패: ' + err.message, 'error'); loadAppData(); }
            }
        });
    });
}

document.getElementById('global-search').addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    const targets = document.querySelectorAll('.search-target');
    
    if (!query) {
        targets.forEach(t => t.style.display = 'block');
        return;
    }
    
    targets.forEach(target => {
        let match = false;
        target.querySelectorAll('.search-text').forEach(textNode => {
            if (textNode.textContent.toLowerCase().includes(query)) match = true;
        });
        target.style.display = match ? 'block' : 'none';
    });
});

document.getElementById('btn-ai-desc').addEventListener('click', async (e) => {
    const titleInput = document.getElementById('proj-title').value.trim();
    if (!titleInput) {
        UI.showToast('프로젝트 이름을 먼저 입력해주세요!', 'warning');
        document.getElementById('proj-title').focus();
        return;
    }
    
    const btn = e.currentTarget;
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 요약 중...';
    btn.disabled = true;
    
    try {
        const desc = await AIHelper.generateDescription(titleInput);
        if (desc) {
            document.getElementById('proj-desc').value = desc.trim();
            UI.showToast('AI가 성공적으로 내용을 작성했습니다!', 'ai');
        }
    } catch (err) {
        UI.showToast(err.message, 'error');
    } finally {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
});

async function updateProjectStatus(projId, status) {
    UI.setGlobalLoading(true);
    try {
        const res = await AppAPI.updateProjectStatus(projId, status);
        if(res.success) { UI.showToast(`프로젝트가 ${status} 상태로 변경되었습니다.`); loadAppData(); }
        else UI.showToast(res.message, 'error');
    } catch(e) { UI.showToast(e.message, 'error'); }
    UI.setGlobalLoading(false);
}

function deleteProject(projId) {
    UI.confirm('프로젝트 삭제', '프로젝트를 완전히 삭제하시겠습니까? 관련 데이터는 복구할 수 없습니다.', async () => {
        UI.setGlobalLoading(true);
        const res = await AppAPI.deleteProject(projId, AppAPI.getUser().id);
        if(res.success) { UI.showToast(res.message); loadAppData(); } else UI.showToast(res.message, 'error');
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

document.addEventListener('DOMContentLoaded', () => {
    initTheme(); initDragAndDrop();

    document.getElementById('link-to-register').onclick = (e) => { e.preventDefault(); document.getElementById('view-login').classList.remove('active'); document.getElementById('view-register').classList.add('active'); };
    document.getElementById('link-to-login').onclick = (e) => { e.preventDefault(); document.getElementById('view-register').classList.remove('active'); document.getElementById('view-login').classList.add('active'); };
    
    document.getElementById('form-login').onsubmit = async (e) => {
        e.preventDefault(); const btn = e.target.querySelector('button'); btn.disabled = true; btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> 처리중...';
        try {
            const res = await AppAPI.login(document.getElementById('login-id').value, document.getElementById('login-pw').value);
            if(res.success) { UI.showToast('로그인 성공!'); initAppUser(res.user); } else UI.showToast(res.message, 'error');
        } catch(err) { UI.showToast(err.message, 'error'); }
        btn.disabled = false; btn.textContent = '로그인';
    };

    document.getElementById('form-register').onsubmit = async (e) => {
        e.preventDefault(); const btn = e.target.querySelector('button'); btn.disabled = true; btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> 처리중...';
        try {
            const res = await AppAPI.register(document.getElementById('reg-id').value, document.getElementById('reg-pw').value, document.getElementById('reg-nickname').value);
            if(res.success) { UI.showToast('가입 성공! 로그인해주세요.'); document.getElementById('view-register').classList.remove('active'); document.getElementById('view-login').classList.add('active'); } 
            else UI.showToast(res.message, 'error');
        } catch(err) { UI.showToast(err.message, 'error'); }
        btn.disabled = false; btn.textContent = '계정 생성';
    };

    document.getElementById('btn-profile-trigger').onclick = (e) => { e.stopPropagation(); document.getElementById('profile-dropdown').classList.toggle('show'); };
    document.onclick = (e) => { if(!e.target.closest('.profile-wrapper')) document.getElementById('profile-dropdown').classList.remove('show'); };
    document.getElementById('btn-logout').onclick = () => { AppAPI.logout(); document.getElementById('profile-dropdown').classList.remove('show'); document.getElementById('auth-overlay').classList.add('show'); };
    document.getElementById('btn-delete-account').onclick = () => {
        UI.confirm('회원 탈퇴', '계정이 삭제됩니다. 이 작업은 되돌릴 수 없습니다. 계속하시겠습니까?', async () => {
            const res = await AppAPI.deleteAccount(AppAPI.getUser().id);
            if(res.success) { UI.showToast('탈퇴가 완료되었습니다.'); AppAPI.logout(); document.getElementById('auth-overlay').classList.add('show'); }
        });
    };

    // 프로젝트 생성 및 수정 로직
    document.getElementById('form-project').onsubmit = async (e) => {
        e.preventDefault(); 
        const form = e.target;
        const mode = form.dataset.mode || 'create';
        const projId = form.dataset.id;
        
        const btn = document.getElementById('btn-submit-proj'); 
        const originalText = btn.textContent;
        btn.disabled = true; btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> 저장 중...';
        
        const reqData = {
            title: document.getElementById('proj-title').value, 
            desc: document.getElementById('proj-desc').value,
            status: document.getElementById('proj-status').value, 
            due_date: document.getElementById('proj-date').value
        };

        try {
            let res;
            if (mode === 'create') {
                reqData.user_id = AppAPI.getUser().id;
                reqData.progress = 0; // 생성 시에는 항상 0% (완료됨 선택지가 없으므로)
                res = await AppAPI.addProject(reqData);
            } else {
                reqData.project_id = projId;
                res = await AppAPI.updateProject(reqData);
            }

            if(res.success) { 
                if(res.isMock) {
                    const pIdx = currentProjects.findIndex(p => p.id === projId);
                    if(pIdx > -1) {
                currentProjects[pIdx].title = reqData.title;
                currentProjects[pIdx].desc = reqData.desc;
                currentProjects[pIdx].status = reqData.status;
                currentProjects[pIdx].due_date = reqData.due_date;
                    }
                    renderProjects(); renderDashboard(); renderAnalytics();
                    UI.showToast(res.message, 'success');
                    UI.closeModal('project-modal');
                } else {
                    UI.showToast(mode === 'create' ? '새 프로젝트가 생성되었습니다!' : '프로젝트가 저장되었습니다!'); 
                    UI.closeModal('project-modal'); 
                    loadAppData(); 
                }
            } else {
                UI.showToast(res.message, 'error');
            }
        } catch(err) { UI.showToast(err.message, 'error'); }
        btn.disabled = false; btn.textContent = mode === 'create' ? '생성하기' : '저장하기';
    };

    // 작업(Task) 생성 및 수정 로직
    document.getElementById('form-task').onsubmit = async (e) => {
        e.preventDefault(); 
        const form = e.target;
        const mode = form.dataset.mode || 'create';
        const taskId = form.dataset.id;
        
        const btn = document.getElementById('btn-submit-task'); 
        btn.disabled = true; btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> 저장 중...';

        const reqData = {
            project_id: document.getElementById('task-project').value,
            title: document.getElementById('task-title').value, 
            priority: document.getElementById('task-priority').value, 
            due_date: document.getElementById('task-date').value
        };

        try {
            let res;
            if (mode === 'create') {
                reqData.user_id = AppAPI.getUser().id;
                reqData.status = 'To Do';
                res = await AppAPI.addTask(reqData);
            } else {
                reqData.task_id = taskId;
                res = await AppAPI.updateTaskInfo(reqData);
            }
            if(res.success) { 
                if (res.isMock) {
                    const tIdx = currentTasks.findIndex(t => t.id === taskId);
                    if(tIdx > -1) {
                currentTasks[tIdx].title = reqData.title;
                currentTasks[tIdx].project_id = reqData.project_id;
                currentTasks[tIdx].priority = reqData.priority;
                currentTasks[tIdx].due_date = reqData.due_date;
                    }
                    renderTasks(); renderDashboard(); renderAnalytics();
                    UI.showToast(res.message, 'success');
                    UI.closeModal('task-modal');
                } else {
                    UI.showToast(mode === 'create' ? '새 작업이 추가되었습니다!' : '작업이 성공적으로 수정되었습니다!'); 
                    UI.closeModal('task-modal'); 
                    loadAppData(); 
                }
            } else {
                UI.showToast(res.message, 'error');
            }
        } catch(err) { UI.showToast(err.message, 'error'); }
        btn.disabled = false; btn.textContent = mode === 'create' ? '추가' : '저장하기';
    };

    const currentUser = AppAPI.getUser();
    if(currentUser) initAppUser(currentUser); else document.getElementById('auth-overlay').classList.add('show');
});

function initAppUser(user) {
    document.getElementById('auth-overlay').classList.remove('show');
    document.getElementById('header-nickname').textContent = user.nickname;
    document.getElementById('header-avatar-initial').textContent = user.nickname.charAt(0).toUpperCase();
    document.getElementById('dropdown-nickname').textContent = user.nickname;
    document.getElementById('dropdown-id').textContent = `@${user.id}`;
    document.getElementById('dashboard-greeting').textContent = `${user.nickname}님, 환영합니다 👋`;
    loadAppData(); 
}
