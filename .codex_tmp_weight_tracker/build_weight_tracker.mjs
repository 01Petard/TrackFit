import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";
import JSZip from "jszip";

const outputDir = "/Users/hzx/project_self/archived_self/TrackFit/outputs/019fb92f-6611-77b1-a81f-90c5a4262f01";
await fs.mkdir(outputDir, { recursive: true });

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("体重打卡");
sheet.showGridLines = false;

sheet.getRange("A1:H1").merge();
sheet.getRange("A1").values = [["体重打卡记录"]];
sheet.getRange("A1:H1").format = {
  fill: "#1F6F5F",
  font: { bold: true, color: "#FFFFFF", size: 18 },
  horizontalAlignment: "center",
  verticalAlignment: "center",
};
sheet.getRange("A1:H1").format.rowHeight = 34;

sheet.getRange("A2:H2").merge();
sheet.getRange("A2").values = [["每次只需填写体重，记录时间会自动写入并保持不变；在最后一个单元格按 Tab 可新增一行"]];
sheet.getRange("A2:H2").format = {
  fill: "#E8F3EF",
  font: { color: "#355B52", size: 10 },
  horizontalAlignment: "left",
  verticalAlignment: "center",
};
sheet.getRange("A2:H2").format.rowHeight = 26;

sheet.getRange("A4:B5").values = [
  ["打卡记录", null],
  ["记录时间（自动）", "体重（kg）"],
];
sheet.getRange("A4:B4").merge();
sheet.getRange("A4:B4").format = {
  fill: "#D4E9E1",
  font: { bold: true, color: "#174A3F", size: 12 },
  horizontalAlignment: "left",
  verticalAlignment: "center",
};
sheet.getRange("A5:B5").format = {
  fill: "#2E7D6B",
  font: { bold: true, color: "#FFFFFF" },
  horizontalAlignment: "center",
  verticalAlignment: "center",
  borders: { preset: "all", style: "thin", color: "#D5E2DE" },
};
sheet.getRange("A6").formulas = [["=IF(B6=\"\",\"\",IF(A6=\"\",NOW(),A6))"]];
sheet.getRange("B6").values = [[null]];
sheet.getRange("A6:B6").format = {
  fill: "#FFFFFF",
  borders: { preset: "all", style: "thin", color: "#D5E2DE" },
};
sheet.getRange("A6").format.numberFormat = "yyyy-mm-dd hh:mm";
sheet.getRange("B6").format.numberFormat = "0.0";
sheet.getRange("B6").dataValidation = {
  rule: { type: "decimal", operator: "between", formula1: 20, formula2: 300 },
};

const table = sheet.tables.add("A5:B6", true, "WeightLogTable");
table.style = "TableStyleMedium4";
table.showBandedRows = true;
table.showFilterButton = true;

const chart = sheet.charts.add("line", sheet.getRange("A5:B6"));
chart.title = "体重变化趋势（kg）";
chart.titleTextStyle.fontSize = 13;
chart.hasLegend = false;
chart.xAxis = { axisType: "textAxis", textStyle: { fontSize: 9 } };
chart.yAxis = { numberFormatCode: "0.0" };
chart.setPosition("D4", "L20");

sheet.getRange("A8:B10").values = [
  ["使用提示", null],
  ["1", "直接填写体重即可，左侧会自动记录当前时间"],
  ["2", "在体重单元格按 Tab 新增下一行，自动时间和趋势图会继续生效"],
];
sheet.getRange("A8:B8").merge();
sheet.getRange("A8:B8").format = {
  fill: "#F2F6F4",
  font: { bold: true, color: "#355B52" },
};
sheet.getRange("A9:A10").format = {
  font: { bold: true, color: "#2E7D6B" },
  horizontalAlignment: "center",
};
sheet.getRange("B9:B10").format = {
  font: { color: "#4A5F59", size: 10 },
  wrapText: true,
};

sheet.getRange("A:A").format.columnWidth = 20;
sheet.getRange("B:B").format.columnWidth = 30;
sheet.getRange("C:C").format.columnWidth = 3;
sheet.getRange("D:L").format.columnWidth = 12;
sheet.getRange("A5:B6").format.rowHeight = 24;
sheet.getRange("A9:B10").format.rowHeight = 28;
sheet.freezePanes.freezeRows(5);

const inspect = await workbook.inspect({
  kind: "table,drawing",
  sheetId: "体重打卡",
  range: "A1:L20",
  include: "values,formulas",
  tableMaxRows: 20,
  tableMaxCols: 12,
  maxChars: 6000,
});
console.log(inspect.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "final formula error scan",
});
console.log(errors.ndjson);

const preview = await workbook.render({
  sheetName: "体重打卡",
  range: "A1:L20",
  scale: 1.5,
  format: "png",
});
await fs.writeFile(`${outputDir}/体重打卡记录_预览.png`, new Uint8Array(await preview.arrayBuffer()));

const output = await SpreadsheetFile.exportXlsx(workbook);
const outputPath = `${outputDir}/体重打卡记录.xlsx`;
await output.save(outputPath);

// 开启一次迭代计算，使自动时间戳在首次计算后冻结，不随之后重算变化
const zip = await JSZip.loadAsync(await fs.readFile(outputPath));
const workbookXmlPath = "xl/workbook.xml";
let workbookXml = await zip.file(workbookXmlPath).async("string");
if (/<(?:\w+:)?calcPr\b/.test(workbookXml)) {
  workbookXml = workbookXml.replace(/<(\w+:)?calcPr\b([^>]*)\/?>(?:<\/(?:\w+:)?calcPr>)?/, (match, prefix = "", attrs) => {
    const cleaned = attrs
      .replace(/\siterate=\"[^\"]*\"/g, "")
      .replace(/\siterateCount=\"[^\"]*\"/g, "")
      .replace(/\siterateDelta=\"[^\"]*\"/g, "");
    return `<${prefix}calcPr${cleaned} iterate=\"1\" iterateCount=\"1\" iterateDelta=\"0.001\"/>`;
  });
} else {
  const prefix = workbookXml.includes("<x:workbook") ? "x:" : "";
  workbookXml = workbookXml.replace(`</${prefix}workbook>`, `<${prefix}calcPr iterate=\"1\" iterateCount=\"1\" iterateDelta=\"0.001\"/></${prefix}workbook>`);
}
zip.file(workbookXmlPath, workbookXml);
await fs.writeFile(outputPath, await zip.generateAsync({ type: "nodebuffer" }));
