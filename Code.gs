const ROOT_FOLDER_ID = "1dFDQTPnkso7as9j1rszvb0YI2_6Nu10g";

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
MAIN DATA FUNCTION
========================================================
*/

function getDashboardData() {
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

          if (!values || values.length < 2) {
            return;
          }

          const headers = values[0].map(h => String(h).trim());
          const headerMap = createHeaderMap(headers);

          if (
            headerMap["opportunity name"] === undefined &&
            headerMap["account name"] === undefined
          ) {
            return;
          }

          for (let i = 1; i < values.length; i++) {
            const row = values[i];

            if (
              row.every(value =>
                value === "" ||
                value === null ||
                value === undefined
              )
            ) {
              continue;
            }

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
              modifiedBy: getValue(row, headerMap, "last modified by"),
              sourceFile: file.getName(),
              sourceSheet: sheet.getName()
            });
          }
        });
      } catch (error) {
        console.error("Could not read " + file.getName() + ": " + error);
      }
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    rows: result
  };
}

/*
========================================================
HEADER MAP
========================================================
*/

function createHeaderMap(headers) {
  const map = {};
  headers.forEach((header, index) => {
    const normalized = String(header).toLowerCase().trim();
    map[normalized] = index;
  });
  return map;
}

/*
========================================================
GET VALUE
========================================================
*/

function getValue(row, map, column) {
  const index = map[column];
  if (index === undefined) {
    return "";
  }
  return row[index];
}

/*
========================================================
NUMBER PARSING
========================================================
*/

function parseNumber(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  if (typeof value === "number") {
    return value;
  }

  let str = String(value).trim();
  const isNegative = /^\(.*\)$/.test(str) || str.startsWith("-");
  const cleaned = str.replace(/[$₹€£,\s()]/g, "").replace(/[^\d.]/g, "");
  const number = parseFloat(cleaned);

  if (isNaN(number)) return 0;
  return isNegative ? -Math.abs(number) : number;
}

/*
========================================================
DATE FORMATTING
========================================================
*/

function formatDate(value) {
  if (!value) {
    return "";
  }

  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      "yyyy-MM-dd"
    );
  }

  const parsedDate = new Date(value);
  if (!isNaN(parsedDate.getTime())) {
    return Utilities.formatDate(
      parsedDate,
      Session.getScriptTimeZone(),
      "yyyy-MM-dd"
    );
  }

  return String(value);
}
