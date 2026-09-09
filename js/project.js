// js/project.js

let isProjectRequest = false;
let currentProjectId = null;

window.openEditProjectModal = function(id) { UI.openProjectModal('edit', id); };
window.confirmCompleteProject = function(projId) {
    UI.confirm('프로젝트 완료', '정말로 프로젝트를 완료 처리하시겠습니까?<br>완료된 프로젝트는 더 이상 상태를 변경하거나 수정할 수 없습니다.', () => {
        updateProjectStatus(projId, '완료됨');
    });
};

window.openProjectDetail = function(projId) {
    currentProjectId = projId;
    renderProjectDetail(projId);
    UI.switchPage('project-detail');
};

window.closeProjectDetail = function() {
    currentProjectId = null;
    UI.switchPage('projects');
};

function renderProjects() {
    const container = document.getElementById('project-container');
    container.innerHTML = '';
            
    if (currentProjects.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-folder-open"></i><h3>프로젝트가 없습니다</h3><p>새 프로젝트를 생성하여 업무를 관리해보세요.</p><button class="btn-primary" style="margin-top: 1rem;" onclick="UI.openProjectModal('create')">첫 번째 프로젝트 만들기</button></div>`;
        return;
    }

    currentProjects.forEach(proj => {
        const tasks = currentTasks.filter(t => t.project_id === proj.id);
        const completed = tasks.filter(t => t.status === "Done").length;
        const total = tasks.length;
        const progress = total === 0 ? 0 : Math.round((completed / total) * 100);

        const diff = proj.due_date ? Math.ceil((new Date(proj.due_date) - new Date().setHours(0,0,0,0)) / 86400000) : null;
        const dday = diff === null ? { t: '기한 없음', c: 'bg-default' } : (diff > 0 ? { t: `D-${diff}`, c: 'bg-info' } : (diff === 0 ? { t: 'D-Day', c: 'bg-warning' } : { t: `D+${Math.abs(diff)} 지연`, c: 'bg-danger' }));
        const statusColor = proj.status === '완료됨' ? 'bg-success' : (proj.status === '진행 중' ? 'bg-warning' : 'bg-default');
                
        const completeBtnHtml = proj.status !== '완료됨' 
            ? `<button class="btn-success" onclick="event.stopPropagation(); confirmCompleteProject('${proj.id}')" style="margin-right: 0.5rem;" title="프로젝트 완료 처리"><i class="fas fa-check"></i> 완료</button>`
            : ``;

        const editBtnHtml = proj.status !== '완료됨' 
            ? `<button class="btn-edit-item" onclick="event.stopPropagation(); openEditProjectModal('${proj.id}')" title="프로젝트 수정"><i class="fas fa-edit"></i></button>`
            : `<button class="btn-edit-item" onclick="event.stopPropagation(); UI.showToast('완료 처리된 프로젝트는 수정할 수 없습니다.', 'warning')" title="수정 불가 (완료됨)" style="opacity: 0.3; cursor: not-allowed;"><i class="fas fa-lock"></i></button>`;

        container.innerHTML += `
            <div class="project-card search-target" onclick="openProjectDetail('${proj.id}')">
                <div class="project-header">
                    <span class="badge ${statusColor}">${proj.status}</span>
                    <div style="display: flex; align-items: center; gap: 0.25rem;">
                        ${completeBtnHtml}
                        ${editBtnHtml}
                        <button class="btn-delete-item" onclick="event.stopPropagation(); deleteProject('${proj.id}')" title="프로젝트 삭제"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
                <h3 class="project-title search-text">${proj.title}</h3>
                <p class="project-desc search-text" title="${proj.description || ''}">${proj.description || '설명이 없습니다.'}</p>
                <div class="project-progress">
                    <div class="progress-container">
                        <div class="progress-bar" style="width:${progress}%"></div>
                    </div>

                    <div class="project-progress-info">
                        <span>${completed} / ${total} 완료</span>
                        <span>${progress}%</span>
                    </div>
                </div>
                <div class="project-footer">
                    <span class="badge ${dday.c}">${dday.t}</span>
                    <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500;"><i class="far fa-calendar"></i> 목표: ${formatFriendlyDate(proj.due_date)}</span>
                </div>
            </div>`;
    });
}

async function updateProjectStatus(projId, status) {
    if (isProjectRequest) return;
    isProjectRequest = true;
    const buttons = document.querySelectorAll(
        ".btn-success, .btn-edit-item, .btn-delete-item"
    );
    buttons.forEach(btn => btn.disabled = true);
    UI.setGlobalLoading(true);
    try {
        const res = await AppAPI.updateProjectStatus(projId, status, AppAPI.getUser().user_id);
        if (!res.success) {
            throw new Error(res.message);
        }
        await loadAppData();
        UI.showToast(`프로젝트가 ${status} 처리되었습니다.`);
    } catch (e) {
        UI.showToast(e.message, "error");
    } finally {
        buttons.forEach(btn => btn.disabled = false);
        isProjectRequest = false;
        UI.setGlobalLoading(false);
    }
}

function deleteProject(projId) {
    UI.confirm('프로젝트 삭제', '이 프로젝트를 삭제하시겠습니까?<br>프로젝트와 관련된 모든 작업이 함께 삭제됩니다.', async () => {
        UI.setGlobalLoading(true);
        const res = await AppAPI.deleteProject(projId, AppAPI.getUser().user_id);
        if(res.success) {
            UI.showToast('프로젝트가 삭제되었습니다.');
            if (currentProjectId === projId) {
                currentProjectId = null;
                UI.switchPage('projects');
            }
            loadAppData();
        } else {
            UI.showToast(res.message, 'error');
        }
        UI.setGlobalLoading(false);
    });
}


function initProject() {
    document.getElementById("form-project").onsubmit = async (e) => {
        if (isProjectRequest) return;
        isProjectRequest = true;
        e.preventDefault();
        const submitBtn = document.getElementById("btn-submit-proj");
        const form = e.target;
        const mode = form.dataset.mode;
        const data = {
            title: document.getElementById("proj-title").value.trim(),
            description: document.getElementById("proj-desc").value.trim(),
            status: document.getElementById("proj-status").value,
            due_date: document.getElementById("proj-date").value,
            user_id: AppAPI.getUser().user_id
        };

        UI.lockButton(
            submitBtn,
            form.dataset.mode === "create"
                ? "생성 중..."
                : "저장 중..."
        );
        UI.setGlobalLoading(true);
        
        try {
            let res;
            if (mode === "create") {
                res = await AppAPI.addProject(data);
            } else {
                data.project_id = form.dataset.id;
                res = await AppAPI.updateProject(data);
            }
            if (!res.success) {
                throw new Error(res.message);
            }
            UI.closeModal("project-modal");
            await loadAppData();
            UI.showToast(
                mode === "create"
                    ? "프로젝트가 생성되었습니다."
                    : "프로젝트가 수정되었습니다."
            );
        } catch (err) {
            UI.showToast(err.message, "error");
        } finally {
            isProjectRequest = false;
            UI.unlockButton(submitBtn);
            UI.setGlobalLoading(false);
        }
    };
}

function renderProjectDetail(projId) {
    const container = document.getElementById('project-detail-container');
    if (!container) return;

    const proj = currentProjects.find(p => p.id === projId);
    if (!proj) {
        currentProjectId = null;
        UI.switchPage('projects');
        return;
    }

    const tasks = currentTasks.filter(t => t.project_id === proj.id);
    const completedCount = tasks.filter(t => t.status === 'Done').length;
    const totalCount = tasks.length;
    const progress = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

    const diff = proj.due_date ? Math.ceil((new Date(proj.due_date) - new Date().setHours(0,0,0,0)) / 86400000) : null;
    const dday = diff === null ? { t: '기한 없음', c: 'bg-default' } : (diff > 0 ? { t: `D-${diff}`, c: 'bg-info' } : (diff === 0 ? { t: 'D-Day', c: 'bg-warning' } : { t: `D+${Math.abs(diff)} 지연`, c: 'bg-danger' }));
    const statusColor = proj.status === '완료됨' ? 'bg-success' : (proj.status === '진행 중' ? 'bg-warning' : 'bg-default');

    const completeBtnHtml = proj.status !== '완료됨'
        ? `<button class="btn-success" onclick="confirmCompleteProject('${proj.id}')" title="프로젝트 완료 처리" style="padding: 0.5rem 0.9rem; font-size: 0.85rem;"><i class="fas fa-check"></i> 완료</button>`
        : ``;

    const editBtnHtml = proj.status !== '완료됨'
        ? `<button class="btn-secondary" onclick="openEditProjectModal('${proj.id}')" title="프로젝트 수정" style="padding: 0.5rem 0.9rem; font-size: 0.85rem;"><i class="fas fa-edit"></i> 수정</button>`
        : `<button class="btn-secondary" onclick="UI.showToast('완료 처리된 프로젝트는 수정할 수 없습니다.', 'warning')" title="수정 불가 (완료됨)" style="opacity: 0.4; cursor: not-allowed; padding: 0.5rem 0.9rem; font-size: 0.85rem;"><i class="fas fa-lock"></i> 수정 불가 (완료됨)</button>`;

    const deleteBtnHtml = `<button class="btn-secondary text-danger" onclick="deleteProject('${proj.id}')" title="프로젝트 삭제" style="padding: 0.5rem 0.9rem; font-size: 0.85rem;"><i class="fas fa-trash"></i> 삭제</button>`;

    let tasksHtml = '';
    if (tasks.length === 0) {
        tasksHtml = `
            <div class="empty-state" style="padding: 3.5rem 1.5rem;">
                <i class="fas fa-tasks" style="font-size: 2.5rem; opacity: 0.4;"></i>
                <h3>등록된 작업이 없습니다</h3>
                <p>이 프로젝트에 새로운 작업을 추가하여 목표를 달성해보세요.</p>
                <button class="btn-primary" style="margin-top: 0.75rem;" onclick="UI.openTaskModal('create', null, '${proj.id}')">
                    <i class="fas fa-plus"></i> 첫 번째 작업 추가
                </button>
            </div>`;
    } else {
        tasksHtml = `<div class="project-detail-tasks-list">`;
        tasks.forEach(task => {
            const taskDiff = getDueDateDiff(task.due_date);
            const isOverdue = task.status !== 'Done' && taskDiff !== null && taskDiff < 0;
            const isDueSoon = task.status !== 'Done' && taskDiff !== null && taskDiff >= 0 && taskDiff <= 3;
            const prioColor = task.priority === 'High' ? 'danger-color' : (task.priority === 'Medium' ? 'warning-color' : 'info-color');
            const prioKor = task.priority === 'High' ? '높음' : (task.priority === 'Medium' ? '보통' : '낮음');

            const editTaskBtnHtml = task.status !== 'Done'
                ? `<button class="btn-edit-item" onclick="openEditTaskModal('${task.id}')" title="수정"><i class="fas fa-edit"></i></button>`
                : `<button class="btn-edit-item" onclick="UI.showToast('완료된 작업은 수정할 수 없습니다.', 'warning')" title="수정 불가 (완료됨)" style="opacity:0.3; cursor:not-allowed;"><i class="fas fa-lock"></i></button>`;

            let overdueBadgeHtml = '';
            if (isOverdue) {
                overdueBadgeHtml = `<span class="badge bg-danger" style="font-size: 0.7rem;"><i class="fas fa-exclamation-circle"></i> 기한 초과</span>`;
            }

            let dateMetaHtml = '';
            if (task.status === 'Done') {
                dateMetaHtml = `<span style="font-size: 0.8rem; color: var(--success-color); font-weight: 500;"><i class="far fa-calendar-check"></i> ${formatFriendlyDate(task.due_date)} (완료)</span>`;
            } else if (isOverdue) {
                dateMetaHtml = `<span style="font-size: 0.8rem; color: var(--danger-color); font-weight: 600;"><i class="fas fa-triangle-exclamation"></i> ${formatFriendlyDate(task.due_date)} (D+${Math.abs(taskDiff)} 지연)</span>`;
            } else if (isDueSoon) {
                const dtext = taskDiff === 0 ? '오늘 마감' : `D-${taskDiff}`;
                dateMetaHtml = `<span style="font-size: 0.8rem; color: var(--warning-color); font-weight: 600;"><i class="far fa-clock"></i> ${formatFriendlyDate(task.due_date)} (${dtext})</span>`;
            } else {
                const dtext = taskDiff !== null ? ` (D-${taskDiff})` : '';
                dateMetaHtml = `<span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 500;"><i class="far fa-calendar-check"></i> ${formatFriendlyDate(task.due_date)}${dtext}</span>`;
            }

            tasksHtml += `
                <div class="project-detail-task-card search-target${isOverdue ? ' is-overdue' : ''}">
                    <div class="project-detail-task-main">
                        <div class="project-detail-task-info">
                            <div class="project-detail-task-badges">
                                <span style="font-size: 0.7rem; color: var(--${prioColor}); border: 1px solid var(--${prioColor}); border-radius: 4px; padding: 0.1rem 0.4rem; font-weight: 600;">${prioKor}</span>
                                ${overdueBadgeHtml}
                            </div>
                            <h4 class="search-text project-detail-task-title" style="${task.status === 'Done' ? 'text-decoration: line-through; color: var(--text-muted);' : ''}">${task.title}</h4>
                            ${task.description ? `<p class="search-text project-detail-task-desc">${task.description}</p>` : ''}
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.25rem;">
                            ${editTaskBtnHtml}
                            <button class="btn-delete-item" onclick="deleteTask('${task.id}')" title="작업 삭제">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>
                    <div class="project-detail-task-meta-row">
                        <div>
                            ${dateMetaHtml}
                        </div>
                        <div class="project-detail-task-status-control">
                            <span style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 500;"><i class="fas fa-arrows-rotate" style="color: var(--accent-color); font-size: 0.7rem;"></i> 상태:</span>
                            <select class="form-control" style="padding: 0.2rem 1.6rem 0.2rem 0.6rem; height: 30px; font-size: 0.775rem; width: auto; min-width: 95px; border-radius: var(--radius-md);" onchange="changeTaskStatus('${task.id}', this.value)">
                                <option value="To Do"${task.status === 'To Do' ? ' selected' : ''}>해야 할 일</option>
                                <option value="In Progress"${task.status === 'In Progress' ? ' selected' : ''}>진행 중</option>
                                <option value="Done"${task.status === 'Done' ? ' selected' : ''}>완료됨</option>
                            </select>
                        </div>
                    </div>
                </div>`;
        });
        tasksHtml += `</div>`;
    }

    container.innerHTML = `
        <div class="project-detail-nav">
            <button class="btn-secondary btn-back" onclick="closeProjectDetail()">
                <i class="fas fa-arrow-left"></i> 프로젝트 목록
            </button>
        </div>

        <div class="project-detail-header-card">
            <div class="project-detail-top">
                <div class="project-detail-title-area">
                    <div class="project-detail-meta-badges">
                        <span class="badge ${statusColor}">${proj.status}</span>
                        <span class="badge ${dday.c}">${dday.t}</span>
                    </div>
                    <h2 class="project-detail-title">${proj.title}</h2>
                    <div class="project-detail-due">
                        <i class="far fa-calendar"></i> 목표 마감일: ${formatFriendlyDate(proj.due_date)}
                    </div>
                </div>
                <div class="project-detail-actions">
                    ${completeBtnHtml}
                    ${editBtnHtml}
                    ${deleteBtnHtml}
                </div>
            </div>
            <div class="project-detail-desc">${proj.description || '등록된 설명이 없습니다.'}</div>
        </div>

        <div class="project-detail-progress-card">
            <div class="project-detail-progress-header">
                <span><i class="fas fa-chart-line" style="color: var(--accent-color); margin-right: 0.4rem;"></i> 작업 진행률</span>
                <span style="color: var(--accent-color); font-weight: 700;">${progress}% (${completedCount} / ${totalCount} 완료)</span>
            </div>
            <div class="progress-container" style="height: 8px;">
                <div class="progress-bar" style="width: ${progress}%;"></div>
            </div>
        </div>

        <div class="project-detail-tasks-section">
            <div class="project-detail-tasks-header">
                <h3>
                    <i class="fas fa-tasks" style="color: var(--accent-color);"></i> 소속 작업 목록
                    <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: normal; margin-left: 0.5rem;">(${totalCount}개)</span>
                </h3>
                <button class="btn-primary" onclick="UI.openTaskModal('create', null, '${proj.id}')">
                    <i class="fas fa-plus"></i> 작업 추가
                </button>
            </div>
            ${tasksHtml}
        </div>
    `;
}

window.renderProjectDetail = renderProjectDetail;