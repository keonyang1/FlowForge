// js/analytics.js

function renderDashboard() {
    const totalProjects = currentProjects.length;
    const activeProjects = currentProjects.filter(p => p.status === "진행 중").length;
    const completedProjects = currentProjects.filter(p => p.status === "완료됨").length;

    const totalTasks = currentTasks.length;
    const completedTasks = currentTasks.filter(t => t.status === "Done").length;
    const pendingTasks = totalTasks - completedTasks;

    // 1. 평균 프로젝트 진행률 계산
    let avgProgress = 0;
    if (totalProjects > 0) {
        const sumPercent = currentProjects.reduce((sum, p) => {
            const prog = typeof getProjectProgress === 'function' ? getProjectProgress(p.id).percent : 0;
            return sum + prog;
        }, 0);
        avgProgress = Math.round(sumPercent / totalProjects);
    }

    // 2. 미완료 작업 중 지연 작업과 마감 임박 작업 분류 (완료된 작업은 절대 지연 목록에 포함하지 않음)
    const overdueTasks = [];
    const urgentTasks = [];

    currentTasks.forEach(task => {
        if (task.status === 'Done') return;
        const diff = getDueDateDiff(task.due_date);
        if (diff === null) return;
        if (diff < 0) {
            overdueTasks.push({ task, diff });
        } else if (diff <= 3) {
            urgentTasks.push({ task, diff });
        }
    });

    // 지연 작업: 지연일수 큰 순서 (diff 오름차순, e.g. -5 -> -1)
    overdueTasks.sort((a, b) => a.diff - b.diff);

    // 마감 임박 작업: 마감일 가까운 순서 (diff 오름차순, e.g. 0 -> 1 -> 2 -> 3)
    urgentTasks.sort((a, b) => a.diff - b.diff);

    // 3. 상단 통계 수치 갱신
    const elStatTotal = document.getElementById("stat-total");
    if (elStatTotal) elStatTotal.textContent = totalProjects;

    const elStatActive = document.getElementById("stat-active");
    if (elStatActive) elStatActive.textContent = activeProjects;

    const elStatDone = document.getElementById("stat-done");
    if (elStatDone) elStatDone.textContent = completedProjects;

    const elStatTasksTotal = document.getElementById("stat-tasks-total");
    if (elStatTasksTotal) elStatTasksTotal.textContent = totalTasks;

    const elStatTasksDone = document.getElementById("stat-tasks-done");
    if (elStatTasksDone) elStatTasksDone.textContent = completedTasks;

    const elStatTasksPending = document.getElementById("stat-tasks-pending");
    if (elStatTasksPending) elStatTasksPending.textContent = pendingTasks;

    const elStatTasksLegacy = document.getElementById("stat-tasks");
    if (elStatTasksLegacy) elStatTasksLegacy.textContent = `${pendingTasks} / ${totalTasks}`;

    const elStatAvgProgress = document.getElementById("stat-avg-progress");
    if (elStatAvgProgress) elStatAvgProgress.textContent = `${avgProgress}%`;

    const elStatAvgBar = document.getElementById("stat-avg-progress-bar");
    if (elStatAvgBar) elStatAvgBar.style.width = `${avgProgress}%`;

    const elStatAlertTotal = document.getElementById("stat-alert-total");
    if (elStatAlertTotal) elStatAlertTotal.textContent = overdueTasks.length + urgentTasks.length;

    const elStatOverdue = document.getElementById("stat-overdue-count");
    if (elStatOverdue) elStatOverdue.textContent = overdueTasks.length;

    const elStatUrgent = document.getElementById("stat-urgent-count");
    if (elStatUrgent) elStatUrgent.textContent = urgentTasks.length;

    const elBadgeOverdue = document.getElementById("badge-overdue-count");
    if (elBadgeOverdue) elBadgeOverdue.textContent = overdueTasks.length;

    const elBadgeUrgent = document.getElementById("badge-urgent-count");
    if (elBadgeUrgent) elBadgeUrgent.textContent = urgentTasks.length;

    // 4. 진행 중인 프로젝트 렌더링
    const activeProjsContainer = document.getElementById('dashboard-active-projects');
    if (activeProjsContainer) {
        activeProjsContainer.innerHTML = '';
        const activeList = currentProjects.filter(p => p.status === '진행 중');
        if (activeList.length === 0) {
            activeProjsContainer.innerHTML = `
                <div class="dashboard-empty" style="grid-column: 1 / -1;">
                    <i class="fas fa-folder-open"></i>
                    <p>현재 진행 중인 프로젝트가 없습니다.<br><span style="font-size: 0.8rem; opacity: 0.7;">새 프로젝트를 시작하거나 기존 프로젝트의 상태를 '진행 중'으로 변경해보세요.</span></p>
                </div>`;
        } else {
            activeList.forEach(proj => {
                const { percent, completed, total } = typeof getProjectProgress === 'function'
                    ? getProjectProgress(proj.id)
                    : { percent: 0, completed: 0, total: 0 };
                const diff = getDueDateDiff(proj.due_date);
                const ddayText = diff === null ? '기한 없음' : (diff > 0 ? `D-${diff}` : (diff === 0 ? 'D-Day' : `D+${Math.abs(diff)} 지연`));
                const ddayColor = diff === null ? 'bg-default' : (diff > 0 ? 'bg-info' : (diff === 0 ? 'bg-warning' : 'bg-danger'));

                activeProjsContainer.innerHTML += `
                    <div class="dashboard-project-card" onclick="openProjectDetail('${proj.id}')" title="프로젝트 상세 페이지로 이동">
                        <div class="dashboard-project-card-header">
                            <h4 class="dashboard-project-card-title">${proj.title}</h4>
                            <span class="badge ${ddayColor}" style="font-size: 0.7rem;">${ddayText}</span>
                        </div>
                        <div class="project-progress" style="margin: 0;">
                            <div class="progress-container" style="height: 6px;">
                                <div class="progress-bar" style="width: ${percent}%;"></div>
                            </div>
                            <div class="project-progress-info" style="font-size: 0.775rem; margin-top: 0.35rem;">
                                <span>${completed} / ${total} 작업 완료</span>
                                <span style="font-weight: 600; color: var(--accent-color);">${percent}%</span>
                            </div>
                        </div>
                        <div class="dashboard-project-card-footer">
                            <span><i class="far fa-calendar"></i> 목표: ${formatFriendlyDate(proj.due_date)}</span>
                            <span style="color: var(--accent-color); font-weight: 500;">상세보기 <i class="fas fa-arrow-right" style="font-size: 0.7rem;"></i></span>
                        </div>
                    </div>`;
            });
        }
    }

    // 5. 지연된 작업 렌더링
    const overdueContainer = document.getElementById('dashboard-overdue-tasks');
    if (overdueContainer) {
        overdueContainer.innerHTML = '';
        const displayOverdue = overdueTasks.slice(0, 5);
        if (displayOverdue.length === 0) {
            overdueContainer.innerHTML = `
                <div class="dashboard-empty" style="color: var(--success-color);">
                    <i class="fas fa-circle-check" style="color: var(--success-color); opacity: 0.85;"></i>
                    <p style="color: var(--text-primary); font-weight: 600; margin-bottom: 0.25rem;">지연된 작업이 없습니다!</p>
                    <span style="font-size: 0.8rem; color: var(--text-muted);">모든 작업이 일정에 맞춰 잘 진행되고 있습니다 🎉</span>
                </div>`;
        } else {
            displayOverdue.forEach(({ task, diff }) => {
                const proj = task.project_id ? currentProjects.find(p => p.id === task.project_id) : null;
                const projName = proj ? proj.title : (task.project_id ? '삭제된 프로젝트' : '독립 작업');
                const prioColor = task.priority === 'High' ? 'danger-color' : (task.priority === 'Medium' ? 'warning-color' : 'info-color');
                const prioKor = task.priority === 'High' ? '높음' : (task.priority === 'Medium' ? '보통' : '낮음');

                overdueContainer.innerHTML += `
                    <div class="dashboard-list-item" onclick="openTaskDetail('${task.id}')" title="작업 상세 보기">
                        <div class="dashboard-list-item-main">
                            <h4 class="dashboard-list-item-title">${task.title}</h4>
                            <div class="dashboard-list-item-meta">
                                <span><i class="fas fa-folder" style="font-size: 0.7rem; color: var(--accent-color);"></i> ${projName}</span>
                                <span style="color: var(--${prioColor}); border: 1px solid var(--${prioColor}); border-radius: 3px; padding: 0.05rem 0.35rem; font-size: 0.7rem; font-weight: 600;">${prioKor}</span>
                            </div>
                        </div>
                        <div class="dashboard-list-item-badge">
                            <span class="badge bg-danger" style="font-size: 0.75rem; font-weight: 600;">
                                <i class="fas fa-triangle-exclamation"></i> D+${Math.abs(diff)} 지연
                            </span>
                        </div>
                    </div>`;
            });
        }
    }

    // 6. 마감 임박 작업 렌더링
    const urgentContainer = document.getElementById('dashboard-urgent-tasks');
    if (urgentContainer) {
        urgentContainer.innerHTML = '';
        const displayUrgent = urgentTasks.slice(0, 5);
        if (displayUrgent.length === 0) {
            urgentContainer.innerHTML = `
                <div class="dashboard-empty">
                    <i class="fas fa-calendar-check"></i>
                    <p style="font-weight: 500; margin-bottom: 0.25rem;">다가오는 마감 작업이 없습니다.</p>
                    <span style="font-size: 0.8rem; opacity: 0.7;">3일 이내에 마감 예정인 작업이 없습니다.</span>
                </div>`;
        } else {
            displayUrgent.forEach(({ task, diff }) => {
                const proj = task.project_id ? currentProjects.find(p => p.id === task.project_id) : null;
                const projName = proj ? proj.title : (task.project_id ? '삭제된 프로젝트' : '독립 작업');
                const prioColor = task.priority === 'High' ? 'danger-color' : (task.priority === 'Medium' ? 'warning-color' : 'info-color');
                const prioKor = task.priority === 'High' ? '높음' : (task.priority === 'Medium' ? '보통' : '낮음');
                const dtext = diff === 0 ? '오늘 마감' : `D-${diff}`;

                urgentContainer.innerHTML += `
                    <div class="dashboard-list-item" onclick="openTaskDetail('${task.id}')" title="작업 상세 보기">
                        <div class="dashboard-list-item-main">
                            <h4 class="dashboard-list-item-title">${task.title}</h4>
                            <div class="dashboard-list-item-meta">
                                <span><i class="fas fa-folder" style="font-size: 0.7rem; color: var(--accent-color);"></i> ${projName}</span>
                                <span style="color: var(--${prioColor}); border: 1px solid var(--${prioColor}); border-radius: 3px; padding: 0.05rem 0.35rem; font-size: 0.7rem; font-weight: 600;">${prioKor}</span>
                            </div>
                        </div>
                        <div class="dashboard-list-item-badge">
                            <span class="badge bg-warning" style="font-size: 0.75rem; font-weight: 600;">
                                <i class="far fa-clock"></i> ${dtext}
                            </span>
                        </div>
                    </div>`;
            });
        }
    }

    // 7. 최근 작업 렌더링
    const recentContainer = document.getElementById('dashboard-recent-tasks');
    if (recentContainer) {
        recentContainer.innerHTML = '';
        if (currentTasks.length === 0) {
            recentContainer.innerHTML = `
                <div class="dashboard-empty">
                    <i class="fas fa-tasks"></i>
                    <p style="font-weight: 500; margin-bottom: 0.25rem;">등록된 작업이 없습니다.</p>
                    <span style="font-size: 0.8rem; opacity: 0.7;">상단의 '+ 새 작업 추가' 버튼으로 첫 번째 작업을 등록해보세요!</span>
                </div>`;
        } else {
            const recentList = [...currentTasks].sort((a, b) => {
                if (a.created_at && b.created_at) {
                    const diff = new Date(b.created_at) - new Date(a.created_at);
                    if (!isNaN(diff) && diff !== 0) return diff;
                }
                return String(b.id || '').localeCompare(String(a.id || ''), undefined, { numeric: true });
            }).slice(0, 5);

            recentList.forEach(task => {
                const proj = task.project_id ? currentProjects.find(p => p.id === task.project_id) : null;
                const projName = proj ? proj.title : (task.project_id ? '삭제된 프로젝트' : '독립 작업');
                const prioColor = task.priority === 'High' ? 'danger-color' : (task.priority === 'Medium' ? 'warning-color' : 'info-color');
                const prioKor = task.priority === 'High' ? '높음' : (task.priority === 'Medium' ? '보통' : '낮음');
                const statusColor = task.status === 'Done' ? 'bg-success' : (task.status === 'In Progress' ? 'bg-warning' : 'bg-default');
                const statusKor = task.status === 'Done' ? '완료됨' : (task.status === 'In Progress' ? '진행 중' : '해야 할 일');

                recentContainer.innerHTML += `
                    <div class="dashboard-list-item" onclick="openTaskDetail('${task.id}')" title="작업 상세 보기">
                        <div class="dashboard-list-item-main">
                            <h4 class="dashboard-list-item-title" style="${task.status === 'Done' ? 'text-decoration: line-through; color: var(--text-muted);' : ''}">${task.title}</h4>
                            <div class="dashboard-list-item-meta">
                                <span><i class="fas fa-folder" style="font-size: 0.7rem; color: var(--accent-color);"></i> ${projName}</span>
                                <span style="color: var(--${prioColor}); border: 1px solid var(--${prioColor}); border-radius: 3px; padding: 0.05rem 0.35rem; font-size: 0.7rem; font-weight: 600;">${prioKor}</span>
                                <span><i class="far fa-calendar"></i> ${formatFriendlyDate(task.due_date)}</span>
                            </div>
                        </div>
                        <div class="dashboard-list-item-badge">
                            <span class="badge ${statusColor}" style="font-size: 0.725rem;">${statusKor}</span>
                        </div>
                    </div>`;
            });
        }
    }
}

function renderAnalytics() {
    const totalProjects = currentProjects.length;
    const totalTasks = currentTasks.length;
    const completedTasks = currentTasks.filter(t => t.status === "Done").length;

    // 1. 평균 프로젝트 진행률 계산 (getProjectProgress 재사용)
    let avgProgress = 0;
    if (totalProjects > 0) {
        const sumPercent = currentProjects.reduce((sum, p) => {
            const prog = typeof getProjectProgress === 'function' ? getProjectProgress(p.id).percent : 0;
            return sum + prog;
        }, 0);
        avgProgress = Math.round(sumPercent / totalProjects);
    }

    // 2. 작업 완료율 계산
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // 3. 지연 작업 계산 (Done 상태가 아니고 마감일이 지난 작업)
    let overdueCount = 0;
    currentTasks.forEach(t => {
        if (t.status === 'Done') return;
        const diff = getDueDateDiff(t.due_date);
        if (diff !== null && diff < 0) {
            overdueCount++;
        }
    });

    // 4. 상단 KPI 수치 갱신
    const elKpiProjects = document.getElementById('analytics-stat-projects');
    if (elKpiProjects) elKpiProjects.textContent = totalProjects;

    const elKpiAvgProg = document.getElementById('analytics-stat-avg-progress');
    if (elKpiAvgProg) elKpiAvgProg.textContent = `${avgProgress}%`;

    const elKpiTasks = document.getElementById('analytics-stat-tasks');
    if (elKpiTasks) elKpiTasks.textContent = totalTasks;

    const elKpiCompRate = document.getElementById('analytics-stat-completion-rate');
    if (elKpiCompRate) elKpiCompRate.textContent = `${completionRate}%`;

    const elKpiCompSub = document.getElementById('analytics-stat-completion-sub');
    if (elKpiCompSub) elKpiCompSub.textContent = `${completedTasks} / ${totalTasks} 완료`;

    const elKpiOverdue = document.getElementById('analytics-stat-overdue');
    if (elKpiOverdue) elKpiOverdue.textContent = overdueCount;

    // 5. [중단 좌측] 프로젝트 진행 현황
    const pContent = document.getElementById('analytics-projects-content');
    if (pContent) {
        if (totalProjects === 0) {
            pContent.innerHTML = `
                <div class="analytics-empty">
                    <i class="fas fa-folder-open"></i>
                    <p>등록된 프로젝트가 없습니다.<br><span style="font-size: 0.8rem; opacity: 0.7;">새 프로젝트를 생성하여 체계적으로 업무를 관리해보세요.</span></p>
                </div>`;
        } else {
            pContent.innerHTML = '';
            currentProjects.forEach(proj => {
                const { percent, completed, total } = typeof getProjectProgress === 'function'
                    ? getProjectProgress(proj.id)
                    : { percent: 0, completed: 0, total: 0 };
                const statusBadge = proj.status === '완료됨' ? 'bg-success' : (proj.status === '진행 중' ? 'bg-info' : 'bg-default');

                pContent.innerHTML += `
                    <div class="analytics-project-item" onclick="openProjectDetail('${proj.id}')" title="프로젝트 상세 보기로 이동">
                        <div class="analytics-project-header">
                            <span class="analytics-project-title">
                                <i class="fas fa-folder" style="color: var(--accent-color); font-size: 0.85rem;"></i>
                                ${proj.title}
                            </span>
                            <div class="analytics-project-meta">
                                <span class="badge ${statusBadge}" style="font-size: 0.7rem;">${proj.status}</span>
                                <span><i class="far fa-calendar"></i> ${formatFriendlyDate(proj.due_date)}</span>
                            </div>
                        </div>
                        <div class="progress-container" style="height: 6px;">
                            <div class="progress-bar" style="width: ${percent}%;"></div>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 0.775rem; color: var(--text-muted); margin-top: 0.4rem;">
                            <span>${completed} / ${total} 작업 완료</span>
                            <span style="font-weight: 600; color: var(--accent-color);">${percent}%</span>
                        </div>
                    </div>`;
            });
        }
    }

    // 6. [중단 우측] 작업 상태 분포
    const tContent = document.getElementById('analytics-tasks-content');
    if (tContent) {
        if (totalTasks === 0) {
            tContent.innerHTML = `
                <div class="analytics-empty">
                    <i class="fas fa-tasks"></i>
                    <p>등록된 작업이 없습니다.<br><span style="font-size: 0.8rem; opacity: 0.7;">작업을 추가하여 상태별 분포를 확인해보세요.</span></p>
                </div>`;
        } else {
            const tCounts = { 'To Do': 0, 'In Progress': 0, 'Done': 0 };
            currentTasks.forEach(t => { if (tCounts[t.status] !== undefined) tCounts[t.status]++; });

            tContent.innerHTML = '';
            const statusConfig = [
                { label: '해야 할 일 (To Do)', key: 'To Do', color: 'var(--info-color)', icon: 'fas fa-list-ul' },
                { label: '진행 중 (In Progress)', key: 'In Progress', color: 'var(--warning-color)', icon: 'fas fa-spinner' },
                { label: '완료됨 (Done)', key: 'Done', color: 'var(--success-color)', icon: 'fas fa-circle-check' }
            ];

            statusConfig.forEach(item => {
                const count = tCounts[item.key] || 0;
                const pct = Math.round((count / totalTasks) * 100);
                tContent.innerHTML += `
                    <div class="analytics-stat-row">
                        <div class="analytics-stat-header">
                            <span class="analytics-stat-label">
                                <i class="${item.icon}" style="color: ${item.color}; font-size: 0.8rem;"></i>
                                ${item.label}
                            </span>
                            <span class="analytics-stat-badge">${count}개 · ${pct}%</span>
                        </div>
                        <div class="progress-container" style="height: 8px;">
                            <div class="progress-bar" style="width: ${pct}%; background-color: ${item.color};"></div>
                        </div>
                    </div>`;
            });
        }
    }

    // 7. [하단 좌측] 작업 중요도 분석
    const prioContent = document.getElementById('analytics-priority-content');
    if (prioContent) {
        if (totalTasks === 0) {
            prioContent.innerHTML = `
                <div class="analytics-empty">
                    <i class="fas fa-flag"></i>
                    <p>등록된 작업이 없습니다.<br><span style="font-size: 0.8rem; opacity: 0.7;">작업 등록 시 중요도를 설정하여 리스크를 관리하세요.</span></p>
                </div>`;
        } else {
            const pCounts = { 'High': 0, 'Medium': 0, 'Low': 0 };
            currentTasks.forEach(t => { if (pCounts[t.priority] !== undefined) pCounts[t.priority]++; });

            prioContent.innerHTML = '';
            const prioConfig = [
                { label: '높음 (High)', key: 'High', color: 'var(--danger-color)', icon: 'fas fa-angles-up' },
                { label: '보통 (Medium)', key: 'Medium', color: 'var(--warning-color)', icon: 'fas fa-angle-up' },
                { label: '낮음 (Low)', key: 'Low', color: 'var(--info-color)', icon: 'fas fa-angle-down' }
            ];

            prioConfig.forEach(item => {
                const count = pCounts[item.key] || 0;
                const pct = Math.round((count / totalTasks) * 100);
                prioContent.innerHTML += `
                    <div class="analytics-stat-row">
                        <div class="analytics-stat-header">
                            <span class="analytics-stat-label">
                                <i class="${item.icon}" style="color: ${item.color}; font-size: 0.8rem;"></i>
                                ${item.label}
                            </span>
                            <span class="analytics-stat-badge">${count}개 · ${pct}%</span>
                        </div>
                        <div class="progress-container" style="height: 8px;">
                            <div class="progress-bar" style="width: ${pct}%; background-color: ${item.color};"></div>
                        </div>
                    </div>`;
            });
        }
    }

    // 8. [하단 우측] 마감 상태 분석
    const dueContent = document.getElementById('analytics-due-content');
    if (dueContent) {
        if (totalTasks === 0) {
            dueContent.innerHTML = `
                <div class="analytics-empty">
                    <i class="fas fa-calendar-check"></i>
                    <p>등록된 작업이 없습니다.<br><span style="font-size: 0.8rem; opacity: 0.7;">작업 마감 일정을 지정하여 납기 일정을 한눈에 파악하세요.</span></p>
                </div>`;
        } else {
            const dCounts = { 'overdue': 0, 'today': 0, 'soon': 0, 'upcoming': 0, 'done': 0 };

            currentTasks.forEach(t => {
                if (t.status === 'Done') {
                    dCounts['done']++;
                } else {
                    const diff = getDueDateDiff(t.due_date);
                    if (diff !== null && diff < 0) {
                        dCounts['overdue']++;
                    } else if (diff === 0) {
                        dCounts['today']++;
                    } else if (diff !== null && diff > 0 && diff <= 3) {
                        dCounts['soon']++;
                    } else {
                        dCounts['upcoming']++;
                    }
                }
            });

            dueContent.innerHTML = '';
            const dueConfig = [
                { label: '지연됨', key: 'overdue', color: 'var(--danger-color)', icon: 'fas fa-triangle-exclamation' },
                { label: '오늘 마감', key: 'today', color: 'var(--warning-color)', icon: 'far fa-clock' },
                { label: '3일 이내', key: 'soon', color: 'var(--accent-color)', icon: 'fas fa-fire' },
                { label: '여유 있음', key: 'upcoming', color: 'var(--info-color)', icon: 'far fa-calendar-days' },
                { label: '완료', key: 'done', color: 'var(--success-color)', icon: 'fas fa-circle-check' }
            ];

            dueConfig.forEach(item => {
                const count = dCounts[item.key] || 0;
                const pct = Math.round((count / totalTasks) * 100);
                dueContent.innerHTML += `
                    <div class="analytics-stat-row">
                        <div class="analytics-stat-header">
                            <span class="analytics-stat-label">
                                <i class="${item.icon}" style="color: ${item.color}; font-size: 0.8rem;"></i>
                                ${item.label}
                            </span>
                            <span class="analytics-stat-badge">${count}개 · ${pct}%</span>
                        </div>
                        <div class="progress-container" style="height: 8px;">
                            <div class="progress-bar" style="width: ${pct}%; background-color: ${item.color};"></div>
                        </div>
                    </div>`;
            });
        }
    }

    // 9. [하단 전체] 프로젝트별 작업 완료율
    const ptContent = document.getElementById('analytics-project-tasks-content');
    if (ptContent) {
        if (totalProjects === 0) {
            ptContent.innerHTML = `
                <div class="analytics-empty">
                    <i class="fas fa-diagram-project"></i>
                    <p>등록된 프로젝트가 없습니다.<br><span style="font-size: 0.8rem; opacity: 0.7;">프로젝트를 등록하고 작업을 연결하여 프로젝트별 완료율을 확인해보세요.</span></p>
                </div>`;
        } else {
            ptContent.innerHTML = '';
            currentProjects.forEach(proj => {
                const { percent, completed, total } = typeof getProjectProgress === 'function'
                    ? getProjectProgress(proj.id)
                    : { percent: 0, completed: 0, total: 0 };
                
                const taskMetaText = total === 0 ? '작업 없음' : `완료 ${completed} / 전체 ${total}`;
                const barColor = percent === 100 ? 'var(--success-color)' : 'var(--accent-color)';

                ptContent.innerHTML += `
                    <div class="analytics-project-item" onclick="openProjectDetail('${proj.id}')" title="프로젝트 상세 보기로 이동">
                        <div class="analytics-project-header">
                            <span class="analytics-project-title">
                                <i class="fas fa-folder" style="color: var(--accent-color); font-size: 0.85rem;"></i>
                                ${proj.title}
                            </span>
                            <div class="analytics-project-meta">
                                <span>${taskMetaText}</span>
                                <span style="font-weight: 600; color: ${barColor};">${percent}%</span>
                            </div>
                        </div>
                        <div class="progress-container" style="height: 8px;">
                            <div class="progress-bar" style="width: ${percent}%; background-color: ${barColor};"></div>
                        </div>
                    </div>`;
            });
        }
    }
}