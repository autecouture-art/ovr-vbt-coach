# Google Drive Crash Reports

RepVeloCoach can send VBT/session crash diagnostics to Google Drive without composing Gmail.

## Flow

1. The app saves the latest VBT/session crash context in AsyncStorage.
2. On the next launch, Home or Session Safe Gate detects the saved context.
3. If Drive diagnostics are enabled, the app POSTs Markdown and JSON to a Google Apps Script Web App.
4. Apps Script creates files in Google Drive.
5. Codex can inspect the Drive folder or the user can share the files directly.

## App Settings

Open `Settings > 共有 > Google Drive 診断送信`.

- `Drive診断送信を有効化`: enables POST upload.
- `クラッシュ後に自動送信`: sends automatically after relaunch when a saved crash context exists.
- `Google Apps Script Web App URL`: paste the deployed `/exec` URL.
- `TOKEN`: optional shared token. Use the same value as Apps Script property `REPVELO_CRASH_REPORT_TOKEN`.

If upload fails, the app keeps the report in an on-device queue. Tap `Driveへ診断送信` to retry.

## Apps Script Setup

1. Create a Google Apps Script project.
2. Paste `scripts/google_drive_crash_report_webapp.gs`.
3. Optional: create a Drive folder and copy its folder id.
4. In Apps Script, open `Project Settings > Script Properties`.
5. Optional properties:
   - `REPVELO_CRASH_REPORT_TOKEN`: shared token.
   - `REPVELO_CRASH_REPORT_FOLDER`: destination Drive folder id.
6. Deploy as Web App:
   - Execute as: `Me`
   - Who has access: `Anyone with the link`
7. Copy the Web App `/exec` URL into the app.

## Output

Default Drive folder:

```text
RepVeloCoach crash-reports/
  repvelocoach-vbt-crash-report-YYYYMMDDTHHMMSSZ.md
  repvelocoach-vbt-crash-report-YYYYMMDDTHHMMSSZ.json
```

Markdown is for human/Codex reading. JSON is for later comparison and aggregation.

## Safety

- The app only sends to the exact URL typed in settings.
- It does not scan the network or discover hosts.
- Drive upload is disabled by default.
- Token is optional but recommended if the Web App is accessible by link.
