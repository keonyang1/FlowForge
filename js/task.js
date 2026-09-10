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
    `;

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
window.navigateToProjectFromTaskDetail = navigateToProjectFromTaskDetail;
window.changeTaskStatusFromDetail = changeTaskStatusFromDetail;
window.editTaskFromDetail = editTaskFromDetail;
window.deleteTaskFromDetail = deleteTaskFromDetail;

let isStatusUpdating = false;

async function changeTaskStatus(taskId, newStatus) {
    if (isStatusUpdating) return;
    const task = currentTasks.find(t => t.id === taskId);
    if (!task || task.status === newStatus) return;

    isStatusUpdating = true;
    const oldStatus = task.status;
    task.status = newStatus;
    renderTasks();
    if (typeof renderProjects === 'function') renderProjects();
    if (typeof currentProjectId !== 'undefined' && currentProjectId && typeof renderProjectDetail === 'function') {
        renderProjectDetail(currentProjectId);
    }
    if (typeof currentDetailTaskId !== 'undefined' && currentDetailTaskId === taskId) {
        renderTaskDetailContent(task);
    }
    if (typeof renderDashboard === 'function') renderDashboard();
    if (typeof renderAnalytics === 'function') renderAnalytics();
    if (typeof renderCalendar === 'function') renderCalendar();
    UI.setGlobalLoading(true);

    try {
        const res = await AppAPI.updateTaskStatus(
            taskId,
            newStatus,
            AppAPI.getUser().user_id
        );
        if (!res.success) {
            throw new Error(res.message);
        }
        UI.showToast(`상태가 변경되었습니다: ${newStatus}`);
        await loadAppData();
    } catch (err) {
        task.status = oldStatus;
        renderTasks();
        if (typeof renderProjects === 'function') renderProjects();
        if (typeof currentProjectId !== 'undefined' && currentProjectId && typeof renderProjectDetail === 'function') {
            renderProjectDetail(currentProjectId);
        }
        if (typeof currentDetailTaskId !== 'undefined' && currentDetailTaskId === taskId) {
            renderTaskDetailContent(task);
        }
        if (typeof renderDashboard === 'function') renderDashboard();
        if (typeof renderAnalytics === 'function') renderAnalytics();
        if (typeof renderCalendar === 'function') renderCalendar();
        UI.showToast(err.message || '상태 변경에 실패했습니다.', 'error');
    } finally {
        isStatusUpdating = false;
        UI.setGlobalLoading(false);
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
            if (isDraggingCard) return;
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
}

function deleteTask(taskId) {
    UI.confirm('작업 삭제', '이 작업을 삭제하시겠습니까?<br>삭제된 작업은 복구할 수 없습니다.', async () => {
        UI.setGlobalLoading(true);
        try {
            const res = await AppAPI.deleteTask(taskId, AppAPI.getUser().user_id);
            if(res.success) {
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
}