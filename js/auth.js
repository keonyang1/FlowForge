// js/auth.js

let currentHelpPage = 1;
const TOTAL_HELP_PAGES = 10;
let helpAnimationTimers = [];

function clearHelpTimers() {
    helpAnimationTimers.forEach(t => clearTimeout(t));
    helpAnimationTimers = [];
}

function shouldReduceMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function closeHelpModal() {
    stopHelpAnimation();
    if (typeof UI !== 'undefined' && UI.closeModal) {
        UI.closeModal('help-modal');
    }
}

function initAuth() {

    const btnHelp = document.getElementById("btn-help");
    if (btnHelp) {
        btnHelp.onclick = () => {
            showHelpPage(1);
            UI.openModal("help-modal");
        };
    }

    const helpPrev = document.getElementById("help-prev");
    if (helpPrev) {
        helpPrev.onclick = () => {
            if (currentHelpPage > 1) {
                showHelpPage(currentHelpPage - 1);
            }
        };
    }

    const helpNext = document.getElementById("help-next");
    if (helpNext) {
        helpNext.onclick = () => {
            if (currentHelpPage === TOTAL_HELP_PAGES) {
                closeHelpModal();
                return;
            }
            showHelpPage(currentHelpPage + 1);
        };
    }

    const helpSkip = document.getElementById("help-skip");
    if (helpSkip) {
        helpSkip.onclick = () => {
            closeHelpModal();
        };
    }

    const helpDots = document.querySelectorAll("#help-indicator span");
    helpDots.forEach((dot, index) => {
        dot.onclick = () => showHelpPage(index + 1);
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            const modal = document.getElementById("help-modal");
            if (modal && modal.classList.contains("show")) {
                closeHelpModal();
            }
        }
    });

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
        const savedPage = sessionStorage.getItem("flowforge_current_page") || "dashboard";
        UI.switchPage(savedPage);
        if(!localStorage.getItem("flowforge_help_seen")){
            setTimeout(()=>{
                showHelpPage(1);
                UI.openModal("help-modal");
            },500);
            localStorage.setItem("flowforge_help_seen","true");
        }
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
            const savedPage = sessionStorage.getItem("flowforge_current_page") || "dashboard";
            UI.switchPage(savedPage);
            if(!localStorage.getItem("flowforge_help_seen")){
                setTimeout(()=>{
                    showHelpPage(1);
                    UI.openModal("help-modal");
                },500);
                localStorage.setItem("flowforge_help_seen","true");
            }
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
            if (RESERVED_USER_IDS.includes(userId.toLowerCase())) {
                UI.showToast("사용할 수 없는 아이디입니다.", "warning");
                return;
            }
            if (!validateUserId(userId)) {
                UI.showToast("아이디는 영문 소문자(a-z), 숫자(0-9), 언더바(_)만 사용할 수 있으며 4자 이상이어야 합니다.", "warning");
                return;
            }
            if (!validatePassword(password)) {
                UI.showToast("비밀번호는 영문 대/소문자, 숫자, 특수문자만 사용할 수 있으며 6자 이상이어야 합니다.", "warning");
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

function stopHelpAnimation() {
    clearHelpTimers();

    // 4. Kanban Reset
    const oldKanbanLanded = document.getElementById("help-kanban-landed");
    if (oldKanbanLanded) oldKanbanLanded.remove();

    const dragCard = document.getElementById("help-drag-card");
    if (dragCard) {
        dragCard.style.transition = "none";
        dragCard.style.transform = "";
        dragCard.style.opacity = "1";
        dragCard.style.display = "";
        dragCard.className = "help-kanban-card";
    }
    const kanbanCursor = document.getElementById("help-kanban-cursor");
    if (kanbanCursor) {
        kanbanCursor.style.transition = "none";
        kanbanCursor.style.opacity = "0";
        kanbanCursor.style.transform = "";
        kanbanCursor.classList.remove("grabbing");
    }
    const dropGhost = document.getElementById("help-drop-ghost");
    if (dropGhost) {
        dropGhost.style.display = "";
        dropGhost.classList.remove("highlight");
    }
    const countTodo = document.getElementById("help-count-todo");
    if (countTodo) countTodo.textContent = "1";
    const countProg = document.getElementById("help-count-prog");
    if (countProg) countProg.textContent = "0";
    const kanbanToast = document.getElementById("help-kanban-toast");
    if (kanbanToast) kanbanToast.classList.remove("show");

    // 5. Checklist Reset
    const chkBadge = document.getElementById("help-chk-badge");
    if (chkBadge) chkBadge.textContent = "1 / 3 완료 (33%)";
    const chkBar = document.getElementById("help-chk-bar");
    if (chkBar) chkBar.style.width = "33%";
    const chkIcon2 = document.getElementById("help-chk-icon-2");
    if (chkIcon2) { chkIcon2.className = "far fa-square"; chkIcon2.style.color = ""; }
    const chkText2 = document.getElementById("help-chk-text-2");
    if (chkText2) { chkText2.style.textDecoration = "none"; chkText2.style.color = ""; }
    const chkIcon3 = document.getElementById("help-chk-icon-3");
    if (chkIcon3) { chkIcon3.className = "far fa-square"; chkIcon3.style.color = ""; }
    const chkText3 = document.getElementById("help-chk-text-3");
    if (chkText3) { chkText3.style.textDecoration = "none"; chkText3.style.color = ""; }

    // 6. Dependency Reset
    const depNode2 = document.getElementById("help-dep-node-2");
    const depLine2 = document.getElementById("help-dep-line-2");
    const depNode3 = document.getElementById("help-dep-node-3");
    if (depNode2) {
        depNode2.className = "help-dep-node active";
        const top = depNode2.querySelector(".help-dep-node-top");
        if (top) top.innerHTML = '<i class="fas fa-spinner"></i> 진행 준비';
    }
    if (depLine2) depLine2.className = "help-dep-line";
    if (depNode3) {
        depNode3.className = "help-dep-node locked";
        const top = depNode3.querySelector(".help-dep-node-top");
        if (top) top.innerHTML = '<i class="fas fa-clock"></i> 대기 중';
    }

    // 7. Calendar Reset
    const oldCalLanded = document.getElementById("help-cal-landed");
    if (oldCalLanded) oldCalLanded.remove();

    const calItem = document.getElementById("help-cal-item");
    if (calItem) {
        calItem.style.transition = "none";
        calItem.style.transform = "";
        calItem.style.opacity = "1";
        calItem.style.display = "";
        calItem.className = "help-cal-item";
    }
    const calCursor = document.getElementById("help-cal-cursor");
    if (calCursor) {
        calCursor.style.transition = "none";
        calCursor.style.opacity = "0";
        calCursor.style.transform = "";
        calCursor.classList.remove("grabbing");
    }
    const calDropTarget = document.getElementById("help-cal-drop-target");
    if (calDropTarget) calDropTarget.classList.remove("highlight");
    const calGhost = document.getElementById("help-cal-ghost");
    if (calGhost) {
        calGhost.style.display = "";
        calGhost.style.opacity = "1";
    }
    const calToast = document.getElementById("help-cal-toast");
    if (calToast) calToast.classList.remove("show");

    // 8. Filter Reset
    const typeText = document.getElementById("help-type-text");
    if (typeText) typeText.textContent = "디자인";
    const filterCards = document.querySelectorAll(".help-filter-card");
    if (filterCards.length >= 3) {
        filterCards[0].className = "help-filter-card match";
        filterCards[1].className = "help-filter-card dim";
        filterCards[2].className = "help-filter-card match";
    }
}

function runPage4KanbanAnimation() {
    if (shouldReduceMotion()) return;
    const box = document.getElementById("help-kanban-box");
    const cursor = document.getElementById("help-kanban-cursor");
    const dragCard = document.getElementById("help-drag-card");
    const dropSlot = document.getElementById("help-drop-slot");
    const dropGhost = document.getElementById("help-drop-ghost");
    const countTodo = document.getElementById("help-count-todo");
    const countProg = document.getElementById("help-count-prog");
    const kanbanToast = document.getElementById("help-kanban-toast");

    if (!box || !cursor || !dragCard || !dropSlot) return;

    function resetKanban() {
        const oldLanded = document.getElementById("help-kanban-landed");
        if (oldLanded) oldLanded.remove();

        dragCard.style.transition = "none";
        dragCard.style.transform = "";
        dragCard.style.opacity = "1";
        dragCard.style.display = "";
        dragCard.className = "help-kanban-card";

        cursor.style.transition = "none";
        cursor.style.opacity = "0";
        cursor.style.transform = "";
        cursor.classList.remove("grabbing");

        if (dropGhost) {
            dropGhost.style.display = "";
            dropGhost.classList.remove("highlight");
        }
        if (countTodo) countTodo.textContent = "1";
        if (countProg) countProg.textContent = "0";
        if (kanbanToast) kanbanToast.classList.remove("show");
    }

    resetKanban();
    void dragCard.offsetHeight;

    helpAnimationTimers.push(setTimeout(() => {
        const boxRect = box.getBoundingClientRect();
        const cardRect = dragCard.getBoundingClientRect();
        const slotRect = dropSlot.getBoundingClientRect();

        const cardInitX = cardRect.left - boxRect.left;
        const cardInitY = cardRect.top - boxRect.top;

        // Position cursor slightly away
        const cursorStartX = cardInitX + cardRect.width * 0.65;
        const cursorStartY = cardInitY + cardRect.height * 0.8;

        cursor.style.transition = "none";
        cursor.style.transform = `translate(${cursorStartX}px, ${cursorStartY}px)`;
        cursor.style.opacity = "0";

        // Step 1: Cursor approaches card
        helpAnimationTimers.push(setTimeout(() => {
            cursor.style.transition = "transform 0.6s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.3s ease";
            cursor.style.opacity = "1";
            const cursorTargetX = cardInitX + cardRect.width * 0.45;
            const cursorTargetY = cardInitY + cardRect.height * 0.45;
            cursor.style.transform = `translate(${cursorTargetX}px, ${cursorTargetY}px)`;
        }, 60));

        // Step 2: Grab & Lift
        helpAnimationTimers.push(setTimeout(() => {
            cursor.classList.add("grabbing");
            dragCard.classList.add("is-dragging");
        }, 750));

        // Step 3: Drag together to destination slot
        helpAnimationTimers.push(setTimeout(() => {
            const dx = (slotRect.left + (slotRect.width - cardRect.width) / 2) - cardRect.left;
            const dy = (slotRect.top + (slotRect.height - cardRect.height) / 2) - cardRect.top;

            dragCard.style.transition = "transform 0.9s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.3s ease, border-color 0.3s ease";
            dragCard.style.transform = `translate(${dx}px, ${dy}px) scale(1.03)`;

            const cursorTargetX = cardInitX + cardRect.width * 0.45 + dx;
            const cursorTargetY = cardInitY + cardRect.height * 0.45 + dy;
            cursor.style.transition = "transform 0.9s cubic-bezier(0.25, 1, 0.5, 1)";
            cursor.style.transform = `translate(${cursorTargetX}px, ${cursorTargetY}px)`;

            helpAnimationTimers.push(setTimeout(() => {
                if (dropGhost) dropGhost.classList.add("highlight");
            }, 350));
        }, 1050));

        // Step 4: Drop Card into slot (Instant switch to settled landedCard in destination DOM slot)
        helpAnimationTimers.push(setTimeout(() => {
            // 1. Hide drop ghost
            if (dropGhost) {
                dropGhost.style.display = "none";
                dropGhost.classList.remove("highlight");
            }

            // 2. Insert landed card clone into destination slot
            const landedCard = document.createElement("div");
            landedCard.id = "help-kanban-landed";
            landedCard.className = "help-kanban-card is-dropped";
            landedCard.innerHTML = dragCard.innerHTML;
            dropSlot.appendChild(landedCard);

            // 3. Immediately hide original card and clear its transform without animating
            dragCard.style.display = "none";
            dragCard.style.transition = "none";
            dragCard.style.transform = "";
            dragCard.className = "help-kanban-card";

            // 4. Cursor releases grab and fades out on the spot (NO translation!)
            cursor.classList.remove("grabbing");
            cursor.style.transition = "opacity 0.35s ease";
            cursor.style.opacity = "0";
            helpAnimationTimers.push(setTimeout(() => {
                cursor.style.transition = "none";
                cursor.style.transform = "";
            }, 400));

            // 5. Update UI stats & show toast
            if (countTodo) countTodo.textContent = "0";
            if (countProg) countProg.textContent = "1";
            if (kanbanToast) kanbanToast.classList.add("show");

            // Step 5: Hold at destination for 3.2s, then perform invisible reset to start next cycle
            helpAnimationTimers.push(setTimeout(() => {
                // Fade out landed card and toast at destination
                landedCard.style.transition = "opacity 0.45s ease";
                landedCard.style.opacity = "0";
                if (kanbanToast) kanbanToast.classList.remove("show");

                helpAnimationTimers.push(setTimeout(() => {
                    // Remove clone and restore drop ghost while invisible
                    landedCard.remove();
                    if (dropGhost) {
                        dropGhost.style.display = "";
                        dropGhost.classList.remove("highlight");
                    }
                    if (countTodo) countTodo.textContent = "1";
                    if (countProg) countProg.textContent = "0";

                    // Re-show drag card at source with opacity 0, then fade in
                    dragCard.style.transition = "none";
                    dragCard.style.transform = "";
                    dragCard.style.opacity = "0";
                    dragCard.style.display = "";
                    dragCard.className = "help-kanban-card";
                    void dragCard.offsetHeight; // force reflow

                    dragCard.style.transition = "opacity 0.45s ease";
                    dragCard.style.opacity = "1";

                    // Pause briefly at source, then begin next drag cycle
                    helpAnimationTimers.push(setTimeout(() => {
                        runPage4KanbanAnimation();
                    }, 800));
                }, 500));
            }, 3200));
        }, 2050));
    }, 150));
}

function runPage5ChecklistAnimation() {
    if (shouldReduceMotion()) return;
    const chkBadge = document.getElementById("help-chk-badge");
    const chkBar = document.getElementById("help-chk-bar");
    const chkIcon2 = document.getElementById("help-chk-icon-2");
    const chkText2 = document.getElementById("help-chk-text-2");
    const chkIcon3 = document.getElementById("help-chk-icon-3");
    const chkText3 = document.getElementById("help-chk-text-3");

    function stepReset() {
        if (chkBadge) chkBadge.textContent = "1 / 3 완료 (33%)";
        if (chkBar) chkBar.style.width = "33%";
        if (chkIcon2) {
            chkIcon2.className = "far fa-square";
            chkIcon2.style.color = "";
        }
        if (chkText2) {
            chkText2.style.textDecoration = "none";
            chkText2.style.color = "";
        }
        if (chkIcon3) {
            chkIcon3.className = "far fa-square";
            chkIcon3.style.color = "";
        }
        if (chkText3) {
            chkText3.style.textDecoration = "none";
            chkText3.style.color = "";
        }
    }

    function stepItem2() {
        if (chkIcon2) {
            chkIcon2.className = "fas fa-square-check";
            chkIcon2.style.color = "var(--success-color)";
        }
        if (chkText2) {
            chkText2.style.textDecoration = "line-through";
            chkText2.style.color = "var(--text-muted)";
        }
        if (chkBadge) chkBadge.textContent = "2 / 3 완료 (67%)";
        if (chkBar) chkBar.style.width = "67%";
    }

    function stepItem3() {
        if (chkIcon3) {
            chkIcon3.className = "fas fa-square-check";
            chkIcon3.style.color = "var(--success-color)";
        }
        if (chkText3) {
            chkText3.style.textDecoration = "line-through";
            chkText3.style.color = "var(--text-muted)";
        }
        if (chkBadge) chkBadge.textContent = "3 / 3 완료 (100%)";
        if (chkBar) chkBar.style.width = "100%";
    }

    stepReset();
    helpAnimationTimers.push(setTimeout(stepItem2, 1100));
    helpAnimationTimers.push(setTimeout(stepItem3, 2300));
    helpAnimationTimers.push(setTimeout(() => {
        stepReset();
        helpAnimationTimers.push(setTimeout(runPage5ChecklistAnimation, 600));
    }, 4500));
}

function runPage6DependencyAnimation() {
    if (shouldReduceMotion()) return;
    const depNode2 = document.getElementById("help-dep-node-2");
    const depLine2 = document.getElementById("help-dep-line-2");
    const depNode3 = document.getElementById("help-dep-node-3");

    function stepInitial() {
        if (depNode2) {
            depNode2.className = "help-dep-node active";
            const top = depNode2.querySelector(".help-dep-node-top");
            if (top) top.innerHTML = '<i class="fas fa-spinner"></i> 진행 준비';
        }
        if (depLine2) depLine2.className = "help-dep-line";
        if (depNode3) {
            depNode3.className = "help-dep-node locked";
            const top = depNode3.querySelector(".help-dep-node-top");
            if (top) top.innerHTML = '<i class="fas fa-clock"></i> 대기 중';
        }
    }

    function stepCompleteNode2() {
        if (depNode2) {
            depNode2.className = "help-dep-node done";
            const top = depNode2.querySelector(".help-dep-node-top");
            if (top) top.innerHTML = '<i class="fas fa-check-circle"></i> 선행 완료';
        }
        if (depLine2) depLine2.className = "help-dep-line done";
        if (depNode3) {
            depNode3.className = "help-dep-node active";
            const top = depNode3.querySelector(".help-dep-node-top");
            if (top) top.innerHTML = '<i class="fas fa-spinner"></i> 진행 준비';
        }
    }

    stepInitial();
    helpAnimationTimers.push(setTimeout(stepCompleteNode2, 1600));
    helpAnimationTimers.push(setTimeout(() => {
        stepInitial();
        helpAnimationTimers.push(setTimeout(runPage6DependencyAnimation, 800));
    }, 4200));
}

function runPage7CalendarAnimation() {
    if (shouldReduceMotion()) return;
    const box = document.getElementById("help-cal-box");
    const cursor = document.getElementById("help-cal-cursor");
    const calItem = document.getElementById("help-cal-item");
    const dropTarget = document.getElementById("help-cal-drop-target");
    const calGhost = document.getElementById("help-cal-ghost");
    const calToast = document.getElementById("help-cal-toast");
    const day15 = document.getElementById("help-cal-day-15");

    if (!box || !cursor || !calItem || !dropTarget || !day15) return;

    function resetCal() {
        const oldCalLanded = document.getElementById("help-cal-landed");
        if (oldCalLanded) oldCalLanded.remove();

        calItem.style.transition = "none";
        calItem.style.transform = "";
        calItem.style.opacity = "1";
        calItem.style.display = "";
        calItem.className = "help-cal-item";

        cursor.style.transition = "none";
        cursor.style.opacity = "0";
        cursor.style.transform = "";
        cursor.classList.remove("grabbing");

        if (dropTarget) dropTarget.classList.remove("highlight");
        if (calGhost) {
            calGhost.style.display = "";
            calGhost.style.opacity = "1";
        }
        if (calToast) calToast.classList.remove("show");
    }

    resetCal();
    void calItem.offsetHeight;

    helpAnimationTimers.push(setTimeout(() => {
        const boxRect = box.getBoundingClientRect();
        const day15Rect = day15.getBoundingClientRect();
        const targetRect = dropTarget.getBoundingClientRect();
        const itemRect = calItem.getBoundingClientRect();

        const itemInitX = itemRect.left - boxRect.left;
        const itemInitY = itemRect.top - boxRect.top;

        // Position cursor slightly away
        const cursorStartX = itemInitX + itemRect.width * 0.7;
        const cursorStartY = itemInitY + 30;

        cursor.style.transition = "none";
        cursor.style.transform = `translate(${cursorStartX}px, ${cursorStartY}px)`;
        cursor.style.opacity = "0";

        // Step 1: Cursor approaches item
        helpAnimationTimers.push(setTimeout(() => {
            cursor.style.transition = "transform 0.6s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.3s ease";
            cursor.style.opacity = "1";
            const cursorTargetX = itemInitX + itemRect.width * 0.4;
            const cursorTargetY = itemInitY + itemRect.height * 0.5;
            cursor.style.transform = `translate(${cursorTargetX}px, ${cursorTargetY}px)`;
        }, 60));

        // Step 2: Grab & Lift
        helpAnimationTimers.push(setTimeout(() => {
            cursor.classList.add("grabbing");
            calItem.classList.add("is-dragging");
        }, 750));

        // Step 3: Drag across from 15th to 17th
        helpAnimationTimers.push(setTimeout(() => {
            const dx = targetRect.left - day15Rect.left;
            const dy = targetRect.top - day15Rect.top;

            calItem.style.transition = "transform 0.9s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.3s ease, border-color 0.3s ease";
            calItem.style.transform = `translate(${dx}px, ${dy}px) scale(1.03)`;

            const cursorTargetX = itemInitX + itemRect.width * 0.4 + dx;
            const cursorTargetY = itemInitY + itemRect.height * 0.5 + dy;
            cursor.style.transition = "transform 0.9s cubic-bezier(0.25, 1, 0.5, 1)";
            cursor.style.transform = `translate(${cursorTargetX}px, ${cursorTargetY}px)`;

            helpAnimationTimers.push(setTimeout(() => {
                dropTarget.classList.add("highlight");
                if (calGhost) calGhost.style.opacity = "0";
            }, 350));
        }, 1050));

        // Step 4: Drop Card into 17th cell (Instant switch to settled landedCal in Day 17 DOM slot)
        helpAnimationTimers.push(setTimeout(() => {
            // 1. Hide ghost & remove highlight
            if (calGhost) calGhost.style.display = "none";
            dropTarget.classList.remove("highlight");

            // 2. Insert landed item clone into Day 17
            const landedCal = document.createElement("div");
            landedCal.id = "help-cal-landed";
            landedCal.className = "help-cal-item is-dropped";
            landedCal.innerHTML = calItem.innerHTML;
            dropTarget.appendChild(landedCal);

            // 3. Immediately hide original item and clear its transform without animating
            calItem.style.display = "none";
            calItem.style.transition = "none";
            calItem.style.transform = "";
            calItem.className = "help-cal-item";

            // 4. Cursor releases grab and fades out on the spot (NO translation!)
            cursor.classList.remove("grabbing");
            cursor.style.transition = "opacity 0.35s ease";
            cursor.style.opacity = "0";
            helpAnimationTimers.push(setTimeout(() => {
                cursor.style.transition = "none";
                cursor.style.transform = "";
            }, 400));

            // 5. Show toast
            if (calToast) calToast.classList.add("show");

            // Step 5: Hold at destination for 3.2s, then perform invisible reset to start next cycle
            helpAnimationTimers.push(setTimeout(() => {
                // Fade out landed item and toast at destination
                landedCal.style.transition = "opacity 0.45s ease";
                landedCal.style.opacity = "0";
                if (calToast) calToast.classList.remove("show");

                helpAnimationTimers.push(setTimeout(() => {
                    // Remove clone and restore ghost while invisible
                    landedCal.remove();
                    if (calGhost) {
                        calGhost.style.display = "";
                        calGhost.style.opacity = "1";
                    }

                    // Re-show calItem at Day 15 with opacity 0, then fade in
                    calItem.style.transition = "none";
                    calItem.style.transform = "";
                    calItem.style.opacity = "0";
                    calItem.style.display = "";
                    calItem.className = "help-cal-item";
                    void calItem.offsetHeight; // force reflow

                    calItem.style.transition = "opacity 0.45s ease";
                    calItem.style.opacity = "1";

                    // Pause briefly at source, then begin next drag cycle
                    helpAnimationTimers.push(setTimeout(() => {
                        runPage7CalendarAnimation();
                    }, 800));
                }, 500));
            }, 3200));
        }, 2050));
    }, 150));
}

function runPage8FilterAnimation() {
    if (shouldReduceMotion()) return;
    const typeText = document.getElementById("help-type-text");
    const filterCards = document.querySelectorAll(".help-filter-card");

    function setTyping(text, dimCard) {
        if (typeText) typeText.textContent = text;
        if (filterCards.length >= 3) {
            if (dimCard) {
                filterCards[0].className = "help-filter-card match";
                filterCards[1].className = "help-filter-card dim";
                filterCards[2].className = "help-filter-card match";
            } else {
                filterCards[0].className = "help-filter-card";
                filterCards[1].className = "help-filter-card";
                filterCards[2].className = "help-filter-card";
            }
        }
    }

    setTyping("", false);
    helpAnimationTimers.push(setTimeout(() => setTyping("디", false), 600));
    helpAnimationTimers.push(setTimeout(() => setTyping("디자", false), 1100));
    helpAnimationTimers.push(setTimeout(() => setTyping("디자인", true), 1600));
    helpAnimationTimers.push(setTimeout(() => {
        setTyping("", false);
        helpAnimationTimers.push(setTimeout(runPage8FilterAnimation, 600));
    }, 4400));
}

function startHelpPageAnimation(page) {
    if (page === 4) {
        runPage4KanbanAnimation();
    } else if (page === 5) {
        runPage5ChecklistAnimation();
    } else if (page === 6) {
        runPage6DependencyAnimation();
    } else if (page === 7) {
        runPage7CalendarAnimation();
    } else if (page === 8) {
        runPage8FilterAnimation();
    }
}

function showHelpPage(page) {
    if (page < 1 || page > TOTAL_HELP_PAGES) return;
    currentHelpPage = page;

    // 1. Stop active animations and reset DOM
    stopHelpAnimation();

    // 2. Toggle active page
    const pages = document.querySelectorAll(".help-page");
    pages.forEach((p) => {
        const pageNum = parseInt(p.getAttribute("data-page"), 10);
        p.classList.toggle("active", pageNum === page);
    });

    // 3. Update indicators
    const dots = document.querySelectorAll("#help-indicator span");
    dots.forEach((d, index) => {
        d.classList.toggle("active", index === page - 1);
    });

    // 4. Update step badge
    const badge = document.getElementById("help-step-badge");
    if (badge) {
        badge.textContent = `${page} / ${TOTAL_HELP_PAGES}`;
    }

    // 5. Update prev button
    const prevBtn = document.getElementById("help-prev");
    if (prevBtn) {
        prevBtn.disabled = (page === 1);
    }

    // 6. Update next button text
    const nextBtn = document.getElementById("help-next");
    if (nextBtn) {
        if (page === TOTAL_HELP_PAGES) {
            nextBtn.innerHTML = 'FlowForge 시작하기 <i class="fas fa-rocket"></i>';
        } else {
            nextBtn.innerHTML = '다음 <i class="fas fa-chevron-right"></i>';
        }
    }

    // 7. Start animation for current page
    startHelpPageAnimation(page);
}

// Global exports
window.showHelpPage = showHelpPage;
window.closeHelpModal = closeHelpModal;
window.stopHelpAnimation = stopHelpAnimation;