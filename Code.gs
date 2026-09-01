const ROOT_FOLDER_ID = "1mhoEu3E-vS1KlvE_u4sMXsm4mbDGT_Wo";
const CACHE_KEY = "AM_DASHBOARD_DATA";
const CACHE_DURATION = 3600; // 1 hour in seconds

function doGet() {
  return HtmlService
    .createTemplateFromFile("index")
    .evaluate()
    .setTitle("AM Opportunity Dashboard")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getDashboardData(forceRefresh = false) {
  const cache = CacheService.getScriptCache();
  
  // 1. Check cache first
  if (!forceRefresh) {
    const cachedData = cache.get(CACHE_KEY);
    if (cachedData) {
      try { return JSON.parse(cachedData); } catch (e) { /* ignore and rebuild */ }
    }
  }

  const root = DriveApp.getFolderById(ROOT_FOLDER_ID);
  const result = [];

  // Recursive function to dig through all subfolders
  function processFolder(folder, defaultAmName) {
    // A. Check for any Google Sheets directly inside THIS folder
    const files = folder.getFilesByType(MimeType.GOOGLE_SHEETS);
    while (files.hasNext()) {
      const file = files.next();
      extractDataFromFile(file, defaultAmName, result);
    }
    
    // B. Check for sub-folders inside THIS folder and dive into them
    const subfolders = folder.getFolders();
    while (subfolders.hasNext()) {
      const sub = subfolders.next();
      processFolder(sub, sub.getName()); // Passes the subfolder name as the AM name
    }
  }

  // Start the search from the Root folder
  processFolder(root, "Unassigned / Root");

  const payload = {
    generatedAt: new Date().toISOString(),
    isCached: false,
    rows: result
  };

  // Cache the result for next time
  try {
    const jsonString = JSON.stringify(payload);
    if (jsonString.length < 100000) { 
      cache.put(CACHE_KEY, jsonString, CACHE_DURATION);
    }
  } catch (e) {
    console.warn("Payload too large to cache.");
  }

  // Sanitize Date objects for the frontend
  return JSON.parse(JSON.stringify(payload));
}

// ----------------------------------------------------------------
// Data Extraction Helper
// ----------------------------------------------------------------
function extractDataFromFile(file, fallbackAmName, resultArray) {
  try {
    const spreadsheet = SpreadsheetApp.openById(file.getId());
    const sheets = spreadsheet.getSheets();

    sheets.forEach(sheet => {
      const values = sheet.getDataRange().getValues();
      if (!values || values.length < 2) return;

      const headers = values[0].map(h => String(h).toLowerCase().trim());
      const headerMap = {};
      headers.forEach((h, index) => { headerMap[h] = index; });

      // Skip sheets that don't have opportunity columns
      if (headerMap["opportunity name"] === undefined && headerMap["account name"] === undefined) return;

      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        
        // Skip entirely empty rows
        if (row.every(val => val === "" || val === null || val === undefined)) continue;

        resultArray.push({
          am: getValue(row, headerMap, "opportunity owner") || fallbackAmName,
          stage: getValue(row, headerMap, "stage"),
          account: getValue(row, headerMap, "account name"),
          opportunity: getValue(row, headerMap, "opportunity name"),
          amount: parseNumber(getValue(row, headerMap, "amount")),
          created: formatDate(getValue(row, headerMap, "created date")),
          activity: formatDate(getValue(row, headerMap, "last activity")),
          age: parseNumber(getValue(row, headerMap, "age")),
          quantity: parseNumber(getValue(row, headerMap, "opportunity quantity")),
          nextStep: String(getValue(row, headerMap, "next step") || ""), 
          modified: formatDate(getValue(row, headerMap, "last modified date")),
          sourceFile: file.getName()
        });
      }
    });
  } catch (error) {
    console.error(`Error reading ${file.getName()}: ${error.message}`);
  }
}

// ----------------------------------------------------------------
// Formatting Helpers
// ----------------------------------------------------------------
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
