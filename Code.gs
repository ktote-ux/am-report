const ROOT_FOLDER_ID = "1dFDQTPnkso7as9j1rszvb0YI2_6Nu10g";

/*
========================================================
WEB APP
========================================================
*/

function doGet() {
  return HtmlService
    .createTemplateFromFile("Index")
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

  /*
  Each immediate sub-folder is treated as an AM.
  */

  const folders = root.getFolders();

  while (folders.hasNext()) {

    const amFolder = folders.next();

    const amName = amFolder.getName();

    /*
    Find Google Sheets inside AM folder
    */

    const files = amFolder.getFilesByType(
      MimeType.GOOGLE_SHEETS
    );

    while (files.hasNext()) {

      const file = files.next();

      try {

        const spreadsheet = SpreadsheetApp.openById(
          file.getId()
        );

        const sheets = spreadsheet.getSheets();

        sheets.forEach(sheet => {

          const values = sheet.getDataRange().getValues();

          if (!values || values.length < 2) {
            return;
          }

          const headers = values[0].map(h =>
            String(h).trim()
          );

          const headerMap = createHeaderMap(headers);

          /*
          Check whether this looks like
          an opportunity sheet.
          */

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

              am:
                getValue(
                  row,
                  headerMap,
                  "opportunity owner"
                ) || amName,

              stage:
                getValue(
                  row,
                  headerMap,
                  "stage"
                ),

              account:
                getValue(
                  row,
                  headerMap,
                  "account name"
                ),

              opportunity:
                getValue(
                  row,
                  headerMap,
                  "opportunity name"
                ),

              amount:
                parseNumber(
                  getValue(
                    row,
                    headerMap,
                    "amount"
                  )
                ),

              created:
                formatDate(
                  getValue(
                    row,
                    headerMap,
                    "created date"
                  )
                ),

              activity:
                formatDate(
                  getValue(
                    row,
                    headerMap,
                    "last activity"
                  )
                ),

              age:
                parseNumber(
                  getValue(
                    row,
                    headerMap,
                    "age"
                  )
                ),

              quantity:
                parseNumber(
                  getValue(
                    row,
                    headerMap,
                    "opportunity quantity"
                  )
                ),

              nextStep:
                getValue(
                  row,
                  headerMap,
                  "next step"
                ),

              modified:
                formatDate(
                  getValue(
                    row,
                    headerMap,
                    "last modified date"
                  )
                ),

              modifiedBy:
                getValue(
                  row,
                  headerMap,
                  "last modified by"
                ),

              sourceFile: file.getName(),
              sourceSheet: sheet.getName()
            });
          }

        });

      } catch (error) {

        console.error(
          "Could not read " +
          file.getName() +
          ": " +
          error
        );

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

    const normalized =
      String(header)
        .toLowerCase()
        .trim();

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
NUMBER
========================================================
*/

function parseNumber(value) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  if (typeof value === "number") {
    return value;
  }

  const cleaned =
    String(value)
      .replace(/[$₹€£,\s]/g, "")
      .replace(/[^\d.-]/g, "");

  const number = parseFloat(cleaned);

  return isNaN(number) ? 0 : number;
}


/*
========================================================
DATE
========================================================
*/

function formatDate(value) {

  if (!value) {
    return "";
  }

  if (
    Object.prototype.toString.call(value) ===
    "[object Date]"
  ) {

    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      "yyyy-MM-dd"
    );

  }

  return String(value);
}
