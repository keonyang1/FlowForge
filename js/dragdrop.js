let isDragRequest = false;

function initDragAndDrop() {
    document.querySelectorAll('.kanban-column').forEach(col => {
        col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('drag-over'); });
        col.addEventListener('dragleave', () => { col.classList.remove('drag-over'); });
        col.addEventListener('drop', async e => {
            e.preventDefault();
            col.classList.remove('drag-over');
            if (isDragRequest) return;
            isDragRequest = true;
            const taskId = e.dataTransfer.getData('text/plain');
            const newStatus = col.dataset.status;
            const task = currentTasks.find(t => t.id === taskId);

            if (!task || task.status === newStatus) {
                isDragRequest = false;
                return;
            }
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
                UI.showToast(err.message, "error");
            } finally {
                isDragRequest = false;
                UI.setGlobalLoading(false);
            }
        });
    });
}