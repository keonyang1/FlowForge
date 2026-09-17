// js/task-detail.js

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
        projHtml = `<button type="button" class="task-detail-project-btn" data-click-action="task-detail-project" data-project-id="${escapeDataValue(proj.id)}" title="프로젝트 상세 페이지로 이동">
            <i class="fas fa-folder-open"></i>
            <span>${escapeHtml(proj.title)}</span>
            <i class="fas fa-arrow-right" style="font-size: 0.7rem; opacity: 0.7;"></i>
        </button>`;
    } else {
        projHtml = `<span style="color: var(--text-muted); font-size: 0.85rem;">${escapeHtml(projName)}</span>`;
    }

    const createdMetaHtml = task.created_at ? `
        <div class="task-detail-meta-item">
            <span class="task-detail-meta-label"><i class="far fa-calendar-plus"></i> 등록일</span>
            <div class="task-detail-meta-val"><span style="color: var(--text-muted); font-size: 0.8rem;">${escapeHtml(task.created_at)}</span></div>
        </div>` : '';

    body.innerHTML = `
        <h3 class="task-detail-title${task.status === 'Done' ? ' is-done' : ''}">${escapeHtml(task.title)}</h3>

        <div class="task-detail-meta-grid">
            <div class="task-detail-meta-item">
                <span class="task-detail-meta-label"><i class="fas fa-folder"></i> 소속 프로젝트</span>
                <div class="task-detail-meta-val">${projHtml}</div>
            </div>

            <div class="task-detail-meta-item">
                <span class="task-detail-meta-label"><i class="fas fa-arrows-rotate"></i> 상태</span>
                <div class="task-detail-meta-val">
                    <select class="form-control task-detail-status-select" data-change-action="task-detail-status" data-task-id="${escapeDataValue(task.id)}">
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
        <div class="task-detail-desc-box">${task.description ? escapeHtml(task.description) : '<span style="color: var(--text-muted); font-style: italic;">설명이 없습니다.</span>'}</div>
        <div id="task-detail-dependency-container" class="task-dependency-section"></div>
        <div id="task-detail-checklist-container" class="task-checklist-section"></div>
    `;

    renderTaskDependencies(task.id);
    renderTaskChecklist(task.id);

    const editBtnHtml = task.status !== 'Done'
        ? `<button type="button" class="btn-secondary" data-click-action="task-detail-edit" data-task-id="${escapeDataValue(task.id)}"><i class="fas fa-edit"></i> 수정</button>`
        : `<button type="button" class="btn-secondary" data-click-action="task-detail-edit-locked" title="수정 불가 (완료됨)" style="opacity: 0.4; cursor: not-allowed;"><i class="fas fa-lock"></i> 수정 불가</button>`;

    footer.innerHTML = `
        <button type="button" class="btn-secondary text-danger" data-click-action="task-detail-delete" data-task-id="${escapeDataValue(task.id)}"><i class="fas fa-trash"></i> 삭제</button>
        <div class="task-detail-footer-right">
            ${editBtnHtml}
            <button type="button" class="btn-primary" data-click-action="task-detail-close">닫기</button>
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
            const escapedText = escapeHtml(item.text);
            return `
                <li class="task-checklist-item${item.is_completed ? ' is-completed' : ''}" id="checklist-item-${escapeHtml(item.id)}">
                    <button type="button" class="task-checklist-check-btn${item.is_completed ? ' is-completed' : ''}" data-click-action="checklist-toggle" data-task-id="${escapeDataValue(taskId)}" data-item-id="${escapeDataValue(item.id)}" title="${item.is_completed ? '미완료로 표시' : '완료로 표시'}" aria-label="체크박스">
                        <span class="task-checklist-custom-checkbox"><i class="fas fa-check"></i></span>
                    </button>
                    <div class="task-checklist-item-content" id="checklist-text-wrap-${escapeHtml(item.id)}">
                        <span class="task-checklist-item-text${item.is_completed ? ' is-completed' : ''}" data-click-action="checklist-toggle" data-keydown-action="checklist-toggle" data-task-id="${escapeDataValue(taskId)}" data-item-id="${escapeDataValue(item.id)}" role="button" tabindex="0" title="클릭하여 상태 변경">${escapedText}</span>
                    </div>
                    <div class="task-checklist-item-actions">
                        <button type="button" class="btn-icon-subtle" data-click-action="checklist-edit" data-task-id="${escapeDataValue(taskId)}" data-item-id="${escapeDataValue(item.id)}" title="세부 작업 수정">
                            <i class="fas fa-pen"></i>
                        </button>
                        <button type="button" class="btn-icon-subtle btn-delete-checklist" data-click-action="checklist-delete" data-task-id="${escapeDataValue(taskId)}" data-item-id="${escapeDataValue(item.id)}" title="세부 작업 삭제">
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
                <input type="text" id="checklist-new-input-${escapeHtml(taskId)}" class="form-control task-checklist-add-input" placeholder="세부 작업 추가... (Enter로 등록)" maxlength="150" data-keydown-action="checklist-add" data-task-id="${escapeDataValue(taskId)}">
                <button type="button" id="btn-add-checklist-${escapeHtml(taskId)}" class="btn-primary task-checklist-add-btn" data-click-action="checklist-add" data-task-id="${escapeDataValue(taskId)}">
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

    let saved = false;
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
                    currentChecklists.push({ ...createdItem, is_completed: normalizeBoolean(createdItem.is_completed) });
                }
                try {
                    localStorage.setItem(`flowforge_checklists_${userId}`, JSON.stringify(currentChecklists));
                } catch (e) {}
            }
            saved = true;
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
            nextInput.value = saved ? '' : text;
            nextInput.focus();
        }
    }
}

function startEditChecklistItem(taskId, itemId) {
    if (typeof currentChecklists === 'undefined') return;
    const item = currentChecklists.find(c => c.id === itemId);
    const wrap = document.getElementById(`checklist-text-wrap-${itemId}`);
    if (!item || !wrap) return;

    const escapedText = escapeHtml(item.text);
    wrap.innerHTML = `
        <div class="task-checklist-inline-edit">
            <input type="text" id="checklist-edit-input-${escapeHtml(itemId)}" class="form-control task-checklist-inline-input" value="${escapedText}" maxlength="150" data-keydown-action="checklist-edit" data-task-id="${escapeDataValue(taskId)}" data-item-id="${escapeDataValue(itemId)}">
            <div class="task-checklist-inline-edit-btns">
                <button type="button" class="btn-icon-save" data-click-action="checklist-save" data-task-id="${escapeDataValue(taskId)}" data-item-id="${escapeDataValue(itemId)}" title="저장"><i class="fas fa-check"></i></button>
                <button type="button" class="btn-icon-cancel" data-click-action="checklist-cancel" data-task-id="${escapeDataValue(taskId)}" title="취소"><i class="fas fa-times"></i></button>
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

// 같은 작업의 상태 저장은 한 번에 하나만 허용합니다.

