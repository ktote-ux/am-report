const ROOT_FOLDER_ID = "1dFDQTPnkso7as9j1rszvb0YI2_6Nu10g";
const CACHE_KEY = "AM_DASHBOARD_DATA";
const CACHE_DURATION = 3600; // 1 hour in seconds

/*
========================================================
WEB APP
========================================================
*/
function doGet() {
  return HtmlService
    .createTemplateFromFile("index")
    .evaluate()
    .setTitle("AM Opportunity Dashboard")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/*
========================================================
MAIN DATA FUNCTION (With Caching)
========================================================
*/
function getDashboardData(forceRefresh = false) {
  const cache = CacheService.getScriptCache();
  
  // 1. Check Cache first (unless forced refresh)
  if (!forceRefresh) {
    const cachedData = cache.get(CACHE_KEY);
    if (cachedData) {
      try {
        return JSON.parse(cachedData);
      } catch (e) {
        console.warn("Failed to parse cached data, fetching fresh.");
      }
    }
  }

  // 2. Fetch fresh data
  const root = DriveApp.getFolderById(ROOT_FOLDER_ID);
  const result = [];
  const folders = root.getFolders();

  while (folders.hasNext()) {
    const amFolder = folders.next();
    const amName = amFolder.getName();
    const files = amFolder.getFilesByType(MimeType.GOOGLE_SHEETS);

    while (files.hasNext()) {
      const file = files.next();
      try {
        const spreadsheet = SpreadsheetApp.openById(file.getId());
        const sheets = spreadsheet.getSheets();

        sheets.forEach(sheet => {
          const values = sheet.getDataRange().getValues();
          if (!values || values.length < 2) return;

          const headers = values[0].map(h => String(h).trim());
          const headerMap = createHeaderMap(headers);

          // Skip if it doesn't look like an opportunity sheet
          if (headerMap["opportunity name"] === undefined && headerMap["account name"] === undefined) {
            return;
          }

          for (let i = 1; i < values.length; i++) {
            const row = values[i];
            
            // Skip completely empty rows
            if (row.every(val => val === "" || val === null || val === undefined)) continue;

            result.push({
              am: getValue(row, headerMap, "opportunity owner") || amName,
              stage: getValue(row, headerMap, "stage"),
              account: getValue(row, headerMap, "account name"),
              opportunity: getValue(row, headerMap, "opportunity name"),
              amount: parseNumber(getValue(row, headerMap, "amount")),
              created: formatDate(getValue(row, headerMap, "created date")),
              activity: formatDate(getValue(row, headerMap, "last activity")),
              age: parseNumber(getValue(row, headerMap, "age")),
              quantity: parseNumber(getValue(row, headerMap, "opportunity quantity")),
              nextStep: getValue(row, headerMap, "next step"),
              modified: formatDate(getValue(row, headerMap, "last modified date")),
              sourceFile: file.getName()
            });
          }
        });
      } catch (error) {
        console.error(`Error reading ${file.getName()}: ${error.message}`);
      }
    }
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    isCached: false,
    rows: result
  };

  // 3. Attempt to save to cache (Script cache limit is 100KB per item)
  try {
    const jsonString = JSON.stringify(payload);
    if (jsonString.length < 100000) { // Google Apps Script cache size limit safeguard
      cache.put(CACHE_KEY, jsonString, CACHE_DURATION);
    }
  } catch (e) {
    console.warn("Payload too large to cache, bypassing cache storage.");
  }

  return payload;
}

/* ========================================================
   HELPERS
======================================================== */
function createHeaderMap(headers) {
  const map = {};
  headers.forEach((header, index) => {
    map[String(header).toLowerCase().trim()] = index;
  });
  return map;
}

function getValue(row, map, column) {
  const index = map[column];
  return index !== undefined ? row[index] : "";
}

function parseNumber(value) {
  if (value == null || value === "") return 0;
  if (typeof value === "number") return value;
  
  let str = String(value).trim();
  const isNegative = /^\(.*\)$/.test(str) || str.startsWith("-");
  const cleaned = str.replace(/[$₹€£,\s()]/g, "").replace(/[^\d.]/g, "");
  const number = parseFloat(cleaned);
  
  return isNaN(number) ? 0 : (isNegative ? -Math.abs(number) : number);
}

function formatDate(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  const parsedDate = new Date(value);
  if (!isNaN(parsedDate.getTime())) {
    return Utilities.formatDate(parsedDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return String(value);
}
