// ============================================================
// POPUP SCRIPT - Controls the popup UI
// ============================================================

// Global variable to store the token once we get it
let currentToken = null;

// ============================================================
// SEND MESSAGE TO BACKGROUND
// ============================================================
function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      resolve(response);
    });
  });
}

// ============================================================
// UPDATE STATUS BAR
// ============================================================
function updateStatus(text, connected = false) {
  const status = document.getElementById('status');
  status.textContent = text;
  status.style.background = connected ? '#e6f4ea' : '#f0f0f0';
}

// ============================================================
// SHOW/HIDE LOADING
// ============================================================
function showLoading() {
  document.getElementById('loading').style.display = 'block';
}

function hideLoading() {
  document.getElementById('loading').style.display = 'none';
}

// ============================================================
// SHOW/HIDE ERROR
// ============================================================
function showError(message) {
  const error = document.getElementById('error');
  error.textContent = message;
  error.style.display = 'block';
}

function hideError() {
  document.getElementById('error').style.display = 'none';
}

// ============================================================
// LOAD PROPERTIES - Get list of GA properties
// ============================================================
async function loadProperties() {
  try {
    console.log('Loading properties...');
    
    const response = await sendMessage({
      action: 'getProperties',
      token: currentToken
    });

    if (!response.success) {
      throw new Error(response.error);
    }

    if (response.newToken) {
      currentToken = response.newToken;
    }

    const data = response.data;
    const select = document.getElementById('propertySelect');
    select.innerHTML = '<option value="">Select a property...</option>';

    if (!data.accountSummaries || data.accountSummaries.length === 0) {
      throw new Error('No Google Analytics properties found');
    }

    for (const account of data.accountSummaries) {
      for (const property of account.propertySummaries) {
        const option = document.createElement('option');
        // Extract only the numeric ID
        const propertyId = property.property.replace('properties/', '');
        option.value = propertyId;
        option.textContent = property.displayName + ' (' + propertyId + ')';
        select.appendChild(option);
      }
    }

    document.getElementById('propertySection').style.display = 'block';
    console.log('Properties loaded successfully');

  } catch (error) {
    console.error('Load properties error:', error);
    showError('Failed to load properties: ' + error.message);
  }
}

// ============================================================
// FETCH ANALYTICS - Get data for selected property
// ============================================================
async function fetchAnalytics() {
  const select = document.getElementById('propertySelect');
  const propertyId = select.value;

  if (!propertyId) {
    showError('Please select a property first');
    return;
  }

  try {
    hideError();
    showLoading();
    document.getElementById('fetchBtn').disabled = true;

    console.log('Fetching analytics for property ID:', propertyId);

    const response = await sendMessage({
      action: 'fetchAnalytics',
      token: currentToken,
      propertyId: propertyId
    });

    if (!response.success) {
      throw new Error(response.error);
    }

    if (response.newToken) {
      currentToken = response.newToken;
    }

    const data = response.data;
    displayData(data);
    document.getElementById('dataSection').style.display = 'block';

  } catch (error) {
    console.error('Fetch error:', error);
    showError('Failed to fetch data: ' + error.message);
    document.getElementById('dataSection').style.display = 'none';
  } finally {
    hideLoading();
    document.getElementById('fetchBtn').disabled = false;
  }
}

// ============================================================
// DISPLAY DATA - Show analytics in the UI
// ============================================================
function displayData(data) {
  if (!data.rows || data.rows.length === 0) {
    document.getElementById('users').textContent = 'No data';
    document.getElementById('sessions').textContent = 'No data';
    document.getElementById('pageViews').textContent = 'No data';
    document.getElementById('bounceRate').textContent = 'No data';
    document.getElementById('avgDuration').textContent = 'No data';
    return;
  }

  let totalUsers = 0;
  let totalSessions = 0;
  let totalPageViews = 0;
  let totalBounceRate = 0;
  let totalDuration = 0;
  let rowCount = data.rows.length;

  for (const row of data.rows) {
    totalUsers += parseInt(row.metricValues[0].value) || 0;
    totalSessions += parseInt(row.metricValues[1].value) || 0;
    totalPageViews += parseInt(row.metricValues[2].value) || 0;
    totalBounceRate += parseFloat(row.metricValues[3].value) || 0;
    totalDuration += parseFloat(row.metricValues[4].value) || 0;
  }

  document.getElementById('users').textContent = totalUsers.toLocaleString();
  document.getElementById('sessions').textContent = totalSessions.toLocaleString();
  document.getElementById('pageViews').textContent = totalPageViews.toLocaleString();
  document.getElementById('bounceRate').textContent = (totalBounceRate / rowCount).toFixed(1) + '%';
  document.getElementById('avgDuration').textContent = Math.round(totalDuration / rowCount) + 's';

  updateStatus('Data loaded successfully', true);
}

// ============================================================
// LOGIN - Connect to Google
// ============================================================
async function login() {
  try {
    hideError();
    showLoading();
    document.getElementById('loginBtn').disabled = true;

    const response = await sendMessage({ action: 'login' });

    if (!response.success) {
      throw new Error(response.error);
    }

    currentToken = response.token;
    updateStatus('Connected to Google', true);
    document.getElementById('loginBtn').style.display = 'none';
    document.getElementById('logoutBtn').style.display = 'block';

    await loadProperties();

  } catch (error) {
    showError(error.message);
    updateStatus('Connection failed', false);
  } finally {
    hideLoading();
    document.getElementById('loginBtn').disabled = false;
  }
}

// ============================================================
// LOGOUT - Disconnect from Google
// ============================================================
async function logout() {
  try {
    const response = await sendMessage({ action: 'logout' });

    if (!response.success) {
      throw new Error(response.error);
    }

    currentToken = null;
    updateStatus('Disconnected', false);
    document.getElementById('loginBtn').style.display = 'block';
    document.getElementById('logoutBtn').style.display = 'none';
    document.getElementById('propertySection').style.display = 'none';
    document.getElementById('dataSection').style.display = 'none';
    hideError();

  } catch (error) {
    showError(error.message);
  }
}

// ============================================================
// CHECK IF ALREADY LOGGED IN
// ============================================================
async function checkExistingLogin() {
  try {
    const response = await sendMessage({ action: 'login' });
    
    if (response.success) {
      currentToken = response.token;
      updateStatus('Connected to Google', true);
      document.getElementById('loginBtn').style.display = 'none';
      document.getElementById('logoutBtn').style.display = 'block';
      await loadProperties();
    }
  } catch (error) {
    console.log('Not logged in yet');
  }
}

// ============================================================
// SETUP BUTTONS - Connect clicks to functions
// ============================================================
function setupButtons() {
  document.getElementById('loginBtn').addEventListener('click', login);
  document.getElementById('logoutBtn').addEventListener('click', logout);
  document.getElementById('fetchBtn').addEventListener('click', fetchAnalytics);
}

// ============================================================
// INITIALIZE - Runs when popup opens
// ============================================================
function init() {
  console.log('Popup loaded');
  setupButtons();
  checkExistingLogin();
}

document.addEventListener('DOMContentLoaded', init);