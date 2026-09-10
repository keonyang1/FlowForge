// js/task.js

let isTaskRequest = false;
let currentDetailTaskId = null;

window.openEditTaskModal = function(id) { UI.openTaskModal('edit', id); };

function openTaskDetail(taskId) {
    const task = currentTasks.find(t => t.id === taskId);
    if (!task) return;

    currentDetailTaskId = taskId;
    renderTaskDetailContent(task);
    UI.openModal('task-detail-modal');
}

function closeTaskDetail() {
    currentDetailTaskId = null;
    UI.closeModal('task-detail-modal');
}

function renderTaskDetailContent(task) {
    const body = document.getElementById('task-detail-body');
    const footer = document.getElementById('task-detail-footer');
    if (!body || !footer) return;

    const proj = task.project_id ? currentProjects.find(p => p.id === task.project_id) : null;
    const projName = proj ? proj.title : (task.project_id ? '삭제된 프로젝트' : '독립 작업');

    const prioColor = task.priority === 'High' ? 'danger-color' : (task.priority === 'Medium' ? 'warning-color' : 'info-color');
    const prioKor = task.priority === 'High' ? '높음' : (task.priority === 'Medium' ? '보통' : '낮음');

    const diff = getDueDateDiff(task.due_date);
    const isOverdue = task.status !== 'Done' && diff !== null && diff < 0;
    const isDueSoon = task.status !== 'Done' && diff !== null && diff >= 0 && diff <= 3;

    let dueBadgeHtml = '';
    if (task.status === 'Done') {
        dueBadgeHtml = `<span class="badge bg-success" style="font-size: 0.75rem;"><i class="far fa-calendar-check"></i> 완료</span>`;
    } else if (isOverdue) {
        dueBadgeHtml = `<span class="badge bg-danger" style="font-size: 0.75rem;"><i class="fas fa-exclamation-circle"></i> 기한 초과 (D+${Math.abs(diff)} 지연)</span>`;
    } else if (isDueSoon) {
        dueBadgeHtml = `<span class="badge bg-warning" style="font-size: 0.75rem;"><i class="far fa-clock"></i> ${diff === 0 ? '오늘 마감' : 'D-' + diff}</span>`;
    } else if (diff !== null) {
        dueBadgeHtml = `<span class="badge bg-info" style="font-size: 0.75rem;"><i class="far fa-clock"></i> D-${diff}</span>`;
    } else {
        dueBadgeHtml = `<span class="badge bg-default" style="font-size: 0.75rem;">기한 없음</span>`;
    }

    const dueDateText = task.due_date ? `${formatFriendlyDate(task.due_date)} (${getFormatDate(task.due_date)})` : '기한 없음';

    let projHtml = '';
    if (proj) {
        projHtml = `<button type="button" class="task-detail-project-btn" onclick="navigateToProjectFromTaskDetail('${proj.id}')" title="프로젝트 상세 페이지로 이동">
            <i class="fas fa-folder-open"></i>
            <span>${proj.title}</span>
            <i class="fas fa-arrow-right" style="font-size: 0.7rem; opacity: 0.7;"></i>
        </button>`;
    } else {
        projHtml = `<span style="color: var(--text-muted); font-size: 0.85rem;">${projName}</span>`;
    }

    const createdMetaHtml = task.created_at ? `
        <div class="task-detail-meta-item">
            <span class="task-detail-meta-label"><i class="far fa-calendar-plus"></i> 등록일</span>
            <div class="task-detail-meta-val"><span style="color: var(--text-muted); font-size: 0.8rem;">${task.created_at}</span></div>
        </div>` : '';

    body.innerHTML = `
        <h3 class="task-detail-title${task.status === 'Done' ? ' is-done' : ''}">${task.title}</h3>

        <div class="task-detail-meta-grid">
            <div class="task-detail-meta-item">
                <span class="task-detail-meta-label"><i class="fas fa-folder"></i> 소속 프로젝트</span>
                <div class="task-detail-meta-val">${projHtml}</div>
            </div>

            <div class="task-detail-meta-item">
                <span class="task-detail-meta-label"><i class="fas fa-arrows-rotate"></i> 상태</span>
                <div class="task-detail-meta-val">
                    <select class="form-control task-detail-status-select" onchange="changeTaskStatusFromDetail('${task.id}', this.value)">
                        <option value="To Do"${task.status === 'To Do' ? ' selected' : ''}>해야 할 일</option>
                        <option value="In Progress"${task.status === 'In Progress' ? ' selected' : ''}>진행 중</option>
                        <option value="Done"${task.status === 'Done' ? ' selected' : ''}>완료됨</option>
                    </select>
                </div>
            </div>

            <div class="task-detail-meta-item">
                <span class="task-detail-meta-label"><i class="fas fa-flag"></i> 중요도</span>
                <div class="task-detail-meta-val">
                    <span style="font-size: 0.8rem; color: var(--${prioColor}); border: 1px solid var(--${prioColor}); border-radius: 4px; padding: 0.15rem 0.55rem; font-weight: 600;">${prioKor}</span>
                </div>
            </div>

            <div class="task-detail-meta-item">
                <span class="task-detail-meta-label"><i class="far fa-calendar-check"></i> 마감일</span>
                <div class="task-detail-meta-val">
                    <span style="font-size: 0.85rem;">${dueDateText}</span>
                    ${dueBadgeHtml}
                </div>
            </div>

            ${createdMetaHtml}
        </div>

        <div class="task-detail-desc-label"><i class="fas fa-align-left"></i> 작업 설명</div>
        <div class="task-detail-desc-box">${task.description ? task.description : '<span style="color: var(--text-muted); font-style: italic;">설명이 없습니다.</span>'}</div>
        <div id="task-detail-dependency-container" class="task-dependency-section"></div>
        <div id="task-detail-checklist-container" class="task-checklist-section"></div>
    `;

    renderTaskDependencies(task.id);
    renderTaskChecklist(task.id);

    const editBtnHtml = task.status !== 'Done'
        ? `<button type="button" class="btn-secondary" onclick="editTaskFromDetail('${task.id}')"><i class="fas fa-edit"></i> 수정</button>`
        : `<button type="button" class="btn-secondary" onclick="UI.showToast('완료된 작업은 수정할 수 없습니다.', 'warning')" title="수정 불가 (완료됨)" style="opacity: 0.4; cursor: not-allowed;"><i class="fas fa-lock"></i> 수정 불가</button>`;

    footer.innerHTML = `
        <button type="button" class="btn-secondary text-danger" onclick="deleteTaskFromDetail('${task.id}')"><i class="fas fa-trash"></i> 삭제</button>
        <div class="task-detail-footer-right">
            ${editBtnHtml}
            <button type="button" class="btn-primary" onclick="closeTaskDetail()">닫기</button>
        </div>
    `;
}

let isAddingChecklist = false;
const updatingChecklistItems = new Set();

function renderTaskChecklist(taskId) {
    const container = document.getElementById('task-detail-checklist-container');
    if (!container) return;

    const items = typeof getTaskChecklist === 'function' ? getTaskChecklist(taskId) : [];
    const stats = typeof getTaskChecklistStats === 'function' ? getTaskChecklistStats(taskId) : { total: 0, completed: 0, percent: 0 };
    const isAllDone = stats.total > 0 && stats.completed === stats.total;

    let itemsHtml = '';
    if (items.length === 0) {
        itemsHtml = `<div class="task-checklist-empty"><i class="far fa-clipboard"></i> 등록된 세부 작업이 없습니다. 아래에서 추가해보세요.</div>`;
    } else {
        itemsHtml = `<ul class="task-checklist-list">` + items.map(item => {
            const escapedText = typeof escapeHtml === 'function' ? escapeHtml(item.text) : (item.text || '');
            return `
                <li class="task-checklist-item${item.is_completed ? ' is-completed' : ''}" id="checklist-item-${item.id}">
                    <button type="button" class="task-checklist-check-btn${item.is_completed ? ' is-completed' : ''}" onclick="toggleChecklistItem('${taskId}', '${item.id}')" title="${item.is_completed ? '미완료로 표시' : '완료로 표시'}" aria-label="체크박스">
                        <span class="task-checklist-custom-checkbox"><i class="fas fa-check"></i></span>
                    </button>
                    <div class="task-checklist-item-content" id="checklist-text-wrap-${item.id}">
                        <span class="task-checklist-item-text${item.is_completed ? ' is-completed' : ''}" onclick="toggleChecklistItem('${taskId}', '${item.id}')" title="클릭하여 상태 변경">${escapedText}</span>
                    </div>
                    <div class="task-checklist-item-actions">
                        <button type="button" class="btn-icon-subtle" onclick="startEditChecklistItem('${taskId}', '${item.id}')" title="세부 작업 수정">
                            <i class="fas fa-pen"></i>
                        </button>
                        <button type="button" class="btn-icon-subtle btn-delete-checklist" onclick="deleteChecklistItem('${taskId}', '${item.id}')" title="세부 작업 삭제">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </li>
            `;
        }).join('') + `</ul>`;
    }

    container.innerHTML = `
        <div class="task-checklist-header">
            <div class="task-checklist-title-wrap">
                <span class="task-checklist-title"><i class="fas fa-list-check"></i> 체크리스트</span>
                <span class="task-checklist-stats-badge${isAllDone ? ' is-completed' : ''}">
                    ${stats.completed} / ${stats.total} 완료 (${stats.percent}%)
                </span>
            </div>
            <div class="task-checklist-progress-bar-bg">
                <div class="task-checklist-progress-bar-fill" style="width: ${stats.percent}%;"></div>
            </div>
        </div>
        ${itemsHtml}
        <div class="task-checklist-add-wrap">
            <div class="task-checklist-add-input-group">
                <input type="text" id="checklist-new-input-${taskId}" class="form-control task-checklist-add-input" placeholder="세부 작업 추가... (Enter로 등록)" maxlength="150" onkeydown="if(event.key === 'Enter'){ if(event.isComposing) return; event.preventDefault(); addChecklistItem('${taskId}'); }">
                <button type="button" id="btn-add-checklist-${taskId}" class="btn-primary task-checklist-add-btn" onclick="addChecklistItem('${taskId}')">
                    <i class="fas fa-plus"></i> 추가
                </button>
            </div>
        </div>
    `;
}

function updateChecklistView(taskId) {
    renderTaskChecklist(taskId);
    renderTasks();
    if (typeof currentProjectId !== 'undefined' && currentProjectId && typeof renderProjectDetail === 'function') {
        renderProjectDetail(currentProjectId);
    }
    if (typeof renderCalendar === 'function') {
        renderCalendar();
    }
}

async function toggleChecklistItem(taskId, itemId) {
    if (typeof currentChecklists === 'undefined') return;
    if (updatingChecklistItems.has(itemId)) return;

    const item = currentChecklists.find(c => c.id === itemId);
    if (!item) return;

    updatingChecklistItems.add(itemId);
    const prevStatus = item.is_completed;
    const nextStatus = !prevStatus;

    // 낙관적 UI 업데이트
    item.is_completed = nextStatus;
    updateChecklistView(taskId);

    const user = typeof AppAPI !== 'undefined' && AppAPI.getUser ? AppAPI.getUser() : null;
    const userId = user ? user.user_id : '';

    try {
        if (typeof AppAPI !== 'undefined' && AppAPI.updateChecklistItem && userId) {
            const res = await AppAPI.updateChecklistItem(itemId, { is_completed: nextStatus }, userId);
            if (!res || res.success === false) {
                throw new Error(res ? res.message : '상태 저장 실패');
            }
            try {
                localStorage.setItem(`flowforge_checklists_${userId}`, JSON.stringify(currentChecklists));
            } catch (e) {}
        }
    } catch (err) {
        console.error('Failed to toggle checklist item:', err);
        // 실패 시 이전 상태로 안전하게 롤백
        item.is_completed = prevStatus;
        updateChecklistView(taskId);
        UI.showToast('체크리스트 상태 저장에 실패했습니다.', 'error');
    } finally {
        updatingChecklistItems.delete(itemId);
    }
}

async function addChecklistItem(taskId) {
    if (isAddingChecklist) return;

    const input = document.getElementById(`checklist-new-input-${taskId}`);
    const btn = document.getElementById(`btn-add-checklist-${taskId}`);
    const text = input ? input.value.trim() : '';

    if (!text) {
        UI.showToast('세부 작업 내용을 입력해주세요.', 'warning');
        if (input) input.focus();
        return;
    }

    isAddingChecklist = true;
    if (btn) btn.disabled = true;
    if (input) input.disabled = true;

    const user = typeof AppAPI !== 'undefined' && AppAPI.getUser ? AppAPI.getUser() : null;
    const userId = user ? user.user_id : '';

    try {
        if (typeof AppAPI !== 'undefined' && AppAPI.addChecklistItem && userId) {
            const res = await AppAPI.addChecklistItem(taskId, text, userId);
            if (!res || res.success === false) {
                throw new Error(res ? res.message : '체크리스트 추가 실패');
            }

            const createdItem = res.checklist || res.item;
            if (createdItem) {
                if (typeof currentChecklists === 'undefined') {
                    currentChecklists = [];
                }
                if (!currentChecklists.some(c => c.id === createdItem.id)) {
                    currentChecklists.push(createdItem);
                }
                try {
                    localStorage.setItem(`flowforge_checklists_${userId}`, JSON.stringify(currentChecklists));
                } catch (e) {}
            }
            updateChecklistView(taskId);
        }
    } catch (err) {
        console.error('Failed to add checklist item:', err);
        UI.showToast(err.message || '체크리스트 추가 중 오류가 발생했습니다.', 'error');
    } finally {
        isAddingChecklist = false;
        const nextInput = document.getElementById(`checklist-new-input-${taskId}`);
        const nextBtn = document.getElementById(`btn-add-checklist-${taskId}`);
        if (nextBtn) nextBtn.disabled = false;
        if (nextInput) {
            nextInput.disabled = false;
            nextInput.value = '';
            nextInput.focus();
        }
    }
}

function startEditChecklistItem(taskId, itemId) {
    if (typeof currentChecklists === 'undefined') return;
    const item = currentChecklists.find(c => c.id === itemId);
    const wrap = document.getElementById(`checklist-text-wrap-${itemId}`);
    if (!item || !wrap) return;

    const escapedText = typeof escapeHtml === 'function' ? escapeHtml(item.text) : (item.text || '');
    wrap.innerHTML = `
        <div class="task-checklist-inline-edit">
            <input type="text" id="checklist-edit-input-${itemId}" class="form-control task-checklist-inline-input" value="${escapedText}" maxlength="150" onkeydown="handleChecklistEditKey(event, '${taskId}', '${itemId}')">
            <div class="task-checklist-inline-edit-btns">
                <button type="button" class="btn-icon-save" onclick="saveEditChecklistItem('${taskId}', '${itemId}')" title="저장"><i class="fas fa-check"></i></button>
                <button type="button" class="btn-icon-cancel" onclick="renderTaskChecklist('${taskId}')" title="취소"><i class="fas fa-times"></i></button>
            </div>
        </div>
    `;

    const editInput = document.getElementById(`checklist-edit-input-${itemId}`);
    if (editInput) {
        editInput.focus();
        editInput.select();
    }
}

function handleChecklistEditKey(event, taskId, itemId) {
    if (event.key === 'Enter') {
        if (event.isComposing) return;
        event.preventDefault();
        saveEditChecklistItem(taskId, itemId);
    } else if (event.key === 'Escape') {
        event.preventDefault();
        renderTaskChecklist(taskId);
    }
}

async function saveEditChecklistItem(taskId, itemId) {
    const input = document.getElementById(`checklist-edit-input-${itemId}`);
    const text = input ? input.value.trim() : '';
    if (!text) {
        UI.showToast('세부 작업 내용을 입력해주세요.', 'warning');
        if (input) input.focus();
        return;
    }

    if (typeof currentChecklists === 'undefined') return;
    const item = currentChecklists.find(c => c.id === itemId);
    if (!item) return;

    const prevText = item.text;
    item.text = text;
    updateChecklistView(taskId);

    const user = typeof AppAPI !== 'undefined' && AppAPI.getUser ? AppAPI.getUser() : null;
    const userId = user ? user.user_id : '';

    try {
        if (typeof AppAPI !== 'undefined' && AppAPI.updateChecklistItem && userId) {
            const res = await AppAPI.updateChecklistItem(itemId, { text: text }, userId);
            if (!res || res.success === false) {
                throw new Error(res ? res.message : '수정 실패');
            }
            try {
                localStorage.setItem(`flowforge_checklists_${userId}`, JSON.stringify(currentChecklists));
            } catch (e) {}
        }
    } catch (err) {
        console.error('Failed to update checklist item text:', err);
        item.text = prevText;
        updateChecklistView(taskId);
        UI.showToast('체크리스트 수정 중 오류가 발생했습니다.', 'error');
    }
}

async function deleteChecklistItem(taskId, itemId) {
    if (typeof currentChecklists === 'undefined') return;
    const idx = currentChecklists.findIndex(c => c.id === itemId);
    if (idx === -1) return;

    const deletedItem = currentChecklists[idx];
    currentChecklists.splice(idx, 1);
    updateChecklistView(taskId);

    const user = typeof AppAPI !== 'undefined' && AppAPI.getUser ? AppAPI.getUser() : null;
    const userId = user ? user.user_id : '';

    try {
        if (typeof AppAPI !== 'undefined' && AppAPI.deleteChecklistItem && userId) {
            const res = await AppAPI.deleteChecklistItem(itemId, userId);
            if (!res || res.success === false) {
                throw new Error(res ? res.message : '삭제 실패');
            }
            try {
                localStorage.setItem(`flowforge_checklists_${userId}`, JSON.stringify(currentChecklists));
            } catch (e) {}
        }
    } catch (err) {
        console.error('Failed to delete checklist item:', err);
        currentChecklists.splice(idx, 0, deletedItem);
        updateChecklistView(taskId);
        UI.showToast('체크리스트 삭제 중 오류가 발생했습니다.', 'error');
    }
}

function navigateToProjectFromTaskDetail(projectId) {
    closeTaskDetail();
    if (typeof openProjectDetail === 'function') {
        openProjectDetail(projectId);
    }
}

async function changeTaskStatusFromDetail(taskId, newStatus) {
    await changeTaskStatus(taskId, newStatus);
}

function editTaskFromDetail(taskId) {
    closeTaskDetail();
    openEditTaskModal(taskId);
}

function deleteTaskFromDetail(taskId) {
    closeTaskDetail();
    deleteTask(taskId);
}

window.openTaskDetail = openTaskDetail;
window.closeTaskDetail = closeTaskDetail;
window.renderTaskDetailContent = renderTaskDetailContent;
window.renderTaskChecklist = renderTaskChecklist;
window.toggleChecklistItem = toggleChecklistItem;
window.addChecklistItem = addChecklistItem;
window.startEditChecklistItem = startEditChecklistItem;
window.handleChecklistEditKey = handleChecklistEditKey;
window.saveEditChecklistItem = saveEditChecklistItem;
window.deleteChecklistItem = deleteChecklistItem;
window.navigateToProjectFromTaskDetail = navigateToProjectFromTaskDetail;
window.changeTaskStatusFromDetail = changeTaskStatusFromDetail;
window.editTaskFromDetail = editTaskFromDetail;
window.deleteTaskFromDetail = deleteTaskFromDetail;

// 작업 상태 변경을 위한 낙관적 업데이트(Optimistic UI) 및 버전 카운터
const taskStatusVersions = {};
const taskPendingRequests = {};
const taskOriginalStatus = {};

function syncTaskRelatedViews(task) {
    renderTasks();
    if (typeof renderProjects === 'function') renderProjects();
    if (typeof currentProjectId !== 'undefined' && currentProjectId && typeof renderProjectDetail === 'function') {
        renderProjectDetail(currentProjectId);
    }
    if (typeof currentDetailTaskId !== 'undefined' && task && currentDetailTaskId === task.id) {
        renderTaskDetailContent(task);
    }
    if (typeof renderDashboard === 'function') renderDashboard();
    if (typeof renderAnalytics === 'function') renderAnalytics();
    if (typeof renderCalendar === 'function') renderCalendar();
}

async function changeTaskStatus(taskId, newStatus) {
    const task = currentTasks.find(t => t.id === taskId);
    if (!task || task.status === newStatus) return;

    // 작업별 버전 카운터 및 연속 요청 추적
    if (!taskStatusVersions[taskId]) taskStatusVersions[taskId] = 0;
    const reqVersion = ++taskStatusVersions[taskId];

    if (!taskPendingRequests[taskId] || taskPendingRequests[taskId] <= 0) {
        taskPendingRequests[taskId] = 0;
        taskOriginalStatus[taskId] = task.status;
    }
    taskPendingRequests[taskId]++;

    const targetStatus = newStatus;
    task.status = targetStatus;

    // 즉시 화면 반영 (전체 화면 로딩 없음)
    syncTaskRelatedViews(task);

    const user = typeof AppAPI !== 'undefined' ? AppAPI.getUser() : null;
    if (!user) {
        taskPendingRequests[taskId]--;
        if (taskPendingRequests[taskId] <= 0) {
            task.status = taskOriginalStatus[taskId];
            delete taskOriginalStatus[taskId];
            delete taskPendingRequests[taskId];
            syncTaskRelatedViews(task);
        }
        UI.showToast('로그인이 필요합니다.', 'error');
        return;
    }

    try {
        const res = await AppAPI.updateTaskStatus(
            taskId,
            targetStatus,
            user.user_id
        );
        if (!res || !res.success) {
            throw new Error((res && res.message) || '상태 변경에 실패했습니다.');
        }
        // 가장 최신 변경 요청인 경우에만 성공 토스트 표시
        if (taskStatusVersions[taskId] === reqVersion) {
            const statusLabels = { 'To Do': '해야 할 일', 'In Progress': '진행 중', 'Done': '완료됨' };
            UI.showToast(`작업 상태가 변경되었습니다: ${statusLabels[targetStatus] || targetStatus}`);
        }
    } catch (err) {
        // 가장 최신 변경 요청인 경우에만 롤백 실행 및 오류 안내
        if (taskStatusVersions[taskId] === reqVersion) {
            task.status = taskOriginalStatus[taskId];
            syncTaskRelatedViews(task);
            UI.showToast(err.message || '상태 변경에 실패했습니다.', 'error');
        }
    } finally {
        taskPendingRequests[taskId]--;
        if (taskPendingRequests[taskId] <= 0) {
            delete taskPendingRequests[taskId];
            delete taskOriginalStatus[taskId];
        }
    }
}

window.changeTaskStatus = changeTaskStatus;

function updateTaskProjectFilterOptions() {
    const select = document.getElementById('task-filter-project');
    if (!select) return;
    const currentVal = select.value || 'all';

    const existingOptions = Array.from(select.options).map(o => o.value);
    const expectedOptions = ['all', ...currentProjects.map(p => p.id)];
    const isSame = existingOptions.length === expectedOptions.length &&
                   existingOptions.every((val, idx) => val === expectedOptions[idx]);

    if (!isSame) {
        select.innerHTML = '<option value="all">전체</option>';
        currentProjects.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.title;
            select.appendChild(opt);
        });

        if (currentVal !== 'all' && currentProjects.some(p => p.id === currentVal)) {
            select.value = currentVal;
        } else {
            select.value = 'all';
        }
    }
}

function resetTaskFilters() {
    const filterStatus = document.getElementById("task-filter-status");
    const filterPriority = document.getElementById("task-filter-priority");
    const filterProject = document.getElementById("task-filter-project");
    const filterDue = document.getElementById("task-filter-due");
    const sortSelect = document.getElementById("task-sort");

    if (filterStatus) filterStatus.value = "all";
    if (filterPriority) filterPriority.value = "all";
    if (filterProject) filterProject.value = "all";
    if (filterDue) filterDue.value = "all";
    if (sortSelect) sortSelect.value = "default";
}

function renderTasks() {
    updateTaskProjectFilterOptions();

    const statusFilter = document.getElementById('task-filter-status')?.value || 'all';
    const priorityFilter = document.getElementById('task-filter-priority')?.value || 'all';
    const projectFilter = document.getElementById('task-filter-project')?.value || 'all';
    const dueFilter = document.getElementById('task-filter-due')?.value || 'all';
    const sortFilter = document.getElementById('task-sort')?.value || 'default';
    const searchQuery = (document.getElementById('global-search')?.value || '').trim().toLowerCase();

    const cols = {
        'To Do': document.getElementById('col-todo'),
        'In Progress': document.getElementById('col-inprogress'),
        'Done': document.getElementById('col-done')
    };
    const counts = { 'To Do': 0, 'In Progress': 0, 'Done': 0 };
    
    Object.values(cols).forEach(col => { if (col) col.innerHTML = ''; });

    // 1. 필터링
    const filteredTasks = currentTasks.filter(task => {
        // 상태 필터
        if (statusFilter !== 'all' && task.status !== statusFilter) {
            return false;
        }

        // 중요도 필터
        if (priorityFilter !== 'all' && task.priority !== priorityFilter) {
            return false;
        }

        // 프로젝트 필터
        if (projectFilter !== 'all' && task.project_id !== projectFilter) {
            return false;
        }

        // 마감 상태 필터
        const diff = getDueDateDiff(task.due_date);
        if (dueFilter !== 'all') {
            if (dueFilter === 'due_soon') {
                if (task.status === 'Done' || diff === null || diff < 0 || diff > 3) {
                    return false;
                }
            } else if (dueFilter === 'overdue') {
                if (task.status === 'Done' || diff === null || diff >= 0) {
                    return false;
                }
            } else if (dueFilter === 'completed') {
                if (task.status !== 'Done') {
                    return false;
                }
            }
        }

        // 검색어 필터 (검색 + 필터 + 정렬 동시 적용)
        if (searchQuery) {
            const projName = task.project_id ? (currentProjects.find(p => p.id === task.project_id)?.title || '') : '독립 작업';
            const searchableText = `${task.title} ${task.description || ''} ${projName}`.toLowerCase();
            if (!searchableText.includes(searchQuery)) {
                return false;
            }
        }

        return true;
    });

    // 2. 정렬
    const sortedTasks = [...filteredTasks].sort((a, b) => {
        if (sortFilter === 'due_date') {
            if (!a.due_date && !b.due_date) return 0;
            if (!a.due_date) return 1;
            if (!b.due_date) return -1;
            return new Date(a.due_date) - new Date(b.due_date);
        } else if (sortFilter === 'priority') {
            const prioOrder = { 'High': 1, 'Medium': 2, 'Low': 3 };
            const pa = prioOrder[a.priority] || 4;
            const pb = prioOrder[b.priority] || 4;
            return pa - pb;
        } else if (sortFilter === 'created_at') {
            if (a.created_at && b.created_at) {
                const diff = new Date(b.created_at) - new Date(a.created_at);
                if (!isNaN(diff) && diff !== 0) return diff;
            }
            return String(b.id || '').localeCompare(String(a.id || ''), undefined, { numeric: true });
        } else if (sortFilter === 'title') {
            return (a.title || '').localeCompare(b.title || '', 'ko');
        }
        return 0;
    });

    // 3. 카드 렌더링
    sortedTasks.forEach(task => {
        const status = cols[task.status] ? task.status : "To Do";
        const col = cols[status];
        if (!col) return;
        counts[status]++;
                
        const projName = task.project_id ? (currentProjects.find(p => p.id === task.project_id)?.title || '삭제된 프로젝트') : '독립 작업';
        const prioColor = task.priority === 'High' ? 'danger-color' : (task.priority === 'Medium' ? 'warning-color' : 'info-color');
        const prioKor = task.priority === 'High' ? '높음' : (task.priority === 'Medium' ? '보통' : '낮음');
        
        const diff = getDueDateDiff(task.due_date);
        const isOverdue = task.status !== 'Done' && diff !== null && diff < 0;
        const isDueSoon = task.status !== 'Done' && diff !== null && diff >= 0 && diff <= 3;

        const card = document.createElement('div');
        card.className = `task-card search-target${isOverdue ? ' is-overdue' : ''}`;
        card.draggable = true;
        card.dataset.id = task.id;
        
        let overdueBadgeHtml = '';
        if (isOverdue) {
            overdueBadgeHtml = `<span class="badge bg-danger" style="font-size: 0.7rem;"><i class="fas fa-exclamation-circle"></i> 기한 초과</span>`;
        }

        let dateMetaHtml = '';
        if (task.status === 'Done') {
            dateMetaHtml = `<span style="font-weight: 500; color: var(--success-color);"><i class="far fa-calendar-check"></i> ${formatFriendlyDate(task.due_date)}</span>`;
        } else if (isOverdue) {
            dateMetaHtml = `<span style="font-weight: 600; color: var(--danger-color);"><i class="fas fa-triangle-exclamation"></i> ${formatFriendlyDate(task.due_date)} (D+${Math.abs(diff)} 지연)</span>`;
        } else if (isDueSoon) {
            const dtext = diff === 0 ? '오늘 마감' : `D-${diff}`;
            dateMetaHtml = `<span style="font-weight: 600; color: var(--warning-color);"><i class="far fa-clock"></i> ${formatFriendlyDate(task.due_date)} (${dtext})</span>`;
        } else {
            const dtext = diff !== null ? ` (D-${diff})` : '';
            dateMetaHtml = `<span style="font-weight: 500;"><i class="far fa-calendar-check"></i> ${formatFriendlyDate(task.due_date)}${dtext}</span>`;
        }

        // 선행 작업(의존성) 통계 및 뱃지
        const taskDeps = (typeof currentDependencies !== 'undefined' && Array.isArray(currentDependencies))
            ? currentDependencies.filter(d => d.task_id === task.id)
            : [];
        let depBadgeHtml = '';
        if (taskDeps.length > 0) {
            const preds = taskDeps.map(d => currentTasks.find(t => t.id === d.depends_on_task_id)).filter(Boolean);
            const allDone = preds.length > 0 && preds.every(p => p.status === 'Done');
            const uncompletedCount = preds.filter(p => p.status !== 'Done').length;
            const depTitle = allDone
                ? `선행 작업 ${taskDeps.length}개 모두 완료됨`
                : `선행 작업 ${taskDeps.length}개 중 ${uncompletedCount}개 미완료`;
            depBadgeHtml = `<span class="task-card-dep-badge${allDone ? ' is-satisfied' : ' is-pending'}" title="${depTitle}"><i class="fas fa-link"></i> 선행 ${taskDeps.length}</span>`;
        }

        // 체크리스트 통계 및 뱃지
        const chkStats = typeof getTaskChecklistStats === 'function' ? getTaskChecklistStats(task.id) : { total: 0, completed: 0, percent: 0 };
        let checklistBadgeHtml = '';
        if (chkStats.total > 0) {
            const isAllDone = chkStats.completed === chkStats.total;
            checklistBadgeHtml = `<span class="task-card-checklist-badge${isAllDone ? ' is-completed' : ''}" title="체크리스트 ${chkStats.completed}/${chkStats.total} 완료 (${chkStats.percent}%)"><i class="fas fa-list-check"></i> ${chkStats.completed}/${chkStats.total}</span>`;
        }
            
        card.innerHTML = `
            <div class="task-actions">
                <button class="btn-delete-item" onclick="event.stopPropagation(); deleteTask('${task.id}')" onpointerdown="event.stopPropagation()" ontouchstart="event.stopPropagation()" title="삭제">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div style="margin-bottom: 0.75rem; display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">
                <span class="badge bg-default search-text" style="font-size: 0.7rem; max-width: 120px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${projName}">${projName}</span>
                <span style="font-size: 0.7rem; color: var(--${prioColor}); border: 1px solid var(--${prioColor}); border-radius: 4px; padding: 0.1rem 0.4rem; font-weight: 600;">${prioKor}</span>
                ${overdueBadgeHtml}
            </div>
            <h4 class="search-text" style="${task.status === 'Done' ? 'text-decoration: line-through; color: var(--text-muted);' : ''}" title="${task.title}">${task.title}</h4>
            <p class="task-desc search-text" title="${task.description || ''}">${task.description || '설명이 없습니다.'}</p>
            <div class="task-meta">
                ${dateMetaHtml}
                <div style="display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap;">
                    ${depBadgeHtml}
                    ${checklistBadgeHtml}
                </div>
            </div>
            <div class="task-mobile-status" onpointerdown="event.stopPropagation()" ontouchstart="event.stopPropagation()" onclick="event.stopPropagation()">
                <label class="task-status-label" for="task-status-select-${task.id}"><i class="fas fa-arrows-rotate"></i> 상태</label>
                <select class="form-control task-status-select" id="task-status-select-${task.id}" onchange="changeTaskStatus('${task.id}', this.value)">
                    <option value="To Do"${task.status === 'To Do' ? ' selected' : ''}>해야 할 일</option>
                    <option value="In Progress"${task.status === 'In Progress' ? ' selected' : ''}>진행 중</option>
                    <option value="Done"${task.status === 'Done' ? ' selected' : ''}>완료됨</option>
                </select>
            </div>`;

        let isDraggingCard = false;
        card.addEventListener('dragstart', (e) => {
            if (window.innerWidth <= 768) {
                e.preventDefault();
                return false;
            }
            isDraggingCard = true;
            card.classList.add('dragging');
            e.dataTransfer.setData('text/plain', task.id);
        });
        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
            setTimeout(() => {
                isDraggingCard = false;
            }, 150);
        });
        card.addEventListener('click', (e) => {
            if (isDraggingCard || isMobileSwiping) return;
            openTaskDetail(task.id);
        });
        col.appendChild(card);
    });

    const isFilterActive = statusFilter !== 'all' || priorityFilter !== 'all' || projectFilter !== 'all' || dueFilter !== 'all' || Boolean(searchQuery);

    Object.keys(cols).forEach(status => {
        if (!cols[status]) return;
        if (counts[status] === 0) {
            const emptyMsg = isFilterActive ? '조건에 맞는 작업 없음' : '비어 있음';
            const emptySub = isFilterActive ? '필터 조건을 변경해보세요' : '여기로 작업을 드래그하세요';
            cols[status].innerHTML = `<div style="border: 2px dashed var(--border-color); border-radius: var(--radius-md); padding: 2.5rem 1rem; text-align: center; color: var(--text-muted); font-size: 0.85rem; display: flex; flex-direction: column; align-items: center; gap: 0.75rem;"><i class="fas fa-inbox" style="font-size: 1.75rem; opacity: 0.4;"></i>${emptyMsg}<br><span style="font-size: 0.75rem; opacity: 0.7;">${emptySub}</span></div>`;
        }
    });

    const countTodo = document.getElementById('count-todo');
    const countInprogress = document.getElementById('count-inprogress');
    const countDone = document.getElementById('count-done');

    if (countTodo) countTodo.textContent = counts['To Do'];
    if (countInprogress) countInprogress.textContent = counts['In Progress'];
    if (countDone) countDone.textContent = counts['Done'];

    updateMobileKanbanUI();
}

function deleteTask(taskId) {
    UI.confirm('작업 삭제', '이 작업을 삭제하시겠습니까?<br>삭제된 작업은 복구할 수 없습니다.', async () => {
        UI.setGlobalLoading(true);
        try {
            const res = await AppAPI.deleteTask(taskId, AppAPI.getUser().user_id);
            if(res.success) {
                // 체크리스트 메모리 및 로컬 캐시 정리
                if (typeof currentChecklists !== 'undefined') {
                    currentChecklists = currentChecklists.filter(c => c.task_id !== taskId);
                    const user = AppAPI.getUser();
                    if (user && user.user_id) {
                        try {
                            localStorage.setItem("flowforge_checklists_" + user.user_id, JSON.stringify(currentChecklists));
                        } catch (e) {}
                    }
                }
                // 의존성 메모리 및 로컬 캐시 정리
                if (typeof currentDependencies !== 'undefined') {
                    currentDependencies = currentDependencies.filter(d => d.task_id !== taskId && d.depends_on_task_id !== taskId);
                    const user = AppAPI.getUser();
                    if (user && user.user_id) {
                        try {
                            localStorage.setItem("flowforge_dependencies_" + user.user_id, JSON.stringify(currentDependencies));
                        } catch (e) {}
                    }
                }
                UI.showToast('작업이 삭제되었습니다.');
                if (typeof currentDetailTaskId !== 'undefined' && currentDetailTaskId === taskId) {
                    currentDetailTaskId = null;
                    UI.closeModal('task-detail-modal');
                }
                await loadAppData();
            } else {
                UI.showToast(res.message, 'error');
            }
        } catch (e) {
            UI.showToast(e.message || '작업 삭제 중 오류가 발생했습니다.', 'error');
        } finally {
            UI.setGlobalLoading(false);
        }
    });
}

function initTask() {
    const filterStatus = document.getElementById("task-filter-status");
    const filterPriority = document.getElementById("task-filter-priority");
    const filterProject = document.getElementById("task-filter-project");
    const filterDue = document.getElementById("task-filter-due");
    const sortSelect = document.getElementById("task-sort");
    const resetBtn = document.getElementById("btn-task-filter-reset");

    [filterStatus, filterPriority, filterProject, filterDue, sortSelect].forEach(el => {
        if (el) {
            el.addEventListener("change", () => renderTasks());
        }
    });

    if (resetBtn) {
        resetBtn.addEventListener("click", () => {
            resetTaskFilters();
            const searchBox = document.getElementById("global-search");
            if (searchBox && searchBox.value) {
                searchBox.value = "";
            }
            renderTasks();
            UI.showToast("필터가 초기화되었습니다.");
        });
    }

    document.getElementById("form-task").onsubmit = async (e) => {
        if (isTaskRequest) return;
        isTaskRequest = true;
        e.preventDefault();
        const submitBtn = document.getElementById("btn-submit-task");
        const form = e.target;
        const mode = form.dataset.mode;
        const data = {
            project_id: document.getElementById("task-project").value,
            title: document.getElementById("task-title").value.trim(),
            description: document.getElementById("task-desc").value.trim(),
            priority: document.getElementById("task-priority").value,
            due_date: document.getElementById("task-date").value,
            status: mode === "edit" ? (currentTasks.find(t => t.id === form.dataset.id)?.status || "To Do") : "To Do",
            user_id: AppAPI.getUser().user_id
        };

        UI.lockButton(
            submitBtn,
            mode === "create"
                ? "생성 중..."
                : "저장 중..."
        );
        UI.setGlobalLoading(true);

        try {
            let res;
            if (mode === "create") {
                res = await AppAPI.addTask(data);
            } else {
                data.task_id = form.dataset.id;
                res = await AppAPI.updateTask(data);
            }
            if (!res.success)
                throw new Error(res.message);
            UI.closeModal("task-modal");
            await loadAppData();
            UI.showToast(
                mode === "create"
                    ? "작업이 생성되었습니다."
                    : "작업이 수정되었습니다."
            );
        } catch (err) {
            UI.showToast(err.message, "error");
        } finally {
            isTaskRequest = false;
            UI.unlockButton(submitBtn);
            UI.setGlobalLoading(false);
        }
    };

    initMobileKanbanSwipe();
}

// --- 모바일 페이지형 칸반 및 스와이프 제스처 로직 ---
let currentMobileKanbanPage = 0; // 0: To Do, 1: In Progress, 2: Done
let isMobileSwiping = false;

function setMobileKanbanPage(pageIndex) {
    if (typeof pageIndex !== 'number') pageIndex = parseInt(pageIndex, 10) || 0;
    if (pageIndex < 0) pageIndex = 0;
    if (pageIndex > 2) pageIndex = 2;
    currentMobileKanbanPage = pageIndex;

    const board = document.querySelector('.kanban-board');
    if (board) {
        board.style.setProperty('--mobile-kanban-page', pageIndex);
    }

    const cols = document.querySelectorAll('.kanban-column');
    cols.forEach((col, idx) => {
        col.classList.toggle('is-active', idx === pageIndex);
    });

    const dots = document.querySelectorAll('.kanban-indicator-dot');
    dots.forEach((dot, idx) => {
        dot.classList.toggle('active', idx === pageIndex);
    });
}

function updateMobileKanbanUI() {
    setMobileKanbanPage(currentMobileKanbanPage);
}

function initMobileKanbanSwipe() {
    const kanbanBoard = document.querySelector('.kanban-board');
    if (!kanbanBoard) return;

    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;
    let isSwiping = false;
    let isScrolling = false;

    kanbanBoard.addEventListener('touchstart', (e) => {
        if (window.innerWidth > 768) return;
        if (e.touches.length !== 1) return;

        // 버튼, 셀렉트, 링크 등 대화형 요소 터치는 무시
        const target = e.target;
        if (target.closest('button, select, input, textarea, a, .task-status-select, .btn-delete-item, .task-mobile-status')) {
            return;
        }

        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        touchStartTime = Date.now();
        isSwiping = false;
        isScrolling = false;
        isMobileSwiping = false;
    }, { passive: true });

    kanbanBoard.addEventListener('touchmove', (e) => {
        if (window.innerWidth > 768) return;
        if (e.touches.length !== 1) return;
        if (isScrolling) return;

        const touch = e.touches[0];
        const dx = touch.clientX - touchStartX;
        const dy = touch.clientY - touchStartY;

        if (!isSwiping && !isScrolling) {
            // 수직 스크롤 판정 (|dy| >= |dx| && |dy| > 8px)
            if (Math.abs(dy) > 8 && Math.abs(dy) >= Math.abs(dx)) {
                isScrolling = true;
                return;
            }
            // 가로 스와이프 판정 (|dx| > |dy| && |dx| > 8px)
            if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
                isSwiping = true;
                isMobileSwiping = true;
            }
        }

        if (isSwiping) {
            if (e.cancelable) {
                e.preventDefault();
            }
        }
    }, { passive: false });

    kanbanBoard.addEventListener('touchend', (e) => {
        if (window.innerWidth > 768) return;
        if (!isSwiping) {
            isScrolling = false;
            return;
        }

        const touch = e.changedTouches[0];
        const dx = touch.clientX - touchStartX;
        const dy = touch.clientY - touchStartY;
        const dt = Date.now() - touchStartTime;

        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        // 스와이프 판정 기준: 이동 거리 >= 40px 또는 빠른 플릭(>= 25px & < 250ms)
        const isThresholdPassed = absDx >= 40 || (absDx >= 25 && dt < 250);

        if (isThresholdPassed && absDx > absDy) {
            if (dx < 0) {
                // 오른쪽 -> 왼쪽 Swipe: 다음 상태 (0 -> 1 -> 2)
                if (currentMobileKanbanPage < 2) {
                    setMobileKanbanPage(currentMobileKanbanPage + 1);
                }
            } else {
                // 왼쪽 -> 오른쪽 Swipe: 이전 상태 (2 -> 1 -> 0)
                if (currentMobileKanbanPage > 0) {
                    setMobileKanbanPage(currentMobileKanbanPage - 1);
                }
            }
        }

        isSwiping = false;
        isScrolling = false;
        // 스와이프 완료 직후 발생할 수 있는 가상 클릭 이벤트 억제
        setTimeout(() => {
            isMobileSwiping = false;
        }, 120);
    }, { passive: true });

    window.addEventListener('resize', () => {
        if (window.innerWidth <= 768) {
            updateMobileKanbanUI();
        }
    });

    updateMobileKanbanUI();
}

window.setMobileKanbanPage = setMobileKanbanPage;
window.updateMobileKanbanUI = updateMobileKanbanUI;

// ===============================================
// --- 작업 의존성 (Task Dependency / 선행 작업) 로직 ---
// ===============================================
let currentDepTargetTaskId = null;
let selectedDepCandidateId = null;

function wouldCreateCycle(taskId, dependsOnTaskId) {
    if (taskId === dependsOnTaskId) return true;
    const queue = [dependsOnTaskId];
    const visited = new Set();
    while (queue.length > 0) {
        const curr = queue.shift();
        if (curr === taskId) return true;
        if (visited.has(curr)) continue;
        visited.add(curr);
        const preds = (typeof currentDependencies !== 'undefined' && Array.isArray(currentDependencies))
            ? currentDependencies.filter(d => d.task_id === curr).map(d => d.depends_on_task_id)
            : [];
        for (const p of preds) {
            if (!visited.has(p)) queue.push(p);
        }
    }
    return false;
}

function renderTaskDependencies(taskId) {
    const container = document.getElementById('task-detail-dependency-container');
    if (!container) return;

    const task = currentTasks.find(t => t.id === taskId);
    if (!task) return;

    const deps = (typeof currentDependencies !== 'undefined' && Array.isArray(currentDependencies))
        ? currentDependencies.filter(d => d.task_id === taskId)
        : [];

    // 선행 작업 정보 매핑
    const predItems = deps.map(d => {
        const pred = currentTasks.find(t => t.id === d.depends_on_task_id);
        return {
            depId: d.id,
            predTaskId: d.depends_on_task_id,
            predTask: pred
        };
    });

    const uncompletedCount = predItems.filter(item => item.predTask && item.predTask.status !== 'Done').length;
    const isTaskDone = task.status === 'Done';

    // 미완료 선행 작업 경고 배너 (상태 변경 자체를 막지는 않고 권장 알림 제공)
    let warningBannerHtml = '';
    if (!isTaskDone && uncompletedCount > 0) {
        warningBannerHtml = `
            <div class="task-dep-warning-banner">
                <i class="fas fa-triangle-exclamation"></i>
                <div class="task-dep-warning-body">
                    <strong>선행 작업 미완료 (${uncompletedCount}개)</strong>
                    <p>이 작업이 진행되기 전 먼저 완료되어야 할 선행 작업이 남아있습니다. 선행 작업이 완료된 후 진행하는 것을 권장합니다.</p>
                </div>
            </div>
        `;
    }

    let listHtml = '';
    if (predItems.length === 0) {
        listHtml = `<div class="task-dep-empty"><i class="fas fa-link-slash"></i> 연결된 선행 작업이 없습니다. 필요 시 위 버튼으로 추가해보세요.</div>`;
    } else {
        listHtml = `<ul class="task-dep-list">` + predItems.map(item => {
            const pred = item.predTask;
            if (!pred) {
                return `
                    <li class="task-dep-item">
                        <div class="task-dep-item-main">
                            <span style="color: var(--text-muted); font-size: 0.85rem; font-style: italic;">삭제된 작업 (ID: ${item.predTaskId})</span>
                        </div>
                        <button type="button" class="btn-icon-subtle btn-delete-dep" onclick="deleteDependency('${item.depId}', '${taskId}')" title="연결 삭제">
                            <i class="fas fa-times"></i>
                        </button>
                    </li>
                `;
            }

            const proj = pred.project_id ? currentProjects.find(p => p.id === pred.project_id) : null;
            const projName = proj ? proj.title : (pred.project_id ? '삭제된 프로젝트' : '독립 작업');

            let statusBadge = '';
            if (pred.status === 'Done') {
                statusBadge = `<span class="badge bg-success" style="font-size: 0.7rem;"><i class="fas fa-check"></i> 완료됨</span>`;
            } else if (pred.status === 'In Progress') {
                statusBadge = `<span class="badge bg-warning" style="font-size: 0.7rem;"><i class="fas fa-spinner"></i> 진행 중</span>`;
            } else {
                statusBadge = `<span class="badge bg-info" style="font-size: 0.7rem;"><i class="fas fa-list-ul"></i> 해야 할 일</span>`;
            }

            const diff = getDueDateDiff(pred.due_date);
            const dueText = pred.due_date ? formatFriendlyDate(pred.due_date) : '';

            return `
                <li class="task-dep-item${pred.status === 'Done' ? ' is-done' : ''}">
                    <div class="task-dep-item-main">
                        <div class="task-dep-item-top">
                            <button type="button" class="task-dep-title-link" onclick="openTaskDetail('${pred.id}')" title="작업 상세로 이동">
                                <i class="fas fa-arrow-turn-up fa-rotate-90" style="font-size: 0.7rem; color: var(--accent-color);"></i>
                                <span class="task-dep-title-text${pred.status === 'Done' ? ' is-done' : ''}">${escapeHtml(pred.title)}</span>
                                <i class="fas fa-arrow-right" style="font-size: 0.65rem; opacity: 0.5;"></i>
                            </button>
                            ${statusBadge}
                        </div>
                        <div class="task-dep-item-meta">
                            <span class="badge bg-default" style="font-size: 0.68rem; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(projName)}</span>
                            ${dueText ? `<span style="font-size: 0.75rem; color: var(--text-muted);"><i class="far fa-calendar"></i> ${dueText}</span>` : ''}
                        </div>
                    </div>
                    <button type="button" class="btn-icon-subtle btn-delete-dep" onclick="deleteDependency('${item.depId}', '${taskId}')" title="선행 작업 연결 해제">
                        <i class="fas fa-times"></i>
                    </button>
                </li>
            `;
        }).join('') + `</ul>`;
    }

    container.innerHTML = `
        <div class="task-dep-header">
            <div class="task-dep-title-wrap">
                <span class="task-dep-title"><i class="fas fa-link"></i> 선행 작업 (Predecessors)</span>
                <span class="task-dep-count-badge">${deps.length}개</span>
            </div>
            <button type="button" class="btn-secondary btn-sm task-dep-add-btn" onclick="openAddDependencyModal('${taskId}')">
                <i class="fas fa-plus"></i> 선행 작업 추가
            </button>
        </div>
        ${warningBannerHtml}
        ${listHtml}
    `;
}

function openAddDependencyModal(taskId) {
    const task = currentTasks.find(t => t.id === taskId);
    if (!task) return;

    currentDepTargetTaskId = taskId;
    selectedDepCandidateId = null;

    const modalTitle = document.getElementById('task-dependency-modal-title');
    if (modalTitle) {
        modalTitle.innerHTML = `<i class="fas fa-link" style="color: var(--accent-color); margin-right: 0.4rem;"></i> 선행 작업 추가`;
    }

    const subtitle = document.getElementById('task-dependency-modal-subtitle');
    if (subtitle) {
        subtitle.innerHTML = `<strong>${escapeHtml(task.title)}</strong> 작업이 진행되기 전 먼저 완료되어야 할 작업을 선택하세요.`;
    }

    const searchInput = document.getElementById('dep-search-input');
    if (searchInput) searchInput.value = '';

    const submitBtn = document.getElementById('btn-submit-dependency');
    if (submitBtn) submitBtn.disabled = true;

    renderDependencyCandidates(taskId, '');
    UI.openModal('task-dependency-modal');
}

function closeAddDependencyModal() {
    currentDepTargetTaskId = null;
    selectedDepCandidateId = null;
    UI.closeModal('task-dependency-modal');
}

function onDependencySearchInput(val) {
    if (!currentDepTargetTaskId) return;
    renderDependencyCandidates(currentDepTargetTaskId, (val || '').trim().toLowerCase());
}

function renderDependencyCandidates(taskId, filterText = '') {
    const listContainer = document.getElementById('dep-candidate-list');
    if (!listContainer) return;

    const currentTask = currentTasks.find(t => t.id === taskId);
    if (!currentTask) return;

    const existingPredIds = new Set(
        (typeof currentDependencies !== 'undefined' && Array.isArray(currentDependencies))
            ? currentDependencies.filter(d => d.task_id === taskId).map(d => d.depends_on_task_id)
            : []
    );

    // 후보 작업들: 자기 자신 제외
    let candidates = currentTasks.filter(t => t.id !== taskId);

    // 검색어 필터링
    if (filterText) {
        candidates = candidates.filter(t => {
            const proj = t.project_id ? currentProjects.find(p => p.id === t.project_id) : null;
            const projTitle = proj ? proj.title.toLowerCase() : '';
            return t.title.toLowerCase().includes(filterText) || (t.description || '').toLowerCase().includes(filterText) || projTitle.includes(filterText);
        });
    }

    // 정렬: 동일 프로젝트 우선 정렬 -> 그 후 이름순
    candidates.sort((a, b) => {
        const aSameProj = a.project_id && a.project_id === currentTask.project_id ? 1 : 0;
        const bSameProj = b.project_id && b.project_id === currentTask.project_id ? 1 : 0;
        if (aSameProj !== bSameProj) return bSameProj - aSameProj;
        return (a.title || '').localeCompare(b.title || '', 'ko');
    });

    if (candidates.length === 0) {
        listContainer.innerHTML = `<div class="task-dep-candidate-empty"><i class="fas fa-search"></i> 선택 가능한 작업이 없습니다.</div>`;
        return;
    }

    listContainer.innerHTML = candidates.map(t => {
        const isAlreadyAdded = existingPredIds.has(t.id);
        const causesCycle = !isAlreadyAdded && wouldCreateCycle(taskId, t.id);
        const isDisabled = isAlreadyAdded || causesCycle;
        const isSelected = selectedDepCandidateId === t.id;

        const proj = t.project_id ? currentProjects.find(p => p.id === t.project_id) : null;
        const isSameProj = currentTask.project_id && t.project_id === currentTask.project_id;
        const projName = proj ? proj.title : (t.project_id ? '삭제된 프로젝트' : '독립 작업');

        let statusText = t.status === 'Done' ? '완료' : (t.status === 'In Progress' ? '진행 중' : '해야 할 일');
        let statusClass = t.status === 'Done' ? 'bg-success' : (t.status === 'In Progress' ? 'bg-warning' : 'bg-info');

        let disabledBadge = '';
        if (isAlreadyAdded) {
            disabledBadge = `<span class="badge bg-default" style="font-size: 0.7rem; color: var(--text-muted);"><i class="fas fa-check"></i> 이미 연결됨</span>`;
        } else if (causesCycle) {
            disabledBadge = `<span class="badge bg-danger" style="font-size: 0.7rem;"><i class="fas fa-rotate"></i> 순환 의존 (연결 불가)</span>`;
        }

        return `
            <div class="task-dep-candidate-item${isDisabled ? ' is-disabled' : ''}${isSelected ? ' is-selected' : ''}" ${!isDisabled ? `onclick="selectDependencyCandidate('${t.id}')"` : ''}>
                <div class="task-dep-candidate-radio">
                    <input type="radio" name="dep_candidate_radio" value="${t.id}" ${isSelected ? 'checked' : ''} ${isDisabled ? 'disabled' : ''}>
                </div>
                <div class="task-dep-candidate-info">
                    <div class="task-dep-candidate-title-row">
                        <span class="task-dep-candidate-title">${escapeHtml(t.title)}</span>
                        ${disabledBadge || `<span class="badge ${statusClass}" style="font-size: 0.68rem;">${statusText}</span>`}
                    </div>
                    <div class="task-dep-candidate-meta-row">
                        <span class="badge ${isSameProj ? 'bg-info' : 'bg-default'}" style="font-size: 0.68rem; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            ${isSameProj ? '<i class="fas fa-star" style="font-size: 0.6rem; margin-right: 0.2rem;"></i>' : ''}${escapeHtml(projName)}
                        </span>
                        ${t.due_date ? `<span style="font-size: 0.72rem; color: var(--text-muted);"><i class="far fa-calendar"></i> ${formatFriendlyDate(t.due_date)}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function selectDependencyCandidate(id) {
    selectedDepCandidateId = id;
    if (currentDepTargetTaskId) {
        const searchInput = document.getElementById('dep-search-input');
        renderDependencyCandidates(currentDepTargetTaskId, (searchInput ? searchInput.value : '').trim().toLowerCase());
    }
    const submitBtn = document.getElementById('btn-submit-dependency');
    if (submitBtn) submitBtn.disabled = !selectedDepCandidateId;
}

let isDepSubmitting = false;

async function submitAddDependency() {
    if (isDepSubmitting) return;
    if (!currentDepTargetTaskId || !selectedDepCandidateId) return;
    const taskId = currentDepTargetTaskId;
    const dependsOnTaskId = selectedDepCandidateId;

    if (wouldCreateCycle(taskId, dependsOnTaskId)) {
        UI.showToast("순환 의존성을 만들 수 없습니다.", "error");
        return;
    }

    const user = AppAPI.getUser();
    if (!user) return;

    const submitBtn = document.getElementById('btn-submit-dependency');
    isDepSubmitting = true;
    UI.lockButton(submitBtn, "추가 중...");

    try {
        const res = await AppAPI.addDependency(taskId, dependsOnTaskId, user.user_id);
        if (!res || !res.success) {
            throw new Error((res && res.message) || "선행 작업 추가에 실패했습니다.");
        }
        if (res.dependency && !currentDependencies.some(d => d.id === res.dependency.id)) {
            currentDependencies.push(res.dependency);
        }
        closeAddDependencyModal();
        UI.showToast("선행 작업이 추가되었습니다.");

        renderTaskDependencies(taskId);
        renderTasks();
        if (typeof renderProjectDetail === 'function' && typeof currentProjectId !== 'undefined' && currentProjectId) {
            renderProjectDetail(currentProjectId);
        }
    } catch (e) {
        UI.showToast(e.message || "선행 작업 추가 중 오류가 발생했습니다.", "error");
        UI.unlockButton(submitBtn);
        if (submitBtn) submitBtn.disabled = !selectedDepCandidateId;
    } finally {
        isDepSubmitting = false;
        UI.unlockButton(submitBtn);
    }
}

function deleteDependency(depId, taskId) {
    const isDetailOpen = document.getElementById('task-detail-modal')?.classList.contains('show');
    if (isDetailOpen) {
        UI.closeModal('task-detail-modal');
    }

    UI.confirm(
        "선행 작업 연결 해제",
        "이 선행 작업과의 의존성 연결을 해제하시겠습니까?<br>작업 데이터 자체는 삭제되지 않습니다.",
        async () => {
            const user = AppAPI.getUser();
            if (!user) {
                if (isDetailOpen) openTaskDetail(taskId);
                return;
            }

            const backup = [...currentDependencies];
            currentDependencies = currentDependencies.filter(d => d.id !== depId);
            renderTasks();
            if (typeof renderProjectDetail === 'function' && typeof currentProjectId !== 'undefined' && currentProjectId) {
                renderProjectDetail(currentProjectId);
            }

            // Task Detail 모달이 열려있던 경우 즉시 최신 상태로 재오픈
            if (isDetailOpen) {
                openTaskDetail(taskId);
            }

            try {
                const res = await AppAPI.deleteDependency(depId, user.user_id);
                if (!res || !res.success) {
                    throw new Error((res && res.message) || "선행 작업 삭제 중 오류가 발생했습니다.");
                }
                UI.showToast("선행 작업 연결이 해제되었습니다.");
            } catch (e) {
                currentDependencies = backup;
                renderTasks();
                if (typeof renderProjectDetail === 'function' && typeof currentProjectId !== 'undefined' && currentProjectId) {
                    renderProjectDetail(currentProjectId);
                }
                if (isDetailOpen) {
                    openTaskDetail(taskId);
                }
                UI.showToast(e.message || "선행 작업 삭제 중 오류가 발생했습니다.", "error");
            }
        },
        () => {
            // 취소 시: Task Detail 모달 복구
            if (isDetailOpen) {
                openTaskDetail(taskId);
            }
        }
    );
}

window.renderTaskDependencies = renderTaskDependencies;
window.openAddDependencyModal = openAddDependencyModal;
window.closeAddDependencyModal = closeAddDependencyModal;
window.onDependencySearchInput = onDependencySearchInput;
window.selectDependencyCandidate = selectDependencyCandidate;
window.submitAddDependency = submitAddDependency;
window.deleteDependency = deleteDependency;
window.wouldCreateCycle = wouldCreateCycle;