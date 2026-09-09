// js/dragdrop.js

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
            try {
                const taskId = e.dataTransfer.getData('text/plain');
                const newStatus = col.dataset.status;
                if (typeof changeTaskStatus === 'function') {
                    await changeTaskStatus(taskId, newStatus);
                }
            } finally {
                isDragRequest = false;
            }
        });
    });
}