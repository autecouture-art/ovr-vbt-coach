/*
 * RepVeloCoach Google Drive crash report receiver.
 *
 * Setup:
 * 1. Create a Google Apps Script project.
 * 2. Paste this file.
 * 3. Set Script Properties:
 *    - REPVELO_CRASH_REPORT_TOKEN: optional shared token
 *    - REPVELO_CRASH_REPORT_FOLDER: optional Drive folder id
 * 4. Deploy as Web App:
 *    - Execute as: Me
 *    - Who has access: Anyone with the link
 * 5. Put the Web App URL into RepVeloCoach Settings > Share.
 */

const DEFAULT_FOLDER_NAME = "RepVeloCoach crash-reports";

function doPost(e) {
  try {
    const body = parseJsonBody_(e);
    verifyToken_(body);

    const folder = getTargetFolder_();
    const baseName = sanitizeFileName_(
      body.file_base_name || `repvelocoach-crash-${new Date().toISOString()}`,
    );
    const markdown = String(body.markdown || "");
    const json = JSON.stringify(
      {
        schema: body.schema,
        report_id: body.report_id,
        queued_at: body.queued_at,
        uploaded_at: body.uploaded_at,
        snapshot: body.snapshot || null,
      },
      null,
      2,
    );

    const mdFile = folder.createFile(`${baseName}.md`, markdown, MimeType.PLAIN_TEXT);
    const jsonFile = folder.createFile(`${baseName}.json`, json, MimeType.JSON);

    return jsonResponse_({
      ok: true,
      markdown_file_id: mdFile.getId(),
      json_file_id: jsonFile.getId(),
      folder_id: folder.getId(),
    });
  } catch (error) {
    return jsonResponse_(
      {
        ok: false,
        error: error && error.message ? error.message : String(error),
      },
      500,
    );
  }
}

function parseJsonBody_(e) {
  const contents = e && e.postData && e.postData.contents;
  if (!contents) {
    throw new Error("Missing POST body.");
  }
  const body = JSON.parse(contents);
  if (body.schema !== "repvelocoach.google-drive-crash-report.v1") {
    throw new Error("Invalid schema.");
  }
  if (!body.markdown || !body.snapshot) {
    throw new Error("Missing markdown or snapshot.");
  }
  return body;
}

function verifyToken_(body) {
  const expected = PropertiesService.getScriptProperties().getProperty(
    "REPVELO_CRASH_REPORT_TOKEN",
  );
  if (!expected) {
    return;
  }
  if (body.token !== expected) {
    throw new Error("Invalid token.");
  }
}

function getTargetFolder_() {
  const props = PropertiesService.getScriptProperties();
  const folderId = props.getProperty("REPVELO_CRASH_REPORT_FOLDER");
  if (folderId) {
    return DriveApp.getFolderById(folderId);
  }

  const existing = DriveApp.getFoldersByName(DEFAULT_FOLDER_NAME);
  if (existing.hasNext()) {
    return existing.next();
  }
  return DriveApp.createFolder(DEFAULT_FOLDER_NAME);
}

function sanitizeFileName_(value) {
  return String(value)
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 120);
}

function jsonResponse_(payload, statusCode) {
  const output = ContentService.createTextOutput(JSON.stringify(payload));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
