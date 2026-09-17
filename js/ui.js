// js/ui.js

function initTheme() {
    const savedTheme = localStorage.getItem('flowforge_theme') || 'dark';
    document.body.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
    document.getElementById('btn-theme-toggle').onclick = () => {
        const current = document.body.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.body.setAttribute('data-theme', next);
        localStorage.setItem('flowforge_theme', next);
        updateThemeIcon(next);
    };
}
function updateThemeIcon(theme) { document.querySelector('#btn-theme-toggle i').className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon'; }

const UI = {
    setSyncState(state) {
        const button = document.getElementById('sync-status');
        const label = document.getElementById('sync-status-text');
        if (!button || !label) return;
        const labels = { idle: '연결 대기', loading: '불러오는 중', synced: '조회 완료', cached: '일부 이전 데이터', error: '조회 실패 · 재시도' };
        button.dataset.state = state;
        button.disabled = state === 'loading' || state === 'idle';
        label.textContent = labels[state] || labels.idle;
        button.title = state === 'cached' ? '일부 데이터는 이전에 저장된 내용입니다. 클릭하여 다시 불러오세요.' : '데이터 다시 불러오기';
    },
    switchPage(pageId) {
        if (pageId === 'project-detail' && !currentProjectId) pageId = 'projects';
        if (!document.getElementById(pageId + '-page')) pageId = 'dashboard';
        document.querySelectorAll('main .page-section, .nav-item').forEach(el => el.classList.remove('active'));
        document.getElementById(pageId + '-page').classList.add('active');
        
        const activePageId = pageId === 'project-detail' ? 'projects' : pageId;
        document.querySelectorAll('.nav-item').forEach(nav => {
            nav.classList.toggle('active', nav.dataset.page === activePageId);
        });
        
        const searchBox = document.getElementById('global-search');
        if (searchBox && searchBox.value !== '') {
            searchBox.value = '';
            searchBox.dispatchEvent(new Event('input'));
        }
        sessionStorage.setItem("flowforge_current_page", pageId);
    },
    modalFocus: new Map(),
    modalLayer: 10000,
    openModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        if (!modal.classList.contains('show')) this.modalFocus.set(id, document.activeElement);
        modal.style.zIndex = String(++this.modalLayer);
        modal.classList.add('show');
        const target = modal.querySelector('input:not([type=hidden]), select, textarea, button');
        if (target) target.focus();
    },
    
    closeModal(id) { 
        const modal = document.getElementById(id);
        if(!modal) return;
        modal.classList.remove('show');
        if (id === 'task-detail-modal') currentDetailTaskId = null;
        const previousFocus = this.modalFocus.get(id);
        this.modalFocus.delete(id);
        if (previousFocus?.isConnected) previousFocus.focus();
        const form = modal.querySelector('form');
        if(form) form.reset();
        modal.querySelectorAll('.pw-input-wrapper').forEach(wrapper => {
            const input = wrapper.querySelector('input');
            const button = wrapper.querySelector('.pw-toggle-btn');
            if (input) input.type = 'password';
            if (button) {
                button.setAttribute('aria-pressed', 'false');
                button.setAttribute('aria-label', '비밀번호 표시');
                button.querySelector('i').className = 'fas fa-eye';
            }
        });
        if(id === 'help-modal' && typeof stopHelpAnimation === 'function') {
            stopHelpAnimation();
        }
    },
    handleOutsideClick(event, id) {
        if(event.target.id === id) this.closeModal(id);
    },
    
    // 비밀번호 표시/숨기기 토글 로직 추가
    togglePasswordVisibility(inputId, btnElement) {
        const input = document.getElementById(inputId);
        const icon = btnElement.querySelector('i');
        btnElement.setAttribute('aria-pressed', String(input.type === 'password'));
        btnElement.setAttribute('aria-label', input.type === 'password' ? '비밀번호 숨기기' : '비밀번호 표시');
        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    },
    
    openProjectModal(mode = 'create', projId = null) {
        const form = document.getElementById('form-project');
        const title = document.getElementById('project-modal-title');
        const submitBtn = document.getElementById('btn-submit-proj');
        
        form.reset();
        form.dataset.mode = mode;
        if (projId) {
            form.dataset.id = projId;
        } else {
            delete form.dataset.id;
        }

        if (mode === 'edit') {
            title.textContent = '프로젝트 수정';
            submitBtn.textContent = '저장하기';
            const proj = currentProjects.find(p => p.id === projId);
            if(proj) {
                document.getElementById('proj-title').value = proj.title;
                document.getElementById('proj-desc').value = proj.description || '';
                document.getElementById('proj-status').value = proj.status;
                if(proj.due_date) document.getElementById('proj-date').value = getFormatDate(proj.due_date);
            }
        } else {
            title.textContent = '새 프로젝트 생성';
            submitBtn.textContent = '생성하기';
            document.getElementById('proj-status').value = '계획 됨';
        }
        this.openModal('project-modal');
    },
            
    openTaskModal(mode = 'create', taskId = null, defaultProjectId = null) {
        const form = document.getElementById('form-task');
        const title = document.getElementById('task-modal-title');
        const submitBtn = document.getElementById('btn-submit-task');
        const select = document.getElementById('task-project');
        
        form.reset();
        
        select.replaceChildren();
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = '선택 안함';
        select.appendChild(emptyOption);
        currentProjects.forEach(p => {
            const option = document.createElement('option');
            option.value = p.id;
            option.textContent = p.title || '';
            select.appendChild(option);
        });
        
        form.dataset.mode = mode;
        if (taskId) {
            form.dataset.id = taskId;
        } else {
            delete form.dataset.id;
        }

        if (mode === 'edit') {
            title.textContent = '작업 수정';
            submitBtn.textContent = '저장하기';
            const task = currentTasks.find(t => t.id === taskId);
            if(task) {
                document.getElementById('task-title').value = task.title;
                document.getElementById('task-desc').value = task.description || '';
                document.getElementById('task-project').value = task.project_id || '';
                document.getElementById('task-priority').value = task.priority;
                if(task.due_date) document.getElementById('task-date').value = getFormatDate(task.due_date);
            }
        } else {
            title.textContent = '새 작업 추가';
            submitBtn.textContent = '추가';
            if (defaultProjectId) {
                document.getElementById('task-project').value = defaultProjectId;
            } else if (typeof currentProjectId !== 'undefined' && currentProjectId && sessionStorage.getItem("flowforge_current_page") === 'project-detail') {
                document.getElementById('task-project').value = currentProjectId;
            }
        }
        this.openModal('task-modal');
    },
            
    showToast(msg, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        const variants = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            ai: 'fa-magic'
        };
        const toastType = Object.prototype.hasOwnProperty.call(variants, type) ? type : 'success';
        toast.className = 'toast ' + toastType;
        const icon = document.createElement('i');
        icon.className = 'fas ' + variants[toastType];
        const message = document.createElement('span');
        message.textContent = String(msg ?? '');
        toast.append(icon, document.createTextNode(' '), message);
        container.appendChild(toast);
        setTimeout(() => { toast.classList.add('fadeOut'); setTimeout(() => toast.remove(), 300); }, 3000);
    },

    confirm(title, msg, onConfirm, onCancel) {
        const modal = document.getElementById('confirm-modal');
        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-msg').innerHTML  = msg;
        const btnOk = document.getElementById('btn-confirm-ok'), btnCancel = document.getElementById('btn-confirm-cancel');
        const newBtnOk = btnOk.cloneNode(true), newBtnCancel = btnCancel.cloneNode(true);
        btnOk.parentNode.replaceChild(newBtnOk, btnOk); btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);
        
        let isHandled = false;
        const handleCancel = () => {
            if (isHandled) return;
            isHandled = true;
            this.closeModal('confirm-modal');
            if (typeof onCancel === 'function') onCancel();
        };

        const handleConfirm = () => {
            if (isHandled) return;
            isHandled = true;
            this.closeModal('confirm-modal');
            if (typeof onConfirm === 'function') onConfirm();
        };

        modal.onclick = (e) => {
            if (e.target === modal) handleCancel();
        };

        newBtnCancel.addEventListener('click', handleCancel);
        newBtnOk.addEventListener('click', handleConfirm);
        this.openModal('confirm-modal');
    },
    loadingCount: 0,
    loadingTimer: null,
    setGlobalLoading(isLoad) {
        this.loadingCount = Math.max(0, this.loadingCount + (isLoad ? 1 : -1));
        const loader = document.getElementById('global-loader');
        clearTimeout(this.loadingTimer);
        const loading = this.loadingCount > 0;
        loader.setAttribute('aria-hidden', String(!loading));
        if (loading) {
            loader.style.display = 'flex';
            loader.style.opacity = '1';
        } else {
            loader.style.opacity = '0';
            this.loadingTimer = setTimeout(() => { loader.style.display = 'none'; }, 300);
        }
    },
    lockButton(button, loadingText = "처리 중...") {
        if (!button || button.disabled) return;
        button.dataset.originalText = button.innerHTML;
        button.disabled = true;
        button.style.pointerEvents = "none";
        button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${escapeHtml(loadingText)}`;
    },
    unlockButton(button) {
        if (!button) return;
        button.disabled = false;
        button.style.pointerEvents = "";
        if (button.dataset.originalText) {
            button.innerHTML = button.dataset.originalText;
        }
    }
};

// Keyboard access for every modal, including the initial login dialog.
function initAccessibility() {
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        const heading = modal.querySelector('h3, .brand');
        if (heading) {
            if (!heading.id) heading.id = modal.id + '-heading';
            modal.setAttribute('aria-labelledby', heading.id);
        }
    });
    document.querySelectorAll('.form-group').forEach(group => {
        const label = group.querySelector('label');
        const input = group.querySelector('input[id], select[id], textarea[id]');
        if (label && input && !label.htmlFor) label.htmlFor = input.id;
    });
    document.querySelectorAll('.modal-close').forEach(button => button.setAttribute('aria-label', '닫기'));
    document.querySelectorAll('.pw-toggle-btn').forEach(button => {
        button.setAttribute('aria-label', '비밀번호 표시');
        button.setAttribute('aria-pressed', 'false');
    });
    document.addEventListener('keydown', event => {
        const modals = [...document.querySelectorAll('.modal-overlay.show')];
        const modal = modals.sort((a, b) => Number(getComputedStyle(a).zIndex) - Number(getComputedStyle(b).zIndex)).at(-1);
        if (!modal) return;
        if (event.key === 'Escape' && modal.id !== 'auth-overlay') {
            event.preventDefault();
            if (modal.id === 'confirm-modal') document.getElementById('btn-confirm-cancel').click();
            else UI.closeModal(modal.id);
        }
        if (event.key !== 'Tab') return;
        const focusable = [...modal.querySelectorAll('button, input, select, textarea, a[href], [tabindex="0"]')]
            .filter(el => !el.disabled && el.getClientRects().length);
        if (!focusable.length) return;
        const first = focusable[0], last = focusable.at(-1);
        if (!modal.contains(document.activeElement) || (event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
            event.preventDefault();
            (event.shiftKey ? last : first).focus();
        }
    });
}
