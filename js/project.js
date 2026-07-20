let isProjectRequest = false;

window.openEditProjectModal = function(id) { UI.openProjectModal('edit', id); };
window.confirmCompleteProject = function(projId) {
    UI.confirm('프로젝트 완료', '정말로 프로젝트를 완료 처리하시겠습니까?<br>완료된 프로젝트는 더 이상 상태를 변경하거나 수정할 수 없습니다.', () => {
        updateProjectStatus(projId, '완료됨');
    });
};

function renderProjects() {
    const container = document.getElementById('project-container');
    container.innerHTML = '';
            
    if (currentProjects.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-folder-open"></i><h3>프로젝트가 없습니다</h3><p>새 프로젝트를 생성하여 업무를 관리해보세요.</p><button class="btn-primary" style="margin-top: 1rem;" onclick="UI.openProjectModal('create')">첫 번째 프로젝트 만들기</button></div>`;
        return;
    }

    currentProjects.forEach(proj => {
        const tasks = currentTasks.filter(t => t.project_id === proj.id);
        const completed = tasks.filter(t => t.status === "Done").length;
        const total = tasks.length;
        const progress = total === 0 ? 0 : Math.round((completed / total) * 100);

        const diff = proj.due_date ? Math.ceil((new Date(proj.due_date) - new Date().setHours(0,0,0,0)) / 86400000) : null;
        const dday = diff === null ? { t: '기한 없음', c: 'bg-default' } : (diff > 0 ? { t: `D-${diff}`, c: 'bg-info' } : (diff === 0 ? { t: 'D-Day', c: 'bg-warning' } : { t: `D+${Math.abs(diff)} 지연`, c: 'bg-danger' }));
        const statusColor = proj.status === '완료됨' ? 'bg-success' : (proj.status === '진행 중' ? 'bg-warning' : 'bg-default');
                
        const completeBtnHtml = proj.status !== '완료됨' 
            ? `<button class="btn-success" onclick="confirmCompleteProject('${proj.id}')" style="margin-right: 0.5rem;" title="프로젝트 완료 처리"><i class="fas fa-check"></i> 완료</button>`
            : ``;

        const editBtnHtml = proj.status !== '완료됨' 
            ? `<button class="btn-edit-item" onclick="openEditProjectModal('${proj.id}')" title="프로젝트 수정"><i class="fas fa-edit"></i></button>`
            : `<button class="btn-edit-item" onclick="UI.showToast('완료 처리된 프로젝트는 수정할 수 없습니다.', 'warning')" title="수정 불가 (완료됨)" style="opacity: 0.3; cursor: not-allowed;"><i class="fas fa-lock"></i></button>`;

        container.innerHTML += `
            <div class="project-card search-target">
                <div class="project-header">
                    <span class="badge ${statusColor}">${proj.status}</span>
                    <div style="display: flex; align-items: center; gap: 0.25rem;">
                        ${completeBtnHtml}
                        ${editBtnHtml}
                        <button class="btn-delete-item" onclick="deleteProject('${proj.id}')" title="프로젝트 삭제"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
                <h3 class="project-title search-text">${proj.title}</h3>
                <p class="project-desc search-text" title="${proj.description || ''}">${proj.description || '설명이 없습니다.'}</p>
                <div class="project-progress">
                    <div class="progress-container">
                        <div class="progress-bar" style="width:${progress}%"></div>
                    </div>

                    <div class="project-progress-info">
                        <span>${completed} / ${total} 완료</span>
                        <span>${progress}%</span>
                    </div>
                </div>
                <div class="project-footer">
                    <span class="badge ${dday.c}">${dday.t}</span>
                    <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500;"><i class="far fa-calendar"></i> 목표: ${formatFriendlyDate(proj.due_date)}</span>
                </div>
            </div>`;
    });
}

async function updateProjectStatus(projId, status) {
    if (isProjectRequest) return;
    isProjectRequest = true;
    const buttons = document.querySelectorAll(
        ".btn-success, .btn-edit-item, .btn-delete-item"
    );
    buttons.forEach(btn => btn.disabled = true);
    UI.setGlobalLoading(true);
    try {
        const res = await AppAPI.updateProjectStatus(projId, status);
        if (!res.success) {
            throw new Error(res.message);
        }
        await loadAppData();
        UI.showToast(`프로젝트가 ${status} 처리되었습니다.`);
    } catch (e) {
        UI.showToast(e.message, "error");
    } finally {
        buttons.forEach(btn => btn.disabled = false);
        isProjectRequest = false;
        UI.setGlobalLoading(false);
    }
}

function deleteProject(projId) {
    UI.confirm('프로젝트 삭제', '이 프로젝트를 삭제하시겠습니까?<br>프로젝트와 관련된 모든 작업이 함께 삭제됩니다.', async () => {
        UI.setGlobalLoading(true);
        const res = await AppAPI.deleteProject(projId, AppAPI.getUser().user_id);
        if(res.success) { UI.showToast('프로젝트가 삭제되었습니다.'); loadAppData(); } else UI.showToast(res.message, 'error');
        UI.setGlobalLoading(false);
    });
}


function initProject() {
    document.getElementById("form-project").onsubmit = async (e) => {
        if (isProjectRequest) return;
        isProjectRequest = true;
        e.preventDefault();
        const submitBtn = document.getElementById("btn-submit-proj");
        const form = e.target;
        const mode = form.dataset.mode;
        const data = {
            title: document.getElementById("proj-title").value.trim(),
            description: document.getElementById("proj-desc").value.trim(),
            status: document.getElementById("proj-status").value,
            due_date: document.getElementById("proj-date").value,
            user_id: AppAPI.getUser().user_id
        };

        UI.lockButton(
            submitBtn,
            form.dataset.mode === "create"
                ? "생성 중..."
                : "저장 중..."
        );
        UI.setGlobalLoading(true);
        
        try {
            let res;
            if (mode === "create") {
                res = await AppAPI.addProject(data);
            } else {
                data.project_id = form.dataset.id;
                res = await AppAPI.updateProject(data);
            }
            if (!res.success) {
                throw new Error(res.message);
            }
            UI.closeModal("project-modal");
            await loadAppData();
            UI.showToast(
                mode === "create"
                    ? "프로젝트가 생성되었습니다."
                    : "프로젝트가 수정되었습니다."
            );
        } catch (err) {
            UI.showToast(err.message, "error");
        } finally {
            isProjectRequest = false;
            UI.unlockButton(submitBtn);
            UI.setGlobalLoading(false);
        }
    };
}