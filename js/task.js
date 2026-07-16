window.openEditTaskModal = function(id) { UI.openTaskModal('edit', id); };

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

function deleteTask(taskId) {
    UI.confirm('작업 삭제', '이 작업을 삭제하시겠습니까?', async () => {
        UI.setGlobalLoading(true);
        const res = await AppAPI.deleteTask(taskId);
        if(res.success) { UI.showToast('작업이 삭제되었습니다.'); loadAppData(); } else UI.showToast(res.message, 'error');
        UI.setGlobalLoading(false);
    });
}