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
    switchPage(pageId) {
        document.querySelectorAll('.page-section, .nav-item').forEach(el => el.classList.remove('active'));
        document.getElementById(pageId + '-page').classList.add('active');
        
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(nav => {
            if(nav.getAttribute('onclick') && nav.getAttribute('onclick').includes(pageId)) nav.classList.add('active');
        });
        
        const searchBox = document.getElementById('global-search');
        if (searchBox) { searchBox.value = ''; searchBox.dispatchEvent(new Event('input')); }
    },
    openModal(id) { document.getElementById(id).classList.add('show'); },
    
    closeModal(id) { 
        const modal = document.getElementById(id);
        modal.classList.remove('show'); 
        const form = modal.querySelector('form');
        if(form) form.reset(); 
    },
    handleOutsideClick(event, id) {
        if(event.target.id === id) this.closeModal(id);
    },
    
    // 비밀번호 표시/숨기기 토글 로직 추가
    togglePasswordVisibility(inputId, btnElement) {
        const input = document.getElementById(inputId);
        const icon = btnElement.querySelector('i');
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
            
    openTaskModal(mode = 'create', taskId = null) {
        const form = document.getElementById('form-task');
        const title = document.getElementById('task-modal-title');
        const submitBtn = document.getElementById('btn-submit-task');
        const select = document.getElementById('task-project');
        
        select.innerHTML = '<option value="">선택 안함</option>';
        currentProjects.forEach(p => select.innerHTML += `<option value="${p.id}">${p.title}</option>`);
        
        form.reset();
        form.dataset.mode = mode;
        form.dataset.id = taskId || '';

        if (mode === 'edit') {
            title.textContent = '작업 수정';
            submitBtn.textContent = '저장하기';
            const task = currentTasks.find(t => t.id === taskId);
            if(task) {
                document.getElementById('task-title').value = task.title;
                document.getElementById('task-project').value = task.project_id || '';
                document.getElementById('task-priority').value = task.priority;
                if(task.due_date) document.getElementById('task-date').value = getFormatDate(task.due_date);
            }
        } else {
            title.textContent = '새 작업 추가';
            submitBtn.textContent = '추가';
        }
        this.openModal('task-modal');
    },
            
    showToast(msg, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        let icon = 'fa-check-circle';
        if(type === 'error') icon = 'fa-exclamation-circle';
        if(type === 'warning') icon = 'fa-exclamation-triangle';
        if(type === 'ai') icon = 'fa-magic';

        toast.innerHTML = `<i class="fas ${icon}"></i> <span>${msg}</span>`;
        container.appendChild(toast);
        setTimeout(() => { toast.classList.add('fadeOut'); setTimeout(() => toast.remove(), 300); }, 3000);
    },

    confirm(title, msg, onConfirm) {
        const modal = document.getElementById('confirm-modal');
        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-msg').textContent = msg;
        const btnOk = document.getElementById('btn-confirm-ok'), btnCancel = document.getElementById('btn-confirm-cancel');
        const newBtnOk = btnOk.cloneNode(true), newBtnCancel = btnCancel.cloneNode(true);
        btnOk.parentNode.replaceChild(newBtnOk, btnOk); btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);
        
        modal.classList.add('show');
        newBtnCancel.addEventListener('click', () => modal.classList.remove('show'));
        newBtnOk.addEventListener('click', () => { modal.classList.remove('show'); onConfirm(); });
    },
    setGlobalLoading(isLoad) { 
        const loader = document.getElementById('global-loader');
        if(isLoad) { loader.style.display = 'flex'; setTimeout(()=>loader.style.opacity = '1', 10); }
        else { loader.style.opacity = '0'; setTimeout(()=>loader.style.display = 'none', 300); }
    },
    lockButton(button, loadingText = "처리 중...") {
        if (!button) return;
        button.dataset.originalText = button.innerHTML;
        button.disabled = true;
        button.style.pointerEvents = "none";
        button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${loadingText}`;
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