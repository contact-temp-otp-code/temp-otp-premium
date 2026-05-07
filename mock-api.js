// mock-api.js - Chạy song song với live server
// Dùng để test frontend khi chưa có Worker

// Giả lập API response
const mockResponses = {
  '/api/balance': { status_code: 200, success: true, data: { balance: 150000 } },
  '/api/services?country=vn': {
    status_code: 200,
    success: true,
    data: [
      { id: 1, name: 'Zalo', price: 800 },
      { id: 2, name: 'Facebook', price: 800 },
      { id: 3, name: 'Shopee', price: 1400 },
      { id: 4, name: 'Lazada', price: 1400 },
      { id: 5, name: 'TikTok', price: 1400 },
      { id: 6, name: 'Telegram', price: 800 },
      { id: 7, name: 'Gmail', price: 2000 }
    ]
  },
  '/api/networks': {
    status_code: 200,
    success: true,
    data: [
      { name: 'VIETTEL' },
      { name: 'VINAPHONE' },
      { name: 'MOBIFONE' },
      { name: 'UNITEL' }
    ]
  },
  '/api/request?serviceId=1&country=vn': {
    status_code: 200,
    success: true,
    data: {
      phone_number: '0987654321',
      re_phone_number: null,
      request_id: 'REQ_' + Date.now(),
      balance: 149200,
      countryISO: 'VN'
    }
  },
  '/api/session?requestId=REQ_123': {
    status_code: 200,
    success: true,
    data: {
      Status: 1,
      Code: '123456',
      SmsContent: 'Ma xac thuc cua ban la 123456',
      ServiceName: 'Zalo',
      Phone: '0987654321',
      Price: 800
    }
  }
};

// Intercept fetch requests
const originalFetch = window.fetch;
window.fetch = function(url, options) {
  const urlStr = typeof url === 'string' ? url : url.url;
  
  // Check if this is an API call to our worker
  if (urlStr.includes('/api/')) {
    const path = urlStr.split('/api/')[1];
    
    // Find matching mock response (simple matching)
    for (const [mockPath, response] of Object.entries(mockResponses)) {
      if (path.includes(mockPath.replace('/api/', '')) || mockPath === urlStr) {
        console.log('[MOCK] API call:', urlStr, '→', response);
        return Promise.resolve(new Response(JSON.stringify(response), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }));
      }
    }
    
    // Default mock response
    console.warn('[MOCK] No mock for:', urlStr);
    return Promise.resolve(new Response(JSON.stringify({
      status_code: 200,
      success: true,
      data: {}
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  }
  
  // Pass through non-API requests
  return originalFetch(url, options);
};

console.log('[MOCK] API Mock enabled - Các API đang được giả lập');