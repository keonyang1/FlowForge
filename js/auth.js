function initAuth() {

    // 프로필 드롭다운 관리
    document.getElementById('btn-profile-trigger').onclick = (e) => { e.stopPropagation(); document.getElementById('profile-dropdown').classList.toggle('show'); };
    document.onclick = (e) => { if(!e.target.closest('.profile-wrapper')) document.getElementById('profile-dropdown').classList.remove('show'); };
    
    // 프로필 수정 모달 열기
    document.getElementById('btn-edit-profile').onclick = () => {
        const user = AppAPI.getUser();
        const preview = document.getElementById("profile-avatar-preview");
        const initial = document.getElementById("profile-avatar-initial");
        if(user.avatar_url){
            preview.src = user.avatar_url;
            preview.style.display = "block";
            initial.style.display = "none";

        }else{
            preview.style.display = "none";
            initial.style.display = "block";
            initial.textContent = user.nickname.charAt(0).toUpperCase();
        }

        document.getElementById("profile-avatar-file").value = "";
        if(user) {
            document.getElementById('prof-nickname').value = user.nickname;
        }
        UI.openModal('profile-modal');
        document.getElementById('profile-dropdown').classList.remove('show');
    };

    document.getElementById("btn-change-avatar").onclick=() => {
        document.getElementById("profile-avatar-file").click();
    };

    document.getElementById("btn-remove-avatar").onclick = async () => {
        const user = AppAPI.getUser();
        if (!user.avatar_url) {
            UI.showToast("삭제할 프로필 사진이 없습니다.", "warning");
            return;
        }
        UI.closeModal("profile-modal");
        UI.confirm("프로필 사진 삭제", "현재 프로필 사진을 삭제하시겠습니까?", async () => {
            UI.setGlobalLoading(true);
            try {
                const res = await AppAPI.removeAvatar(user.user_id);
                if (!res.success)
                    throw new Error(res.message);
                // 세션 갱신
                user.avatar_url = "";
                localStorage.setItem(
                    "flowforge_session",
                    JSON.stringify(user)
                );
                // 프로필 수정 모달 갱신
                document.getElementById("profile-avatar-preview").style.display = "none";
                document.getElementById("profile-avatar-initial").style.display = "block";
                document.getElementById("profile-avatar-initial").textContent =
                    user.nickname.charAt(0).toUpperCase();
                document.getElementById("profile-avatar-file").value = "";
                // 헤더/드롭다운 갱신
                updateAvatarUI(user);
                UI.showToast("프로필 사진이 삭제되었습니다.");
            } catch (err) {
                UI.showToast(err.message || "삭제에 실패했습니다.", "error");
            } finally {
                UI.setGlobalLoading(false);
            }
        });
    };

    document.getElementById("profile-avatar-file").addEventListener("change",(e) => {
        const file=e.target.files[0];
        if(!file) return;
        if(file.size>2*1024*1024){
            UI.showToast("2MB 이하 이미지만 업로드 가능합니다.","warning");
            return;
        }
        const reader=new FileReader();
        reader.onload=() => {
            document.getElementById("profile-avatar-preview").src=reader.result;
            document.getElementById("profile-avatar-preview").style.display="block";
            document.getElementById("profile-avatar-initial").style.display="none";
        };
        reader.readAsDataURL(file);
    });

    document.getElementById("btn-open-password-modal").onclick = () => {
        document.getElementById("pw-current").value = "";
        document.getElementById("pw-new").value = "";
        document.getElementById("pw-new-confirm").value = "";
        UI.closeModal("profile-modal");
        UI.openModal("password-modal");
    };

    document.getElementById("btn-open-delete-modal").onclick = () => {
        document.getElementById("delete-current-password").value = "";
        UI.closeModal("profile-modal");
        UI.openModal("delete-account-modal");
    };
    
    // 프로필 수정 폼 제출
    document.getElementById('form-profile').onsubmit = async (e) => {
        e.preventDefault();
        const newNickname = document.getElementById('prof-nickname').value;

        const btn = document.getElementById('btn-submit-profile');
        const originalText = btn.textContent;
        btn.disabled = true; btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> 저장 중...';

        try {
            let user = AppAPI.getUser();
            let profileSuccess = false;
            
            // 1. 닉네임 변경 API 호출 로직 
            if (
                newNickname !== "" &&
                newNickname !== user.nickname
            ) {
                const profileRes =
                    await AppAPI.updateProfile(
                        user.user_id,
                        newNickname
                    );
                if (!profileRes.success)
                    throw new Error(profileRes.message);
                user.nickname = newNickname;
                profileSuccess = true;
            }

            // 2. 프로필 사진 업로드
            const avatarFile = document.getElementById("profile-avatar-file").files[0];
            if (avatarFile) {
                const base64 = await new Promise(resolve => {
                    const reader = new FileReader();
                    reader.onload = () => {
                        resolve(reader.result.split(",")[1]);
                    };
                    reader.readAsDataURL(avatarFile);
                });
                const avatarRes = await AppAPI.uploadAvatar(user.user_id, base64);
                if (!avatarRes.success) throw new Error(avatarRes.message);
                user.avatar_url = avatarRes.avatar_url;
                profileSuccess = true;
            }

            // 변경사항 적용
            if (profileSuccess) {
                localStorage.setItem("flowforge_session", JSON.stringify(user));
                document.getElementById("header-nickname").textContent = user.nickname;
                document.getElementById("dropdown-nickname").textContent = user.nickname;
                updateAvatarUI(user);
                UI.showToast("프로필이 성공적으로 업데이트되었습니다.");
                UI.closeModal("profile-modal");

            } else {
                 UI.showToast('변경된 내용이 없습니다.', 'warning');
                 UI.closeModal('profile-modal');
            }
        } catch (err) {
            UI.showToast(err.message || "오류가 발생했습니다.", 'error');
        }
        btn.disabled = false; btn.textContent = originalText;
    };

    document.getElementById("form-password").onsubmit = async (e) => {
        e.preventDefault();
        const currentPw = document.getElementById("pw-current").value.trim();
        const newPw = document.getElementById("pw-new").value.trim();
        const confirmPw = document.getElementById("pw-new-confirm").value.trim();

        if (newPw !== confirmPw) {
            UI.showToast("새 비밀번호가 일치하지 않습니다.", "warning");
            return;
        }
        if (!validatePassword(newPw)) {
            UI.showToast("비밀번호 형식이 올바르지 않습니다.", "warning");
            return;
        }
        UI.setGlobalLoading(true);
        try {
            const user = AppAPI.getUser();
            const res = await AppAPI.updatePassword(user.user_id, currentPw, newPw);
            if (!res.success)
                throw new Error(res.message);
            UI.showToast("비밀번호가 변경되었습니다.");
            UI.closeModal("password-modal");
            document.getElementById("form-password").reset();
        } catch (err) {
            UI.showToast(err.message, "error");
        } finally {
            UI.setGlobalLoading(false);
        }
    };

    document.getElementById("form-delete-account").onsubmit = async (e) => {
        e.preventDefault();
        const pw = document.getElementById("delete-current-password").value.trim();
        UI.closeModal("delete-account-modal");
        UI.confirm("회원 탈퇴", "정말 회원 탈퇴하시겠습니까?<br><br>모든 프로젝트와 작업이 함께 영구 삭제됩니다.<br>삭제된 데이터는 복구할 수 없습니다.", async () => {
            UI.setGlobalLoading(true);
            try {
                const res = await AppAPI.deleteAccount(AppAPI.getUser().user_id, pw);
                if (res.success) {
                    UI.showToast("회원 탈퇴가 완료되었습니다.");
                    AppAPI.logout();
                    resetAppUI();
                    document
                        .getElementById("auth-overlay")
                        .classList.add("show");
                } else {
                    UI.showToast(res.message, "error");
                }
            } catch (err) {
                UI.showToast(err.message, "error");
            } finally {
                UI.setGlobalLoading(false);
            }
        });
    };

    // 로그아웃 로직
    document.getElementById('btn-logout').onclick = () => { 
        AppAPI.logout(); 
        document.getElementById('profile-dropdown').classList.remove('show'); 
        resetAppUI();
        document.getElementById('auth-overlay').classList.add('show'); 
    };

    const user = AppAPI.getUser();
    if (user) {
        document.getElementById('auth-overlay').classList.remove('show');
        document.getElementById('header-nickname').textContent = user.nickname;
        updateAvatarUI(user);
        document.getElementById('dropdown-nickname').textContent = user.nickname;
        document.getElementById('dropdown-user-id').textContent = `@${user.user_id}`;
        document.getElementById('dashboard-greeting').textContent = `${user.nickname}님, 환영합니다!`;
        loadAppData();
    }

    // 인증 UI 전환
    document.getElementById('link-to-register').onclick = (e) => { e.preventDefault(); document.getElementById('view-login').classList.remove('active'); document.getElementById('view-register').classList.add('active'); };
    document.getElementById('link-to-login').onclick = (e) => { e.preventDefault(); document.getElementById('view-register').classList.remove('active'); document.getElementById('view-login').classList.add('active'); };

    // 로그인
    document.getElementById("form-login").onsubmit = async (e) => {
        e.preventDefault();
        const btn = document.getElementById("btn-login");
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> 로그인 중...';
        try {
            const userId = document.getElementById("login-id").value.trim();
            const password = document.getElementById("login-pw").value;
            const res = await AppAPI.login(userId, password);
            if (!res.success) {
                UI.showToast(res.message, "error");
                return;
            }
            UI.showToast(`환영합니다, ${res.user.nickname}님!`);
            document.getElementById("header-nickname").textContent = res.user.nickname;
            document.getElementById("dropdown-nickname").textContent = res.user.nickname;
            document.getElementById("dropdown-user-id").textContent = `@${res.user.user_id}`;
            document.getElementById("dashboard-greeting").textContent = `${res.user.nickname}님, 환영합니다!`;
            updateAvatarUI(res.user);
            document.getElementById("auth-overlay").classList.remove("show");
            loadAppData();
        } catch (err) {
            UI.showToast(err.message, "error");
        } finally {
            btn.disabled = false;
            btn.textContent = "로그인";
        }
    };

    // 회원가입
    document.getElementById("form-register").onsubmit = async (e) => {
        e.preventDefault();
        const btn = document.getElementById("btn-register");
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> 처리중...';
        const userId = document.getElementById("reg-id").value.trim();
        const nickname = document.getElementById("reg-nickname").value.trim();
        const password = document.getElementById("reg-pw").value;
        const passwordConfirm = document.getElementById("reg-pw-confirm").value;
        try {
            if (!validateUserId(userId)) {
                UI.showToast(
                    "아이디는 영문 소문자(a-z), 숫자(0-9), 언더바(_)만 사용할 수 있으며 4자 이상이어야 합니다.",
                    "warning"
                );
                return;
            }
            if (!validatePassword(password)) {
                UI.showToast(
                    "비밀번호는 영문 대/소문자, 숫자, 특수문자만 사용할 수 있으며 6자 이상이어야 합니다.",
                    "warning"
                );
                return;
            }
            if (nickname === "") {
                UI.showToast("닉네임을 입력해주세요.", "warning");
                return;
            }
            if (password !== passwordConfirm) {
                UI.showToast("비밀번호가 일치하지 않습니다.", "warning");
                return;
            }
            const res = await AppAPI.register(
                userId,
                password,
                nickname
            );
            if (!res.success) {
                UI.showToast(res.message, "error");
                return;
            }
            document.getElementById("link-to-login").click();
            document.getElementById("login-id").value = userId;
            document.getElementById("login-pw").value = "";
            document.getElementById("login-pw").focus();
            UI.showToast("회원가입이 완료되었습니다. 비밀번호를 입력하여 로그인해주세요.");
        } catch (err) {
            UI.showToast(err.message, "error");
        } finally {
            btn.disabled = false;
            btn.textContent = "계정 생성";
        }
    };
}

function updateAvatarUI(user){

    const hasAvatar = !!user.avatar_url;

    const headerImg = document.getElementById("header-avatar-img");
    const headerText = document.getElementById("header-avatar-initial");

    const dropdownImg = document.getElementById("dropdown-avatar-img");
    const dropdownText = document.getElementById("dropdown-avatar-initial");

    if(hasAvatar){

        headerImg.src = user.avatar_url;
        headerImg.style.display = "block";
        headerText.style.display = "none";

        dropdownImg.src = user.avatar_url;
        dropdownImg.style.display = "block";
        dropdownText.style.display = "none";

    }else{

        const initial = user.nickname.charAt(0).toUpperCase();

        headerImg.style.display = "none";
        headerText.style.display = "block";
        headerText.textContent = initial;

        dropdownImg.style.display = "none";
        dropdownText.style.display = "block";
        dropdownText.textContent = initial;

    }
}