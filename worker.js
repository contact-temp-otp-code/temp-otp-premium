export default {
  async fetch(request, env) {
    // Handle CORS preflight - tối ưu cache
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const url = new URL(request.url);
    
    // Only handle /api/* routes
    if (!url.pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const path = url.pathname.replace('/api/', '');
    const targetRoot = 'https://api.viotp.com';
    
    // API Token cứng
    const API_TOKEN = 'c7dcbd1d3588412cafc2fa62da61eb74';
    
    // Add token to params
    const params = new URLSearchParams(url.search);
    params.set('token', API_TOKEN);
    
    // Build endpoint URL
    let endpoint;
    switch (path) {
      case 'balance':
        endpoint = `${targetRoot}/users/balance?${params.toString()}`;
        break;
      case 'networks':
        endpoint = `${targetRoot}/networks/get?${params.toString()}`;
        break;
      case 'services':
        if (!params.has('country')) params.set('country', 'vn');
        endpoint = `${targetRoot}/service/getv2?${params.toString()}`;
        break;
      case 'request':
        endpoint = `${targetRoot}/request/getv2?${params.toString()}`;
        break;
      case 'session':
        endpoint = `${targetRoot}/session/getv2?${params.toString()}`;
        break;
      case 'history':
        endpoint = `${targetRoot}/session/historyv2?${params.toString()}`;
        break;
      default:
        return new Response(JSON.stringify({ 
          status_code: 404, 
          success: false, 
          message: 'API route not found' 
        }), {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
    }

    // Forward request to ViOTP API với timeout ngắn
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
      
      const apiResponse = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'User-Agent': 'ViOTP-Worker/1.0',
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const body = await apiResponse.text();
      
      return new Response(body, {
        status: apiResponse.status,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache',
        },
      });
    } catch (error) {
      return new Response(JSON.stringify({
        status_code: -1,
        success: false,
        message: 'Proxy error: ' + error.message,
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
};