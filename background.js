// ============================================================
// BACKGROUND SERVICE WORKER
// ============================================================

// Import SQLite service
importScripts('sqlite-service.js');

console.log('Background script starting...');

// ============================================================
// AUTH SERVICE - Handles OAuth tokens
// ============================================================
class AuthService {
  constructor() {
    this.token = null;
  }

  async getToken(interactive = true) {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({
        interactive: interactive,
        scopes: ['https://www.googleapis.com/auth/analytics.readonly']
      }, (token) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        this.token = token;
        console.log('Token obtained');
        resolve(token);
      });
    });
  }

  async removeToken() {
    return new Promise((resolve, reject) => {
      chrome.identity.removeCachedAuthToken({
        token: this.token
      }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        this.token = null;
        console.log('Token removed');
        resolve();
      });
    });
  }
}

// ============================================================
// ANALYTICS SERVICE - Fetches data from Google
// ============================================================
class AnalyticsService {
  
  async getProperties(token) {
    console.log('Fetching properties...');
    
    const response = await fetch(
      'https://analyticsadmin.googleapis.com/v1alpha/accountSummaries',
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (response.status === 401) {
      throw new Error('TOKEN_EXPIRED');
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Properties found:', data.accountSummaries?.length || 0, 'accounts');
    return data;
  }

  async fetchAnalytics(token, propertyId) {
    console.log('Fetching analytics for:', propertyId);
    
    const response = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          dateRanges: [
            { startDate: "30daysAgo", endDate: "today" }
          ],
          metrics: [
            { name: "activeUsers" },
            { name: "sessions" },
            { name: "screenPageViews" },
            { name: "bounceRate" },
            { name: "averageSessionDuration" }
          ],
          dimensions: [
            { name: "date" }
          ]
        })
      }
    );

    if (response.status === 401) {
      throw new Error('TOKEN_EXPIRED');
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log('Analytics data received, rows:', data.rows?.length || 0);
    return data;
  }

  // ============================================================
  // NEW: Fetch analytics with SQLite caching
  // ============================================================
  async fetchAnalyticsWithCache(token, propertyId, forceRefresh = false) {
    try {
      console.log('Fetching analytics with cache for:', propertyId);

      // Check if SQLite is initialized and data is fresh
      const isStale = await dbService.isDataStale(propertyId);

      if (!forceRefresh && !isStale) {
        console.log('Using cached data from SQLite');
        const cachedData = await dbService.getAnalytics(propertyId);
        if (cachedData) {
          return cachedData;
        }
      }

      console.log('Fetching fresh data from Google...');
      const freshData = await this.fetchAnalytics(token, propertyId);

      if (freshData && freshData.rows) {
        await dbService.saveAnalytics(propertyId, freshData);
      }

      return freshData;
    } catch (error) {
      console.error('fetchAnalyticsWithCache error:', error);
      // If SQLite fails, fall back to direct fetch
      console.log('Falling back to direct fetch...');
      return this.fetchAnalytics(token, propertyId);
    }
  }
}

// ============================================================
// CREATE INSTANCES
// ============================================================
const auth = new AuthService();
const analytics = new AnalyticsService();

// ============================================================
// LISTEN FOR MESSAGES FROM POPUP
// ============================================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message received:', message.action);

  // LOGIN
  if (message.action === 'login') {
    auth.getToken(true)
      .then(token => sendResponse({ success: true, token: token }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // LOGOUT
  if (message.action === 'logout') {
    auth.removeToken()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // GET PROPERTIES
  if (message.action === 'getProperties') {
    analytics.getProperties(message.token)
      .then(data => sendResponse({ success: true, data: data }))
      .catch(error => {
        if (error.message === 'TOKEN_EXPIRED') {
          auth.getToken(false)
            .then(newToken => {
              analytics.getProperties(newToken)
                .then(data => sendResponse({ 
                  success: true, 
                  data: data, 
                  newToken: newToken 
                }))
                .catch(err => sendResponse({ success: false, error: err.message }));
            })
            .catch(err => sendResponse({ success: false, error: err.message }));
        } else {
          sendResponse({ success: false, error: error.message });
        }
      });
    return true;
  }

  // FETCH ANALYTICS (with SQLite cache)
  if (message.action === 'fetchAnalytics') {
    analytics.fetchAnalyticsWithCache(message.token, message.propertyId)
      .then(data => sendResponse({ success: true, data: data }))
      .catch(error => {
        if (error.message === 'TOKEN_EXPIRED') {
          auth.getToken(false)
            .then(newToken => {
              analytics.fetchAnalyticsWithCache(newToken, message.propertyId, true)
                .then(data => sendResponse({ 
                  success: true, 
                  data: data, 
                  newToken: newToken 
                }))
                .catch(err => sendResponse({ success: false, error: err.message }));
            })
            .catch(err => sendResponse({ success: false, error: err.message }));
        } else {
          sendResponse({ success: false, error: error.message });
        }
      });
    return true;
  }

  // UNKNOWN ACTION
  sendResponse({ success: false, error: 'Unknown action' });
  return true;
});

console.log('Background service worker loaded');