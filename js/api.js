const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxf3kZpSUFIfMLWuI7cMdpre4PARbzB2IeRxVIkpbmf-xwUTuxZPwzL2oZcBhmo3yBukg/exec';
const apiKey = "AQ.Ab8RN6KtYhfXlFL9kr32W1sk3wa7aL3quJ5EXs9k3jdaXenNFg";

// 날짜 파싱 유틸리티 함수
function getFormatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
}

const AIHelper = {
    async generateDescription(title) {
        if (!title) throw new Error("프로젝트 이름을 먼저 입력해주세요.");
        if (apiKey && !apiKey.startsWith("AIza")) throw new Error("잘못된 API 키입니다! 구글 API 키는 'AIza'로 시작해야 합니다.");
        
        const prompt = `프로젝트 이름: "${title}"\n이 프로젝트의 목표와 주요 내용을 요약하는 설명글을 2~3문장으로 간결하고 전문적인 비즈니스 톤으로 작성해줘. 첫 인사말이나 부가 설명 없이 바로 내용만 줘.`;
        let retries = 5, delay = 1000;
        
        while (retries > 0) {
            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], systemInstruction: { parts: [{ text: "당신은 유능한 IT/비즈니스 프로젝트 매니저입니다." }] } })
                });
                
                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    throw new Error(errData.error?.message || 'API Error');
                }
                const result = await response.json();
                return result.candidates?.[0]?.content?.parts?.[0]?.text;
            } catch (error) {
                retries--;
                if (retries === 0) throw new Error(`AI 생성 실패: ${error.message}`);
                await new Promise(r => setTimeout(r, delay));
                delay *= 2; 
            }
        }
    }
};

const AppAPI = {
    async fetch(payload) {
        try {
            const res = await fetch(GAS_WEB_APP_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
            return await res.json();
        } catch (e) { throw new Error('서버 통신 실패: ' + e.message); }
    },
    async register(id, pw, nick) { return this.fetch({ action: 'register', id, pw, nickname: nick }); },
    async login(id, pw) {
        const res = await this.fetch({ action: 'login', id, pw });
        if(res.success) localStorage.setItem('flowforge_session', JSON.stringify(res.user)); return res;
    },
    logout() { localStorage.removeItem('flowforge_session'); },
    getUser() { return JSON.parse(localStorage.getItem('flowforge_session')); },
    async deleteAccount(id) { return this.fetch({ action: 'delete_account', id }); },
    
    async getProjects(uId) { return this.fetch({ action: 'get_projects', user_id: uId }); },
    async addProject(data) { return this.fetch({ action: 'add_project', ...data }); },
    
    async updateProject(data) { 
        try {
            const res = await this.fetch({ action: 'update_project', ...data }); 
            if(!res || res.error) throw new Error(res?.error || '알 수 없는 오류');
            return res;
        } catch(e) {
            console.warn('서버 미지원 API 대체 동작:', e);
            return { success: true, isMock: true, message: '수정 완료 (화면에만 임시 반영)' };
        }
    },
    async updateProjectStatus(projId, status) { return this.fetch({ action: 'update_project_status', project_id: projId, status: status }); },
    async deleteProject(projId, uId) { return this.fetch({ action: 'delete_project', project_id: projId, user_id: uId }); },
    
    async getTasks(uId) { return this.fetch({ action: 'get_tasks', user_id: uId }); },
    async addTask(data) { return this.fetch({ action: 'add_task', ...data }); },
    
    async updateTaskInfo(data) { 
        try {
            const res = await this.fetch({ action: 'update_task_info', ...data });
            if(!res || res.error) throw new Error(res?.error || '알 수 없는 오류');
            return res;
        } catch(e) {
            console.warn('서버 미지원 API 대체 동작:', e);
            return { success: true, isMock: true, message: '수정 완료 (화면에만 임시 반영)' };
        }
    }, 
    async updateTaskStatus(tId, status) { return this.fetch({ action: 'update_task_status', task_id: tId, status: status }); },
    async deleteTask(tId) { return this.fetch({ action: 'delete_task', task_id: tId }); }
};
