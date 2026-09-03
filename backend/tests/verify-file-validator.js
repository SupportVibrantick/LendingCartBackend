const { validateFileMimetype } = require("../utils/security/fileValidator");
const { Readable } = require("stream");
const assert = require("assert");

async function test() {
  console.log("Testing validateFileMimetype...");

  const allowed = ["application/pdf", "image/jpeg", "image/png"];

  // 1. Test Valid PDF
  const pdfBuffer = Buffer.from("%PDF-1.4\n some content");
  const pdfStream = Readable.from(pdfBuffer);
  const pdfRes = await validateFileMimetype(pdfStream, allowed);
  console.log(`PDF Valid: ${pdfRes.isValid} (Detected: ${pdfRes.detectedMime})`);
  assert.strictEqual(pdfRes.isValid, true);
  assert.strictEqual(pdfRes.detectedMime, "application/pdf");

  // 2. Test Valid JPEG
  const jpgBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43]);
  const jpgStream = Readable.from(jpgBuffer);
  const jpgRes = await validateFileMimetype(jpgStream, allowed);
  console.log(`JPEG Valid: ${jpgRes.isValid} (Detected: ${jpgRes.detectedMime})`);
  assert.strictEqual(jpgRes.isValid, true);
  assert.strictEqual(jpgRes.detectedMime, "image/jpeg");

  // 3. Test Invalid (Text file pretending to be PDF)
  const textBuffer = Buffer.from("This is just a text file, not a PDF");
  const textStream = Readable.from(textBuffer);
  const textRes = await validateFileMimetype(textStream, allowed);
  console.log(`Text as PDF Valid: ${textRes.isValid} (Detected: ${textRes.detectedMime})`);
  assert.strictEqual(textRes.isValid, false);

  // 4. Test Valid Mime but not in allowed list
  const gifBuffer = Buffer.from("GIF89a\x01\x00\x01\x00");
  const gifStream = Readable.from(gifBuffer);
  const gifRes = await validateFileMimetype(gifStream, allowed);
  console.log(`GIF (Not Allowed) Valid: ${gifRes.isValid} (Detected: ${gifRes.detectedMime})`);
  assert.strictEqual(gifRes.isValid, false);
  assert.strictEqual(gifRes.detectedMime, "image/gif");

  console.log("\n✅ All isolation tests passed!");
}

test().catch((err) => {
  console.error("\n❌ Test failed:");
  console.error(err);
  process.exit(1);
});
