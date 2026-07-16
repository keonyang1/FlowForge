function initAuth() {

    // 프로필 드롭다운 관리
    document.getElementById('btn-profile-trigger').onclick = (e) => { e.stopPropagation(); document.getElementById('profile-dropdown').classList.toggle('show'); };
    document.onclick = (e) => { if(!e.target.closest('.profile-wrapper')) document.getElementById('profile-dropdown').classList.remove('show'); };
    
    // 프로필 수정 모달 열기
    document.getElementById('btn-edit-profile').onclick = () => {
        const user = AppAPI.getUser();
        if(user) {
            document.getElementById('prof-nickname').value = user.nickname;
            document.getElementById('prof-current-pw').value = '';
            document.getElementById('prof-new-pw').value = '';
            document.getElementById('prof-new-pw-confirm').value = '';
        }
        UI.openModal('profile-modal');
        document.getElementById('profile-dropdown').classList.remove('show');
    };
            
    // 프로필 수정 폼 제출
    document.getElementById('form-profile').onsubmit = async (e) => {
        e.preventDefault();
        const newNickname = document.getElementById('prof-nickname').value;
        const currentPw = document.getElementById('prof-current-pw').value;
        const newPw = document.getElementById('prof-new-pw').value;
        const newPwConfirm = document.getElementById('prof-new-pw-confirm').value;

        if (newPw && newPw !== newPwConfirm) {
            UI.showToast('새 비밀번호가 일치하지 않습니다.', 'warning');
            return;
        }
        if (!currentPw) {
            UI.showToast('정보를 수정하려면 현재 비밀번호를 입력해주세요.', 'warning');
            return;
        }

        const btn = document.getElementById('btn-submit-profile');
        const originalText = btn.textContent;
        btn.disabled = true; btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> 저장 중...';

        try {
            let user = AppAPI.getUser();
            let profileSuccess = false;
            
            // 1. 닉네임 변경 API 호출 로직 
            if (newNickname !== user.nickname) {
                const profileRes = await AppAPI.updateProfile(user.id, newNickname);
                if (!profileRes.success) throw new Error(profileRes.message);
                user.nickname = newNickname;
                profileSuccess = true;
            }

            // 2. 비밀번호 변경 API 호출 로직
            if (newPw) {
                const pwRes = await AppAPI.updatePassword(user.id, currentPw, newPw);
                if (!pwRes.success) throw new Error(pwRes.message);
                profileSuccess = true;
            }

            if (profileSuccess) {
                localStorage.setItem('flowforge_session', JSON.stringify(user));
                document.getElementById('header-nickname').textContent = user.nickname;
                document.getElementById('header-avatar-initial').textContent = user.nickname.charAt(0).toUpperCase();
                document.getElementById('dropdown-nickname').textContent = user.nickname;
                
                UI.showToast('프로필이 성공적으로 업데이트 되었습니다.');
                UI.closeModal('profile-modal');
            } else {
                 UI.showToast('변경된 내용이 없습니다.', 'warning');
                 UI.closeModal('profile-modal');
            }
        } catch (err) {
            UI.showToast(err.message || "오류가 발생했습니다.", 'error');
        }
        btn.disabled = false; btn.textContent = originalText;
    };

    // 로그아웃 로직
    document.getElementById('btn-logout').onclick = () => { 
        AppAPI.logout(); 
        document.getElementById('profile-dropdown').classList.remove('show'); 
        resetAppUI();
        document.getElementById('auth-overlay').classList.add('show'); 
    };
            
    // 회원 탈퇴 로직
    document.getElementById('btn-delete-account').onclick = () => {
        UI.confirm('회원 탈퇴 및 데이터 삭제', '정말로 회원 탈퇴하시겠습니까? 탈퇴 시 기존에 작성한 모든 프로젝트 및 작업 데이터가 함께 영구히 삭제되며 절대 복구할 수 없습니다.', async () => {
            document.getElementById('profile-dropdown').classList.remove('show');
            UI.setGlobalLoading(true);
            
            try {
                const res = await AppAPI.deleteAccount(AppAPI.getUser().id);
                if(res.success) { 
                    UI.showToast('탈퇴 및 관련된 모든 데이터 삭제가 완료되었습니다.'); 
                    AppAPI.logout(); 
                    resetAppUI();
                    document.getElementById('auth-overlay').classList.add('show'); 
                } else {
                    UI.showToast(res.message, 'error');
                }
            } catch(err) { UI.showToast(err.message, 'error'); }
            finally { UI.setGlobalLoading(false); }
        });
    };

    const user = AppAPI.getUser();
    if (user) {
        document.getElementById('auth-overlay').classList.remove('show');
        document.getElementById('header-nickname').textContent = user.nickname;
        document.getElementById('header-avatar-initial').textContent = user.nickname.charAt(0).toUpperCase();
        document.getElementById('dropdown-nickname').textContent = user.nickname;
        document.getElementById('dashboard-greeting').textContent = `${user.nickname}님, 환영합니다!`;
        loadAppData();
    }

    // 인증 UI 전환
    document.getElementById('link-to-register').onclick = (e) => { e.preventDefault(); document.getElementById('view-login').classList.remove('active'); document.getElementById('view-register').classList.add('active'); };
    document.getElementById('link-to-login').onclick = (e) => { e.preventDefault(); document.getElementById('view-register').classList.remove('active'); document.getElementById('view-login').classList.add('active'); };

    // 로그인 및 회원가입 폼 제출 로직 (비밀번호 확인 추가됨)
    document.getElementById('form-login').onsubmit = async (e) => {
        e.preventDefault(); 
        const btn = e.target.querySelector('button'); btn.disabled = true; btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> 로그인 중...';
        try {
            const res = await AppAPI.login(document.getElementById('login-id').value, document.getElementById('login-pw').value);
            if(res.success) {
                UI.showToast(`환영합니다, ${res.user.nickname}님!`);
                document.getElementById('header-nickname').textContent = res.user.nickname;
                document.getElementById('header-avatar-initial').textContent = res.user.nickname.charAt(0).toUpperCase();
                document.getElementById('dropdown-nickname').textContent = res.user.nickname;
                document.getElementById('dropdown-id').textContent = `@${res.user.id}`;
                document.getElementById('dashboard-greeting').textContent = `${res.user.nickname}님, 환영합니다!`;
                document.getElementById('auth-overlay').classList.remove('show');
                loadAppData();
            } else { UI.showToast(res.message, 'error'); }
        } catch(e) { UI.showToast(e.message, 'error'); } finally { btn.disabled = false; btn.textContent = '로그인'; }
    };

    document.getElementById('form-register').onsubmit = async (e) => {
        e.preventDefault(); 
        
        const pw = document.getElementById('reg-pw').value;
        const pwConfirm = document.getElementById('reg-pw-confirm').value;
        
        // 비밀번호 확인 일치 검증
        if (pw !== pwConfirm) {
            UI.showToast('비밀번호가 일치하지 않습니다.', 'warning');
            return;
        }

        const id = document.getElementById("reg-id").value.trim();
        const nickname = document.getElementById("reg-nickname").value.trim();

        if(id.length<4){
            UI.showToast("아이디는 4자 이상이어야 합니다.", "warning");
            return;
        }

        if(pw.length<6){
            UI.showToast("비밀번호는 6자 이상이어야 합니다.", "warning");
            return;
        }

        if(nickname===""){
            UI.showToast("닉네임을 입력해주세요.", "warning");
            return;
        }

        const btn = e.target.querySelector('button'); btn.disabled = true; btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> 처리중...';
        try {
            const res = await AppAPI.register(document.getElementById("reg-id").value.trim(), pw, document.getElementById("reg-nickname").value.trim());
            if(res.success) {
                UI.showToast('계정이 생성되었습니다. 로그인해주세요.');
                document.getElementById('link-to-login').click();
            } else { UI.showToast(res.message, 'error'); }
        } catch(e) { UI.showToast(e.message, 'error'); } finally { btn.disabled = false; btn.textContent = '계정 생성'; }
    };
}