// ====================  DATABASE LAYER (API CLIENT)  ====================
class DatabaseManager {
    constructor() {
        this.baseUrl = '';
    }

    async request(path, options = {}) {
    const res = await fetch(this.baseUrl + path, {
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        credentials: 'include', // IMPORTANT: Include cookies for session
        ...options
    });
    
    // Handle rate limiting
    if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        const retryAfter = data.retryAfter || 900;
        alert(`Too many attempts. Please wait ${Math.ceil(retryAfter / 60)} minutes.`);
        throw new Error('Rate limited');
    }
    
    // Handle unauthorized (session expired)
    if (res.status === 401) {
        alert('Session expired. Please login again.');
        location.reload();
        throw new Error('Unauthorized');
    }
    
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`API ${path} failed: ${res.status} ${text}`);
    }
    
    // Some endpoints return no body
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) return res.json();
    return null;
}

    // Kept for compatibility with existing code that uses hash()
    hash(text) { return btoa(text); }

    async init() {
        // All seeding and schema creation is done on the server in server.js
        return;
    }

    // ---------- USERS ----------
    async getUsers() {
        return this.request('/api/users', { method: 'GET' });
    }

    // ---------- AUTH ----------
    async login(username, password) {
        return this.request('/api/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
    }

    // ---------- PRODUCTS ----------
    async getProducts() {
        return this.request('/api/products', { method: 'GET' });
    }
    async getProduct(id) {
        const products = await this.getProducts();
        return products.find(p => p.id === id);
    }
    async addProduct(product) {
        return this.request('/api/products', { method: 'POST', body: JSON.stringify(product) });
    }
    async updateProduct(id, updates) {
        return this.request(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(updates) });
    }
    async deleteProduct(id) {
        await this.request(`/api/products/${id}`, { method: 'DELETE' });
        return true;
    }

    // ---------- CUSTOMERS ----------
    async getCustomers() {
        return this.request('/api/customers', { method: 'GET' });
    }
    async addCustomer(customer) {
        return this.request('/api/customers', { method: 'POST', body: JSON.stringify(customer) });
    }
    async updateCustomer(id, updates) {
        return this.request(`/api/customers/${id}`, { method: 'PUT', body: JSON.stringify(updates) });
    }
    async deleteCustomer(id) {
        await this.request(`/api/customers/${id}`, { method: 'DELETE' });
        return true;
    }

    // ---------- SUPPLIERS ----------
    async getSuppliers() {
        return this.request('/api/suppliers', { method: 'GET' });
    }
    async addSupplier(supplier) {
        return this.request('/api/suppliers', { method: 'POST', body: JSON.stringify(supplier) });
    }
    async updateSupplier(id, updates) {
        return this.request(`/api/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(updates) });
    }
    async deleteSupplier(id) {
        await this.request(`/api/suppliers/${id}`, { method: 'DELETE' });
        return true;
    }

    // ---------- SALES ----------
    async getSales() {
        return this.request('/api/sales', { method: 'GET' });
    }
    async addSale(sale) {
        return this.request('/api/sales', { method: 'POST', body: JSON.stringify(sale) });
    }

    // ---------- INVOICES ----------
    async getInvoices() {
        return this.request('/api/invoices', { method: 'GET' });
    }
    async getInvoice(id) {
        return this.request(`/api/invoices/${id}`, { method: 'GET' });
    }
    async addInvoice(invoice) {
        return this.request('/api/invoices', { method: 'POST', body: JSON.stringify(invoice) });
    }
    async updateInvoice(id, updates) {
        return this.request(`/api/invoices/${id}`, { method: 'PUT', body: JSON.stringify(updates) });
    }
    async deleteInvoice(id) {
        await this.request(`/api/invoices/${id}`, { method: 'DELETE' });
        return true;
    }

    // ---------- SETTINGS ----------
    async getSettings() {
        return this.request('/api/settings', { method: 'GET' });
    }
    async saveSettings(settings) {
        return this.request('/api/settings', { method: 'PUT', body: JSON.stringify(settings) });
    }

    // ---------- LOGO ----------
    async getLogo() {
        return this.request('/api/logo', { method: 'GET' });
    }
    async saveLogo(data) {
        return this.request('/api/logo', { method: 'PUT', body: JSON.stringify({ data }) });
    }

    // ---------- DATA MANAGEMENT ----------
    async exportAll() {
        return this.request('/api/export', { method: 'GET' });
    }
    async importAll(data) {
        return this.request('/api/import', { method: 'POST', body: JSON.stringify(data) });
    }
    async clearAll() {
        return this.request('/api/clear-all', { method: 'POST' });
    }
}

// ====================  POS CLASS  ====================
class HardwarePOS {
    constructor() {
        this.db = new DatabaseManager();
        this.cart = []; this.currentUser = null; this.currentTab = 'dashboard';
        this.editingProductId = null; this.editingCustomerId = null; this.editingSupplierId = null;
        this.currency = '$'; this.taxRate = 0; this.companyName = 'Hardware Pro'; this.lowStockThreshold = 10;
        this.logoData = ''; // base-64 logo
        this.salesChart = null; // Chart.js instance
    }
    async init() {
            try {
                await this.db.init();
                await this.loadSettings();
                await this.loadLogo();
                
                // CHECK IF USER IS ALREADY LOGGED IN
                const sessionCheck = await this.checkSession();
                if (sessionCheck.loggedIn) {
                    this.currentUser = sessionCheck.user;
                    this.setupApp();
                    console.log('✅ Session restored for:', this.currentUser.name);
                    return;
                }
                
                // Check first run
                const firstRunResponse = await this.db.request('/api/first-run');
                if (firstRunResponse && firstRunResponse.firstRun) return this.showFirstRunScreen();
                
                // Show login
                this.showLoginScreen();
                this.initPosGoogleAuth();
                console.log('✅ Hardware POS System Initialized with API backend!');
            } catch (err) {
                console.error('❌ Init error:', err);
                // Show login screen even if there's an error
                this.showLoginScreen();
                this.initPosGoogleAuth();
                alert('Warning: ' + err.message + '. Please log in to continue.');
            }
        }

        showFirstRunScreen() {
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('firstRunOverlay').style.display = 'flex';
        document.getElementById('appContainer').style.display = 'none';
        }

        async handleFirstRun(e) {
        e.preventDefault();
        const companyName = document.getElementById('frCompany').value.trim();
        const currency = document.getElementById('frCurrency').value.trim();
        const taxRate = parseFloat(document.getElementById('frTax').value) || 0;
        const lowStockThreshold = parseInt(document.getElementById('frLowStock').value) || 10;
        const username = document.getElementById('frUsername').value.trim();
        const password = document.getElementById('frPassword').value;
        const name = document.getElementById('frName').value.trim();
        if (!companyName || !currency || !username || !password || !name) return alert('Please fill all fields');
        try {
            await this.db.request('/api/first-run', { method: 'POST', body: JSON.stringify({ companyName, currency, taxRate, lowStockThreshold, username, password, name }) });
            location.reload();
        } catch (e) {
            alert('Setup failed: ' + e.message);
        }
    }

    // ---------- AUTH ----------
    async checkSession() {
            try {
                const response = await fetch('/api/session', { credentials: 'include' });
                return await response.json();
            } catch {
                return { loggedIn: false };
            }
        }

    async login(username, password) {
            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include', // CRITICAL for cookies
                    body: JSON.stringify({ username, password })
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Login failed');
                }

                const user = await response.json();
                this.currentUser = user;
                this.hideLoginScreen(); 
                this.setupApp(); 
                return true;
            } catch (e) {
                alert('❌ ' + e.message); 
                return false;
            }
        }
    
    async logout() {
            try {
                await fetch('/api/logout', { method: 'POST', credentials: 'include' });
                this.currentUser = null;
                location.reload();
            } catch (e) {
                console.error('Logout failed', e);
                location.reload();
            }
        }

    setupApp() { this.hideLoginScreen(); this.renderAll(); }
    renderAll() { this.renderUserMenu(); this.updatePermissions(); this.loadAllData(); this.switchTab(this.currentTab); }
    async loadAllData() {
        await Promise.all([
            this.loadProducts(),
            this.loadInventory(),
            this.loadCustomers(),
            this.loadSuppliers(),
            this.loadSales(),
            this.loadInvoices(),
            this.updateDashboard()
        ]);
    }
    async updatePermissions() {
        if (!this.currentUser) return; const isAdmin = this.currentUser.role === 'admin';
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = isAdmin ? 'flex' : 'none');
        document.querySelectorAll('.cashier-hidden').forEach(el => el.style.display = isAdmin ? 'flex' : 'none');
        // cashier filter for sales history (admin sees all)
        const cashierFilter = document.getElementById('saleCashierFilter');
        if (isAdmin) {
            cashierFilter.style.display = 'inline-block';
            cashierFilter.innerHTML = '<option value="">All Cashiers</option>';
            const users = await this.db.getUsers();
            users.filter(u => u.role === 'cashier').forEach(c => {
                const opt = document.createElement('option'); opt.value = c.id; opt.textContent = c.name; cashierFilter.appendChild(opt);
            });
        } else {
            if (cashierFilter) cashierFilter.style.display = 'none';
        }
    }
    renderUserMenu() {
        if (!this.currentUser) return;
        document.getElementById('userName').textContent = this.currentUser.name;
        document.getElementById('userRole').textContent = this.currentUser.role.toUpperCase();
        document.getElementById('userAvatarText').textContent = this.currentUser.username.charAt(0).toUpperCase();
    }
    showLoginScreen() { 
        document.getElementById('loginOverlay').style.display = 'flex'; 
        document.getElementById('appContainer').style.display = 'none';
        document.body.classList.add('login-active');
    }
    showFirstRunWizard() { 
        document.getElementById('loginOverlay').style.display = 'none'; 
        document.getElementById('firstRunOverlay').style.display = 'flex'; 
    }
    hideFirstRun() { 
        document.getElementById('firstRunOverlay').style.display = 'none'; 
        document.getElementById('loginOverlay').style.display = 'flex'; 
    }
    hideLoginScreen() {
        const box = document.querySelector('.login-box'); box.classList.add('fade-out');
        setTimeout(() => {
            document.getElementById('loginOverlay').style.display = 'none';
            document.getElementById('appContainer').style.display = 'flex';
            document.getElementById('appContainer').style.flexDirection = 'row';
            document.body.classList.remove('login-active');
        }, 400);
    }
    handleLogin() { const u = document.getElementById('loginEmail').value.trim(), p = document.getElementById('loginPassword').value.trim(); this.login(u, p); }
    
    redirectToSignup() {
        // Redirect to home page for signup
        window.location.href = '/';
    }
    
    initPosGoogleAuth() {
        // Initialize Google OAuth for POS login
        fetch('/api/config/google-client-id')
            .then(res => res.json())
            .then(data => {
                const clientId = data.clientId;
                google.accounts.id.initialize({
                    client_id: clientId,
                    callback: (response) => this.handlePosGoogleSignIn(response)
                });
                
                const googleBtn = document.getElementById('googleLoginPosBtn');
                if (googleBtn) {
                    googleBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        // Trigger One Tap UI or prompt
                        google.accounts.id.prompt((notification) => {
                            if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                                // Fallback: render button
                                google.accounts.id.renderButton(
                                    document.getElementById('googleLoginPosBtn'),
                                    { theme: 'outline', size: 'large', width: '100%' }
                                );
                            }
                        });
                    });
                }
            })
            .catch(err => console.error('Failed to load Google Client ID:', err));
    }
    
    async handlePosGoogleSignIn(response) {
        try {
            if (!response || !response.credential) {
                throw new Error('No credential received from Google');
            }
            console.log('Google credential received:', response.credential.substring(0, 20) + '...');
            
            const result = await fetch('/api/auth/google', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    token: response.credential,
                    isSignUp: false
                })
            });
            
            if (!result.ok) {
                const error = await result.json();
                throw new Error(error.error || 'Google login failed');
            }
            
            const userData = await result.json();
            this.currentUser = userData.user;
            this.hideLoginScreen();
            this.setupApp();
        } catch (error) {
            console.error('Google sign-in error:', error);
            alert('Google login failed: ' + error.message);
        }
    }
    showPasswordChangeModal() {
        document.getElementById('oldPassword').value = ''; document.getElementById('newPassword').value = '';
        document.getElementById('passwordChangeModal').style.display = 'flex';
        document.body.classList.add('modal-active');
    }
    hidePasswordChangeModal() { 
        document.getElementById('passwordChangeModal').style.display = 'none';
        document.body.classList.remove('modal-active');
    }
    handleChangePassword() {
        const oldP = document.getElementById('oldPassword').value, newP = document.getElementById('newPassword').value;
        this.changePassword(oldP, newP); this.hidePasswordChangeModal();
    }

    async changePassword(oldPass, newPass) {
            if (!this.currentUser) { 
                alert('❌ Not logged in.'); 
                return; 
            }
            if (!newPass || newPass.length < 5) { 
                alert('❌ New password must be ≥ 5 chars.'); 
                return; 
            }

            try {
                await this.db.request(`/api/users/${this.currentUser.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        username: this.currentUser.username,
                        name: this.currentUser.name,
                        role: this.currentUser.role,
                        oldPassword: oldPass,
                        newPassword: newPass
                    })
                });
                alert('✅ Password changed! You are logged out.');
                await this.logout();
            } catch (err) {
                alert('❌ Failed to change password: ' + err.message);
            }
        }

    showUpgradeModal() {
        // Fetch current subscription and display plans
        this.loadPlanUpgradeModal();
    }

    hidePlanUpgradeModal() {
        document.getElementById('planUpgradeModal').style.display = 'none';
    }

    async loadPlanUpgradeModal() {
        try {
            const sub = await this.db.request('/api/subscription/status', { method: 'GET' });
            const modal = document.getElementById('planUpgradeModal');
            
            // Display current plan info
            const currentPlanInfo = document.getElementById('currentPlanInfo');
            if (currentPlanInfo) {
                currentPlanInfo.innerHTML = `
                    <div style="font-size: 14px; color: #666;">Current Plan:</div>
                    <div style="font-size: 1.5rem; font-weight: bold;">${sub.plan}</div>
                    <div style="font-size: 12px; color: #999; margin-top: 5px;">
                        ${sub.daysRemaining > 0 ? `${sub.daysRemaining} days remaining` : 'Plan expired'}
                        • Status: ${sub.paymentStatus === 'completed' ? '✅ Active' : '⏳ Pending Payment'}
                    </div>
                `;
            }
            
            // Display available plans
            const plans = [
                {
                    id: 'Trial',
                    name: 'Trial',
                    price: 0,
                    period: '30 days',
                    description: '30-day trial with basic features',
                    features: ['100 Products', '1 User', 'Basic Analytics'],
                    color: '#6366f1'
                },
                {
                    id: 'Starter',
                    name: 'Starter',
                    price: 1500,
                    period: 'per month',
                    description: 'Great for small stores',
                    features: ['Unlimited Products', '3 Users', 'Advanced Analytics', 'Multi-User Support'],
                    color: '#3366ff'
                },
                {
                    id: 'Professional',
                    name: 'Professional',
                    price: 3500,
                    period: 'per month',
                    description: 'Perfect for growing businesses',
                    features: ['Unlimited Products', '10 Users', 'Advanced Analytics', 'Supplier Management', 'Custom Branding', 'Priority Support'],
                    color: '#00d084'
                },
                {
                    id: 'Enterprise',
                    name: 'Enterprise',
                    price: 7500,
                    period: 'per month',
                    description: 'For large operations',
                    features: ['Unlimited Products', 'Unlimited Users', 'Advanced Analytics', 'Supplier Management', 'Custom Branding', 'Priority Support'],
                    color: '#ff6b35'
                }
            ];
            
            const plansGrid = document.getElementById('plansGrid');
            if (plansGrid) {
                plansGrid.innerHTML = plans.map(plan => {
                    const isCurrentPlan = plan.id === sub.plan;
                    return `
                        <div style="
                            border: 2px solid ${isCurrentPlan ? plan.color : '#ddd'};
                            border-radius: 8px;
                            padding: 20px;
                            background: ${isCurrentPlan ? plan.color + '10' : 'white'};
                            position: relative;
                        ">
                            ${isCurrentPlan ? '<div style="position: absolute; top: 10px; right: 10px; background: ' + plan.color + '; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">CURRENT</div>' : ''}
                            <div style="font-weight: bold; font-size: 1.3rem; margin-bottom: 5px; color: ${plan.color};">${plan.name}</div>
                            <div style="font-size: 2rem; font-weight: bold; margin-bottom: 5px;">
                                KSH ${plan.price.toLocaleString()}
                                <span style="font-size: 0.8rem; color: #666;">/${plan.period}</span>
                            </div>
                            <div style="color: #666; font-size: 0.9rem; margin-bottom: 15px;">${plan.description}</div>
                            <ul style="list-style: none; padding: 0; margin: 15px 0; font-size: 0.9rem;">
                                ${plan.features.map(f => `<li style="padding: 5px 0;"><i class="fas fa-check" style="color: ${plan.color}; margin-right: 8px;"></i>${f}</li>`).join('')}
                            </ul>
                            <button 
                                class="btn" 
                                style="width: 100%; background: ${plan.color}; color: white; margin-top: 15px; border: none; cursor: pointer; ${isCurrentPlan ? 'opacity: 0.5; cursor: not-allowed;' : ''}"
                                onclick="${isCurrentPlan ? '' : `pos.selectPlanForUpgrade("${plan.id}", ${plan.price})`}"
                                ${isCurrentPlan ? 'disabled' : ''}
                            >
                                ${isCurrentPlan ? '✓ Current Plan' : 'Select Plan'}
                            </button>
                        </div>
                    `;
                }).join('');
            }
            
            modal.style.display = 'flex';
        } catch (error) {
            console.error('Error loading plan upgrade modal:', error);
            alert('Failed to load upgrade options: ' + error.message);
        }
    }

    selectPlanForUpgrade(planId, amount) {
        // If selecting Trial, just show message
        if (planId === 'Trial') {
            alert('Trial plans can only be activated through the landing page. Please contact support to explore other trial options.');
            return;
        }
        
        // Store the selected plan and redirect to payment
        sessionStorage.setItem('upgradePlan', JSON.stringify({ planId, amount }));
        
        // Show payment/confirmation
        this.showPlanPaymentConfirmation(planId, amount);
    }

    showPlanPaymentConfirmation(planId, amount) {
        const confirmed = confirm(`
You are about to upgrade to ${planId} plan for KSH ${amount.toLocaleString()}/month.

Do you want to proceed?
        `);
        
        if (confirmed) {
            this.initiatePlanPayment(planId, amount);
        }
    }

    async initiatePlanPayment(planId, amount) {
        try {
            const sub = await this.db.request('/api/subscription/status', { method: 'GET' });
            
            // Initialize Paystack payment
            const response = await fetch('/api/payment/initialize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fullName: sub.email.split('@')[0],
                    email: sub.email,
                    phone: sub.email, // Placeholder
                    companyName: sub.companyName,
                    plan: planId,
                    amount: amount
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to initialize payment');
            }
            
            const paymentData = await response.json();
            
            // Redirect to Paystack
            if (paymentData.authorizationUrl) {
                window.location.href = paymentData.authorizationUrl;
            } else {
                alert('Failed to generate payment link. Please try again.');
            }
        } catch (error) {
            console.error('Payment error:', error);
            alert('Payment initialization failed: ' + error.message);
        }
    }

    showPaymentModal() {
        const message = `
💳 To make a payment:

1. Click "Upgrade Plan" to select a new plan
2. Complete payment through Paystack
3. Your subscription will be updated immediately

For technical support, contact info@hardwarepos.com
        `;
        alert(message);
    }

    togglePw(id) {
        const el = document.getElementById(id);
        const isPwd = el.type === 'password';
        el.type = isPwd ? 'text' : 'password';
        el.nextElementSibling.classList.toggle('fa-eye-slash', !isPwd);
        el.nextElementSibling.classList.toggle('fa-eye', isPwd);
    }

    async factoryReset() {
        if (!confirm('⚠️  This will delete the entire database and restart the server.\nContinue?')) return;
        if (!confirm('Are you absolutely sure? There is NO undo.')) return;
        try {
            await this.db.request('/api/factory-reset', { method: 'POST' });

            /*  purge every trace of the old client-side storage  */
            localStorage.clear();          // old cart, users, settings
            indexedDB.databases().then(dbs => {   // remove any IDB stores
            dbs.forEach(db => indexedDB.deleteDatabase(db.name));
            });

            alert('Reset complete – server is restarting…');
            setTimeout(() => location.replace('/'), 1000);
        } catch (e) {
            alert('Reset failed: ' + e.message);
        }
    }

    // ---------- USER MANAGEMENT ----------
    async loadUsers() {
    const users = await this.db.request('/api/users/full', { method: 'GET' });
    const tbl = document.getElementById('usersTable'); tbl.innerHTML = '';
    users.forEach(u => {
        const row = tbl.insertRow();
        row.insertCell().textContent = u.id;
        row.insertCell().textContent = u.username;
        row.insertCell().textContent = u.name;
        row.insertCell().textContent = u.role;
        const actions = row.insertCell();
        const ed = document.createElement('button'); ed.className = 'action-btn edit'; ed.textContent = 'Edit';
        ed.onclick = () => this.editUser(u);
        const del = document.createElement('button'); del.className = 'action-btn delete'; del.textContent = 'Delete';
        del.onclick = async () => { if (confirm(`Delete user “${u.username}”?`)) { await this.db.request(`/api/users/${u.id}`, { method: 'DELETE' }); this.loadUsers(); } };
        actions.appendChild(ed); actions.appendChild(del);
    });
    if (!users.length) tbl.innerHTML = '<tr><td colspan="5" class="loading">No users yet.</td></tr>';
    }
    showUserForm(u = null) {
    document.getElementById('userForm').style.display = 'block';
    document.getElementById('usersTable').parentElement.parentElement.style.display = 'none';
    if (u) {
        document.getElementById('userFormTitle').textContent = 'Edit User';
        document.getElementById('userId').value = u.id;
        document.getElementById('uUsername').value = u.username;
        document.getElementById('uName').value = u.name;
        document.getElementById('uRole').value = u.role;
        document.getElementById('uPassword').value = '';
    } else {
        document.getElementById('userFormTitle').textContent = 'Add User';
        document.getElementById('userFormElement').reset();
        document.getElementById('userId').value = '';
    }
    }
    cancelUserForm() {
    document.getElementById('userForm').style.display = 'none';
    document.getElementById('usersTable').parentElement.parentElement.style.display = 'block';
    }
    async saveUser(e) {
        e.preventDefault();
        const id = document.getElementById('userId').value;
        const payload = {
            username: document.getElementById('uUsername').value.trim(),
            name: document.getElementById('uName').value.trim(),
            role: document.getElementById('uRole').value,
            password: document.getElementById('uPassword').value // plain text
        };

        if (!payload.username || !payload.name) return alert('Username and Name are required');

        try {
            if (id) {
            await this.db.request(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
            alert('✅ User updated');
            } else {
            await this.db.request('/api/users', { method: 'POST', body: JSON.stringify(payload) });
            alert('✅ User added');
            }
            this.cancelUserForm(); this.loadUsers();
        } catch (e) {
            alert('Save failed: ' + e.message);
        }
    }

    togglePw(id) {
        const el = document.getElementById(id);
        const isPwd = el.type === 'password';
        el.type = isPwd ? 'text' : 'password';
        el.nextElementSibling.classList.toggle('fa-eye-slash', !isPwd);
        el.nextElementSibling.classList.toggle('fa-eye', isPwd);
        }
        async handleFirstRun(e) {
        e.preventDefault();
        const companyName = document.getElementById('frCompany').value.trim();
        const currency    = document.getElementById('frCurrency').value.trim();
        const taxRate     = parseFloat(document.getElementById('frTax').value) || 0;
        const lowStock    = parseInt(document.getElementById('frLowStock').value) || 10;
        const username    = document.getElementById('frUsername').value.trim();
        const password    = document.getElementById('frPassword').value;
        const confirmPw   = document.getElementById('frPasswordConfirm').value;
        const name        = document.getElementById('frName').value.trim();
        if (!companyName || !currency || !username || !password || !name) return alert('Please fill all fields');
        if (password !== confirmPw) return alert('Passwords do not match');
        try {
            await this.db.request('/api/first-run', { method: 'POST', body: JSON.stringify({ companyName, currency, taxRate, lowStockThreshold: lowStock, username, password, name }) });
            location.reload();
        } catch (e) {
            alert('Setup failed: ' + e.message);
        }
    }

    // ---------- SETTINGS – load live values ----------
    async loadSubscriptionInfo() {
        try {
            const sub = await this.db.request('/api/subscription/status', { method: 'GET' });
            
            if (sub.active) {
                // Format the subscription info
                const planElement = document.getElementById('subscriptionPlan');
                const daysElement = document.getElementById('subscriptionDays');
                const statusElement = document.getElementById('subscriptionStatus');
                const expiryElement = document.getElementById('subscriptionExpiry');
                
                if (planElement) planElement.textContent = sub.plan || 'Unknown';
                if (daysElement) daysElement.textContent = `${sub.daysRemaining} days`;
                if (statusElement) {
                    const statusBadge = sub.paymentStatus === 'completed' ? '✅ Active' : 
                                       sub.paymentStatus === 'pending' ? '⏳ Pending' : 
                                       sub.paymentStatus === 'failed' ? '❌ Failed' : 'Unknown';
                    statusElement.textContent = statusBadge;
                    statusElement.style.color = sub.paymentStatus === 'completed' ? '#00d084' : '#ffa502';
                }
                if (expiryElement && sub.expiryDate) {
                    const expiryDate = new Date(sub.expiryDate);
                    expiryElement.textContent = expiryDate.toLocaleDateString();
                }
            }
        } catch (err) {
            console.warn('Could not load subscription info:', err.message);
        }
    }

    async loadSettingsForm() {
    const s = await this.db.request('/api/settings/public', { method: 'GET' });
    document.getElementById('settingCompanyName').value   = s.companyName || 'Hardware Pro';
    document.getElementById('settingCurrency').value      = s.currency || 'KSH';
    document.getElementById('settingTaxRate').value       = s.taxRate  ?? 0;
    document.getElementById('settingLowStock').value      = s.lowStockThreshold ?? 5;
    
    // Load subscription info
    await this.loadSubscriptionInfo();
    }

    // ---------- SETTINGS ----------
    async loadSettings() {
        try {
            const s = await this.db.request('/api/settings/public', { method: 'GET' });
            this.currency = (s && s.currency) || '$';
            this.taxRate = (s && s.taxRate) || 0;
            this.companyName = (s && s.companyName) || 'Hardware Pro';
            this.lowStockThreshold = (s && s.lowStockThreshold) || 10;
        } catch (err) {
            console.warn('Could not load settings, using defaults:', err.message);
        }
        document.title = `${this.companyName} | POS`;
        document.getElementById('pageTitleTag').textContent = `${this.companyName} | POS`;
        document.querySelector('.logo-text').textContent = this.companyName;
        document.getElementById('loginTitle').textContent = `${this.companyName} – Login`;
        document.getElementById('taxRateDisplay').textContent = `${this.taxRate}%`;
        document.getElementById('invTaxRate').textContent = `${this.taxRate}%`;
    }
    formatCurrency(amount) { return `${this.currency}${parseFloat(amount).toFixed(2)}`; }

    // ---------- LOGO ----------
    async loadLogo() {
        try {
            const logo = await this.db.request('/api/logo/public', { method: 'GET' });
            this.logoData = (logo && logo.data) || '';
            if (this.logoData) {
                document.getElementById('logoPreview').src = this.logoData;
                document.getElementById('loginLogo').src = this.logoData;
                document.getElementById('loginLogo').style.display = 'block';
            }
        } catch (err) {
            console.warn('Could not load logo:', err.message);
        }
    }
    saveLogo() {
        const file = document.getElementById('logoFile').files[0];
        if (!file) return;
        if (file.size > 200 * 1024) { alert('Logo must ≤ 200 KB'); return; }
        const reader = new FileReader();
        reader.onload = async e => {
            this.logoData = e.target.result;
            await this.db.saveLogo(this.logoData);
            document.getElementById('logoPreview').src = this.logoData;
            alert('✅ Logo saved!');
        };
        reader.readAsDataURL(file);
    }

    // ---------- TABS ----------
    switchTab(tab) {
        this.currentTab = tab;
        document.querySelectorAll('.tab-content').forEach(t => t.style.display = (t.id === tab) ? 'block' : 'none');
        document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.tab === tab));
        document.getElementById('pageTitle').textContent = tab.charAt(0).toUpperCase() + tab.slice(1);
        if (tab === 'dashboard') this.updateDashboard();
        if (tab === 'pos') this.loadProducts();
        if (tab === 'sales') { this.loadSales(); this.renderSalesChart(); }
        if (tab === 'inventory') this.loadInventory();
        if (tab === 'customers') this.loadCustomers();
        if (tab === 'suppliers') this.loadSuppliers();
        if (tab === 'invoices') { this.loadInvoices(); this.loadCustomersForInvoice(); }
        if (tab === 'users') this.loadUsers();
        if (tab === 'settings') {this.loadSettingsForm(); }  // <-- add this}
    }

    recentSalesRange = 'day';   // cashier default

    setRecentRange(range) {
        this.recentSalesRange = range;
        // visual feedback – highlight active button
        ['btnRecentDay','btnRecentWeek','btnRecentMonth']
            .forEach(id => document.getElementById(id).classList.remove('active'));
        document.getElementById('btnRecent' + range.charAt(0).toUpperCase() + range.slice(1)).classList.add('active');
        this.updateDashboard();   // re-render table
        }

        /* helper: how far back in ms */
        _daysBack(n) {
        const d = new Date();
        d.setDate(d.getDate() - n);
        return d;
    }

    editUser(u) {
        this.showUserForm(u);
    }

    //UPDATE DASHBOARD - Populate Recent Sales Table ==========
    async updateDashboard() {
        const [products, sales] = await Promise.all([this.db.getProducts(), this.db.getSales()]);
        const today = new Date().toISOString().split('T')[0];
        const todaySales = sales.filter(s => s.date.startsWith(today));
        let todayTotal = 0, todayProfit = 0, todayCount = todaySales.length;
        todaySales.forEach(s => {
            todayTotal += s.total;
            s.items.forEach(i => todayProfit += (i.price - (i.cost || 0)) * i.quantity);
        });
        const lowStock = products.filter(p => p.stock <= this.lowStockThreshold).length;

        document.getElementById('revenueCardValue').textContent = this.formatCurrency(todayTotal);
        document.getElementById('profitCardValue').textContent = this.formatCurrency(todayProfit);
        document.getElementById('transactionsCardValue').textContent = todayCount;
        document.getElementById('lowStockCardValue').textContent = lowStock;

        // ✅ FIX: Actually populate the recent sales table
        const tbl = document.getElementById('recentSalesTable');
        tbl.innerHTML = '';
        
        let cutOff = new Date();
        if (this.recentSalesRange === 'day' || !this.currentUser || this.currentUser.role !== 'admin') {
            cutOff = this._daysBack(1);          // last 24 h
        } else if (this.recentSalesRange === 'week') {
            cutOff = this._daysBack(7);
        } else { // month
            cutOff = this._daysBack(30);
        }
        
        const recent = sales.filter(s => new Date(s.date) >= cutOff).slice(-5).reverse();
        
        // ✅ FIX: Check if there are sales and populate rows
        if (!recent.length) {
            tbl.innerHTML = '<tr><td colspan="6" class="loading">No recent sales.</td></tr>';
            return;
        }
        
        // ✅ FIX: Create rows for each sale
        recent.forEach(s => {
            const row = tbl.insertRow();
            row.insertCell().textContent = s.id;
            row.insertCell().textContent = new Date(s.date).toLocaleString();
            row.insertCell().textContent = `${s.items.length} item(s)`;
            row.insertCell().textContent = s.method;
            row.insertCell().textContent = this.formatCurrency(s.total);
            row.insertCell().textContent = s.cashierName || 'N/A';
        });
    }

    // ---------- SALES CHART (LINE) ----------
    async renderSalesChart() {
        const sales = await this.db.getSales();
        // last 7 days
        const labels = [], totals = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const dayStr = d.toISOString().split('T')[0];
            const dayTotal = sales.filter(s => s.date.startsWith(dayStr)).reduce((sum, s) => sum + s.total, 0);
            labels.push(d.toLocaleDateString('en', { weekday: 'short' }));
            totals.push(dayTotal);
        }
        const ctx = document.getElementById('salesLineChart').getContext('2d');
        if (this.salesChart) this.salesChart.destroy();
        this.salesChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Sales ' + this.currency,
                    data: totals,
                    borderColor: '#FF6B35',
                    backgroundColor: 'rgba(255, 107, 53, 0.1)',
                    tension: 0.3,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true } }
            }
        });
    }

    // ---------- PRODUCTS / POS ----------
    getStockStatus(stock) {
        if (stock > this.lowStockThreshold * 2) return { text: 'HIGH STOCK', class: 'stock-high' };
        if (stock > this.lowStockThreshold) return { text: 'MEDIUM STOCK', class: 'stock-medium' };
        return { text: 'LOW STOCK', class: 'stock-low' };
    }
    async loadProducts() {
        let products = await this.db.getProducts();
        const grid = document.getElementById('productsGrid'); grid.innerHTML = '';
        const search = document.getElementById('posSearch').value.toLowerCase();
        const cat = document.getElementById('posCategoryFilter').value;
        products = products.filter(p => {
            const sMatch = !search || p.name.toLowerCase().includes(search);
            const cMatch = !cat || p.category === cat; return sMatch && cMatch;
        });
        if (!products.length) { grid.innerHTML = '<div class="loading" style="grid-column:1/-1;">No products.</div>'; return; }
        products.forEach(p => {
            const st = this.getStockStatus(p.stock);
            const card = document.createElement('div'); card.className = 'product-card';
            card.innerHTML = `
                        ${p.image ? `<img class="product-img" src="${p.image}" alt="">` : ''}
                        <div class="product-name">${p.name}</div>
                        <div class="product-category">${p.category.toUpperCase().replace('-', ' ')}</div>
                        <div class="product-price">${this.formatCurrency(p.price)}</div>
                        <div class="product-stock">
                            <span class="stock-badge ${st.class}">${st.text} (${p.stock})</span>
                            <button class="add-to-cart" onclick="event.stopPropagation(); pos.addToCart(${p.id})"><i class="fas fa-plus"></i></button>
                        </div>`;
            grid.appendChild(card);
        });
    }
    previewProductImage(input) {
        const file = input.files[0];
        if (!file) return;
        if (file.size > 500 * 1024) { alert('Image must ≤ 500 KB'); input.value = ''; return; }
        const reader = new FileReader();
        reader.onload = e => {
            document.getElementById('pImagePreview').src = e.target.result;
            document.getElementById('pImagePreview').style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
    async addToCart(pid) {
        const p = await this.db.getProduct(pid); if (!p) return;
        const item = this.cart.find(i => i.id === pid);
        if (item) {
            if (item.quantity < p.stock) item.quantity++; else alert(`⚠️ Only ${p.stock} in stock.`);
        } else {
            if (p.stock > 0) this.cart.push({ id: p.id, name: p.name, price: p.price, cost: p.cost || 0, quantity: 1 });
            else alert('❌ Out of stock!');
        }
        this.renderCart();
    }
    removeFromCart(pid) { this.cart = this.cart.filter(i => i.id !== pid); this.renderCart(); }
    async updateCartQuantity(pid, change) {
        const p = await this.db.getProduct(pid), item = this.cart.find(i => i.id === pid); if (!item) return;
        item.quantity += change;
        if (item.quantity > p.stock) { item.quantity = p.stock; alert(`⚠️ Only ${p.stock} in stock.`); }
        if (item.quantity < 1) this.removeFromCart(pid); else this.renderCart();
    }
    clearCart() { if (this.cart.length && confirm('Clear cart?')) { this.cart = []; this.renderCart(); } }
    calculateCart() {
        let sub = 0; this.cart.forEach(i => sub += i.price * i.quantity);
        const tax = sub * (this.taxRate / 100), total = sub + tax; return { subtotal: sub, tax, total };
    }
    renderCart() {
        const container = document.getElementById('cartItems'); container.innerHTML = '';
        if (!this.cart.length) {
            container.innerHTML = '<div class="loading" style="text-align:center;">Cart is empty.</div>';
            document.getElementById('cartSubtotal').textContent = this.formatCurrency(0);
            document.getElementById('cartTax').textContent = this.formatCurrency(0);
            document.getElementById('cartTotal').textContent = this.formatCurrency(0); return;
        }
        this.cart.forEach(i => {
            const total = i.price * i.quantity;
            const div = document.createElement('div'); div.className = 'cart-item';
            div.innerHTML = `
                        <div class="cart-item-info">
                            <div class="cart-item-name">${i.name}</div><div class="cart-item-price">${this.formatCurrency(i.price)} x ${i.quantity}</div>
                        </div>
                            <div class="cart-item-controls">
                            <button class="quantity-btn" type="button" onclick="pos.updateCartQuantity(${i.id},-1)" aria-label="Decrease quantity"><i class="fas fa-minus" aria-hidden="true"></i></button>
                            <span class="quantity-display" aria-live="polite">${i.quantity}</span>
                            <button class="quantity-btn" type="button" onclick="pos.updateCartQuantity(${i.id},1)" aria-label="Increase quantity"><i class="fas fa-plus" aria-hidden="true"></i></button>
                            <div style="font-weight:700;min-width:60px;text-align:right;">${this.formatCurrency(total)}</div>
                            <button class="remove-item" type="button" onclick="pos.removeFromCart(${i.id})" aria-label="Remove item"><i class="fas fa-trash" aria-hidden="true"></i></button>
                        </div>`;
            container.appendChild(div);
        });
        const { subtotal, tax, total } = this.calculateCart();
        document.getElementById('cartSubtotal').textContent = this.formatCurrency(subtotal);
        document.getElementById('cartTax').textContent = this.formatCurrency(tax);
        document.getElementById('cartTotal').textContent = this.formatCurrency(total);
    }
    
    // ========== FIX 4: CHECKOUT - Refresh Dashboard After Sale ==========
    async checkout(method) {
        if (!this.cart.length) { 
            alert('❌ Cart is empty.'); 
            return; 
        }
        
        const allCustomers = await this.db.getCustomers();
        if (method === 'Invoice' && !allCustomers.length) { 
            alert('❌ Add a customer first.'); 
            return; 
        }
        
        const { total } = this.calculateCart();
        let msg = `Confirm Sale – Total: ${this.formatCurrency(total)} (${method})\n\nItems:\n`;
        this.cart.forEach(i => msg += `${i.name} x ${i.quantity}\n`);
        
        if (!confirm(msg)) return;

        try {
            const sale = {
                items: JSON.parse(JSON.stringify(this.cart)),
                subtotal: this.calculateCart().subtotal,
                tax: this.calculateCart().tax,
                total,
                method,
                cashierId: this.currentUser.id,
                cashierName: this.currentUser.name
            };
            
            const newSale = await this.db.addSale(sale);
            
            this.cart = []; 
            this.renderCart(); 
            await this.loadProducts(); 
            await this.updateDashboard(); // ✅ FIX: Now dashboard will show the new sale
            await this.renderSalesChart();
            
            alert(`✅ Sale #${newSale.id} completed! Total: ${this.formatCurrency(newSale.total)} (${method})`);
            
        } catch (error) {
            alert(`❌ Sale failed: ${error.message}\n\nPlease check stock levels and try again.`);
            console.error('Checkout error:', error);
            this.loadProducts();
        }
    }

    async shutdownServer() { 
        if (confirm('Are you sure you want to shut down the POS server?')) 
            { await this.db.request('/api/shutdown-server', { method: 'POST' }); 
        } 
    }

    // ---------- SALES HISTORY ----------
    async loadSales() {
        let sales = await this.db.getSales();
        const tbl = document.getElementById('salesTable'); tbl.innerHTML = '';
        const dateF = document.getElementById('saleDateFilter').value;
        const methodF = document.getElementById('saleMethodFilter').value;
        const search = document.getElementById('saleSearch').value.toLowerCase();
        const cashierF = document.getElementById('saleCashierFilter').value;

        // cashier filter logic
        const isAdmin = this.currentUser.role === 'admin';
        sales = sales.filter(s => {
            const dateMatch = !dateF || s.date.startsWith(dateF);
            const methodMatch = !methodF || s.method === methodF;
            const searchMatch = !search || s.id.toString().includes(search) || s.total.toFixed(2).toString().includes(search);
            let cashierMatch = true;
            if (!isAdmin) cashierMatch = s.cashierId === this.currentUser.id; // cashier sees own only
            if (isAdmin && cashierF) cashierMatch = s.cashierId == cashierF;
            return dateMatch && methodMatch && searchMatch && cashierMatch;
        });

        sales.forEach(s => {
            const row = tbl.insertRow();
            row.insertCell().textContent = s.id;
            row.insertCell().textContent = new Date(s.date).toLocaleDateString();
            row.insertCell().textContent = `${s.items.length} item(s)`;
            row.insertCell().textContent = s.method;
            row.insertCell().textContent = this.formatCurrency(s.total);
            row.insertCell().textContent = s.cashierName || 'N/A';
            const actions = row.insertCell();
            const btn = document.createElement('button'); btn.className = 'action-btn edit'; btn.textContent = 'View';
            btn.onclick = () => alert(`Sale #${s.id} – ${s.cashierName}\nItems: ${s.items.map(i => `${i.name} (${i.quantity})`).join(', ')}`);
            actions.appendChild(btn);
        });
        if (!sales.length) tbl.innerHTML = '<tr><td colspan="7" class="loading">No sales found.</td></tr>';
    }

    // ---------- SALES PDF ----------
    async generateSalesPDF() {
        const sales = await this.db.getSales();
        // last 7 days
        const labels = [], totals = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const dayStr = d.toISOString().split('T')[0];
            const dayTotal = sales.filter(s => s.date.startsWith(dayStr)).reduce((sum, s) => sum + s.total, 0);
            labels.push(d.toLocaleDateString('en', { weekday: 'short' }));
            totals.push(dayTotal);
        }
        const { jsPDF } = window.jspdf; const doc = new jsPDF('p', 'mm', 'a4');
        // header
        if (this.logoData) doc.addImage(this.logoData, 'PNG', 15, 10, 25, 25);
        doc.setFontSize(18); doc.text(this.companyName, 45, 20);
        doc.setFontSize(12); doc.text('Sales Report - Last 7 Days', 15, 40);
        // line chart
        const chartCanvas = document.createElement('canvas'); chartCanvas.width = 600; chartCanvas.height = 300;
        const ctx = chartCanvas.getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{ label: 'Sales ' + this.currency, data: totals, borderColor: '#FF6B35', backgroundColor: 'rgba(255, 107, 53, 0.1)', tension: 0.3, fill: true }]
            },
            options: { responsive: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
        });
        setTimeout(() => {
            const imgData = chartCanvas.toDataURL('image/png');
            doc.addImage(imgData, 'PNG', 15, 50, 180, 90);
            // table
            const body = sales.slice(-20).reverse().map(s => [
                s.id.toString(),
                new Date(s.date).toLocaleDateString(),
                s.method,
                this.formatCurrency(s.total),
                s.cashierName
            ]);
            doc.autoTable({
                startY: 150,
                head: [['Sale ID', 'Date', 'Method', 'Total', 'Cashier']],
                body,
                theme: 'striped'
            });
            doc.save(`SalesReport_${new Date().toISOString().split('T')[0]}.pdf`);
        }, 300);
    }

    // ---------- INVENTORY ----------
    async loadInventory() {
        let products = await this.db.getProducts();
        const tbl = document.getElementById('inventoryTable'); tbl.innerHTML = '';
        const search = document.getElementById('inventorySearch').value.toLowerCase();
        const catF = document.getElementById('inventoryCategoryFilter').value;
        const stockF = document.getElementById('inventoryStockFilter').value;

        products = products.filter(p => {
            const sMatch = !search || p.name.toLowerCase().includes(search) || p.sku.toLowerCase().includes(search);
            const cMatch = !catF || p.category === catF;
            let stockMatch = true;
            const st = this.getStockStatus(p.stock);
            if (stockF === 'low') stockMatch = st.class === 'stock-low';
            if (stockF === 'medium') stockMatch = st.class === 'stock-medium';
            if (stockF === 'high') stockMatch = st.class === 'stock-high';
            return sMatch && cMatch && stockMatch;
        });

        products.forEach(p => {
            const st = this.getStockStatus(p.stock);
            const row = tbl.insertRow();
            row.insertCell().textContent = p.id;
            row.insertCell().textContent = p.sku;
            row.insertCell().textContent = p.name;
            row.insertCell().textContent = p.category.toUpperCase().replace('-', ' ');
            row.insertCell().textContent = this.formatCurrency(p.price);
            row.insertCell().innerHTML = `<span class="status-badge ${st.class}">${p.stock} (${st.text})</span>`;
            const actions = row.insertCell();
            const editBtn = document.createElement('button'); editBtn.className = 'action-btn edit'; editBtn.textContent = 'Edit';
            editBtn.onclick = () => this.editProduct(p.id); actions.appendChild(editBtn);
            const delBtn = document.createElement('button'); delBtn.className = 'action-btn delete'; delBtn.textContent = 'Delete';
            delBtn.onclick = () => this.deleteProduct(p.id); actions.appendChild(delBtn);
        });
        if (!products.length) tbl.innerHTML = '<tr><td colspan="7" class="loading">No products.</td></tr>';
    }
    showProductForm(p = null) {
        document.getElementById('productForm').style.display = 'block';
        document.getElementById('inventoryTable').parentElement.parentElement.style.display = 'none';
        if (p) {
            document.getElementById('formTitle').textContent = 'Edit Product';
            document.getElementById('productId').value = p.id;
            document.getElementById('pName').value = p.name;
            document.getElementById('pPrice').value = p.price;
            document.getElementById('pCost').value = p.cost || 0;
            document.getElementById('pStock').value = p.stock;
            document.getElementById('pCategory').value = p.category;
            document.getElementById('pSKU').value = p.sku || '';
            if (p.image) { document.getElementById('pImagePreview').src = p.image; document.getElementById('pImagePreview').style.display = 'block'; }
            this.editingProductId = p.id;
        } else {
            document.getElementById('formTitle').textContent = 'Add New Product';
            document.getElementById('productFormElement').reset(); document.getElementById('productId').value = '';
            document.getElementById('pImagePreview').style.display = 'none';
            this.editingProductId = null;
        }
    }
    cancelProductForm() {
        document.getElementById('productForm').style.display = 'none';
        document.getElementById('inventoryTable').parentElement.parentElement.style.display = 'block';
    }
    async editProduct(id) { const p = await this.db.getProduct(id); if (p) this.showProductForm(p); }
    async saveProduct(e) {
        e.preventDefault();
        const id = document.getElementById('productId').value;
        const price = parseFloat(document.getElementById('pPrice').value);
        const stock = parseInt(document.getElementById('pStock').value);
        if (price < 0 || stock < 0) { alert('Price & stock must be ≥ 0.'); return; }
        const product = {
            name: document.getElementById('pName').value,
            price,
            cost: parseFloat(document.getElementById('pCost').value) || 0,
            stock,
            category: document.getElementById('pCategory').value,
            image: document.getElementById('pImagePreview').src || '',
            sku: document.getElementById('pSKU').value.trim() || `SKU${Date.now()}`
        };
        if (id) { await this.db.updateProduct(parseInt(id), { id: parseInt(id), ...product }); alert(`✅ Product updated.`); }
        else { await this.db.addProduct(product); alert(`✅ Product added.`); }
        this.cancelProductForm(); this.loadInventory(); this.loadProducts(); this.updateDashboard();
    }
    async deleteProduct(id) { if (confirm('Delete product?')) { await this.db.deleteProduct(id); this.loadInventory(); this.loadProducts(); this.updateDashboard(); alert('🗑️ Deleted.'); } }

    // ---------- CUSTOMERS ----------
    async loadCustomers() {
        const customers = await this.db.getCustomers();
        const tbl = document.getElementById('customersTable'); tbl.innerHTML = '';
        customers.forEach(c => {
            const row = tbl.insertRow();
            row.insertCell().textContent = c.id; row.insertCell().textContent = c.name;
            row.insertCell().textContent = c.email || '-'; row.insertCell().textContent = c.phone || '-';
            const actions = row.insertCell();
            const editBtn = document.createElement('button'); editBtn.className = 'action-btn edit'; editBtn.textContent = 'Edit';
            editBtn.onclick = () => this.editCustomer(c.id); actions.appendChild(editBtn);
            const delBtn = document.createElement('button'); delBtn.className = 'action-btn delete'; delBtn.textContent = 'Delete';
            delBtn.onclick = () => this.deleteCustomer(c.id); actions.appendChild(delBtn);
        });
        if (!customers.length) tbl.innerHTML = '<tr><td colspan="5" class="loading">No customers.</td></tr>';
    }
    showCustomerForm(c = null) {
        document.getElementById('customerForm').style.display = 'block';
        document.getElementById('customersTable').parentElement.parentElement.style.display = 'none';
        if (c) {
            document.getElementById('customerFormTitle').textContent = 'Edit Customer';
            document.getElementById('customerId').value = c.id;
            document.getElementById('cName').value = c.name;
            document.getElementById('cPhone').value = c.phone;
            document.getElementById('cEmail').value = c.email || '';
            document.getElementById('cType').value = c.type || 'retail';
            document.getElementById('cAddress').value = c.address || '';
        } else {
            document.getElementById('customerFormTitle').textContent = 'Add New Customer';
            document.getElementById('customerFormElement').reset(); document.getElementById('customerId').value = '';
            document.getElementById('cType').value = 'retail';
        }
    }
    cancelCustomerForm() {
        document.getElementById('customerForm').style.display = 'none';
        document.getElementById('customersTable').parentElement.parentElement.style.display = 'block';
    }
    async editCustomer(id) {
        const customers = await this.db.getCustomers();
        const c = customers.find(cust => cust.id === id); if (c) this.showCustomerForm(c);
    }
    async saveCustomer(e) {
        e.preventDefault();
        const id = document.getElementById('customerId').value;
        const customer = {
            name: document.getElementById('cName').value,
            phone: document.getElementById('cPhone').value,
            email: document.getElementById('cEmail').value,
            type: document.getElementById('cType').value,
            address: document.getElementById('cAddress').value
        };
        if (id) { await this.db.updateCustomer(parseInt(id), customer); alert(`✅ Customer updated.`); }
        else { await this.db.addCustomer(customer); alert(`✅ Customer added.`); }
        this.cancelCustomerForm(); this.loadCustomers(); this.loadCustomersForInvoice();
    }
    async deleteCustomer(id) { if (confirm('Delete customer?')) { await this.db.deleteCustomer(id); this.loadCustomers(); this.loadCustomersForInvoice(); alert('🗑️ Deleted.'); } }

    // ---------- SUPPLIERS ----------
    async loadSuppliers() {
        const suppliers = await this.db.getSuppliers();
        const tbl = document.getElementById('suppliersTable'); tbl.innerHTML = '';
        suppliers.forEach(s => {
            const row = tbl.insertRow();
            row.insertCell().textContent = s.id; row.insertCell().textContent = s.name;
            row.insertCell().textContent = s.contact || '-'; row.insertCell().textContent = s.phone || '-';
            const actions = row.insertCell();
            const editBtn = document.createElement('button'); editBtn.className = 'action-btn edit'; editBtn.textContent = 'Edit';
            editBtn.onclick = () => this.editSupplier(s.id); actions.appendChild(editBtn);
            const delBtn = document.createElement('button'); delBtn.className = 'action-btn delete'; delBtn.textContent = 'Delete';
            delBtn.onclick = () => this.deleteSupplier(s.id); actions.appendChild(delBtn);
        });
        if (!suppliers.length) tbl.innerHTML = '<tr><td colspan="5" class="loading">No suppliers.</td></tr>';
    }
    showSupplierForm(s = null) {
        document.getElementById('supplierForm').style.display = 'none';
        document.getElementById('suppliersTable').parentElement.parentElement.style.display = 'none';
        if (s) {
            document.getElementById('supplierFormTitle').textContent = 'Edit Supplier';
            document.getElementById('supplierId').value = s.id;
            document.getElementById('sName').value = s.name;
            document.getElementById('sContact').value = s.contact || '';
            document.getElementById('sPhone').value = s.phone;
            document.getElementById('sEmail').value = s.email || '';
        } else {
            document.getElementById('supplierFormTitle').textContent = 'Add New Supplier';
            document.getElementById('supplierFormElement').reset(); document.getElementById('supplierId').value = '';
        }
        document.getElementById('supplierForm').style.display = 'block';
    }
    cancelSupplierForm() {
        document.getElementById('supplierForm').style.display = 'none';
        document.getElementById('suppliersTable').parentElement.parentElement.style.display = 'block';
    }
    async editSupplier(id) {
        const suppliers = await this.db.getSuppliers();
        const s = suppliers.find(sup => sup.id === id); if (s) this.showSupplierForm(s);
    }
    async saveSupplier(e) {
        e.preventDefault();
        const id = document.getElementById('supplierId').value;
        const supplier = {
            name: document.getElementById('sName').value,
            contact: document.getElementById('sContact').value,
            phone: document.getElementById('sPhone').value,
            email: document.getElementById('sEmail').value
        };
        if (id) { await this.db.updateSupplier(parseInt(id), supplier); alert(`✅ Supplier updated.`); }
        else { await this.db.addSupplier(supplier); alert(`✅ Supplier added.`); }
        this.cancelSupplierForm(); this.loadSuppliers();
    }
    async deleteSupplier(id) { if (confirm('Delete supplier?')) { await this.db.deleteSupplier(id); this.loadSuppliers(); alert('🗑️ Deleted.'); } }

    //LOAD INVOICES - Fix Customer Name Display ==========
    async loadInvoices() {
        const invoices = await this.db.getInvoices();
        const customers = await this.db.getCustomers(); // ✅ Load customers to resolve names
        const tbl = document.getElementById('invoicesTable');
        tbl.innerHTML = '';
        
        if (!invoices.length) {
            tbl.innerHTML = '<tr><td colspan="7" class="loading">No invoices yet.</td></tr>';
            return;
        }
        
        invoices.forEach(i => {
            const row = tbl.insertRow();
            
            // ✅ FIX: Populate all cells in correct order
            row.insertCell().textContent = i.number;
            
            // ✅ FIX: Resolve customer name
            const customer = customers.find(c => c.id === i.customerId);
            row.insertCell().textContent = customer ? customer.name : 'Unknown Customer';
            
            row.insertCell().textContent = new Date(i.invoiceDate).toLocaleDateString();
            row.insertCell().textContent = new Date(i.dueDate).toLocaleDateString();
            row.insertCell().textContent = this.formatCurrency(i.total);
            row.insertCell().innerHTML = `<span class="status-badge ${i.status === 'PAID' ? 'badge-success' : 'badge-pending'}">${i.status}</span>`;
            
            const actions = row.insertCell();
            const pdfBtn = document.createElement('button');
            pdfBtn.className = 'action-btn view';
            pdfBtn.textContent = 'PDF';
            pdfBtn.onclick = () => this.generateInvoicePDF(i.id);
            actions.appendChild(pdfBtn);
            
            const delBtn = document.createElement('button');
            delBtn.className = 'action-btn delete';
            delBtn.textContent = 'Delete';
            delBtn.onclick = () => this.deleteInvoice(i.id);
            actions.appendChild(delBtn);
        });
    }

    async loadCustomersForInvoice() {
        const customers = await this.db.getCustomers(), sel = document.getElementById('invCustomer');
        sel.innerHTML = '<option value="">Select Customer</option>';
        customers.forEach(c => { const opt = document.createElement('option'); opt.value = c.id; opt.textContent = c.name; sel.appendChild(opt); });
    }
    showInvoiceForm(inv = null) {
        document.getElementById('invoiceForm').style.display = 'block';
        document.getElementById('invoicesTable').parentElement.parentElement.style.display = 'none';
        if (inv) {
            document.getElementById('invoiceFormTitle').textContent = 'Edit Invoice';
            document.getElementById('invoiceId').value = inv.id;
            document.getElementById('invNumber').value = inv.number;
            document.getElementById('invCustomer').value = inv.customerId;
            document.getElementById('invDueDate').value = inv.dueDate;
            document.getElementById('invPaymentTerms').value = inv.paymentTerms;
            document.getElementById('invNotes').value = inv.notes || '';
            document.getElementById('invStatus').value = inv.status || 'PENDING';
            // load items
            document.getElementById('invoiceItems').innerHTML = '';
            inv.items.forEach(it => this.addInvoiceItem(it));
            this.calculateInvoiceTotal();
        } else {
            document.getElementById('invoiceFormTitle').textContent = 'New Service Invoice';
            document.getElementById('invoiceFormElement').reset();
            document.getElementById('invoiceId').value = '';
            document.getElementById('invoiceItems').innerHTML = '';
            document.getElementById('invStatus').value = 'PENDING';
            // auto number
            const today = new Date(), yymmdd = today.toISOString().slice(2, 10).replace(/-/g, '');
            // number will be unique enough client-side; server just stores it
            document.getElementById('invNumber').value = `INV-${yymmdd}-${Date.now().toString().slice(-3)}`;
            this.addInvoiceItem(); // blank row
            const due = new Date(); due.setDate(due.getDate() + 30);
            document.getElementById('invDueDate').value = due.toISOString().split('T')[0];
        }
    }
    cancelInvoiceForm() {
        document.getElementById('invoiceForm').style.display = 'none';
        document.getElementById('invoicesTable').parentElement.parentElement.style.display = 'block';
    }
    addInvoiceItem(preFill = null) {
        const container = document.getElementById('invoiceItems');
        const row = document.createElement('div'); row.className = 'invoice-item-row';
        row.innerHTML = `
                    <div class="form-group" style="margin:0;"><input type="text" class="inv-item-desc" placeholder="Description" required value="${preFill ? preFill.description : ''}"></div>
                    <div class="form-group" style="margin:0;"><input type="number" class="inv-item-qty" min="1" value="${preFill ? preFill.quantity : 1}" oninput="pos.calculateInvoiceTotal()" required></div>
                    <div class="form-group" style="margin:0;"><input type="number" class="inv-item-price" step="0.01" min="0" value="${preFill ? preFill.price : ''}" oninput="pos.calculateInvoiceTotal()" required></div>
                    <div class="form-group" style="margin:0;"><input type="text" class="inv-item-total" readonly style="background:var(--light-bg);border:dashed;" value="${preFill ? this.formatCurrency(preFill.total) : ''}"></div>
                    <div><button type="button" class="btn action-btn delete" onclick="this.parentElement.parentElement.remove();pos.calculateInvoiceTotal();" style="padding:12px;"><i class="fas fa-trash"></i></button></div>`;
        container.appendChild(row);
    }
    calculateInvoiceTotal() {
        const rows = document.querySelectorAll('#invoiceItems .invoice-item-row'); let sub = 0;
        rows.forEach(row => {
            const qty = parseFloat(row.querySelector('.inv-item-qty').value) || 0;
            const price = parseFloat(row.querySelector('.inv-item-price').value) || 0;
            const total = qty * price; sub += total;
            row.querySelector('.inv-item-total').value = this.formatCurrency(total);
        });
        const tax = sub * (this.taxRate / 100), total = sub + tax;
        document.getElementById('invSubtotal').textContent = this.formatCurrency(sub);
        document.getElementById('invTax').textContent = this.formatCurrency(tax);
        document.getElementById('invTotal').textContent = this.formatCurrency(total);
    }

    // SAVE INVOICE - Proper Async Handling ==========
    async saveInvoice(e) {
        e.preventDefault();
        const rows = document.querySelectorAll('#invoiceItems .invoice-item-row');
        const items = [];
        rows.forEach(row => {
            const qty = parseFloat(row.querySelector('.inv-item-qty').value) || 0;
            const price = parseFloat(row.querySelector('.inv-item-price').value) || 0;
            if (qty > 0 && price >= 0) items.push({ 
                description: row.querySelector('.inv-item-desc').value, 
                quantity: qty, 
                price, 
                total: qty * price 
            });
        });
        
        if (!items.length) { 
            alert('❌ Add at least one item.'); 
            return; 
        }
        
        this.calculateInvoiceTotal();
        const id = document.getElementById('invoiceId').value;
        const invoice = {
            number: document.getElementById('invNumber').value,
            customerId: parseInt(document.getElementById('invCustomer').value),
            dueDate: document.getElementById('invDueDate').value,
            paymentTerms: document.getElementById('invPaymentTerms').value,
            notes: document.getElementById('invNotes').value.trim(),
            status: document.getElementById('invStatus').value,
            items,
            subtotal: parseFloat(document.getElementById('invSubtotal').textContent.replace(/[^\d.]/g, '')),
            tax: parseFloat(document.getElementById('invTax').textContent.replace(/[^\d.]/g, '')),
            total: parseFloat(document.getElementById('invTotal').textContent.replace(/[^\d.]/g, ''))
        };
        
        let newInv;
        try {
            if (id) { 
                await this.db.updateInvoice(parseInt(id), { id: parseInt(id), ...invoice }); 
                newInv = await this.db.getInvoice(parseInt(id)); 
                alert(`✅ Invoice updated.`); 
            } else { 
                newInv = await this.db.addInvoice(invoice); 
                alert(`✅ Invoice created.`); 
            }
            
            // ✅ FIX: Generate PDF and properly wait for reload
            await this.generateInvoicePDF(newInv.id);
            this.cancelInvoiceForm(); 
            await this.loadInvoices(); // ✅ Wait for table to reload
            
        } catch (error) {
            console.error('Save invoice error:', error);
            alert('❌ Failed to save invoice: ' + error.message);
        }
    }

    async deleteInvoice(id) { if (confirm('Delete invoice?')) { await this.db.deleteInvoice(id); this.loadInvoices(); alert('🗑️ Deleted.'); } }
    async generateInvoicePDF(id) {
        const inv = await this.db.getInvoice(id); if (!inv) return;
        const customers = await this.db.getCustomers();
        const cust = customers.find(c => c.id === inv.customerId) || { name: 'N/A', address: 'N/A', email: 'N/A' };
        const { jsPDF } = window.jspdf; const doc = new jsPDF('p', 'mm', 'a4');
        // header
        if (this.logoData) doc.addImage(this.logoData, 'PNG', 15, 10, 25, 25);
        doc.setFontSize(18); doc.text(this.companyName, 45, 20);
        doc.setFontSize(10); doc.text(`INVOICE ${inv.number}`, 15, 40);
        // details
        doc.setFontSize(12); doc.text('Bill To:', 15, 50); doc.text('Invoice Date:', 100, 50); doc.text('Due Date:', 150, 50); doc.text('Payment Terms:', 100, 60);
        doc.setFontSize(10); doc.text(cust.name, 15, 56); doc.text(inv.invoiceDate, 100, 56); doc.text(inv.dueDate, 150, 56); doc.text(inv.paymentTerms, 100, 66);
        // table
        const body = inv.items.map(i => [i.description, i.quantity.toString(), this.formatCurrency(i.price), this.formatCurrency(i.total)]);
        doc.autoTable({
            startY: 75,
            head: [['Description', 'Qty', 'Unit Price', 'Total']],
            body,
            theme: 'striped'
        });
        let y = doc.autoTable.previous.finalY + 10;
        // summary
        doc.setFontSize(12);
        doc.text('Subtotal:', 150, y, { align: 'right' }); doc.text(this.formatCurrency(inv.subtotal), 190, y, { align: 'right' }); y += 6;
        doc.text(`Tax (${this.taxRate}%):`, 150, y, { align: 'right' }); doc.text(this.formatCurrency(inv.tax), 190, y, { align: 'right' }); y += 8;
        doc.setFontSize(14); doc.setFont(undefined, 'bold'); doc.setTextColor(255, 107, 53);
        doc.text('TOTAL:', 150, y, { align: 'right' }); doc.text(this.formatCurrency(inv.total), 190, y, { align: 'right' });
        // status badge
        y += 12;
        doc.setFontSize(11); doc.setTextColor(0,0,0); doc.setFont(undefined,'normal');
        doc.text(`Status: ${inv.status}`, 15, y);
        // NOTES
        if (inv.notes) {
            y += 10;
            doc.setFontSize(10); doc.setFont(undefined,'italic');
            doc.text('Notes / Terms:', 15, y); y += 5;
            const lines = doc.splitTextToSize(inv.notes, 180);
            doc.text(lines, 15, y);
        }
        doc.save(`Invoice_${inv.number}_${cust.name}.pdf`);
    }

    // ---------- SETTINGS (SAVE/IMPORT/EXPORT/CLEAR) ----------
    async saveSettings() {
        const settings = {
            companyName: document.getElementById('settingCompanyName').value,
            currency: document.getElementById('settingCurrency').value,
            taxRate: parseFloat(document.getElementById('settingTaxRate').value),
            lowStockThreshold: parseInt(document.getElementById('settingLowStock').value)
        };
        await this.db.saveSettings(settings); await this.loadSettings(); this.updateDashboard(); alert('✅ Settings saved!');
    }
    async exportData() {
        const data = await this.db.exportAll(), json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' }), url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `hardware_pro_data_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); alert('✅ Exported!');
    }
    importData() { document.getElementById('importFile').click(); }
    async handleImport(e) {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = async ev => {
            try {
                const data = JSON.parse(ev.target.result);
                if (confirm('Replace all data?')) { await this.db.importAll(data); this.loadAllData(); alert('✅ Imported!'); }
            } catch { alert('❌ Invalid file.'); }
        };
        reader.readAsText(file);
    }
    async clearAllData() {
        if (confirm('⚠️ Delete ALL data permanently?')) {
            if (confirm('This cannot be undone. Continue?')) {
                await this.db.clearAll(); this.cart = []; location.reload();
            }
        }
    }
}

// ====================  INIT  ====================
const pos = new HardwarePOS();
pos.init();


