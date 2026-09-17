// js/task-dependencies.js

// 작업 의존성 및 선행 작업 선택 로직
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
                            <span style="color: var(--text-muted); font-size: 0.85rem; font-style: italic;">삭제된 작업 (ID: ${escapeHtml(item.predTaskId)})</span>
                        </div>
                        <button type="button" class="btn-icon-subtle btn-delete-dep" data-click-action="dependency-delete" data-dependency-id="${escapeDataValue(item.depId)}" data-task-id="${escapeDataValue(taskId)}" title="연결 삭제">
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
                            <button type="button" class="task-dep-title-link" data-click-action="dependency-open-task" data-task-id="${escapeDataValue(pred.id)}" title="작업 상세로 이동">
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
                    <button type="button" class="btn-icon-subtle btn-delete-dep" data-click-action="dependency-delete" data-dependency-id="${escapeDataValue(item.depId)}" data-task-id="${escapeDataValue(taskId)}" title="선행 작업 연결 해제">
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
            <button type="button" class="btn-secondary btn-sm task-dep-add-btn" data-click-action="dependency-open-add" data-task-id="${escapeDataValue(taskId)}">
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
            <div class="task-dep-candidate-item${isDisabled ? ' is-disabled' : ''}${isSelected ? ' is-selected' : ''}" ${!isDisabled ? `data-click-action="dependency-select" data-record-id="${escapeDataValue(t.id)}"` : ''}>
                <div class="task-dep-candidate-radio">
                    <input type="radio" name="dep_candidate_radio" value="${escapeHtml(t.id)}" ${isSelected ? 'checked' : ''} ${isDisabled ? 'disabled' : ''}>
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
