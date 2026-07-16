window.openEditProjectModal = function(id) { UI.openProjectModal('edit', id); };
window.confirmCompleteProject = function(projId) {
    UI.confirm('프로젝트 완료', '정말로 프로젝트를 완료 처리하시겠습니까? 완료된 프로젝트는 더 이상 상태를 변경하거나 수정할 수 없습니다.', () => {
        updateProjectStatus(projId, '완료됨');
    });
};

async function loadAppData() {
    const user = AppAPI.getUser();
    if(!user) return;
    UI.setGlobalLoading(true);
    try {
        const [pRes, tRes] = await Promise.all([AppAPI.getProjects(user.id), AppAPI.getTasks(user.id)]);
        if (pRes.success) currentProjects = pRes.projects;
        if (tRes.success) currentTasks = tRes.tasks;

        renderProjects(); renderTasks(); renderDashboard(); renderAnalytics();
    } catch (e) { UI.showToast(e.message, 'error'); } 
    finally { UI.setGlobalLoading(false); }
}

function renderProjects() {
    const container = document.getElementById('project-container');
    container.innerHTML = '';
            
    if (currentProjects.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-folder-open"></i><h3>프로젝트가 없습니다</h3><p>새 프로젝트를 생성하여 업무를 관리해보세요.</p><button class="btn-primary" style="margin-top: 1rem;" onclick="UI.openProjectModal('create')">첫 번째 프로젝트 만들기</button></div>`;
        return;
    }

    currentProjects.forEach(proj => {
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
                <p class="project-desc search-text" title="${proj.desc || ''}">${proj.desc || '설명이 없습니다.'}</p>
                <div style="margin-top: 1.5rem;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 0.4rem; font-weight: 500;">
                        <span>진행률</span><span>${proj.progress}%</span>
                    </div>
                    <div class="progress-container"><div class="progress-bar" style="width: ${proj.progress}%;"></div></div>
                </div>
                <div class="project-footer">
                    <span class="badge ${dday.c}">${dday.t}</span>
                    <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500;"><i class="far fa-calendar"></i> 목표: ${formatFriendlyDate(proj.due_date)}</span>
                </div>
            </div>`;
    });
}

async function updateProjectStatus(projId, status) {
    UI.setGlobalLoading(true);
    try {
        const res = await AppAPI.updateProjectStatus(projId, status);
        if(res.success) { UI.showToast(`프로젝트가 ${status} 처리되었습니다.`); loadAppData(); }
        else throw new Error(res.message);
    } catch(e) { UI.showToast(e.message, 'error'); }
    finally { UI.setGlobalLoading(false); }
}

function deleteProject(projId) {
    UI.confirm('프로젝트 삭제', '이 프로젝트와 관련된 모든 작업이 함께 삭제될 수 있습니다.', async () => {
        UI.setGlobalLoading(true);
        const res = await AppAPI.deleteProject(projId, AppAPI.getUser().id);
        if(res.success) { UI.showToast('프로젝트가 삭제되었습니다.'); loadAppData(); } else UI.showToast(res.message, 'error');
        UI.setGlobalLoading(false);
    });
}