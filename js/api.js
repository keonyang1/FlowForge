const AppAPI = {
    // 공통 요청
    async fetch(payload) {
        try {
            const response = await fetch(GAS_WEB_APP_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "text/plain;charset=utf-8"
                },
                body: JSON.stringify(payload)
            });
            return await response.json();
        } catch (error) {
            console.error(error);
            return {
                success: false,
                message: "서버에 연결할 수 없습니다."
            };
        }
    },

    // 회원가입
    async register(username, password, nickname) {
        return await this.fetch({action: "register", username, password, nickname});
    },

    // 로그인
    async login(username, password) {
        const result = await this.fetch({action: "login", username, password});
        if (result.success) {
            localStorage.setItem(
                "flowforge_session",
                JSON.stringify(result.user)
            );
        }
        return result;
    },

    // 닉네임 변경
    async updateProfile(username, currentPassword, nickname) {
        return this.fetch({
            action: "update_profile",
            username,
            current_password: currentPassword,
            nickname
        });
    },

    // 비밀번호 변경
    async updatePassword(username, oldPassword, newPassword) {
        return this.fetch({
            action:"update_password",
            username,
            old_password:oldPassword,
            new_password:newPassword
        });
    },

    // 로그아웃
    logout() {
        localStorage.removeItem("flowforge_session");
    },

    // 로그인 여부
    isLoggedIn() {
        return localStorage.getItem("flowforge_session") !== null;
    },
    
    // 세션 가져오기
    getUser() {
        try {
            const session = localStorage.getItem(
                "flowforge_session"
            );
            if (!session) return null;
            const user = JSON.parse(session);
            if (
                !user ||
                typeof user.username !== "string" ||
                typeof user.nickname !== "string"
            ) {
                this.logout();
                return null;
            }
            return user;
        } catch {
            this.logout();
            return null;
        }
    }
};