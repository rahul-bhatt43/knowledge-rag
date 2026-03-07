import { parseFile } from "../utils/fileParser.util";
import path from "path";
import fs from "fs";
import * as xlsx from "xlsx";
import mammoth from "mammoth";

async function createDummyFiles() {
    const tmpDir = path.join(__dirname, "tmp_test_files");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

    // 1. JSON
    const jsonPath = path.join(tmpDir, "test.json");
    fs.writeFileSync(jsonPath, JSON.stringify({ hello: "world", data: [1, 2, 3] }));

    // 2. CSV
    const csvPath = path.join(tmpDir, "test.csv");
    fs.writeFileSync(csvPath, "name,age\nAlice,30\nBob,25");

    // 3. XLSX
    const xlsxPath = path.join(tmpDir, "test.xlsx");
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet([{ id: 1, val: "A" }, { id: 2, val: "B" }]);
    xlsx.utils.book_append_sheet(wb, ws, "Sheet1");
    xlsx.writeFile(wb, xlsxPath);

    return { jsonPath, csvPath, xlsxPath, tmpDir };
}

async function run() {
    try {
        console.log("Creating dummy files...");
        const files = await createDummyFiles();

        console.log("\nTesting JSON parsing:");
        const jsonResult = await parseFile(files.jsonPath);
        console.log(jsonResult.text.substring(0, 100));

        console.log("\nTesting CSV parsing:");
        const csvResult = await parseFile(files.csvPath);
        console.log(csvResult.text.substring(0, 100));

        console.log("\nTesting XLSX parsing:");
        const xlsxResult = await parseFile(files.xlsxPath);
        console.log(xlsxResult.text.substring(0, 100));

        console.log("\nAll parsing tests completed successfully.");

        fs.rmSync(files.tmpDir, { recursive: true, force: true });
    } catch (e) {
        console.error("Test failed:", e);
    }
}

run();
