import fs from "fs";
import { google } from "googleapis";

const TOKEN_PATH = "token.json";
const SCRIPT_TAG = "SCHOOL_TIMETABLE_2026";

async function run() {
  if (!fs.existsSync("credentials.json")) {
    console.error("credentials.json not found");
    return;
  }

  const credentials = JSON.parse(fs.readFileSync("credentials.json", "utf8"));
  const { client_secret, client_id, redirect_uris } = credentials.installed;

  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0],
  );

  if (!fs.existsSync(TOKEN_PATH)) {
    console.error("token.json not found. Run create script first.");
    return;
  }

  oAuth2Client.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8")));

  const calendar = google.calendar({ version: "v3", auth: oAuth2Client });

  const res = await calendar.events.list({
    calendarId: "primary",
    q: SCRIPT_TAG,
    singleEvents: false,
  });

  const events = res.data.items || [];

  for (const event of events) {
    if (event.id) {
      await calendar.events.delete({
        calendarId: "primary",
        eventId: event.id,
      });
      console.log(`Deleted: ${event.summary}`);
    }
  }

  console.log("Cleanup complete.");
}

run().catch(console.error);
