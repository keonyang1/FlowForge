// js/actions.js
// Delegate events for both static markup and dynamically rendered cards.
let appActionsInitialized = false;

function initAppActions() {
    if (appActionsInitialized) return;
    appActionsInitialized = true;

    document.addEventListener('click', handleDelegatedClick);
    document.addEventListener('change', handleDelegatedChange);
    document.addEventListener('input', handleDelegatedInput);
    document.addEventListener('keydown', handleDelegatedKeydown);
    document.addEventListener('dragstart', handleDelegatedDragStart);
    document.addEventListener('dragend', handleDelegatedDragEnd);
    document.addEventListener('dragover', handleDelegatedDragOver);
    document.addEventListener('dragleave', handleDelegatedDragLeave);
    document.addEventListener('drop', handleDelegatedDrop);
}

function getActionElement(event, attribute) {
    const target = event.target;
    if (!target || typeof target.closest !== 'function') return null;
    return target.closest(`[${attribute}]`);
}

function handleDelegatedClick(event) {
    const element = getActionElement(event, 'data-click-action');
    if (!element) return;

    const action = element.dataset.clickAction;
    const recordId = readDataValue(element, 'recordId');
    const taskId = readDataValue(element, 'taskId');
    const projectId = readDataValue(element, 'projectId');
    if (element.tagName === 'A') event.preventDefault();

    switch (action) {
        case 'ignore':
            return;
        case 'toggle-password':
            UI.togglePasswordVisibility(element.dataset.inputId, element);
            break;
        case 'modal-backdrop':
            UI.handleOutsideClick(event, element.dataset.modalId);
            break;
        case 'modal-close':
            UI.closeModal(element.dataset.modalId);
            break;
        case 'dependency-modal-close':
            closeAddDependencyModal();
            break;
        case 'navigate-page':
            UI.switchPage(element.dataset.page);
            break;
        case 'reload-data':
            loadAppData();
            break;
        case 'project-create':
            UI.openProjectModal('create');
            break;
        case 'task-create':
            UI.openTaskModal('create', null, projectId ?? null);
            break;
        case 'project-open':
            openProjectDetail(recordId);
            break;
        case 'project-complete':
            confirmCompleteProject(recordId);
            break;
        case 'project-edit':
            openEditProjectModal(recordId);
            break;
        case 'project-delete':
            deleteProject(recordId);
            break;
        case 'project-locked':
            UI.showToast('완료 처리된 프로젝트는 수정할 수 없습니다.', 'warning');
            break;
        case 'project-detail-close':
            closeProjectDetail();
            break;
        case 'task-open':
            if (typeof isMobileSwiping === 'undefined' || !isMobileSwiping) openTaskDetail(taskId ?? recordId);
            break;
        case 'task-delete':
            deleteTask(taskId ?? recordId);
            break;
        case 'task-detail-project':
            navigateToProjectFromTaskDetail(projectId ?? recordId);
            break;
        case 'task-detail-edit':
            editTaskFromDetail(taskId ?? recordId);
            break;
        case 'task-detail-edit-locked':
            UI.showToast('완료된 작업은 수정할 수 없습니다.', 'warning');
            break;
        case 'task-detail-delete':
            deleteTaskFromDetail(taskId ?? recordId);
            break;
        case 'task-detail-close':
            closeTaskDetail();
            break;
        case 'checklist-toggle':
            toggleChecklistItem(taskId, readDataValue(element, 'itemId'));
            break;
        case 'checklist-edit':
            startEditChecklistItem(taskId, readDataValue(element, 'itemId'));
            break;
        case 'checklist-delete':
            deleteChecklistItem(taskId, readDataValue(element, 'itemId'));
            break;
        case 'checklist-add':
            addChecklistItem(taskId);
            break;
        case 'checklist-save':
            saveEditChecklistItem(taskId, readDataValue(element, 'itemId'));
            break;
        case 'checklist-cancel':
            renderTaskChecklist(taskId);
            break;
        case 'dependency-delete':
            deleteDependency(readDataValue(element, 'dependencyId'), taskId);
            break;
        case 'dependency-open-task':
            openTaskDetail(taskId ?? recordId);
            break;
        case 'dependency-open-add':
            openAddDependencyModal(taskId ?? recordId);
            break;
        case 'dependency-submit':
            submitAddDependency();
            break;
        case 'dependency-select':
            selectDependencyCandidate(recordId);
            break;
        case 'help-page':
            showHelpPage(Number(element.dataset.page));
            break;
        case 'mobile-kanban-page':
            setMobileKanbanPage(Number(element.dataset.page));
            break;
        case 'calendar-today':
            goToCalendarToday();
            break;
        case 'calendar-nav':
            changeCalendarNav(Number(element.dataset.delta));
            break;
        case 'calendar-select-date':
            selectCalendarDate(element.dataset.date, true);
            break;
        case 'calendar-more':
            selectCalendarDate(element.dataset.date, true);
            break;
        case 'calendar-set-view':
            setCalendarView(element.dataset.view);
            break;
        case 'calendar-item':
            handleCalendarItemClick(event, element.dataset.itemType, recordId);
            break;
        case 'calendar-day-project':
            openProjectDetail(recordId);
            break;
        case 'calendar-day-task':
            openTaskDetail(taskId ?? recordId);
            break;
    }
}

function handleDelegatedChange(event) {
    const element = getActionElement(event, 'data-change-action');
    if (!element) return;

    switch (element.dataset.changeAction) {
        case 'task-status':
            changeTaskStatus(readDataValue(element, 'taskId'), element.value);
            break;
        case 'task-detail-status':
            changeTaskStatusFromDetail(readDataValue(element, 'taskId'), element.value);
            break;
    }
}

function handleDelegatedInput(event) {
    const element = getActionElement(event, 'data-input-action');
    if (element?.dataset.inputAction === 'dependency-search') {
        onDependencySearchInput(element.value);
    }
}

function handleDelegatedKeydown(event) {
    const element = getActionElement(event, 'data-keydown-action');
    if (!element) return;

    const taskId = readDataValue(element, 'taskId');
    const itemId = readDataValue(element, 'itemId');
    switch (element.dataset.keydownAction) {
        case 'checklist-toggle':
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggleChecklistItem(taskId, itemId);
            }
            break;
        case 'checklist-add':
            if (event.key === 'Enter') {
                if (event.isComposing) return;
                event.preventDefault();
                addChecklistItem(taskId);
            }
            break;
        case 'checklist-edit':
            handleChecklistEditKey(event, taskId, itemId);
            break;
        case 'dependency-select':
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                selectDependencyCandidate(readDataValue(element, 'recordId'));
            }
            break;
    }
}

function handleDelegatedDragStart(event) {
    const element = getActionElement(event, 'data-dragstart-action');
    if (!element || element.dataset.dragstartAction !== 'calendar-item') return;
    handleCalendarDragStart(event, element.dataset.itemType, readDataValue(element, 'recordId'), element.dataset.date);
}

function handleDelegatedDragEnd(event) {
    const element = getActionElement(event, 'data-dragend-action');
    if (element?.dataset.dragendAction === 'calendar-item') handleCalendarDragEnd(event);
}

function handleDelegatedDragOver(event) {
    const element = getActionElement(event, 'data-dragover-action');
    if (element?.dataset.dragoverAction === 'calendar-drop-zone') handleCalendarDragOver(event);
}

function handleDelegatedDragLeave(event) {
    const element = getActionElement(event, 'data-dragleave-action');
    if (element?.dataset.dragleaveAction === 'calendar-drop-zone') handleCalendarDragLeave(event);
}

function handleDelegatedDrop(event) {
    const element = getActionElement(event, 'data-drop-action');
    if (element?.dataset.dropAction === 'calendar-drop-zone') handleCalendarDrop(event);
}
