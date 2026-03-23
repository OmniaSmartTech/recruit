const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

/**
 * Extract text from a CV file buffer.
 * Supports PDF and DOCX formats.
 */
async function parseCv(buffer, filename) {
  const ext = (filename || "").toLowerCase().split(".").pop();

  if (ext === "pdf") {
    return parsePdf(buffer);
  } else if (ext === "docx") {
    return parseDocx(buffer);
  } else if (ext === "doc") {
    // .doc is legacy — try mammoth (works for some .doc files)
    return parseDocx(buffer);
  } else if (ext === "txt") {
    return buffer.toString("utf-8");
  }

  throw new Error(`Unsupported file format: .${ext}. Please upload PDF, DOCX, or TXT.`);
}

async function parsePdf(buffer) {
  const data = await pdfParse(buffer);
  return cleanText(data.text);
}

async function parseDocx(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return cleanText(result.value);
}

function cleanText(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

module.exports = { parseCv };
