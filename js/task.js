// js/task.js

let isTaskRequest = false;

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
    if (!task || !['To Do', 'In Progress', 'Done'].includes(newStatus)) return;
    const user = AppAPI.getUser();
    if (!user) { UI.showToast('로그인이 필요합니다.', 'error'); return; }
    const key = JSON.stringify([user.user_id, "task", taskId]);
    if (pendingItemWrites.has(key)) {
        syncTaskRelatedViews(task);
        UI.showToast('이 작업의 상태를 저장 중입니다. 잠시 후 변경해주세요.', 'warning');
        return;
    }
    if (task.status === newStatus) return;
    pendingItemWrites.add(key);
    const originalStatus = task.status;
    const isCurrent = () => AppAPI.getUser()?.user_id === user.user_id && currentTasks.includes(task);
    try {
        task.status = newStatus;
        syncTaskRelatedViews(task);
        const res = await AppAPI.updateTaskStatus(taskId, newStatus, user.user_id);
        if (!res?.success) throw new Error(res?.message || '상태 변경에 실패했습니다.');
        if (isCurrent()) UI.showToast('작업 상태가 변경되었습니다.');
    } catch (err) {
        task.status = originalStatus;
        if (isCurrent()) {
            syncTaskRelatedViews(task);
            UI.showToast(err.message || '상태 변경에 실패했습니다.', 'error');
        }
    } finally {
        pendingItemWrites.delete(key);
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
                <button class="btn-delete-item" data-click-action="task-delete" data-task-id="${escapeDataValue(task.id)}" title="삭제">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div style="margin-bottom: 0.75rem; display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">
                <span class="badge bg-default search-text" style="font-size: 0.7rem; max-width: 120px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(projName)}">${escapeHtml(projName)}</span>
                <span style="font-size: 0.7rem; color: var(--${prioColor}); border: 1px solid var(--${prioColor}); border-radius: 4px; padding: 0.1rem 0.4rem; font-weight: 600;">${prioKor}</span>
                ${overdueBadgeHtml}
            </div>
            <h4 class="search-text" style="${task.status === 'Done' ? 'text-decoration: line-through; color: var(--text-muted);' : ''}" title="${escapeHtml(task.title)}">${escapeHtml(task.title)}</h4>
            <p class="task-desc search-text" title="${escapeHtml(task.description || '')}">${escapeHtml(task.description || '설명이 없습니다.')}</p>
            <div class="task-meta">
                ${dateMetaHtml}
                <div style="display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap;">
                    ${depBadgeHtml}
                    ${checklistBadgeHtml}
                </div>
            </div>
            <div class="task-mobile-status" data-click-action="ignore">
                <label class="task-status-label" for="task-status-select-${escapeHtml(task.id)}"><i class="fas fa-arrows-rotate"></i> 상태</label>
                <select class="form-control task-status-select" id="task-status-select-${escapeHtml(task.id)}" data-change-action="task-status" data-task-id="${escapeDataValue(task.id)}">
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
            if (e.target.closest('[data-click-action], .task-mobile-status')) return;
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
        e.preventDefault();
        if (isTaskRequest) return;
        if (!AppAPI.getUser()) return;
        if (!document.getElementById("task-title").value.trim()) {
            UI.showToast("제목을 입력해주세요.", "warning");
            document.getElementById("task-title").focus();
            return;
        }
        isTaskRequest = true;
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
