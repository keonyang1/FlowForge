// js/api.js

const AppAPI = {
    // 공통 요청
    async fetch(payload) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        try {
            const response = await fetch(GAS_WEB_APP_URL, {
                signal: controller.signal,
                method: "POST",
                headers: {
                    "Content-Type": "text/plain;charset=utf-8"
                },
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const result = await response.json();
            if (!result || typeof result !== "object" || typeof result.success !== "boolean") {
                throw new Error("Invalid API response");
            }
            return result;
        } catch (error) {
            console.error(error);
            return {
                success: false,
                message: error.name === "AbortError"
                    ? "응답 시간이 초과되었습니다. 변경 사항이 저장되었는지 새로고침 후 확인해주세요."
                    : "서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요."
            };
        } finally {
            clearTimeout(timeout);
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
        if (result.success && (!result.user || typeof result.user.user_id !== "string" || !result.user.user_id.trim() || typeof result.user.nickname !== "string")) {
            return { success: false, message: "로그인 응답이 올바르지 않습니다." };
        }
        if (result.success) {
            localStorage.setItem(
                "flowforge_session",
                JSON.stringify(result.user)
            );
        }
        return result;
    },

    logout() {
        try { localStorage.removeItem("flowforge_session"); } catch {}
        try { sessionStorage.removeItem("flowforge_current_page"); } catch {}
    },

    clearUserCaches(userId) {
        if (typeof userId !== "string" || !userId) return;
        try {
            localStorage.removeItem(`flowforge_checklists_${userId}`);
            localStorage.removeItem(`flowforge_dependencies_${userId}`);
        } catch (error) {
            console.warn("Failed to clear local user data:", error);
        }
    },

    getUser() {
        try {
            const session = localStorage.getItem("flowforge_session");
            if (!session) return null;
            const user = JSON.parse(session);
            if (
                !user ||
                typeof user.user_id !== "string" ||
                !user.user_id.trim() ||
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
        return this.getUser() !== null;
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

    async updateProjectStatus(projectId, status, userId) {
        return await this.fetch({
            action: "update_project_status",
            project_id: projectId,
            user_id: userId,
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
    },

    // =========================
    // Checklist
    // =========================
    async getChecklists(userId, taskId = null) {
        let list = [];
        let serverLoaded = false;
        try {
            const params = {
                action: "get_checklists",
                user_id: userId
            };
            if (taskId) {
                params.task_id = taskId;
            }
            const res = await this.fetch(params);
            if (res && res.success && Array.isArray(res.checklists)) {
                list = res.checklists;
                serverLoaded = true;
            }
        } catch (e) {
            console.warn("[Checklist API] Server get_checklists failed, falling back to local cache:", e);
        }

        if (!serverLoaded) {
            try {
                const cached = localStorage.getItem(`flowforge_checklists_${userId}`);
                list = cached ? JSON.parse(cached) : [];

            } catch (e) {}
        }

        // id 기준 중복 제거 (기존 시트의 중복 데이터로부터 완벽 방어)
        const unique = [];
        const seen = new Set();
        const rawList = Array.isArray(list) ? list : [];
        for (let i = rawList.length - 1; i >= 0; i--) {
            const item = rawList[i];
            if (!item || typeof item !== "object") continue;
            if (taskId && item.task_id !== taskId) continue;
            const id = String(item.id || '').trim();
            if (!id || seen.has(id)) continue;
            seen.add(id);
            unique.push({ ...item, is_completed: normalizeBoolean(item.is_completed) });
        }
        unique.reverse();

        if (serverLoaded) {
            try {
                const key = `flowforge_checklists_${userId}`;
                const cached = JSON.parse(localStorage.getItem(key) || '[]');
                const otherTasks = taskId && Array.isArray(cached)
                    ? cached.filter(item => item && item.task_id !== taskId) : [];
                localStorage.setItem(key, JSON.stringify([...otherTasks, ...unique]));
            } catch (e) {}
        }

        return {
            success: true,
            fromCache: !serverLoaded,
            checklists: unique
        };
    },

    async addChecklistItem(taskId, textOrItem, userId) {
        const text = typeof textOrItem === 'object' && textOrItem !== null ? (textOrItem.text || '') : textOrItem;
        try {
            const res = await this.fetch({
                action: "add_checklist_item",
                user_id: userId,
                task_id: taskId,
                text: text
            });

            if (res && res.success) {
                const created = res.checklist || res.item;
                if (created) {
                    try {
                        const cacheKey = `flowforge_checklists_${userId}`;
                        const cached = localStorage.getItem(cacheKey);
                        let all = cached ? JSON.parse(cached) : [];
                        if (!Array.isArray(all)) all = [];
                        if (!all.some(c => c.id === created.id)) {
                            all.push(created);
                            localStorage.setItem(cacheKey, JSON.stringify(all));
                        }
                    } catch (e) {}
                }
            }

            return res;
        } catch (e) {
            console.warn("[Checklist API] Server add error:", e);
            return { success: false, message: e.message || '서버 통신 오류' };
        }
    },

    async updateChecklistItem(param1, param2, param3, param4) {
        // (checklistId, updates, userId) 또는 (taskId, itemId, updates, userId) 모두 지원
        let checklistId, updates, userId;
        if (typeof param3 === 'object' && param3 !== null) {
            checklistId = param2;
            updates = param3;
            userId = param4;
        } else {
            checklistId = param1;
            updates = param2;
            userId = param3;
        }

        // 로컬 캐시 인플레이스 갱신
        try {
            const res = await this.fetch({
                action: "update_checklist_item",
                user_id: userId,
                checklist_id: checklistId,
                item_id: checklistId,
                ...updates
            });
            if (!res.success) return res;
            try {
                const cacheKey = `flowforge_checklists_${userId}`;
                const cached = localStorage.getItem(cacheKey);
                let all = cached ? JSON.parse(cached) : [];
                if (Array.isArray(all)) {
                    all = all.map(c => {
                        if (c.id === checklistId) {
                            return { ...c, ...updates };
                        }
                        return c;
                    });
                    localStorage.setItem(cacheKey, JSON.stringify(all));
                }
            } catch (e) {
                console.warn("[Checklist API] Local cache update error:", e);
            }

            return res;
        } catch (e) {
            console.warn("[Checklist API] Server update error:", e);
            return { success: false, message: e.message || '서버 통신 오류' };
        }
    },

    async deleteChecklistItem(param1, param2, param3) {
        // (checklistId, userId) 또는 (taskId, itemId, userId) 모두 지원
        let checklistId, userId;
        if (param3 !== undefined) {
            checklistId = param2;
            userId = param3;
        } else {
            checklistId = param1;
            userId = param2;
        }

        // 로컬 캐시 삭제
        try {
            const res = await this.fetch({
                action: "delete_checklist_item",
                user_id: userId,
                checklist_id: checklistId,
                item_id: checklistId
            });
            if (!res.success) return res;
            try {
                const cacheKey = `flowforge_checklists_${userId}`;
                const cached = localStorage.getItem(cacheKey);
                let all = cached ? JSON.parse(cached) : [];
                if (Array.isArray(all)) {
                    all = all.filter(c => c.id !== checklistId);
                    localStorage.setItem(cacheKey, JSON.stringify(all));
                }
            } catch (e) {
                console.warn("[Checklist API] Local cache delete error:", e);
            }

            return res;
        } catch (e) {
            console.warn("[Checklist API] Server delete error:", e);
            return { success: false, message: e.message || '서버 통신 오류' };
        }
    },

    async saveTaskChecklists(taskId, items, userId) {
        try {
            const res = await this.fetch({
                action: "save_task_checklists",
                user_id: userId,
                task_id: taskId,
                items
            });
            if (!res.success) return res;
            try {
                const cacheKey = `flowforge_checklists_${userId}`;
                const cached = localStorage.getItem(cacheKey);
                let all = cached ? JSON.parse(cached) : [];
                if (!Array.isArray(all)) all = [];
                all = all.filter(item => item.task_id !== taskId);
                const now = new Date().toISOString();
                const seen = new Set();
                const normalizedItems = [];
                for (let idx = 0; idx < (items || []).length; idx++) {
                    const item = items[idx];
                    const id = item.id || `chk_${taskId}_${idx}_${Date.now()}`;
                    if (seen.has(id)) continue;
                    seen.add(id);
                    normalizedItems.push({
                        id: id,
                        user_id: userId,
                        task_id: taskId,
                        text: String(item.text || "").trim(),
                        is_completed: normalizeBoolean(item.is_completed),
                        created_at: item.created_at || now
                    });
                }
                all.push(...normalizedItems);
                localStorage.setItem(cacheKey, JSON.stringify(all));
            } catch (e) {
                console.warn("[Checklist API] Local cache update error:", e);
            }

            return res;
        } catch (e) {
            console.warn("[Checklist API] Server sync error:", e);
            return { success: false, message: "체크리스트 저장에 실패했습니다." };
        }
    },

    // =========================
    // Dependencies
    // =========================
    async getDependencies(userId) {
        let list = [];
        let serverLoaded = false;
        try {
            const res = await this.fetch({
                action: "get_dependencies",
                user_id: userId
            });
            if (res && res.success && Array.isArray(res.dependencies)) {
                list = res.dependencies;
                serverLoaded = true;
            }
        } catch (e) {
            console.warn("[Dependency API] Server get_dependencies failed, falling back to local cache:", e);
        }

        if (!serverLoaded) {
            try {
                const cached = localStorage.getItem(`flowforge_dependencies_${userId}`);
                list = cached ? JSON.parse(cached) : [];
            } catch (e) {}
        }

        const unique = [];
        const seen = new Set();
        const rawList = Array.isArray(list) ? list : [];
        for (let i = rawList.length - 1; i >= 0; i--) {
            const item = rawList[i];
            if (!item || typeof item !== "object") continue;
            const id = String(item.id || '').trim();
            if (!id || seen.has(id)) continue;
            seen.add(id);
            unique.push(item);
        }
        unique.reverse();

        try {
            localStorage.setItem(`flowforge_dependencies_${userId}`, JSON.stringify(unique));
        } catch (e) {}

        return {
            success: true,
            fromCache: !serverLoaded,
            dependencies: unique
        };
    },

    async addDependency(taskId, dependsOnTaskId, userId) {
        try {
            const res = await this.fetch({
                action: "add_dependency",
                user_id: userId,
                task_id: taskId,
                depends_on_task_id: dependsOnTaskId
            });

            if (res && res.success && res.dependency) {
                try {
                    const cacheKey = `flowforge_dependencies_${userId}`;
                    const cached = localStorage.getItem(cacheKey);
                    let all = cached ? JSON.parse(cached) : [];
                    if (!Array.isArray(all)) all = [];
                    if (!all.some(d => d.id === res.dependency.id)) {
                        all.push(res.dependency);
                        localStorage.setItem(cacheKey, JSON.stringify(all));
                    }
                } catch (e) {}
            }
            return res;
        } catch (e) {
            console.warn("[Dependency API] Server add error:", e);
            return { success: false, message: e.message || '서버 통신 오류' };
        }
    },

    async deleteDependency(dependencyId, userId) {
        try {
            const res = await this.fetch({
                action: "delete_dependency",
                user_id: userId,
                dependency_id: dependencyId
            });
            if (!res.success) return res;
            try {
                const cacheKey = `flowforge_dependencies_${userId}`;
                const cached = localStorage.getItem(cacheKey);
                let all = cached ? JSON.parse(cached) : [];
                if (Array.isArray(all)) {
                    all = all.filter(d => d.id !== dependencyId);
                    localStorage.setItem(cacheKey, JSON.stringify(all));
                }
            } catch (e) {}

            return res;
        } catch (e) {
            console.warn("[Dependency API] Server delete error:", e);
            return { success: false, message: e.message || '서버 통신 오류' };
        }
    }
};
