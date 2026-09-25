const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function setup() {
    const values = new Map();
    const storage = {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
        removeItem: key => values.delete(key),
        key: index => [...values.keys()][index] ?? null,
        get length() { return values.size; }
    };
    const ctx = vm.createContext({
        localStorage: storage, sessionStorage: storage, AbortController,
        setTimeout, clearTimeout, console: { error() {}, warn() {} },
        document: { addEventListener() {}, getElementById() { return null; }, querySelector() { return null; } }, window: {},
        fetch: async () => ({ ok: true, json: async () => ({ success: true }) })
    });
    for (const file of ['config', 'utils', 'api', 'ui', 'app']) {
        vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', file + '.js'), 'utf8'), ctx);
    }
    return { ctx, storage, api: vm.runInContext('AppAPI', ctx), ui: vm.runInContext('UI', ctx) };
}

function setSession(storage, userId = 'u', generation = 'session-1', extra = {}) {
    storage.setItem('flowforge_session', JSON.stringify({
        user_id: userId,
        nickname: userId.toUpperCase(),
        __flowforgeSessionGeneration: generation,
        ...extra
    }));
}

function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}

test('dates reject impossible dates and retain leap days', () => {
    const { ctx } = setup();
    for (const [input, expected] of [['2026-02-30', ''], ['2026-13-01', ''], ['2026-00-10', ''], ['2026-01-00', ''], ['2024/2/29', '2024-02-29'], ['2026.9.7', '2026-09-07'], ['2026-09-07garbage', ''], ['', '']]) {
        assert.equal(vm.runInContext(`normalizeDateStr(${JSON.stringify(input)})`, ctx), expected);
    }
});

test('spreadsheet booleans do not treat FALSE as completed', () => {
    const { ctx } = setup();
    for (const value of [false, 'FALSE', 'false', '0', 0, '', null]) {
        assert.equal(vm.runInContext(`normalizeBoolean(${JSON.stringify(value)})`, ctx), false);
    }
    for (const value of [true, 'TRUE', ' true ', '1', 1]) {
        assert.equal(vm.runInContext(`normalizeBoolean(${JSON.stringify(value)})`, ctx), true);
    }
});

for (const [method, field, key] of [['getChecklists', 'checklists', 'flowforge_checklists_u'], ['getDependencies', 'dependencies', 'flowforge_dependencies_u']]) {
    test(`${method}: empty server data clears stale cache`, async () => {
        const { api, storage } = setup();
        setSession(storage);
        storage.setItem(key, JSON.stringify([{ id: 'stale', task_id: 't' }]));
        api.fetch = async () => ({ success: true, [field]: [] });
        const result = await api[method]('u');
        assert.equal(result[field].length, 0);
        assert.equal(storage.getItem(key), '[]');
    });
    test(`${method}: network failure uses cache and ignores invalid entries`, async () => {
        const { api, storage } = setup();
        setSession(storage);
        storage.setItem(key, JSON.stringify([null, { id: 'a', is_completed: 'FALSE' }, { id: 'a', is_completed: 'FALSE' }]));
        api.fetch = async () => ({ success: false });
        const result = await api[method]('u');
        assert.equal(result[field].length, 1);
        if (field === 'checklists') assert.equal(result[field][0].is_completed, false);
    });
}

for (const [method, args, key] of [
    ['updateChecklistItem', ['a', { text: 'new' }, 'u'], 'flowforge_checklists_u'],
    ['deleteChecklistItem', ['a', 'u'], 'flowforge_checklists_u'],
    ['saveTaskChecklists', ['t', [], 'u'], 'flowforge_checklists_u'],
    ['deleteDependency', ['a', 'u'], 'flowforge_dependencies_u']
]) {
    test(`${method}: failed mutation preserves cache; success commits`, async () => {
        const { api, storage } = setup();
        setSession(storage);
        const original = JSON.stringify([{ id: 'a', task_id: 't', text: 'old' }]);
        storage.setItem(key, original);
        api.fetch = async () => ({ success: false });
        assert.equal((await api[method](...args)).success, false);
        assert.equal(storage.getItem(key), original);
        api.fetch = async () => ({ success: true });
        assert.equal((await api[method](...args)).success, true);
        assert.notEqual(storage.getItem(key), original);
    });
}

test('HTTP errors and malformed JSON responses return failures', async () => {
    const { ctx, api } = setup();
    for (const response of [{ ok: false, status: 503 }, { ok: true, json: async () => null }, { ok: true, json: async () => [] }, { ok: true, json: async () => { throw new Error('bad JSON'); } }]) {
        ctx.fetch = async () => response;
        assert.equal((await api.fetch({ action: 'test' })).success, false);
    }
});

test('timeout aborts request and explains uncertain save status', async () => {
    const { ctx, api } = setup();
    ctx.setTimeout = callback => setTimeout(callback, 1);
    ctx.fetch = (_, options) => new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(Object.assign(new Error(), { name: 'AbortError' })));
    });
    const result = await api.fetch({});
    assert.equal(result.success, false);
    assert.match(result.message, /초과/);
});

test('invalid sessions and unavailable storage fail closed without throwing', () => {
    const { api, storage } = setup();
    storage.setItem('flowforge_session', '{');
    assert.equal(api.isLoggedIn(), false);
    storage.getItem = () => { throw new Error('blocked'); };
    storage.removeItem = () => { throw new Error('blocked'); };
    assert.equal(api.getUser(), null);
});

test('malformed login response is not persisted', async () => {
    const { api, storage } = setup();
    api.fetch = async () => ({ success: true });
    assert.equal((await api.login('user', 'password')).success, false);
    assert.equal(storage.getItem('flowforge_session'), null);
});

test('login rotates session generation and clears only a previous account cache', async () => {
    const { api, storage } = setup();
    api.fetch = async payload => ({ success: true, user: { user_id: payload.user_id, nickname: payload.user_id } });
    await api.login('a', 'password');
    const firstGeneration = JSON.parse(storage.getItem('flowforge_session')).__flowforgeSessionGeneration;
    storage.setItem('flowforge_checklists_a', '[{"id":"saved"}]');
    await api.login('a', 'password');
    const secondGeneration = JSON.parse(storage.getItem('flowforge_session')).__flowforgeSessionGeneration;
    assert.notEqual(secondGeneration, firstGeneration);
    assert.notEqual(storage.getItem('flowforge_checklists_a'), null);
    await api.login('b', 'password');
    assert.equal(storage.getItem('flowforge_checklists_a'), null);
    assert.equal(JSON.parse(storage.getItem('flowforge_session')).user_id, 'b');
});

test('an older login response cannot replace a newer account login', async () => {
    const { api, storage } = setup();
    const first = deferred();
    const second = deferred();
    api.fetch = payload => payload.user_id === 'a' ? first.promise : second.promise;
    const older = api.login('a', 'password');
    const newer = api.login('b', 'password');
    second.resolve({ success: true, user: { user_id: 'b', nickname: 'B' } });
    assert.equal((await newer).success, true);
    first.resolve({ success: true, user: { user_id: 'a', nickname: 'A' } });
    assert.equal((await older).success, false);
    assert.equal(JSON.parse(storage.getItem('flowforge_session')).user_id, 'b');
});

test('overlapping loads only apply the newest response', async () => {
    const { ctx, api, ui, storage } = setup();
    storage.setItem('flowforge_session', JSON.stringify({ user_id: 'u', nickname: 'U' }));
    api.bindViewSession(api.captureSession());
    const pending = [];
    api.getProjects = () => new Promise(resolve => pending.push(resolve));
    api.getTasks = async () => ({ success: true, tasks: [] });
    api.getChecklists = async () => ({ success: true, checklists: [] });
    api.getDependencies = async () => ({ success: true, dependencies: [] });
    ui.setGlobalLoading = () => {};
    ui.showToast = () => {};
    for (const name of ['renderProjects', 'renderTasks', 'renderDashboard', 'renderAnalytics']) ctx[name] = () => {};
    const first = vm.runInContext('loadAppData()', ctx);
    const second = vm.runInContext('loadAppData()', ctx);
    pending[1]({ success: true, projects: [{ id: 'new' }] });
    await second;
    pending[0]({ success: true, projects: [{ id: 'old' }] });
    await first;
    assert.equal(vm.runInContext('currentProjects[0].id', ctx), 'new');
});

test('logout while loading prevents old account data from rendering', async () => {
    const { ctx, api, ui, storage } = setup();
    storage.setItem('flowforge_session', JSON.stringify({ user_id: 'u', nickname: 'U' }));
    api.bindViewSession(api.captureSession());
    let finish;
    api.getProjects = () => new Promise(resolve => { finish = resolve; });
    api.getTasks = api.getChecklists = api.getDependencies = async () => ({ success: true, tasks: [] });
    ui.setGlobalLoading = () => {};
    ui.showToast = () => { throw new Error('Unexpected stale toast'); };
    const promise = vm.runInContext('loadAppData()', ctx);
    api.logout();
    finish({ success: true, projects: [{ id: 'private' }] });
    await promise;
    assert.equal(vm.runInContext('currentProjects.length', ctx), 0);
});

test('nested loaders stay visible until all operations finish', () => {
    const { ctx, ui } = setup();
    const callbacks = new Map();
    let id = 0;
    ctx.setTimeout = cb => { callbacks.set(++id, cb); return id; };
    ctx.clearTimeout = key => callbacks.delete(key);
    const loader = { style: {}, setAttribute() {} };
    ctx.document.getElementById = () => loader;
    ui.setGlobalLoading(true);
    ui.setGlobalLoading(true);
    ui.setGlobalLoading(false);
    assert.equal(loader.style.opacity, '1');
    ui.setGlobalLoading(false);
    ui.setGlobalLoading(true);
    for (const cb of callbacks.values()) cb();
    assert.equal(loader.style.display, 'flex');
    assert.equal(loader.style.opacity, '1');
});

test('invalid saved page falls back without hiding login sections', () => {
    const { ctx, ui, storage } = setup();
    const dashboard = { classList: { add() {} } };
    ctx.document.getElementById = id => id === 'dashboard-page' ? dashboard : null;
    ctx.document.querySelectorAll = selector => {
        assert.notEqual(selector, '.page-section, .nav-item');
        return [];
    };
    ui.switchPage('nonexistent');
    assert.equal(storage.getItem('flowforge_current_page'), 'dashboard');
});

test('checklist completion statistics normalize string booleans', () => {
    const { ctx } = setup();
    vm.runInContext(`currentChecklists = [
        { id: 'a', task_id: 't', is_completed: 'FALSE' },
        { id: 'b', task_id: 't', is_completed: 'TRUE' }
    ]`, ctx);
    assert.equal(vm.runInContext("getTaskChecklistStats('t').percent", ctx), 50);
});

test('task-specific checklist refresh clears only its own cached rows', async () => {
    const { api, storage } = setup();
    setSession(storage);
    const key = 'flowforge_checklists_u';
    storage.setItem(key, JSON.stringify([null, { id: 'a', task_id: 't' }, { id: 'b', task_id: 'other' }]));
    api.fetch = async () => ({ success: true, checklists: [] });
    assert.equal((await api.getChecklists('u', 't')).fromCache, false);
    assert.deepEqual(JSON.parse(storage.getItem(key)), [{ id: 'b', task_id: 'other' }]);
    api.fetch = async () => ({ success: false });
    const result = await api.getChecklists('u', 't');
    assert.equal(result.fromCache, true);
    assert.equal(result.checklists.length, 0);
});

test('logout clears account caches and logged-out fallback cannot read residual data', async () => {
    const { api, storage } = setup();
    setSession(storage);
    const checklistKey = 'flowforge_checklists_u';
    const dependencyKey = 'flowforge_dependencies_u';
    storage.setItem(checklistKey, JSON.stringify([{ id: 'c', text: 'private' }]));
    storage.setItem(dependencyKey, JSON.stringify([{ id: 'd', task_id: 't' }]));
    api.fetch = async () => ({ success: false });
    assert.equal((await api.getChecklists('u')).checklists.length, 1);
    assert.equal((await api.getDependencies('u')).dependencies.length, 1);

    api.logout();
    assert.equal(storage.getItem(checklistKey), null);
    assert.equal(storage.getItem(dependencyKey), null);
    storage.setItem(checklistKey, JSON.stringify([{ id: 'legacy', text: 'old' }]));
    assert.equal((await api.getChecklists('u')).checklists.length, 0);
});

test('inactive caches left by an older session are cleared without removing the active offline cache', () => {
    const { api, storage } = setup();
    setSession(storage, 'u');
    storage.setItem('flowforge_checklists_u', '[{"id":"active"}]');
    storage.setItem('flowforge_checklists_old', '[{"id":"private"}]');
    storage.setItem('flowforge_dependencies_old', '[{"id":"private"}]');
    api.purgeInactiveUserCaches('u');
    assert.notEqual(storage.getItem('flowforge_checklists_u'), null);
    assert.equal(storage.getItem('flowforge_checklists_old'), null);
    assert.equal(storage.getItem('flowforge_dependencies_old'), null);
    api.logout();
    assert.equal(storage.getItem('flowforge_checklists_u'), null);
});

for (const [method, field, key] of [
    ['getChecklists', 'checklists', 'flowforge_checklists_u'],
    ['getDependencies', 'dependencies', 'flowforge_dependencies_u']
]) {
    test(`${method}: a late response cannot restore cache after logout and same-user login`, async () => {
        const { api, storage } = setup();
        setSession(storage, 'u', 'old-session');
        const request = deferred();
        api.fetch = () => request.promise;
        const pending = api[method]('u');
        api.logout();
        setSession(storage, 'u', 'new-session');
        request.resolve({ success: true, [field]: [{ id: 'old', task_id: 't' }] });
        await pending;
        assert.equal(storage.getItem(key), null);
    });
}

for (const [method, args, response, key] of [
    ['addChecklistItem', ['t', 'old', 'u'], { success: true, checklist: { id: 'new', task_id: 't' } }, 'flowforge_checklists_u'],
    ['updateChecklistItem', ['a', { text: 'changed' }, 'u'], { success: true }, 'flowforge_checklists_u'],
    ['deleteChecklistItem', ['a', 'u'], { success: true }, 'flowforge_checklists_u'],
    ['saveTaskChecklists', ['t', [{ id: 'new', text: 'old' }], 'u'], { success: true }, 'flowforge_checklists_u'],
    ['addDependency', ['t', 'other', 'u'], { success: true, dependency: { id: 'new', task_id: 't' } }, 'flowforge_dependencies_u'],
    ['deleteDependency', ['a', 'u'], { success: true }, 'flowforge_dependencies_u']
]) {
    test(`${method}: a late mutation cannot recreate a cleared cache`, async () => {
        const { api, storage } = setup();
        setSession(storage, 'u', 'old-session');
        storage.setItem(key, JSON.stringify([{ id: 'a', task_id: 't' }]));
        const request = deferred();
        api.fetch = () => request.promise;
        const pending = api[method](...args);
        api.logout();
        setSession(storage, 'b', 'new-session');
        request.resolve(response);
        await pending;
        assert.equal(storage.getItem(key), null);
    });
}

function setupWrites() {
    const env = setup();
    for (const file of ['task', 'task-detail', 'task-dependencies', 'calendar']) {
        vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', file + '.js'), 'utf8'), env.ctx);
    }
    env.storage.setItem('flowforge_session', JSON.stringify({ user_id: 'u', nickname: 'U' }));
    env.api.bindViewSession(env.api.captureSession());
    env.ui.showToast = () => {};
    for (const name of ['syncTaskRelatedViews', 'renderTasks', 'renderProjects', 'renderCalendar', 'renderDashboard', 'renderAnalytics']) env.ctx[name] = () => {};
    vm.runInContext("currentTasks = [{ id: 't', title: 'Task', status: 'To Do', due_date: '2026-09-17' }]", env.ctx);
    return env;
}

function setupAuth() {
    const env = setup();
    const elements = new Map();
    const listeners = new Map();
    const element = id => {
        if (!elements.has(id)) {
            const classes = new Set();
            elements.set(id, {
                id, style: {}, value: '', textContent: '', innerHTML: '', files: [],
                classList: {
                    add: name => classes.add(name),
                    remove: name => classes.delete(name),
                    contains: name => classes.has(name),
                    toggle: name => classes.has(name) ? classes.delete(name) : classes.add(name)
                },
                addEventListener(name, handler) { listeners.set(`element:${id}:${name}`, handler); },
                reset() {}, focus() {},
                removeAttribute(name) { this[name] = ''; }
            });
        }
        return elements.get(id);
    };
    env.ctx.document.getElementById = element;
    env.ctx.document.querySelectorAll = () => [];
    env.ctx.document.addEventListener = (name, handler) => listeners.set(`document:${name}`, handler);
    env.ctx.window.addEventListener = (name, handler) => listeners.set(`window:${name}`, handler);
    for (const name of ['setSyncState', 'setGlobalLoading', 'switchPage', 'closeModal', 'openModal', 'showToast']) {
        env.ui[name] = () => {};
    }
    setSession(env.storage, 'a', 'a-session', { avatar_url: 'data:image/png;base64,AA==' });
    env.storage.setItem('flowforge_help_seen', 'true');
    vm.runInContext('loadAppData = () => Promise.resolve(true)', env.ctx);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/calendar.js'), 'utf8'), env.ctx);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/auth.js'), 'utf8'), env.ctx);
    vm.runInContext('initAuth()', env.ctx);
    return { ...env, element, listeners };
}

test('rapid status changes send only one write and roll back a failure', async () => {
    const { ctx, api } = setupWrites();
    let finish, calls = 0;
    api.updateTaskStatus = () => { calls++; return new Promise(resolve => { finish = resolve; }); };
    const pending = vm.runInContext("changeTaskStatus('t', 'In Progress')", ctx);
    await vm.runInContext("changeTaskStatus('t', 'Done')", ctx);
    assert.equal(calls, 1);
    assert.equal(vm.runInContext('currentTasks[0].status', ctx), 'In Progress');
    finish({ success: false, message: 'failed' });
    await pending;
    assert.equal(vm.runInContext('currentTasks[0].status', ctx), 'To Do');
    api.updateTaskStatus = async () => ({ success: true });
    await vm.runInContext("changeTaskStatus('t', 'Done')", ctx);
    assert.equal(vm.runInContext('currentTasks[0].status', ctx), 'Done');
});

test('calendar saves update dashboard and analytics without changing API fields', async () => {
    const { ctx, api } = setupWrites();
    const refreshed = [];
    let payload;
    api.updateTask = async data => { payload = data; return { success: true }; };
    ctx.renderDashboard = () => refreshed.push('dashboard');
    ctx.renderAnalytics = () => refreshed.push('analytics');
    await vm.runInContext("updateCalendarItemDueDate('task', 't', '2026-09-20', '2026-09-17')", ctx);
    assert.deepEqual(refreshed, ['dashboard', 'analytics']);
    assert.equal(payload.task_id, 't');
    assert.equal(payload.user_id, 'u');
    assert.equal(payload.status, 'To Do');
    assert.equal(payload.due_date, '2026-09-20');
});

test('calendar write blocks competing status/date writes and releases on failure', async () => {
    const { ctx, api } = setupWrites();
    let finish, calls = 0;
    api.updateTask = () => { calls++; return new Promise(resolve => { finish = resolve; }); };
    api.updateTaskStatus = () => { throw new Error('Concurrent write'); };
    const pending = vm.runInContext("updateCalendarItemDueDate('task', 't', '2026-09-20', '2026-09-17')", ctx);
    await vm.runInContext("updateCalendarItemDueDate('task', 't', '2026-09-21', '2026-09-20')", ctx);
    await vm.runInContext("changeTaskStatus('t', 'Done')", ctx);
    assert.equal(calls, 1);
    assert.equal(vm.runInContext('currentTasks[0].status', ctx), 'To Do');
    finish({ success: false });
    await pending;
    assert.equal(vm.runInContext('currentTasks[0].due_date', ctx), '2026-09-17');
    assert.equal(vm.runInContext('pendingItemWrites.size', ctx), 0);
});

test('global search reapplies only to the active page after a refresh', () => {
    const { ctx } = setup();
    const card = text => ({ style: {}, querySelectorAll: () => [{ textContent: text }] });
    const cards = [card('Alpha Project'), card('Beta Project')];
    ctx.document.querySelector = () => ({ id: 'projects-page', querySelectorAll: () => cards });
    ctx.document.getElementById = () => ({ value: ' alpha ' });
    vm.runInContext('applyGlobalSearch()', ctx);
    assert.equal(cards[0].style.display, '');
    assert.equal(cards[1].style.display, 'none');
});

test('DOM action data preserves numeric and string identifiers', () => {
    const { ctx } = setup();
    assert.equal(vm.runInContext('readDataValue({ dataset: { recordId: "42" } }, "recordId")', ctx), 42);
    assert.equal(vm.runInContext('readDataValue({ dataset: { recordId: "\\"task-1\\"" } }, "recordId")', ctx), 'task-1');
    assert.equal(vm.runInContext('escapeDataValue(42)', ctx), '42');
});

test('delegated menu action reads the page from data attributes', () => {
    const { ctx, ui } = setup();
    const listeners = new Map();
    ctx.document.addEventListener = (type, handler) => listeners.set(type, handler);
    let page = null;
    ui.switchPage = value => { page = value; };
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/actions.js'), 'utf8'), ctx);
    vm.runInContext('initAppActions()', ctx);

    const button = {
        tagName: 'BUTTON',
        dataset: { clickAction: 'navigate-page', page: 'tasks' },
        closest() { return this; }
    };
    listeners.get('click')({ target: button, preventDefault() {}, stopPropagation() {} });
    assert.equal(page, 'tasks');
});

test('every click action in markup and templates has a dispatcher', () => {
    const jsDirectory = path.join(__dirname, '../js');
    const sourceFiles = [
        path.join(__dirname, '../index.html'),
        ...fs.readdirSync(jsDirectory)
            .filter(file => file.endsWith('.js'))
            .map(file => path.join(jsDirectory, file))
    ];
    const actionSource = fs.readFileSync(path.join(jsDirectory, 'actions.js'), 'utf8');
    const handledActions = new Set([...actionSource.matchAll(/case '([^']+)'/g)].map(match => match[1]));
    const usedActions = new Set();

    for (const file of sourceFiles) {
        const source = fs.readFileSync(file, 'utf8');
        for (const match of source.matchAll(/data-click-action=["']([^"']+)["']/g)) {
            usedActions.add(match[1]);
        }
    }
    for (const action of usedActions) assert.ok(handledActions.has(action), `Missing click handler: ${action}`);
});

test('HTML and generated templates have no inline event attributes', () => {
    const sourceFiles = [
        path.join(__dirname, '../index.html'),
        ...fs.readdirSync(path.join(__dirname, '../js'))
            .filter(file => file.endsWith('.js'))
            .map(file => path.join(__dirname, '../js', file))
    ];
    const inlineEventAttribute = /(?:^|\s)on(?:click|dblclick|input|change|submit|reset|keydown|keyup|keypress|pointerdown|pointerup|pointermove|touchstart|touchend|touchmove|dragstart|dragend|dragover|dragleave|drop|focus|blur|load|error|mouseover|mouseout|mouseenter|mouseleave|contextmenu|wheel)\s*=/i;
    for (const file of sourceFiles) {
        assert.doesNotMatch(fs.readFileSync(file, 'utf8'), inlineEventAttribute, path.basename(file));
    }
});

test('session changes clear another tab while same-session profile edits retain its data', () => {
    const { ctx, storage, element, listeners } = setupAuth();
    vm.runInContext("currentProjects = [{ id: 'private' }]", ctx);
    for (const id of ['task-detail-body', 'task-detail-footer', 'dep-candidate-list', 'calendar-day-modal-content', 'calendar-week-view-wrap', 'calendar-day-view-wrap', 'toast-container']) {
        element(id).innerHTML = 'private';
    }
    element('profile-avatar-preview').src = 'data:image/png;base64,PRIVATE';
    setSession(storage, 'a', 'a-session', { nickname: 'Updated' });
    listeners.get('window:storage')({ key: 'flowforge_session' });
    assert.equal(vm.runInContext('currentProjects.length', ctx), 1);

    setSession(storage, 'b', 'b-session');
    listeners.get('window:storage')({ key: 'flowforge_session' });
    assert.equal(vm.runInContext('currentProjects.length', ctx), 0);
    assert.equal(element('auth-overlay').classList.contains('show'), true);
    assert.equal(element('header-avatar-img').src, '');
    assert.equal(element('profile-avatar-preview').src, '');
    assert.equal(element('dropdown-user-id').textContent, '');
    for (const id of ['task-detail-body', 'task-detail-footer', 'dep-candidate-list', 'calendar-day-modal-content', 'calendar-week-view-wrap', 'calendar-day-view-wrap', 'toast-container']) {
        assert.equal(element(id).innerHTML, '', id);
    }
    assert.equal(JSON.parse(storage.getItem('flowforge_session')).user_id, 'b');
});

test('a stale tab logout cannot remove the newer account session', () => {
    const { storage, element } = setupAuth();
    storage.setItem('flowforge_checklists_a', '[{"id":"private"}]');
    setSession(storage, 'b', 'b-session');
    element('btn-logout').onclick();
    assert.equal(JSON.parse(storage.getItem('flowforge_session')).user_id, 'b');
    assert.equal(storage.getItem('flowforge_checklists_a'), null);
    assert.equal(element('auth-overlay').classList.contains('show'), true);
});

test('a stale tab click is stopped before its old controls run', () => {
    const { storage, element, listeners } = setupAuth();
    setSession(storage, 'b', 'b-session');
    let prevented = false;
    let stopped = false;
    listeners.get('document:click')({
        preventDefault() { prevented = true; },
        stopImmediatePropagation() { stopped = true; }
    });
    assert.equal(prevented, true);
    assert.equal(stopped, true);
    assert.equal(element('auth-overlay').classList.contains('show'), true);
    assert.equal(JSON.parse(storage.getItem('flowforge_session')).user_id, 'b');
});

test('a stale tab action cannot bind old checklist data to the new account', async () => {
    const { ctx, api, storage } = setupWrites();
    setSession(storage, 'a', 'a-session');
    api.bindViewSession(api.captureSession());
    vm.runInContext("currentChecklists = [{ id: 'a-item', task_id: 't', text: 'A' }]", ctx);
    const input = { value: 'A private item', disabled: false, focus() {} };
    ctx.document.getElementById = id => id === 'checklist-new-input-t' ? input : null;
    let called = false;
    api.addChecklistItem = async () => { called = true; return { success: true }; };
    setSession(storage, 'b', 'b-session');
    await vm.runInContext("addChecklistItem('t')", ctx);
    assert.equal(called, false);
    assert.equal(storage.getItem('flowforge_checklists_b'), null);
});

test('a delayed avatar file read cannot repopulate a logged-out preview', () => {
    const { ctx, storage, element, listeners } = setupAuth();
    let reader;
    ctx.FileReader = class {
        readAsDataURL() { reader = this; }
    };
    const input = { files: [{ size: 10, type: 'image/png' }], value: '' };
    listeners.get('element:profile-avatar-file:change')({ target: input });
    setSession(storage, 'b', 'b-session');
    listeners.get('window:storage')({ key: 'flowforge_session' });
    reader.result = 'data:image/png;base64,PRIVATE';
    reader.onload();
    assert.equal(element('profile-avatar-preview').src, '');
});

test('account deletion confirmation remains bound to the account that submitted it', async () => {
    const { api, storage, element, ui } = setupAuth();
    let confirm;
    ui.confirm = (_title, _message, callback) => { confirm = callback; };
    let called = false;
    api.deleteAccount = async () => { called = true; return { success: true }; };
    await element('form-delete-account').onsubmit({ preventDefault() {} });
    setSession(storage, 'b', 'b-session');
    await confirm();
    assert.equal(called, false);
    assert.equal(JSON.parse(storage.getItem('flowforge_session')).user_id, 'b');
});

for (const [replacementUser, generation] of [['b', 'b-session'], ['a', 'new-a-session']]) {
    test(`late avatar removal cannot replace ${replacementUser}'s newer session`, async () => {
        const { api, storage, element, ui } = setupAuth();
        let confirm;
        ui.confirm = (_title, _message, callback) => { confirm = callback; };
        const request = deferred();
        api.removeAvatar = () => request.promise;
        await element('btn-remove-avatar').onclick();
        const pending = confirm();
        setSession(storage, replacementUser, generation);
        request.resolve({ success: true });
        await pending;
        assert.equal(JSON.parse(storage.getItem('flowforge_session')).__flowforgeSessionGeneration, generation);
    });
}

test('late account deletion clears the deleted user cache without logging out a newer user', async () => {
    const { api, storage, element, ui } = setupAuth();
    storage.setItem('flowforge_checklists_a', JSON.stringify([{ id: 'private' }]));
    storage.setItem('flowforge_checklists_b', JSON.stringify([{ id: 'b-item' }]));
    let confirm;
    ui.confirm = (_title, _message, callback) => { confirm = callback; };
    const request = deferred();
    api.deleteAccount = () => request.promise;
    await element('form-delete-account').onsubmit({ preventDefault() {} });
    const pending = confirm();
    setSession(storage, 'b', 'b-session');
    request.resolve({ success: true });
    await pending;
    assert.equal(storage.getItem('flowforge_checklists_a'), null);
    assert.notEqual(storage.getItem('flowforge_checklists_b'), null);
    assert.equal(JSON.parse(storage.getItem('flowforge_session')).user_id, 'b');
});

test('checklist add keeps a new account array and cache separate from an old response', async () => {
    const { ctx, api, storage } = setupWrites();
    setSession(storage, 'a', 'a-session');
    api.bindViewSession(api.captureSession());
    const input = { value: 'old private item', disabled: false, focus() {} };
    const button = { disabled: false };
    ctx.document.getElementById = id => id === 'checklist-new-input-t' ? input : id === 'btn-add-checklist-t' ? button : null;
    vm.runInContext('currentChecklists = []', ctx);
    const request = deferred();
    api.addChecklistItem = () => request.promise;
    const pending = vm.runInContext("addChecklistItem('t')", ctx);
    setSession(storage, 'b', 'b-session');
    vm.runInContext("currentChecklists = [{ id: 'b-item', task_id: 't', text: 'B' }]", ctx);
    request.resolve({ success: true, checklist: { id: 'a-item', task_id: 't', text: 'A' } });
    await pending;
    assert.equal(vm.runInContext('currentChecklists.length', ctx), 1);
    assert.equal(vm.runInContext('currentChecklists[0].id', ctx), 'b-item');
    assert.equal(storage.getItem('flowforge_checklists_a'), null);
});

test('checklist add still updates its own active session', async () => {
    const { ctx, api, storage } = setupWrites();
    setSession(storage, 'a', 'a-session');
    api.bindViewSession(api.captureSession());
    const input = { value: 'new item', disabled: false, focus() {} };
    const button = { disabled: false };
    ctx.document.getElementById = id => id === 'checklist-new-input-t' ? input : id === 'btn-add-checklist-t' ? button : null;
    vm.runInContext('currentChecklists = []', ctx);
    api.addChecklistItem = async () => ({ success: true, checklist: { id: 'a-item', task_id: 't', text: 'new item' } });
    await vm.runInContext("addChecklistItem('t')", ctx);
    assert.equal(vm.runInContext('currentChecklists[0].id', ctx), 'a-item');
    assert.equal(JSON.parse(storage.getItem('flowforge_checklists_a'))[0].id, 'a-item');
});

test('late dependency failure cannot restore an old account array into a new account', async () => {
    const { ctx, api, storage, ui } = setupWrites();
    setSession(storage, 'a', 'a-session');
    api.bindViewSession(api.captureSession());
    ctx.document.getElementById = () => ({ classList: { contains: () => false } });
    vm.runInContext("currentDependencies = [{ id: 'a-dependency', task_id: 't' }]", ctx);
    let confirm;
    ui.confirm = (_title, _message, callback) => { confirm = callback; };
    const request = deferred();
    api.deleteDependency = () => request.promise;
    vm.runInContext("deleteDependency('a-dependency', 't')", ctx);
    const pending = confirm();
    setSession(storage, 'b', 'b-session');
    vm.runInContext("currentDependencies = [{ id: 'b-dependency', task_id: 't' }]", ctx);
    request.resolve({ success: false, message: 'failed' });
    await pending;
    assert.equal(vm.runInContext('currentDependencies[0].id', ctx), 'b-dependency');
});

test('late task deletion cannot rewrite a newer account cache', async () => {
    const { ctx, api, storage, ui } = setupWrites();
    ui.setGlobalLoading = () => {};
    setSession(storage, 'a', 'a-session');
    api.bindViewSession(api.captureSession());
    vm.runInContext("currentChecklists = [{ id: 'a-item', task_id: 't' }]", ctx);
    let confirm;
    ui.confirm = (_title, _message, callback) => { confirm = callback; };
    const request = deferred();
    api.deleteTask = () => request.promise;
    vm.runInContext("deleteTask('t')", ctx);
    const pending = confirm();
    setSession(storage, 'b', 'b-session');
    vm.runInContext("currentChecklists = [{ id: 'b-item', task_id: 't' }]", ctx);
    request.resolve({ success: true });
    await pending;
    assert.equal(vm.runInContext('currentChecklists[0].id', ctx), 'b-item');
    assert.equal(storage.getItem('flowforge_checklists_b'), null);
});
