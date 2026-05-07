// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// API Base URL
const WORKER_URL = 'https://workers.contact-temp-otp.workers.dev';

// Cache variables
let cachedServices = null;
let servicesCacheTime = 0;
const CACHE_DURATION = 300000; // 5 phút

// Interval variables
let autoCheckInterval = null;
let expireCheckInterval = null;

// Danh sách dịch vụ mặc định (sẽ được cập nhật từ Firestore)
let popularServices = [
  { id: 19, name: "Telegram", price: 5000 },
  { id: 1234, name: "OpenAI | ChatGPT", price: 2200 },
  { id: 4, name: "Shopee / ShopeePay", price: 2100 },
  { id: 3, name: "Gmail/Google", price: 2000 },
  { id: 29, name: "Tiktok/Douyin", price: 1600 },
  { id: 7, name: "Facebook", price: 1600 },
  { id: 20, name: "Grab", price: 1600 },
  { id: 361, name: "Garena", price: 1600 },
  { id: 2, name: "Lazada", price: 1600 },
  { id: 30, name: "Tiki", price: 1600 },
  { id: 36, name: "Instagram", price: 2000 },
  { id: 49, name: "Twitter | X", price: 1600 }
];

// ============ API CALLS ============
async function apiFetch(path) {
  try {
    const response = await fetch(`${WORKER_URL}/api/${path}`, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache'
      }
    });
    return await response.json();
  } catch (error) {
    console.error('API fetch error:', error);
    return null;
  }
}

// ============ LOAD SERVICES FROM FIRESTORE ============
async function loadServicesFromFirestore() {
  const user = auth.currentUser;
  if (!user) return;
  
  try {
    const snapshot = await db.collection('services').get();
    if (!snapshot.empty) {
      const firestoreServices = [];
      snapshot.forEach(doc => {
        firestoreServices.push({
          id: parseInt(doc.id),
          name: doc.data().name || `Dịch vụ ${doc.id}`,
          price: doc.data().price || 1600
        });
      });
      if (firestoreServices.length > 0) {
        popularServices = firestoreServices;
      }
    }
    // Cache và render
    cachedServices = [...popularServices].sort((a, b) => a.price - b.price);
    servicesCacheTime = Date.now();
    renderServiceSelect(cachedServices);
  } catch (error) {
    console.error('Load services from Firestore error:', error);
    // Fallback to default services
    renderServiceSelect([...popularServices].sort((a, b) => a.price - b.price));
  }
}

function renderServiceSelect(services) {
  const serviceSelect = document.getElementById('serviceSelect');
  if (!serviceSelect) return;
  
  serviceSelect.innerHTML = '<option value="">-- Chọn dịch vụ --</option>';
  services.forEach(service => {
    const option = document.createElement('option');
    option.value = service.id;
    option.textContent = `${service.name} - ${formatNumber(service.price)}`;
    option.setAttribute('data-price', service.price);
    serviceSelect.appendChild(option);
  });
}

function getServicePrice(serviceId) {
  const service = popularServices.find(s => s.id == serviceId);
  return service ? service.price : 0;
}

// ============ HELPER FUNCTIONS ============
function showMessage(elementId, text, isSuccess = true) {
  const element = document.getElementById(elementId);
  if (!element) return;
  element.textContent = text;
  element.className = `alert ${isSuccess ? 'success' : 'error'}`;
  element.style.display = 'block';
  setTimeout(() => {
    if (element) element.style.display = 'none';
  }, 3000);
}

function formatDate(timestamp) {
  if (!timestamp) return '-';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleString('vi-VN');
}

function formatNumber(num) {
  return new Intl.NumberFormat('vi-VN').format(num) + ' VNĐ';
}

window.copyToClipboardText = function(text) {
  if (!text) return;
  navigator.clipboard.writeText(text);
  alert('Đã sao chép!');
};

window.switchTab = function(tabName) {
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  const activeNav = document.querySelector(`.nav-item[data-tab="${tabName}"]`);
  if (activeNav) activeNav.classList.add('active');
  
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  const activeTab = document.getElementById(`${tabName}-tab`);
  if (activeTab) activeTab.classList.add('active');
  
  if (tabName === 'history') loadFullHistory();
  if (tabName === 'rent') loadRentHistoryTable();
};

// ============ USER BALANCE ============
async function loadUserBalance() {
  const user = auth.currentUser;
  if (!user) return 0;
  
  try {
    const userDoc = await db.collection('users').doc(user.uid).get();
    const balance = userDoc.exists ? (userDoc.data().balance || 0) : 0;
    const balanceEl = document.getElementById('balanceText');
    if (balanceEl) balanceEl.textContent = formatNumber(balance);
    return balance;
  } catch (error) {
    console.error('Load balance error:', error);
    return 0;
  }
}

async function updateUserBalance(amountToSubtract) {
  const user = auth.currentUser;
  if (!user) return false;
  
  try {
    const userRef = db.collection('users').doc(user.uid);
    const userDoc = await userRef.get();
    const currentBalance = userDoc.exists ? (userDoc.data().balance || 0) : 0;
    
    if (currentBalance < amountToSubtract) return false;
    
    await userRef.update({ balance: currentBalance - amountToSubtract });
    await loadUserBalance();
    return true;
  } catch (error) {
    console.error('Update balance error:', error);
    return false;
  }
}

async function refundUserBalance(amount, userId) {
  try {
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    const currentBalance = userDoc.exists ? (userDoc.data().balance || 0) : 0;
    await userRef.update({ balance: currentBalance + amount });
    return true;
  } catch (error) {
    console.error('Refund error:', error);
    return false;
  }
}

// ============ LOAD HISTORY ============
async function loadRentHistoryTable() {
  const user = auth.currentUser;
  if (!user) return;
  
  try {
    const snapshot = await db.collection('rentHistory')
      .where('uid', '==', user.uid)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();
    
    const tbody = document.getElementById('rentHistoryTableBody');
    if (!tbody) return;
    
    if (snapshot.empty) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center">Chưa có lịch sử thuê số</td></tr>';
      return;
    }
    
    let index = 1;
    tbody.innerHTML = '';
    for (const doc of snapshot.docs) {
      const item = doc.data();
      const row = tbody.insertRow();
      row.insertCell(0).textContent = index++;
      row.insertCell(1).innerHTML = `<strong>${item.serviceName || item.serviceId}</strong>`;
      row.insertCell(2).innerHTML = `<span style="cursor:pointer;" onclick="copyToClipboardText('${item.phoneNumber || ''}')">${item.phoneNumber || '-'} <i class="fas fa-copy" style="font-size:12px;"></i></span>`;
      row.insertCell(3).innerHTML = item.otpCode 
        ? `<span style="background:#d1fae5; padding:4px 8px; border-radius:6px; font-weight:bold;">${item.otpCode}</span>`
        : '<span class="status-pending">⏳ Chờ OTP</span>';
      row.insertCell(4).textContent = formatDate(item.createdAt);
      row.insertCell(5).innerHTML = item.status === 'Thành công' 
        ? '<span style="color:#10b981;">✓ Thành công</span>'
        : (item.status === 'Đã hủy' ? '<span style="color:#ef4444;">✗ Đã hủy</span>' : '<span style="color:#f59e0b;">⏳ Đang xử lý</span>');
    }
  } catch (error) {
    console.error('Load rent history table error:', error);
  }
}

async function loadFullHistory() {
  const user = auth.currentUser;
  if (!user) return;
  
  try {
    const snapshot = await db.collection('rentHistory')
      .where('uid', '==', user.uid)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    
    const tbody = document.querySelector('#historyTable tbody');
    if (!tbody) return;
    
    let totalRented = snapshot.size;
    let totalSpent = 0;
    let successCount = 0;
    
    if (snapshot.empty) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center">Chưa có lịch sử thuê số</td></tr>';
    } else {
      tbody.innerHTML = '';
      snapshot.forEach(doc => {
        const item = doc.data();
        if (item.status === 'Thành công') {
          totalSpent += item.price || 0;
          successCount++;
        }
        
        const row = tbody.insertRow();
        row.insertCell(0).textContent = formatDate(item.createdAt);
        row.insertCell(1).innerHTML = `<strong>${item.serviceName || item.serviceId}</strong>`;
        row.insertCell(2).textContent = item.phoneNumber || '-';
        row.insertCell(3).innerHTML = item.status === 'Thành công' 
          ? '<span style="color:#10b981;">✓ Thành công</span>'
          : (item.status === 'Đã hủy' ? '<span style="color:#ef4444;">✗ Đã hủy</span>' : '<span style="color:#f59e0b;">⏳ Đang xử lý</span>');
        row.insertCell(4).textContent = item.otpCode || '-';
      });
    }
    
    const totalRentedEl = document.getElementById('totalRented');
    const totalSpentEl = document.getElementById('totalSpent');
    const successRateEl = document.getElementById('successRate');
    
    if (totalRentedEl) totalRentedEl.textContent = totalRented;
    if (totalSpentEl) totalSpentEl.textContent = formatNumber(totalSpent);
    if (successRateEl) {
      successRateEl.textContent = totalRented > 0 
        ? Math.round((successCount / totalRented) * 100) + '%' 
        : '0%';
    }
  } catch (error) {
    console.error('Load full history error:', error);
  }
}

// ============ AUTO CHECK OTP & EXPIRY ============
async function autoCheckOTP() {
  const user = auth.currentUser;
  if (!user) return;
  
  try {
    const snapshot = await db.collection('rentHistory')
      .where('uid', '==', user.uid)
      .where('status', '==', 'Đang xử lý')
      .get();
    
    if (snapshot.empty) return;
    
    for (const doc of snapshot.docs) {
      const item = doc.data();
      if (!item.requestId) continue;
      
      // Kiểm tra hết hạn (5 phút = 300000 ms)
      const createdAt = item.createdAt?.toDate?.() || new Date(item.createdAt);
      const now = new Date();
      const elapsed = now - createdAt;
      
      if (elapsed > 300000) {
        await doc.ref.update({ status: 'Đã hủy' });
        await refundUserBalance(item.price, user.uid);
        console.log(`🔄 Hoàn tiền ${item.price}đ cho request ${item.requestId}`);
        loadRentHistoryTable();
        loadFullHistory();
        continue;
      }
      
      // Kiểm tra OTP
      try {
        const response = await apiFetch(`session?requestId=${item.requestId}`);
        
        if (response?.status_code === 200 && response.data) {
          const data = response.data;
          
          if (data.Status === 1 && data.Code) {
            await doc.ref.update({
              status: 'Thành công',
              otpCode: data.Code,
              price: data.Price || item.price,
              smsContent: data.SmsContent || null
            });
            console.log(`✅ Lấy OTP thành công: ${data.Code}`);
            loadRentHistoryTable();
            loadFullHistory();
          }
        }
      } catch (err) {
        console.error(`Lỗi check OTP:`, err);
      }
    }
  } catch (error) {
    console.error('Auto check OTP error:', error);
  }
}

// ============ RENT NUMBER ============
async function rentNumber() {
  const user = auth.currentUser;
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  
  const serviceSelect = document.getElementById('serviceSelect');
  const serviceId = serviceSelect.value;
  
  if (!serviceId) {
    showMessage('rentMessage', 'Vui lòng chọn dịch vụ', false);
    return;
  }
  
  const selectedOption = serviceSelect.options[serviceSelect.selectedIndex];
  const servicePrice = parseInt(selectedOption.getAttribute('data-price')) || getServicePrice(serviceId);
  const serviceName = selectedOption.text.split(' -')[0];
  
  const currentBalance = await loadUserBalance();
  if (currentBalance < servicePrice) {
    showMessage('rentMessage', `Số dư không đủ! Cần ${formatNumber(servicePrice)}`, false);
    return;
  }
  
  try {
    const response = await apiFetch(`request?serviceId=${serviceId}&country=vn`);
    
    if (response?.status_code !== 200 || !response?.success) {
      showMessage('rentMessage', `Lỗi: ${response?.message || 'Không thể thuê số'}`, false);
      return;
    }
    
    const data = response.data;
    if (!data || !data.phone_number) {
      showMessage('rentMessage', 'Lỗi: Không nhận được số điện thoại', false);
      return;
    }
    
    const deducted = await updateUserBalance(servicePrice);
    if (!deducted) {
      showMessage('rentMessage', 'Lỗi: Không thể trừ tiền', false);
      return;
    }
    
    const resultBox = document.getElementById('rentResult');
    const resultContent = resultBox.querySelector('.result-content');
    resultContent.innerHTML = `
      <div><strong>Số điện thoại:</strong> ${data.phone_number}</div>
      <div><strong>Request ID:</strong> ${data.request_id}</div>
      <div><strong>Đã trừ:</strong> ${formatNumber(servicePrice)}</div>
      <div><strong>Số dư còn lại:</strong> ${formatNumber(currentBalance - servicePrice)}</div>
      <div class="expiry-note">⏰ Số có hiệu lực 5 phút. Nếu không có OTP sẽ tự động hoàn tiền.</div>
    `;
    resultBox.style.display = 'block';
    
    await db.collection('rentHistory').add({
      uid: user.uid,
      email: user.email,
      serviceId: parseInt(serviceId),
      serviceName: serviceName,
      phoneNumber: data.phone_number,
      requestId: data.request_id,
      status: 'Đang xử lý',
      price: servicePrice,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    showMessage('rentMessage', `Thuê số thành công! Đã trừ ${formatNumber(servicePrice)}`, true);
    
    document.getElementById('rentForm').reset();
    loadRentHistoryTable();
    loadFullHistory();
    
    setTimeout(() => {
      resultBox.style.display = 'none';
    }, 8000);
    
  } catch (error) {
    console.error('Rent number error:', error);
    showMessage('rentMessage', 'Có lỗi xảy ra, vui lòng thử lại', false);
  }
}

// ============ RECHARGE ============
async function createRecharge() {
  const user = auth.currentUser;
  if (!user) return;
  
  let amount = parseInt(document.getElementById('amount').value);
  if (isNaN(amount) || amount < 10000) {
    showMessage('rechargeMessage', 'Số tiền phải từ 10,000 VNĐ', false);
    return;
  }
  
  amount = Math.ceil(amount / 1000) * 1000;
  
  const userDoc = await db.collection('users').doc(user.uid).get();
  const userToken = userDoc.data()?.apiToken || user.uid.slice(0, 10);
  const transferCode = userToken;
  
  document.getElementById('transferContent').innerHTML = transferCode;
  document.getElementById('bankInfo').style.display = 'block';
  
  await db.collection('recharges').add({
    uid: user.uid,
    email: user.email,
    amount: amount,
    method: 'bank',
    status: 'Chờ xác nhận',
    transferCode: transferCode,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  
  showMessage('rechargeMessage', `Yêu cầu nạp ${formatNumber(amount)} đã tạo! Nội dung CK: ${transferCode}`, true);
}

// ============ LOAD PROFILE ============
async function loadProfile() {
  const user = auth.currentUser;
  if (!user) return;
  
  try {
    const userDoc = await db.collection('users').doc(user.uid).get();
    const userData = userDoc.exists ? userDoc.data() : {};
    
    let apiToken = userData.apiToken;
    if (!apiToken) {
      apiToken = 'USER_' + Date.now() + '_' + user.uid.slice(0, 8);
      await db.collection('users').doc(user.uid).update({ apiToken: apiToken });
    }
    
    document.getElementById('userName').textContent = userData.fullName || user.email.split('@')[0];
    document.getElementById('profileName').textContent = userData.fullName || '-';
    document.getElementById('profileEmail').textContent = user.email;
    document.getElementById('profileApiToken').textContent = apiToken;
    document.getElementById('joinDate').textContent = userData.createdAt ? formatDate(userData.createdAt) : '-';
    
  } catch (error) {
    console.error('Load profile error:', error);
  }
}

// ============ INIT DASHBOARD ============
async function initDashboard() {
  const user = auth.currentUser;
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  
  await loadProfile();
  await loadUserBalance();
  await loadServicesFromFirestore(); // Load từ Firestore thay vì cứng
  await loadRentHistoryTable();
  await loadFullHistory();
  
  if (autoCheckInterval) clearInterval(autoCheckInterval);
  if (expireCheckInterval) clearInterval(expireCheckInterval);
  
  autoCheckInterval = setInterval(autoCheckOTP, 3000);
  expireCheckInterval = setInterval(() => {
    loadRentHistoryTable();
    loadFullHistory();
  }, 60000);
}

// ============ AUTH FORMS ============
function initAuthForms() {
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      try {
        await auth.signInWithEmailAndPassword(email, password);
        window.location.href = 'dashboard.html';
      } catch (error) {
        showMessage('message', error.message, false);
      }
    });
  }
  
  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const fullName = document.getElementById('name').value.trim();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      
      if (password !== confirmPassword) {
        showMessage('message', 'Mật khẩu xác nhận không khớp', false);
        return;
      }
      
      try {
        const result = await auth.createUserWithEmailAndPassword(email, password);
        await result.user.updateProfile({ displayName: fullName });
        
        const apiToken = 'USER_' + Date.now() + '_' + result.user.uid.slice(0, 8);
        
        await db.collection('users').doc(result.user.uid).set({
          fullName: fullName,
          email: email,
          apiToken: apiToken,
          balance: 0,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showMessage('message', 'Đăng ký thành công!', true);
        setTimeout(() => window.location.href = 'login.html', 1500);
      } catch (error) {
        showMessage('message', error.message, false);
      }
    });
  }
}

// ============ EVENT LISTENERS ============
document.addEventListener('DOMContentLoaded', () => {
  initAuthForms();
  
  if (window.location.pathname.includes('dashboard.html')) {
    auth.onAuthStateChanged((user) => {
      if (user) {
        initDashboard();
      } else {
        window.location.href = 'login.html';
      }
    });
    
    const logoutBtn = document.getElementById('logoutButton');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        if (autoCheckInterval) clearInterval(autoCheckInterval);
        if (expireCheckInterval) clearInterval(expireCheckInterval);
        await auth.signOut();
        window.location.href = 'login.html';
      });
    }
    
    const rentForm = document.getElementById('rentForm');
    if (rentForm) {
      rentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await rentNumber();
      });
    }
    
    const rechargeForm = document.getElementById('rechargeForm');
    if (rechargeForm) {
      rechargeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await createRecharge();
      });
    }
    
    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const amountInput = document.getElementById('amount');
        if (amountInput) amountInput.value = btn.dataset.amount;
      });
    });
    
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = item.dataset.tab;
        if (tab && typeof window.switchTab === 'function') {
          window.switchTab(tab);
        }
      });
    });
  }
});