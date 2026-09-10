// js/calendar.js

let currentCalendarView = 'month'; // 'month' | 'week' | 'day'
let calendarSelectedDate = new Date(); // 포커스된 날짜
let currentCalendarYear = new Date().getFullYear();
let currentCalendarMonth = new Date().getMonth(); // 0-11
let calendarFilter = 'all'; // 'all' | 'projects' | 'tasks'

let isDraggingCalendarItem = false;
let draggedCalendarItem = null; // { type: 'task' | 'project', id: string, oldDate: string }

// 날짜 문자열 정규화 (YYYY-MM-DD)
// ISO UTC 문자열(T/Z 포함)과 순수 날짜 문자열(YYYY-MM-DD)을 모두 로컬 기준 날짜로 안전하게 해석
function normalizeDateStr(dateStr) {
    if (!dateStr) return '';
    if (dateStr instanceof Date) {
        if (isNaN(dateStr.getTime())) return '';
        const yy = dateStr.getFullYear();
        const mm = String(dateStr.getMonth() + 1).padStart(2, '0');
        const dd = String(dateStr.getDate()).padStart(2, '0');
        return `${yy}-${mm}-${dd}`;
    }
    const str = String(dateStr).trim();
    // 1. ISO 포맷 (T 또는 Z 포함: 예: 2026-09-14T15:00:00.000Z)
    // GAS가 시트 날짜를 직렬화할 때 생성한 UTC 타임스탬프이므로 로컬 Date로 변환하여 로컬 날짜 추출
    if (str.includes('T') || str.includes('Z')) {
        const dt = new Date(str);
        if (!isNaN(dt.getTime())) {
            const yy = dt.getFullYear();
            const mm = String(dt.getMonth() + 1).padStart(2, '0');
            const dd = String(dt.getDate()).padStart(2, '0');
            return `${yy}-${mm}-${dd}`;
        }
    }
    // 2. 순수 날짜 문자열 (예: 2026-09-15, 2026.09.15, 2026/09/15)
    // new Date('YYYY-MM-DD')의 UTC 자정 파싱에 의한 시차 오차를 방지하기 위해 정규식으로 직접 추출
    const match = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (match) {
        const yy = match[1];
        const mm = String(match[2]).padStart(2, '0');
        const dd = String(match[3]).padStart(2, '0');
        return `${yy}-${mm}-${dd}`;
    }
    // 3. 기타 날짜 포맷 폴백
    const dt = new Date(str);
    if (!isNaN(dt.getTime())) {
        const yy = dt.getFullYear();
        const mm = String(dt.getMonth() + 1).padStart(2, '0');
        const dd = String(dt.getDate()).padStart(2, '0');
        return `${yy}-${mm}-${dd}`;
    }
    return '';
}

function formatDateToYMD(d) {
    if (!d || isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function initCalendar() {
    // 뷰 전환 버튼 바인딩
    const viewBtns = document.querySelectorAll('.btn-view-calendar');
    viewBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const viewType = btn.dataset.view || 'month';
            setCalendarView(viewType);
        });
    });

    // 필터 버튼 바인딩
    const filterBtns = document.querySelectorAll('.btn-filter-calendar');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const filterType = btn.dataset.filter || 'all';
            setCalendarFilter(filterType);
        });
    });
}

function setCalendarView(viewType) {
    if (!['month', 'week', 'day'].includes(viewType)) return;
    currentCalendarView = viewType;

    const viewBtns = document.querySelectorAll('.btn-view-calendar');
    viewBtns.forEach(btn => {
        if (btn.dataset.view === viewType) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    const monthWrap = document.getElementById('calendar-month-view-wrap');
    const weekWrap = document.getElementById('calendar-week-view-wrap');
    const dayWrap = document.getElementById('calendar-day-view-wrap');

    if (monthWrap) monthWrap.style.display = viewType === 'month' ? 'flex' : 'none';
    if (weekWrap) weekWrap.style.display = viewType === 'week' ? 'flex' : 'none';
    if (dayWrap) dayWrap.style.display = viewType === 'day' ? 'flex' : 'none';

    renderCalendar();
}

function setCalendarFilter(type) {
    calendarFilter = type;
    const filterBtns = document.querySelectorAll('.btn-filter-calendar');
    filterBtns.forEach(btn => {
        if (btn.dataset.filter === type) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    renderCalendar();
}

function changeCalendarNav(delta) {
    if (currentCalendarView === 'month') {
        currentCalendarMonth += delta;
        if (currentCalendarMonth < 0) {
            currentCalendarMonth = 11;
            currentCalendarYear -= 1;
        } else if (currentCalendarMonth > 11) {
            currentCalendarMonth = 0;
            currentCalendarYear += 1;
        }
        calendarSelectedDate = new Date(currentCalendarYear, currentCalendarMonth, Math.min(calendarSelectedDate.getDate(), 28));
    } else if (currentCalendarView === 'week') {
        calendarSelectedDate.setDate(calendarSelectedDate.getDate() + (delta * 7));
        currentCalendarYear = calendarSelectedDate.getFullYear();
        currentCalendarMonth = calendarSelectedDate.getMonth();
    } else if (currentCalendarView === 'day') {
        calendarSelectedDate.setDate(calendarSelectedDate.getDate() + delta);
        currentCalendarYear = calendarSelectedDate.getFullYear();
        currentCalendarMonth = calendarSelectedDate.getMonth();
    }
    renderCalendar();
}

function changeCalendarMonth(delta) {
    changeCalendarNav(delta);
}

function goToCalendarToday() {
    calendarSelectedDate = new Date();
    currentCalendarYear = calendarSelectedDate.getFullYear();
    currentCalendarMonth = calendarSelectedDate.getMonth();
    renderCalendar();
}

function selectCalendarDate(dateStr, switchView = false) {
    if (!dateStr) return;
    const parts = dateStr.split('-');
    if (parts.length >= 3) {
        calendarSelectedDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        currentCalendarYear = calendarSelectedDate.getFullYear();
        currentCalendarMonth = calendarSelectedDate.getMonth();
    }
    if (switchView) {
        setCalendarView('day');
    } else {
        renderCalendar();
    }
}

function resetCalendarUI() {
    calendarSelectedDate = new Date();
    currentCalendarYear = calendarSelectedDate.getFullYear();
    currentCalendarMonth = calendarSelectedDate.getMonth();
    currentCalendarView = 'month';
    calendarFilter = 'all';

    const viewBtns = document.querySelectorAll('.btn-view-calendar');
    viewBtns.forEach(btn => {
        if (btn.dataset.view === 'month') btn.classList.add('active');
        else btn.classList.remove('active');
    });

    const filterBtns = document.querySelectorAll('.btn-filter-calendar');
    filterBtns.forEach(btn => {
        if (btn.dataset.filter === 'all') btn.classList.add('active');
        else btn.classList.remove('active');
    });

    const monthWrap = document.getElementById('calendar-month-view-wrap');
    const weekWrap = document.getElementById('calendar-week-view-wrap');
    const dayWrap = document.getElementById('calendar-day-view-wrap');
    if (monthWrap) monthWrap.style.display = 'flex';
    if (weekWrap) weekWrap.style.display = 'none';
    if (dayWrap) dayWrap.style.display = 'none';

    const gridBody = document.getElementById('calendar-grid-body');
    if (gridBody) gridBody.innerHTML = '';
}

// 캘린더 메인 렌더링 라우터
function renderCalendar() {
    const titleEl = document.getElementById('calendar-month-title');
    if (!titleEl) return;

    if (currentCalendarView === 'month') {
        titleEl.textContent = `${currentCalendarYear}년 ${currentCalendarMonth + 1}월`;
        renderMonthView();
    } else if (currentCalendarView === 'week') {
        const startOfWeek = new Date(calendarSelectedDate);
        startOfWeek.setDate(calendarSelectedDate.getDate() - calendarSelectedDate.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);

        const startM = startOfWeek.getMonth() + 1;
        const startD = startOfWeek.getDate();
        const endM = endOfWeek.getMonth() + 1;
        const endD = endOfWeek.getDate();
        titleEl.textContent = `${startOfWeek.getFullYear()}년 ${startM}월 ${startD}일 ~ ${endM}월 ${endD}일`;
        renderWeekView(startOfWeek);
    } else if (currentCalendarView === 'day') {
        const y = calendarSelectedDate.getFullYear();
        const m = calendarSelectedDate.getMonth() + 1;
        const d = calendarSelectedDate.getDate();
        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
        const dayName = dayNames[calendarSelectedDate.getDay()];
        titleEl.textContent = `${y}년 ${m}월 ${d}일 (${dayName})`;
        renderDayView();
    }
}

// 프로젝트 및 작업 날짜 매핑 헬퍼
function getCalendarEventsMap() {
    const projectsMap = {};
    const tasksMap = {};

    if (calendarFilter === 'all' || calendarFilter === 'projects') {
        (currentProjects || []).forEach(proj => {
            const d = normalizeDateStr(proj.due_date);
            if (d) {
                if (!projectsMap[d]) projectsMap[d] = [];
                projectsMap[d].push(proj);
            }
        });
    }

    if (calendarFilter === 'all' || calendarFilter === 'tasks') {
        (currentTasks || []).forEach(task => {
            const d = normalizeDateStr(task.due_date);
            if (d) {
                if (!tasksMap[d]) tasksMap[d] = [];
                tasksMap[d].push(task);
            }
        });
    }

    return { projectsMap, tasksMap };
}

// 1. 월간 뷰 (Month View) 렌더링
function renderMonthView() {
    const gridBody = document.getElementById('calendar-grid-body');
    if (!gridBody) return;

    const todayStr = formatDateToYMD(new Date());

    const firstDayOfWeek = new Date(currentCalendarYear, currentCalendarMonth, 1).getDay();
    const daysInMonth = new Date(currentCalendarYear, currentCalendarMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentCalendarYear, currentCalendarMonth, 0).getDate();

    const { projectsMap, tasksMap } = getCalendarEventsMap();

    let cellsHtml = '';

    // 이전 달 날짜 채우기
    const prevYear = currentCalendarMonth === 0 ? currentCalendarYear - 1 : currentCalendarYear;
    const prevMonth = currentCalendarMonth === 0 ? 11 : currentCalendarMonth - 1;
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
        const dayNum = daysInPrevMonth - i;
        const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        const dayOfWeek = (firstDayOfWeek - 1 - i) % 7;
        cellsHtml += createCalendarCellHtml(dateStr, dayNum, true, dateStr === todayStr, dayOfWeek, projectsMap[dateStr] || [], tasksMap[dateStr] || []);
    }

    // 이번 달 날짜 채우기
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
        const dateStr = `${currentCalendarYear}-${String(currentCalendarMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        const dayOfWeek = (firstDayOfWeek + dayNum - 1) % 7;
        cellsHtml += createCalendarCellHtml(dateStr, dayNum, false, dateStr === todayStr, dayOfWeek, projectsMap[dateStr] || [], tasksMap[dateStr] || []);
    }

    // 다음 달 날짜 채우기: 항상 최대 6주(42칸)를 수용하는 안정적인 고정 그리드 구조
    const totalFilled = firstDayOfWeek + daysInMonth;
    const totalCells = 42; // 6주 × 7일
    const nextCellsNeeded = totalCells - totalFilled;
    const nextYear = currentCalendarMonth === 11 ? currentCalendarYear + 1 : currentCalendarYear;
    const nextMonth = currentCalendarMonth === 11 ? 0 : currentCalendarMonth + 1;
    for (let dayNum = 1; dayNum <= nextCellsNeeded; dayNum++) {
        const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        const dayOfWeek = (totalFilled + dayNum - 1) % 7;
        cellsHtml += createCalendarCellHtml(dateStr, dayNum, true, dateStr === todayStr, dayOfWeek, projectsMap[dateStr] || [], tasksMap[dateStr] || []);
    }

    gridBody.innerHTML = cellsHtml;
}

// 월간 날짜 셀 HTML 생성
function createCalendarCellHtml(dateStr, dayNum, isOtherMonth, isToday, dayOfWeek, projects, tasks) {
    const dayClasses = ['calendar-day-cell'];
    if (isOtherMonth) dayClasses.push('other-month');
    if (isToday) dayClasses.push('is-today');
    if (dayOfWeek === 0) dayClasses.push('is-sunday');
    if (dayOfWeek === 6) dayClasses.push('is-saturday');

    const totalItems = projects.length + tasks.length;
    if (totalItems > 0) dayClasses.push('has-events');

    let itemsHtml = '';
    // 셀 높이(104px)가 일정 개수에 의해 늘어나지 않도록 최대 2개 표시 후 초과분은 +N개 더보기 버튼 표시
    const maxVisible = totalItems > 2 ? 2 : 2;
    let renderedCount = 0;

    // 프로젝트 항목 렌더링
    for (let i = 0; i < projects.length && renderedCount < maxVisible; i++) {
        const proj = projects[i];
        const isDone = proj.status === '완료됨';
        const doneClass = isDone ? ' is-done' : '';
        itemsHtml += `
            <div class="calendar-item calendar-item-project${doneClass}"
                 draggable="true"
                 ondragstart="handleCalendarDragStart(event, 'project', '${proj.id}', '${dateStr}')"
                 ondragend="handleCalendarDragEnd(event)"
                 onclick="handleCalendarItemClick(event, 'project', '${proj.id}')"
                 title="[프로젝트] ${proj.title} (${proj.status})">
                <i class="fas fa-folder"></i>
                <span class="calendar-item-text">${proj.title}</span>
            </div>`;
        renderedCount++;
    }

    // 작업 항목 렌더링 (우선순위 및 마감 임박 강조)
    for (let i = 0; i < tasks.length && renderedCount < maxVisible; i++) {
        const task = tasks[i];
        const isDone = task.status === 'Done';
        const doneClass = isDone ? ' is-done' : '';
        const prio = (task.priority || 'medium').toLowerCase();
        const prioClass = `prio-${prio}`;
        const diff = typeof getDueDateDiff === 'function' ? getDueDateDiff(task.due_date) : null;
        const isImminent = !isDone && task.priority === 'High' && diff !== null && diff <= 1;
        const imminentClass = isImminent ? ' is-imminent' : '';
        const icon = isDone ? 'fa-check-circle' : 'fa-circle-dot';

        itemsHtml += `
            <div class="calendar-item calendar-item-task ${prioClass}${imminentClass}${doneClass}"
                 draggable="true"
                 ondragstart="handleCalendarDragStart(event, 'task', '${task.id}', '${dateStr}')"
                 ondragend="handleCalendarDragEnd(event)"
                 onclick="handleCalendarItemClick(event, 'task', '${task.id}')"
                 title="[작업] ${task.title} (중요도: ${task.priority || 'Medium'}, 상태: ${task.status})">
                <span class="prio-indicator prio-${prio}"></span>
                <i class="fas ${icon}"></i>
                <span class="calendar-item-text">${task.title}</span>
            </div>`;
        renderedCount++;
    }

    // 초과 항목 더보기 버튼
    if (totalItems > maxVisible) {
        const moreCount = totalItems - maxVisible;
        itemsHtml += `
            <button type="button" class="calendar-more-btn" onclick="event.stopPropagation(); selectCalendarDate('${dateStr}', true)" title="${moreCount}개 일정 더보기 (일간 뷰로 이동)">
                +${moreCount}개 더보기
            </button>`;
    }

    const todayBadge = isToday ? `<span class="calendar-today-badge">오늘</span>` : '';

    return `
        <div class="${dayClasses.join(' ')}"
             data-date="${dateStr}"
             ondragover="handleCalendarDragOver(event)"
             ondragleave="handleCalendarDragLeave(event)"
             ondrop="handleCalendarDrop(event)"
             onclick="selectCalendarDate('${dateStr}', true)">
            <div class="calendar-day-header">
                <span class="calendar-day-num">${dayNum}</span>
                ${todayBadge}
            </div>
            <div class="calendar-day-items">
                ${itemsHtml}
            </div>
        </div>`;
}

// 2. 주간 뷰 (Week View) 렌더링
function renderWeekView(startOfWeek) {
    const weekWrap = document.getElementById('calendar-week-view-wrap');
    if (!weekWrap) return;

    const todayStr = formatDateToYMD(new Date());
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const { projectsMap, tasksMap } = getCalendarEventsMap();

    let gridHtml = '<div class="calendar-week-grid">';

    for (let i = 0; i < 7; i++) {
        const curDate = new Date(startOfWeek);
        curDate.setDate(startOfWeek.getDate() + i);
        const dateStr = formatDateToYMD(curDate);
        const dayNum = curDate.getDate();
        const isToday = dateStr === todayStr;
        const projects = projectsMap[dateStr] || [];
        const tasks = tasksMap[dateStr] || [];

        let colClasses = ['calendar-week-col'];
        if (isToday) colClasses.push('is-today');
        if (i === 0) colClasses.push('is-sunday');
        if (i === 6) colClasses.push('is-saturday');

        const nameColorClass = i === 0 ? ' text-danger' : (i === 6 ? ' text-info' : '');

        let itemsHtml = '';
        // 프로젝트 렌더링
        projects.forEach(proj => {
            const isDone = proj.status === '완료됨';
            const doneClass = isDone ? ' is-done' : '';
            itemsHtml += `
                <div class="calendar-item calendar-item-project${doneClass}"
                     draggable="true"
                     ondragstart="handleCalendarDragStart(event, 'project', '${proj.id}', '${dateStr}')"
                     ondragend="handleCalendarDragEnd(event)"
                     onclick="handleCalendarItemClick(event, 'project', '${proj.id}')"
                     title="[프로젝트] ${proj.title}">
                    <i class="fas fa-folder"></i>
                    <span class="calendar-item-text">${proj.title}</span>
                </div>`;
        });

        // 작업 렌더링
        tasks.forEach(task => {
            const isDone = task.status === 'Done';
            const doneClass = isDone ? ' is-done' : '';
            const prio = (task.priority || 'medium').toLowerCase();
            const prioClass = `prio-${prio}`;
            const diff = typeof getDueDateDiff === 'function' ? getDueDateDiff(task.due_date) : null;
            const isImminent = !isDone && task.priority === 'High' && diff !== null && diff <= 1;
            const imminentClass = isImminent ? ' is-imminent' : '';
            const icon = isDone ? 'fa-check-circle' : 'fa-circle-dot';

            itemsHtml += `
                <div class="calendar-item calendar-item-task ${prioClass}${imminentClass}${doneClass}"
                     draggable="true"
                     ondragstart="handleCalendarDragStart(event, 'task', '${task.id}', '${dateStr}')"
                     ondragend="handleCalendarDragEnd(event)"
                     onclick="handleCalendarItemClick(event, 'task', '${task.id}')"
                     title="[작업] ${task.title} (중요도: ${task.priority || 'Medium'})">
                    <span class="prio-indicator prio-${prio}"></span>
                    <i class="fas ${icon}"></i>
                    <span class="calendar-item-text">${task.title}</span>
                </div>`;
        });

        const todayBadge = isToday ? `<span class="calendar-today-badge">오늘</span>` : '';

        gridHtml += `
            <div class="${colClasses.join(' ')}"
                 data-date="${dateStr}"
                 ondragover="handleCalendarDragOver(event)"
                 ondragleave="handleCalendarDragLeave(event)"
                 ondrop="handleCalendarDrop(event)">
                <div class="calendar-week-col-header" onclick="selectCalendarDate('${dateStr}', true)" title="클릭하여 일간 뷰로 이동">
                    <span class="calendar-week-day-name${nameColorClass}">${dayNames[i]}</span>
                    <span class="calendar-week-day-num">${dayNum}</span>
                    ${todayBadge}
                </div>
                <div class="calendar-week-items">
                    ${itemsHtml}
                </div>
            </div>`;
    }

    gridHtml += '</div>';
    weekWrap.innerHTML = gridHtml;
}

// 3. 일간 뷰 (Day View) 렌더링
function renderDayView() {
    const dayWrap = document.getElementById('calendar-day-view-wrap');
    if (!dayWrap) return;

    const dateStr = formatDateToYMD(calendarSelectedDate);
    const projects = (currentProjects || []).filter(p => normalizeDateStr(p.due_date) === dateStr);
    const tasks = (currentTasks || []).filter(t => normalizeDateStr(t.due_date) === dateStr);

    let html = `
        <div class="calendar-day-view"
             data-date="${dateStr}"
             ondragover="handleCalendarDragOver(event)"
             ondragleave="handleCalendarDragLeave(event)"
             ondrop="handleCalendarDrop(event)">
            <div class="calendar-day-view-header">
                <div class="calendar-day-view-date">
                    <i class="far fa-calendar-check" style="color: var(--accent-color);"></i>
                    <span>${dateStr} 일정 집중 보기</span>
                </div>
                <button type="button" class="btn-secondary" onclick="setCalendarView('month')" style="font-size: 0.8rem; padding: 0.35rem 0.75rem;">
                    <i class="fas fa-calendar-days"></i> 월간 뷰로 돌아가기
                </button>
            </div>`;

    if (projects.length === 0 && tasks.length === 0) {
        html += `
            <div class="calendar-day-empty">
                <i class="fas fa-calendar-xmark" style="font-size: 2.75rem; opacity: 0.35; margin-bottom: 0.5rem;"></i>
                <h4 style="font-size: 1.05rem; font-weight: 600;">예정된 일정이 없습니다</h4>
                <p style="font-size: 0.85rem; color: var(--text-secondary);">이 날짜에 마감되는 프로젝트나 작업이 등록되어 있지 않습니다.</p>
            </div>`;
    } else {
        html += '<div class="calendar-day-sections">';

        // 프로젝트 섹션
        html += `
            <div class="calendar-day-section">
                <div class="calendar-day-section-header">
                    <span><i class="fas fa-folder" style="color: var(--accent-color); margin-right: 0.4rem;"></i> 마감 프로젝트</span>
                    <span class="badge bg-default">${projects.length}개</span>
                </div>
                <div class="calendar-day-list">`;

        if (projects.length === 0) {
            html += `<p style="font-size: 0.8rem; color: var(--text-muted); padding: 1rem 0; text-align: center;">마감 예정 프로젝트가 없습니다.</p>`;
        } else {
            projects.forEach(p => {
                const statusBadge = p.status === '완료됨' ? 'bg-success' : (p.status === '진행 중' ? 'bg-warning' : 'bg-default');
                const doneClass = p.status === '완료됨' ? ' is-done' : '';
                html += `
                    <div class="calendar-day-card${doneClass}" onclick="openProjectDetail('${p.id}')">
                        <div class="calendar-day-card-top">
                            <span class="calendar-day-card-title"><i class="fas fa-folder" style="color: var(--accent-color); margin-right: 0.35rem;"></i> ${p.title}</span>
                            <span class="badge ${statusBadge}">${p.status}</span>
                        </div>
                        <p class="calendar-day-card-desc">${p.description || '프로젝트 설명이 없습니다.'}</p>
                    </div>`;
            });
        }
        html += `</div></div>`;

        // 작업 섹션
        html += `
            <div class="calendar-day-section">
                <div class="calendar-day-section-header">
                    <span><i class="fas fa-tasks" style="color: var(--info-color); margin-right: 0.4rem;"></i> 마감 작업</span>
                    <span class="badge bg-default">${tasks.length}개</span>
                </div>
                <div class="calendar-day-list">`;

        if (tasks.length === 0) {
            html += `<p style="font-size: 0.8rem; color: var(--text-muted); padding: 1rem 0; text-align: center;">마감 예정 작업이 없습니다.</p>`;
        } else {
            tasks.forEach(t => {
                const isDone = t.status === 'Done';
                const prioKor = t.priority === 'High' ? '높음' : (t.priority === 'Medium' ? '보통' : '낮음');
                const prioColor = t.priority === 'High' ? 'danger-color' : (t.priority === 'Medium' ? 'warning-color' : 'info-color');
                const statusKor = t.status === 'Done' ? '완료됨' : (t.status === 'In Progress' ? '진행 중' : '해야 할 일');
                const statusBadge = t.status === 'Done' ? 'bg-success' : (t.status === 'In Progress' ? 'bg-warning' : 'bg-default');
                const proj = t.project_id ? (currentProjects || []).find(p => p.id === t.project_id) : null;
                const projName = proj ? proj.title : '독립 작업';
                const doneClass = isDone ? ' is-done' : '';

                html += `
                    <div class="calendar-day-card${doneClass}" onclick="openTaskDetail('${t.id}')">
                        <div class="calendar-day-card-top">
                            <span class="calendar-day-card-title">
                                <i class="fas ${isDone ? 'fa-check-circle text-success' : 'fa-circle-dot'}" style="margin-right: 0.35rem;"></i>
                                ${t.title}
                            </span>
                            <span class="badge ${statusBadge}">${statusKor}</span>
                        </div>
                        <p class="calendar-day-card-desc">${t.description || '작업 설명이 없습니다.'}</p>
                        <div class="calendar-day-card-bottom">
                            <span class="badge bg-default" style="font-size: 0.7rem;"><i class="fas fa-folder-open"></i> ${projName}</span>
                            <span style="font-size: 0.725rem; font-weight: 600; color: var(--${prioColor});">
                                <span class="prio-indicator prio-${(t.priority || 'medium').toLowerCase()}"></span> 중요도: ${prioKor}
                            </span>
                        </div>
                    </div>`;
            });
        }
        html += `</div></div>`;

        html += '</div>';
    }

    html += '</div>';
    dayWrap.innerHTML = html;
}

// ==========================================
// 드래그 앤 드롭 마감일 변경 핸들러
// ==========================================
function handleCalendarDragStart(e, type, id, dateStr) {
    if (window.innerWidth <= 768) {
        e.preventDefault();
        return false;
    }
    isDraggingCalendarItem = true;
    draggedCalendarItem = { type, id, oldDate: dateStr };
    try {
        e.dataTransfer.setData('application/json', JSON.stringify(draggedCalendarItem));
    } catch (err) {
        // fallback
    }
    e.dataTransfer.effectAllowed = 'move';
    if (e.currentTarget) e.currentTarget.classList.add('dragging');
}

function handleCalendarDragEnd(e) {
    if (e.currentTarget) e.currentTarget.classList.remove('dragging');
    setTimeout(() => {
        isDraggingCalendarItem = false;
        draggedCalendarItem = null;
    }, 150);
}

function handleCalendarItemClick(e, type, id) {
    e.stopPropagation();
    if (isDraggingCalendarItem) return;
    if (type === 'project') {
        if (typeof openProjectDetail === 'function') openProjectDetail(id);
    } else if (type === 'task') {
        if (typeof openTaskDetail === 'function') openTaskDetail(id);
    }
}

function handleCalendarDragOver(e) {
    e.preventDefault();
    if (!isDraggingCalendarItem && !draggedCalendarItem) return;
    e.dataTransfer.dropEffect = 'move';
    const cell = e.currentTarget;
    if (cell && !cell.classList.contains('calendar-drop-target')) {
        cell.classList.add('calendar-drop-target');
    }
}

function handleCalendarDragLeave(e) {
    const cell = e.currentTarget;
    if (cell) cell.classList.remove('calendar-drop-target');
}

async function handleCalendarDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const cell = e.currentTarget;
    if (cell) cell.classList.remove('calendar-drop-target');

    let itemInfo = draggedCalendarItem;
    if (!itemInfo) {
        try {
            const dataStr = e.dataTransfer.getData('application/json');
            if (dataStr) itemInfo = JSON.parse(dataStr);
        } catch (err) {}
    }
    if (!itemInfo || !itemInfo.id) return;

    const targetDateStr = cell.dataset.date;
    if (!targetDateStr) return;

    if (itemInfo.oldDate === targetDateStr) return;

    await updateCalendarItemDueDate(itemInfo.type, itemInfo.id, targetDateStr, itemInfo.oldDate);
}

// 마감일 비동기 업데이트 (낙관적 업데이트 및 실패 시 롤백)
async function updateCalendarItemDueDate(type, id, newDateStr, oldDateStr) {
    const user = typeof AppAPI !== 'undefined' ? AppAPI.getUser() : null;
    if (!user) {
        if (typeof UI !== 'undefined') UI.showToast('로그인이 필요합니다.', 'error');
        return;
    }

    let itemToUpdate = null;
    let originalDate = oldDateStr;

    if (type === 'task') {
        itemToUpdate = (currentTasks || []).find(t => t.id === id);
        if (!itemToUpdate) return;
        originalDate = itemToUpdate.due_date;
        itemToUpdate.due_date = newDateStr;
        if (typeof allTasks !== 'undefined' && Array.isArray(allTasks)) {
            const at = allTasks.find(t => t.id === id);
            if (at) at.due_date = newDateStr;
        }
    } else if (type === 'project') {
        itemToUpdate = (currentProjects || []).find(p => p.id === id);
        if (!itemToUpdate) return;
        originalDate = itemToUpdate.due_date;
        itemToUpdate.due_date = newDateStr;
        if (typeof allProjects !== 'undefined' && Array.isArray(allProjects)) {
            const ap = allProjects.find(p => p.id === id);
            if (ap) ap.due_date = newDateStr;
        }
    }

    // 화면 낙관적 업데이트
    renderCalendar();

    try {
        let res;
        if (type === 'task') {
            res = await AppAPI.updateTask({
                task_id: itemToUpdate.id,
                user_id: user.user_id,
                project_id: itemToUpdate.project_id || '',
                title: itemToUpdate.title,
                description: itemToUpdate.description || '',
                priority: itemToUpdate.priority || 'Medium',
                status: itemToUpdate.status || 'To Do',
                due_date: newDateStr
            });
        } else if (type === 'project') {
            res = await AppAPI.updateProject({
                project_id: itemToUpdate.id,
                user_id: user.user_id,
                title: itemToUpdate.title,
                description: itemToUpdate.description || '',
                status: itemToUpdate.status || '계획 됨',
                due_date: newDateStr
            });
        }

        if (!res || !res.success) {
            throw new Error((res && res.message) || '서버 응답 오류');
        }

        if (typeof UI !== 'undefined') {
            UI.showToast(`마감일이 ${newDateStr}로 변경되었습니다.`, 'success');
        }

        // 백그라운드 동기화 (작업 보드/대시보드 등 새로고침)
        if (typeof renderTasks === 'function') renderTasks();
        if (typeof renderProjects === 'function') renderProjects();
    } catch (err) {
        console.error('마감일 변경 실패:', err);
        // 실패 시 롤백
        if (type === 'task') {
            itemToUpdate.due_date = originalDate;
            if (typeof allTasks !== 'undefined' && Array.isArray(allTasks)) {
                const at = allTasks.find(t => t.id === id);
                if (at) at.due_date = originalDate;
            }
        } else if (type === 'project') {
            itemToUpdate.due_date = originalDate;
            if (typeof allProjects !== 'undefined' && Array.isArray(allProjects)) {
                const ap = allProjects.find(p => p.id === id);
                if (ap) ap.due_date = originalDate;
            }
        }
        renderCalendar();
        if (typeof UI !== 'undefined') {
            UI.showToast(err.message || '마감일 변경에 실패하여 원래 날짜로 복구되었습니다.', 'error');
        }
    }
}

// 4. 모달 호환용 헬퍼 (기존 코드 및 테스트 호환)
function openCalendarDayModal(dateStr) {
    selectCalendarDate(dateStr, true);
}

function closeCalendarDayModal() {
    if (typeof UI !== 'undefined' && UI.closeModal) {
        UI.closeModal('calendar-day-modal');
    }
}

window.initCalendar = initCalendar;
window.setCalendarFilter = setCalendarFilter;
window.setCalendarView = setCalendarView;
window.changeCalendarMonth = changeCalendarMonth;
window.changeCalendarNav = changeCalendarNav;
window.goToCalendarToday = goToCalendarToday;
window.selectCalendarDate = selectCalendarDate;
window.resetCalendarUI = resetCalendarUI;
window.renderCalendar = renderCalendar;
window.createCalendarCellHtml = createCalendarCellHtml;
window.openCalendarDayModal = openCalendarDayModal;
window.closeCalendarDayModal = closeCalendarDayModal;
window.handleCalendarDragStart = handleCalendarDragStart;
window.handleCalendarDragEnd = handleCalendarDragEnd;
window.handleCalendarDragOver = handleCalendarDragOver;
window.handleCalendarDragLeave = handleCalendarDragLeave;
window.handleCalendarDrop = handleCalendarDrop;
window.updateCalendarItemDueDate = updateCalendarItemDueDate;
window.normalizeDateStr = normalizeDateStr;
