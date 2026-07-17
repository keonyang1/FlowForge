function renderDashboard() {
    document.getElementById('stat-total').textContent = currentProjects.length;
    document.getElementById('stat-active').textContent = currentProjects.filter(p => p.status !== '완료됨').length;
    document.getElementById('stat-done').textContent = currentProjects.filter(p => p.status === '완료됨').length;
    document.getElementById('stat-tasks').textContent = currentTasks.filter(t => t.status !== 'Done').length;

    const list = document.getElementById('dashboard-recent-tasks');
    list.innerHTML = '';

    const urgentTasks = currentTasks
        .filter(t => t.status !== 'Done' && t.due_date)
        .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
        .slice(0, 4);

    if (urgentTasks.length === 0) {
        list.innerHTML =
            '<div style="color: var(--text-muted); text-align: center; padding: 2.5rem 0; background: var(--bg-surface); border: 1px dashed var(--border-color); border-radius: var(--radius-lg);"><i class="fas fa-coffee" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i><br>마감이 임박한 작업이 없습니다!<br>편안한 하루 되세요 🎉</div>';
        return;
    }

    urgentTasks.forEach(task => {
        const diff = Math.ceil(
            (new Date(task.due_date) - new Date().setHours(0, 0, 0, 0)) /
                86400000
        );

        const dtext =
            diff < 0
                ? `D+${Math.abs(diff)} 지연`
                : diff === 0
                ? '오늘 마감'
                : `D-${diff}`;

        const color =
            diff <= 2
                ? 'color: var(--danger-color); font-weight:600;'
                : 'color: var(--text-muted);';

        list.innerHTML += `
        <div class="dashboard-list-item">
            <div>
                <h4>${task.title}</h4>
                <p>${currentProjects.find(p=>p.id===task.project_id)?.title || '소속 없음'}</p>
            </div>
            <span style="font-size:.85rem;${color}">
                <i class="far fa-clock"></i> ${dtext}
            </span>
        </div>`;
    });
}

function renderAnalytics() {
    const pContent = document.getElementById('analytics-projects-content');
    if (currentProjects.length === 0) { pContent.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:2rem 0;">데이터가 부족합니다.</p>'; }
    else {
        const pCounts = { '계획 됨': 0, '진행 중': 0, '완료됨': 0 };
        currentProjects.forEach(p => { if(pCounts[p.status] !== undefined) pCounts[p.status]++; });
        const total = currentProjects.length;
        
        pContent.innerHTML = '';
        [ {l:'계획됨', k:'계획 됨', c:'var(--warning-color)'}, {l:'진행 중', k:'진행 중', c:'var(--info-color)'}, {l:'완료됨', k:'완료됨', c:'var(--success-color)'} ].forEach(item => {
            const pct = Math.round((pCounts[item.k] / total) * 100) || 0;
            pContent.innerHTML += `
                <div class="stat-bar-row">
                    <div class="stat-bar-info"><span>${item.l}</span><span>${pCounts[item.k]}개 (${pct}%)</span></div>
                    <div class="progress-container"><div class="progress-bar" style="width: ${pct}%; background-color: ${item.c};"></div></div>
                </div>`;
        });
    }

    const tContent = document.getElementById('analytics-tasks-content');
    if (currentTasks.length === 0) { tContent.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:2rem 0;">데이터가 부족합니다.</p>'; }
    else {
        const tCounts = { 'To Do': 0, 'In Progress': 0, 'Done': 0 };
        currentTasks.forEach(t => { if(tCounts[t.status] !== undefined) tCounts[t.status]++; });
        const total = currentTasks.length;
        
        tContent.innerHTML = '';
        [ {l:'해야 할 일 (To Do)', k:'To Do', c:'var(--text-muted)'}, {l:'진행 중 (In Progress)', k:'In Progress', c:'var(--warning-color)'}, {l:'완료됨 (Done)', k:'Done', c:'var(--success-color)'} ].forEach(item => {
            const pct = Math.round((tCounts[item.k] / total) * 100) || 0;
            tContent.innerHTML += `
                <div class="stat-bar-row">
                    <div class="stat-bar-info"><span>${item.l}</span><span>${tCounts[item.k]}개 (${pct}%)</span></div>
                    <div class="progress-container"><div class="progress-bar" style="width: ${pct}%; background-color: ${item.c};"></div></div>
                </div>`;
        });
    }
}