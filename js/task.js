// js/task.js

let isTaskRequest = false;

window.openEditTaskModal = function(id) { UI.openTaskModal('edit', id); };

let isStatusUpdating = false;

async function changeTaskStatus(taskId, newStatus) {
    if (isStatusUpdating) return;
    const task = currentTasks.find(t => t.id === taskId);
    if (!task || task.status === newStatus) return;

    isStatusUpdating = true;
    const oldStatus = task.status;
    task.status = newStatus;
    renderTasks();
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
        
        const editBtnHtml = task.status !== 'Done'
            ? `<button class="btn-edit-item" onclick="openEditTaskModal('${task.id}')" title="수정"><i class="fas fa-edit"></i></button>`
            : `<button class="btn-edit-item" onclick="UI.showToast('완료된 작업은 수정할 수 없습니다.', 'warning')" title="수정 불가 (완료됨)" style="opacity:0.3; cursor:not-allowed;"><i class="fas fa-lock"></i></button>`;

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
                ${editBtnHtml}
                <button class="btn-delete-item" onclick="deleteTask('${task.id}')" title="삭제">
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
            <div class="task-mobile-status" onpointerdown="event.stopPropagation()" onclick="event.stopPropagation()">
                <label class="task-status-label" for="task-status-select-${task.id}"><i class="fas fa-arrows-rotate"></i> 상태</label>
                <select class="form-control task-status-select" id="task-status-select-${task.id}" onchange="changeTaskStatus('${task.id}', this.value)">
                    <option value="To Do"${task.status === 'To Do' ? ' selected' : ''}>해야 할 일</option>
                    <option value="In Progress"${task.status === 'In Progress' ? ' selected' : ''}>진행 중</option>
                    <option value="Done"${task.status === 'Done' ? ' selected' : ''}>완료됨</option>
                </select>
            </div>`;

        card.addEventListener('dragstart', (e) => {
            if (window.innerWidth <= 768) {
                e.preventDefault();
                return false;
            }
            card.classList.add('dragging');
            e.dataTransfer.setData('text/plain', task.id);
        });
        card.addEventListener('dragend', () => card.classList.remove('dragging'));
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
        const res = await AppAPI.deleteTask(taskId, AppAPI.getUser().user_id);
        if(res.success) { UI.showToast('작업이 삭제되었습니다.'); loadAppData(); } else UI.showToast(res.message, 'error');
        UI.setGlobalLoading(false);
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