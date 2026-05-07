// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// API Base URL
const WORKER_URL = 'https://workers.contact-temp-otp.workers.dev';

let autoCheckInterval = null;

// Danh sách dịch vụ phổ biến (có thể chỉnh sửa giá)
let popularServices = [
  { id: 19, name: "Telegram", price: 5000, category: "Messaging" },
  { id: 1234, name: "OpenAI | ChatGPT", price: 2200, category: "AI Tool" },
  { id: 4, name: "Shopee / ShopeePay", price: 2100, category: "E-commerce" },
  { id: 3, name: "Gmail/Google", price: 2000, category: "Email" },
  { id: 29, name: "Tiktok/Douyin", price: 1600, category: "Social Media" },
  { id: 7, name: "Facebook", price: 1600, category: "Social Media" },
  { id: 20, name: "Grab", price: 1600, category: "Transport" },
  { id: 361, name: "Garena", price: 1600, category: "Gaming" },
  { id: 2, name: "Lazada", price: 1600, category: "E-commerce" },
  { id: 30, name: "Tiki", price: 1600, category: "E-commerce" },
  { id: 36, name: "Instagram", price: 2000, category: "Social Media" },
  { id: 49, name: "Twitter | X", price: 1600, category: "Social Media" }
];

// Hàm gọi API
async function apiFetch(path) {
  const response = await fetch(`${WORKER_URL}/api/${path}`);
  return response.json();
}

function showMessage(elementId, text, isSuccess = true) {
  const element = document.getElementById(elementId);
  if (!element) return;
  element.textContent = text;
  element.className = `alert ${isSuccess ? 'success' : 'error'}`;
  element.style.display = 'block';
  setTimeout(() => {
    if (element) element.style.display = 'none';
  }, 5000);
}

function formatDate(timestamp) {
  if (!timestamp) return '-';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleString('vi-VN');
}

function formatNumber(num) {
  return new Intl.NumberFormat('vi-VN').format(num) + ' VNĐ';
}

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

// Load Services - Chỉ hiển thị danh sách đã định nghĩa
async function loadServices() {
  const serviceSelect = document.getElementById('serviceSelect');
  if (!serviceSelect) return;
  
  try {
    // Sắp xếp theo giá tăng dần
    const sortedServices = [...popularServices].sort((a, b) => a.price - b.price);
    
    serviceSelect.innerHTML = '<option value="">-- Chọn dịch vụ --</option>';
    sortedServices.forEach(service => {
      const option = document.createElement('option');
      option.value = service.id;
      option.textContent = `${service.name} - ${formatNumber(service.price)}`;
      option.setAttribute('data-price', service.price);
      serviceSelect.appendChild(option);
    });
  } catch (error) {
    console.error('Load services error:', error);
    serviceSelect.innerHTML = '<option value="">Lỗi tải dịch vụ</option>';
  }
}

// Lấy giá dịch vụ
function getServicePrice(serviceId) {
  const service = popularServices.find(s => s.id == serviceId);
  return service ? service.price : 0;
}

// Load User Balance
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

// Update User Balance (trừ tiền)
async function updateUserBalance(amountToSubtract) {
  const user = auth.currentUser;
  if (!user) return false;
  
  try {
    const userRef = db.collection('users').doc(user.uid);
    const userDoc = await userRef.get();
    const currentBalance = userDoc.exists ? (userDoc.data().balance || 0) : 0;
    
    if (currentBalance < amountToSubtract) {
      return false; // Không đủ tiền
    }
    
    await userRef.update({
      balance: currentBalance - amountToSubtract
    });
    
    await loadUserBalance(); // Cập nhật hiển thị
    return true;
  } catch (error) {
    console.error('Update balance error:', error);
    return false;
  }
}

// Load Rent History Table
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
        : '<span style="color:#f59e0b;">⏳ Đang xử lý</span>';
    }
  } catch (error) {
    console.error('Load rent history table error:', error);
  }
}

// Load Full History
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
        totalSpent += item.price || 0;
        if (item.status === 'Thành công') successCount++;
        
        const row = tbody.insertRow();
        row.insertCell(0).textContent = formatDate(item.createdAt);
        row.insertCell(1).innerHTML = `<strong>${item.serviceName || item.serviceId}</strong>`;
        row.insertCell(2).textContent = item.phoneNumber || '-';
        row.insertCell(3).innerHTML = item.status === 'Thành công' 
          ? '<span style="color:#10b981;">✓ Thành công</span>'
          : '<span style="color:#f59e0b;">⏳ Đang xử lý</span>';
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

// Auto check OTP
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
      
      try {
        const response = await apiFetch(`session?requestId=${item.requestId}`);
        
        if (response.status_code === 200 && response.data) {
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
          } else if (data.Status === 2) {
            await doc.ref.update({ status: 'Hết hạn' });
            console.log(`⚠️ Request ${item.requestId} đã hết hạn`);
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

// Rent Number - CÓ TRỪ TIỀN
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
  
  // Kiểm tra số dư
  const currentBalance = await loadUserBalance();
  if (currentBalance < servicePrice) {
    showMessage('rentMessage', `Số dư không đủ! Cần ${formatNumber(servicePrice)}`, false);
    return;
  }
  
  try {
    const response = await apiFetch(`request?serviceId=${serviceId}&country=vn`);
    
    if (response.status_code !== 200 || !response.success) {
      showMessage('rentMessage', `Lỗi: ${response.message || 'Không thể thuê số'}`, false);
      return;
    }
    
    const data = response.data;
    if (!data || !data.phone_number) {
      showMessage('rentMessage', 'Lỗi: Không nhận được số điện thoại', false);
      return;
    }
    
    // TRỪ TIỀN
    const deducted = await updateUserBalance(servicePrice);
    if (!deducted) {
      showMessage('rentMessage', 'Lỗi: Không thể trừ tiền, vui lòng thử lại', false);
      return;
    }
    
    // Hiển thị kết quả
    const resultBox = document.getElementById('rentResult');
    const resultContent = resultBox.querySelector('.result-content');
    resultContent.innerHTML = `
      <div><strong>Số điện thoại:</strong> ${data.phone_number}</div>
      <div><strong>Request ID:</strong> ${data.request_id}</div>
      <div><strong>Đã trừ:</strong> ${formatNumber(servicePrice)}</div>
      <div><strong>Số dư còn lại:</strong> <span id="newBalanceDisplay">${formatNumber(currentBalance - servicePrice)}</span></div>
    `;
    resultBox.style.display = 'block';
    
    // Lưu vào Firestore
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
    
    // Reset form và refresh
    document.getElementById('rentForm').reset();
    loadRentHistoryTable();
    loadFullHistory();
    
    // Ẩn kết quả sau 10 giây
    setTimeout(() => {
      resultBox.style.display = 'none';
    }, 10000);
    
  } catch (error) {
    console.error('Rent number error:', error);
    showMessage('rentMessage', 'Có lỗi xảy ra, vui lòng thử lại', false);
  }
}

// Copy helper
window.copyToClipboardText = function(text) {
  if (!text) return;
  navigator.clipboard.writeText(text);
  alert('Đã sao chép: ' + text);
};

// Recharge
async function createRecharge() {
  const user = auth.currentUser;
  if (!user) return;
  
  let amount = parseInt(document.getElementById('amount').value);
  if (isNaN(amount) || amount < 10000) {
    showMessage('rechargeMessage', 'Số tiền phải từ 10,000 VNĐ', false);
    return;
  }
  
  amount = Math.ceil(amount / 1000) * 1000;
  
  const transferCode = 'NAP_' + Date.now() + '_' + user.uid.slice(0, 6);
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
  
  showMessage('rechargeMessage', `Yêu cầu nạp ${formatNumber(amount)} đã tạo! Vui lòng chuyển khoản.`, true);
}

// Load Profile
async function loadProfile() {
  const user = auth.currentUser;
  if (!user) return;
  
  try {
    const userDoc = await db.collection('users').doc(user.uid).get();
    const userData = userDoc.exists ? userDoc.data() : {};
    
    const userNameEl = document.getElementById('userName');
    const profileNameEl = document.getElementById('profileName');
    const profileEmailEl = document.getElementById('profileEmail');
    const joinDateEl = document.getElementById('joinDate');
    
    if (userNameEl) userNameEl.textContent = userData.fullName || user.email.split('@')[0];
    if (profileNameEl) profileNameEl.textContent = userData.fullName || '-';
    if (profileEmailEl) profileEmailEl.textContent = user.email;
    if (joinDateEl) joinDateEl.textContent = userData.createdAt ? formatDate(userData.createdAt) : '-';
    
  } catch (error) {
    console.error('Load profile error:', error);
  }
}

// Init Dashboard
async function initDashboard() {
  const user = auth.currentUser;
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  
  await loadProfile();
  await loadUserBalance();
  await loadServices();
  await loadRentHistoryTable();
  await loadFullHistory();
  
  if (autoCheckInterval) clearInterval(autoCheckInterval);
  autoCheckInterval = setInterval(autoCheckOTP, 5000);
}

// Auth Forms
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
        
        await db.collection('users').doc(result.user.uid).set({
          fullName: fullName,
          email: email,
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

// Event Listeners
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