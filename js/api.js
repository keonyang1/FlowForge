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

    // =========================
    // Auth
    // =========================
    async register(userId, password, nickname) {
        return await this.fetch({
            action: "register",
            user_id: userId,
            password,
            nickname
        });
    },

    async login(userId, password) {
        const result = await this.fetch({
            action: "login",
            user_id: userId,
            password
        });
        if (result.success) {
            localStorage.setItem(
                "flowforge_session",
                JSON.stringify(result.user)
            );
        }
        return result;
    },

    logout() {
        localStorage.removeItem("flowforge_session");
        sessionStorage.removeItem("flowforge_current_page");
    },

    getUser() {
        try {
            const session = localStorage.getItem("flowforge_session");
            if (!session) return null;
            const user = JSON.parse(session);
            if (
                !user ||
                typeof user.user_id !== "string" ||
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
    },

    isLoggedIn() {
        return localStorage.getItem("flowforge_session") !== null;
    },

    async updateProfile(userId, nickname) {
        return this.fetch({
            action: "update_profile",
            user_id: userId,
            nickname
        });
    },

    async updatePassword(userId, oldPassword, newPassword) {
        return this.fetch({
            action: "update_password",
            user_id: userId,
            old_password: oldPassword,
            new_password: newPassword
        });
    },

    async uploadAvatar(userId, image) {
        return await this.fetch({
            action: "upload_avatar",
            user_id: userId,
            image
        });
    },

    async removeAvatar(userId) {
        return this.fetch({
            action: "remove_avatar",
            user_id: userId
        });
    },

    async deleteAccount(userId, password) {
        return this.fetch({
            action: "delete_user",
            user_id: userId,
            password
        });
    },

    // =========================
    // Project
    // =========================
    async getProjects(userId) {
        return await this.fetch({
            action: "get_projects",
            user_id: userId
        });
    },

    async addProject(data) {
        return await this.fetch({
            action: "add_project",
            ...data
        });
    },

    async updateProject(data) {
        return await this.fetch({
            action: "update_project",
            ...data
        });
    },

    async updateProjectStatus(projectId, status) {
        return await this.fetch({
            action: "update_project_status",
            project_id: projectId,
            status
        });
    },

    async deleteProject(projectId, userId) {
        return await this.fetch({
            action: "delete_project",
            project_id: projectId,
            user_id: userId
        });
    },

    // =========================
    // Task
    // =========================
    async getTasks(userId) {
        return await this.fetch({
            action: "get_tasks",
            user_id: userId
        });
    },

    async addTask(data) {
        return await this.fetch({
            action: "add_task",
            ...data
        });
    },

    async updateTask(data) {
        return await this.fetch({
            action: "update_task",
            ...data
        });
    },

    async updateTaskStatus(taskId, status, userId) {
        return await this.fetch({
            action: "update_task_status",
            task_id: taskId,
            user_id: userId,
            status
        });
    },

    async deleteTask(taskId, userId) {
        return await this.fetch({
            action: "delete_task",
            task_id: taskId,
            user_id: userId
        });
    }
};