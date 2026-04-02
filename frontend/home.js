// ==================== THREE.JS SCENE SETUP ====================
let scene, camera, renderer;
let particles, boxes;
let animationFrameId;

function initThreeJS() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    scene.fog = new THREE.Fog(0xffffff, 1000, 10);

    const width = window.innerWidth;
    const height = window.innerHeight;
    camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 50;

    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('canvas'), antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0x3366ff, 0.8);
    directionalLight.position.set(50, 50, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    createParticles();
    createBoxes();

    window.addEventListener('resize', onWindowResize);
    animate();
}

function createParticles() {
    const geometry = new THREE.BufferGeometry();
    const particleCount = 500;
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
        positions[i] = (Math.random() - 0.5) * 200;
        positions[i + 1] = (Math.random() - 0.5) * 200;
        positions[i + 2] = (Math.random() - 0.5) * 200;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
        color: 0x3366ff,
        size: 0.3,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.6
    });

    particles = new THREE.Points(geometry, material);
    scene.add(particles);
}

function createBoxes() {
    boxes = new THREE.Group();
    const boxCount = 8;
    const colors = [0x3366ff, 0xff6b35, 0x00d084, 0xffa502];

    for (let i = 0; i < boxCount; i++) {
        const geometry = new THREE.BoxGeometry(3, 3, 3);
        const material = new THREE.MeshStandardMaterial({
            color: colors[i % colors.length],
            metalness: 0.4,
            roughness: 0.5,
            emissive: colors[i % colors.length],
            emissiveIntensity: 0.1
        });

        const box = new THREE.Mesh(geometry, material);
        box.castShadow = true;
        box.receiveShadow = true;

        const angle = (i / boxCount) * Math.PI * 2;
        const radius = 30;
        box.position.x = Math.cos(angle) * radius;
        box.position.y = Math.sin(angle) * radius;
        box.position.z = (Math.random() - 0.5) * 20;

        box.userData.angle = angle;
        box.userData.radius = radius;

        boxes.add(box);
    }

    scene.add(boxes);
}

function animate() {
    animationFrameId = requestAnimationFrame(animate);

    if (particles) {
        particles.rotation.x += 0.0002;
        particles.rotation.y += 0.0003;

        const positions = particles.geometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
            positions[i] += (Math.random() - 0.5) * 0.1;
            positions[i + 1] += (Math.random() - 0.5) * 0.1;
            positions[i + 2] += (Math.random() - 0.5) * 0.1;
        }
        particles.geometry.attributes.position.needsUpdate = true;
    }

    if (boxes) {
        boxes.children.forEach((box, index) => {
            box.rotation.x += 0.005;
            box.rotation.y += 0.008;

            const time = Date.now() * 0.0005;
            const angle = box.userData.angle + time;
            box.position.x = Math.cos(angle) * box.userData.radius;
            box.position.y = Math.sin(angle) * box.userData.radius;
            box.position.z = Math.sin(time + index) * 10;

            const scale = 1 + Math.sin(time * 2 + index) * 0.1;
            box.scale.set(scale, scale, scale);
        });
    }

    renderer.render(scene, camera);
}

function onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

// ==================== AUTH FLOW ====================
let selectedPlan = {
    name: 'Starter',
    amount: 1500
};

function startTrial() {
    selectedPlan = {
        name: 'Trial',
        amount: 0
    };
    showAuthChoiceModal();
}

function selectPlan(planName, amount) {
    selectedPlan = {
        name: planName,
        amount: amount
    };
    showAuthChoiceModal();
}

function showAuthChoiceModal() {
    document.getElementById('authPlanDisplay').textContent = `${selectedPlan.name} (KSH ${selectedPlan.amount.toLocaleString()})`;
    openModal('authChoiceModal');
}

function showLoginForm() {
    closeModal('authChoiceModal');
    setTimeout(() => openModal('loginModal'), 100);
}

function showRegisterForm() {
    closeModal('authChoiceModal');
    setTimeout(() => openModal('registerModal'), 100);
}

function closeAuthModal() {
    closeModal('authChoiceModal');
    closeModal('loginModal');
    closeModal('registerModal');
    document.body.classList.remove('modal-open');
}

function closePaymentModal() {
    closeModal('paymentModal');
    document.body.classList.remove('modal-open');
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.add('active');
    document.body.classList.add('modal-open');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove('active');
}

function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    input.type = input.type === 'password' ? 'text' : 'password';
}

async function handleLoginForm() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    if (!email || !password) {
        alert('Please fill in all fields');
        return;
    }

    try {
        const response = await fetch('https://pos-kbaq.onrender.com/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username: email, password })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Login failed');
        }

        closeAuthModal();
        // Redirect to POS
        window.location.href = '/pos.html';
    } catch (error) {
        console.error('Login error:', error);
        alert('Login failed: ' + error.message);
    }
}

async function handleRegisterForm() {
    const fullName = document.getElementById('regFullName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const phone = document.getElementById('regPhone').value.trim();
    const companyName = document.getElementById('regCompanyName').value.trim();
    const password = document.getElementById('regPassword').value;

    if (!fullName || !email || !phone || !password) {
        alert('Please fill in all required fields');
        return;
    }

    if (!email.includes('@')) {
        alert('Please enter a valid email');
        return;
    }

    if (password.length < 6) {
        alert('Password must be at least 6 characters');
        return;
    }

    try {
        // For Trial only - pay later is not available
        if (selectedPlan.name === 'Trial') {
            await createTrialAccount(fullName, email, phone, companyName);
        } else {
            // For paid plans
            await createPaidAccount(fullName, email, phone, companyName, password);
        }
    } catch (error) {
        console.error('Registration error:', error);
        alert('Registration failed: ' + error.message);
    }
}

async function createTrialAccount(fullName, email, phone, companyName) {
    try {
        const response = await fetch('https://pos-kbaq.onrender.com/api/trial/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fullName,
                email,
                phone,
                companyName: companyName || 'Trial Store',
                plan: 'Trial'
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Trial creation failed');
        }

        const data = await response.json();
        await autoLoginUser(email, data.credentials.password);
        closeAuthModal();
        setTimeout(() => window.location.href = '/pos.html', 500);
    } catch (error) {
        console.error('Trial creation error:', error);
        alert('Could not create trial account: ' + error.message);
    }
}

async function createPaidAccount(fullName, email, phone, companyName, password) {
    try {
        // Create account without payment first
        const response = await fetch('https://pos-kbaq.onrender.com/api/subscription/create-account', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fullName,
                email,
                phone,
                companyName,
                password,
                plan: selectedPlan.name,
                amount: selectedPlan.amount
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Account creation failed');
        }

        const data = await response.json();
        await autoLoginUser(email, password);
        closeAuthModal();
        // Redirect to payment
        setTimeout(() => window.location.href = '/pos.html?pendingPayment=' + selectedPlan.name, 500);
    } catch (error) {
        console.error('Account creation error:', error);
        alert('Could not create account: ' + error.message);
    }
}

async function autoLoginUser(email, password) {
    try {
        await fetch('https://pos-kbaq.onrender.com/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username: email, password })
        });
    } catch (error) {
        console.error('Auto-login error:', error);
    }
}

// ==================== PAGE INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    initThreeJS();

    const navbar = document.getElementById('navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
        } else {
            navbar.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
        }
    });

    // Close modal on outside click
    document.getElementById('authChoiceModal').addEventListener('click', (e) => {
        if (e.target.id === 'authChoiceModal') closeAuthModal();
    });

    document.getElementById('loginModal').addEventListener('click', (e) => {
        if (e.target.id === 'loginModal') closeAuthModal();
    });

    document.getElementById('registerModal').addEventListener('click', (e) => {
        if (e.target.id === 'registerModal') closeAuthModal();
    });

    document.getElementById('paymentModal').addEventListener('click', (e) => {
        if (e.target.id === 'paymentModal') closePaymentModal();
    });

    // Google OAuth initialization
    initGoogleOAuth();
});

window.addEventListener('beforeunload', () => {
    cancelAnimationFrame(animationFrameId);
    if (renderer) renderer.dispose();
});

// ==================== GOOGLE OAUTH ====================
let googleClientId = '';

function initGoogleOAuth() {
    // Fetch Google Client ID from server
    fetch('https://pos-kbaq.onrender.com/api/config/google-client-id')
        .then(res => res.json())
        .then(data => {
            googleClientId = data.clientId;
            initializeGoogleSignIn();
        })
        .catch(err => console.error('Failed to load Google Client ID:', err));
}

function initializeGoogleSignIn() {
    if (!googleClientId) return;
    
    google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleGoogleCallback
    });
    
    const googleLoginBtn = document.getElementById('googleLoginBtn');
    const googleRegisterBtn = document.getElementById('googleRegisterBtn');
    
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            google.accounts.id.prompt((notification) => {
                if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                    google.accounts.id.renderButton(
                        document.getElementById('googleLoginBtn'),
                        { theme: 'outline', size: 'large', width: '350' }
                    );
                }
            });
        });
    }
    
    if (googleRegisterBtn) {
        googleRegisterBtn.addEventListener('click', (e) => {
            e.preventDefault();
            google.accounts.id.prompt((notification) => {
                if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                    google.accounts.id.renderButton(
                        document.getElementById('googleRegisterBtn'),
                        { theme: 'outline', size: 'large', width: '350' }
                    );
                }
            });
        });
    }
}

function handleGoogleCallback(response) {
    // Determine if this is signup or login based on current context
    const isSignUp = document.getElementById('registerModal').classList.contains('active');
    handleGoogleSignIn(response, isSignUp);
}

async function handleGoogleSignIn(response, isSignUp) {
    try {
        if (!response.credential) {
            throw new Error('No credential in Google response');
        }

        const fullName = isSignUp ? document.getElementById('regFullName').value.trim() : '';
        const phone = isSignUp ? document.getElementById('regPhone').value.trim() : '';
        const companyName = isSignUp ? document.getElementById('regCompanyName').value.trim() : '';

        const data = {
            token: response.credential,
            isSignUp,
            fullName,
            phone,
            companyName,
            plan: selectedPlan.name,
            amount: selectedPlan.amount
        };

        const apiResponse = await fetch('https://pos-kbaq.onrender.com/api/auth/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data)
        });

        if (!apiResponse.ok) {
            const error = await apiResponse.json();
            throw new Error(error.error || 'Google authentication failed');
        }

        closeAuthModal();
        // Redirect to POS
        window.location.href = '/pos.html';
    } catch (error) {
        console.error('Google sign-in error:', error);
        alert('Google authentication failed: ' + error.message);
    }
}
