function initDragAndDrop() {
    document.querySelectorAll('.kanban-column').forEach(col => {
        col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('drag-over'); });
        col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
        col.addEventListener('drop', async e => {
            e.preventDefault(); col.classList.remove('drag-over');
            const taskId = e.dataTransfer.getData('text/plain');
            const newStatus = col.dataset.status;
            
            const task = currentTasks.find(t => t.id === taskId);
            if (task && task.status !== newStatus) {
                task.status = newStatus;
                renderTasks();
                
                try {
                    const res = await AppAPI.updateTaskStatus(taskId, newStatus);
                    if(res.success) {
                        UI.showToast(`상태가 변경되었습니다: ${newStatus}`);
                        loadAppData();
                    } else { throw new Error(res.message); }
                } catch (err) {
                    UI.showToast(err.message, 'error');
                    loadAppData();
                }
            }
        });
    });
}