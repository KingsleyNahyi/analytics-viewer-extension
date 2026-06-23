
class SQLiteService {
  constructor() {
    this.db = null;
    this.initialized = false;
    this.initPromise = null;
  }

  // Initialize SQLite database
  async init() {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._init();
    return this.initPromise;
  }

  async _init() {
    try {
      console.log('Initializing SQLite...');

      // Check if SQL is already available
      if (typeof SQL !== 'undefined') {
        console.log('SQL already loaded');
        this.db = new SQL.Database();
        this.createTables();
        this.initialized = true;
        console.log('SQLite initialized successfully');
        return;
      }

      // Load SQL.js dynamically
      const scriptUrl = chrome.runtime.getURL('sql-wasm.js');
      console.log('Loading SQL from:', scriptUrl);

      const script = document.createElement('script');
      script.src = scriptUrl;
      
      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = () => reject(new Error('Failed to load sql-wasm.js'));
        document.head.appendChild(script);
      });

      // Wait for SQL to be available
      await new Promise((resolve) => {
        const checkSQL = () => {
          if (typeof SQL !== 'undefined') {
            resolve();
          } else {
            setTimeout(checkSQL, 100);
          }
        };
        checkSQL();
      });

      this.db = new SQL.Database();
      this.createTables();
      this.initialized = true;
      console.log('SQLite initialized successfully');
    } catch (error) {
      console.error('SQLite init error:', error);
      throw error;
    }
  }

  // Create database tables
  createTables() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS analytics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        property_id TEXT,
        date TEXT,
        active_users INTEGER,
        sessions INTEGER,
        page_views INTEGER,
        bounce_rate REAL,
        avg_duration REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(property_id, date)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS properties (
        property_id TEXT PRIMARY KEY,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Tables created');
  }

    // Fetch analytics with SQLite caching
  async fetchAnalyticsWithCache(token, propertyId, forceRefresh = false) {
    console.log('Fetching analytics with cache for:', propertyId);

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
  }
  // Save analytics data to database
  async saveAnalytics(propertyId, data) {
    await this.init();

    if (!data.rows || data.rows.length === 0) {
      console.log('No data to save');
      return 0;
    }

    let savedCount = 0;

    for (const row of data.rows) {
      const date = row.dimensionValues[0].value;
      const users = parseInt(row.metricValues[0].value) || 0;
      const sessions = parseInt(row.metricValues[1].value) || 0;
      const pageViews = parseInt(row.metricValues[2].value) || 0;
      const bounceRate = parseFloat(row.metricValues[3].value) || 0;
      const avgDuration = parseFloat(row.metricValues[4].value) || 0;

      try {
        this.db.run(`
          INSERT OR REPLACE INTO analytics 
          (property_id, date, active_users, sessions, page_views, bounce_rate, avg_duration)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [propertyId, date, users, sessions, pageViews, bounceRate, avgDuration]);
        savedCount++;
      } catch (error) {
        console.error('Error saving row:', error);
      }
    }

    this.db.run(`
      INSERT OR REPLACE INTO properties (property_id, last_updated)
      VALUES (?, CURRENT_TIMESTAMP)
    `, [propertyId]);

    console.log(`Saved ${savedCount} records to SQLite`);
    return savedCount;
  }

  // Get analytics data from database
  async getAnalytics(propertyId, days = 30) {
    await this.init();

    const result = this.db.exec(`
      SELECT 
        date,
        active_users,
        sessions,
        page_views,
        bounce_rate,
        avg_duration
      FROM analytics
      WHERE property_id = ?
        AND date >= date('now', '-${days} days')
      ORDER BY date DESC
    `, [propertyId]);

    if (result.length === 0 || result[0].values.length === 0) {
      return null;
    }

    const rows = result[0].values.map(row => ({
      dimensionValues: [{ value: row[0] }],
      metricValues: [
        { value: String(row[1]) },
        { value: String(row[2]) },
        { value: String(row[3]) },
        { value: String(row[4]) },
        { value: String(row[5]) }
      ]
    }));

    return { rows: rows };
  }

  // Check if data is stale (older than 1 hour)
  async isDataStale(propertyId) {
    await this.init();

    const result = this.db.exec(`
      SELECT last_updated
      FROM properties
      WHERE property_id = ?
    `, [propertyId]);

    if (result.length === 0 || result[0].values.length === 0) {
      return true;
    }

    const lastUpdated = new Date(result[0].values[0][0]);
    const now = new Date();
    const hoursDiff = (now - lastUpdated) / (1000 * 60 * 60);

    return hoursDiff > 1;
  }

  // Export database
  async exportDatabase() {
    await this.init();
    return this.db.export();
  }

  // Import database
  async importDatabase(data) {
    await this.init();
    this.db = new SQL.Database(data);
    this.initialized = true;
    console.log('Database imported successfully');
  }
}


const dbService = new SQLiteService();