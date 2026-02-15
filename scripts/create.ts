import fs from "fs";
import path from "path";
import { google, calendar_v3 } from "googleapis";
import open from "open";
import readline from "readline";

const SCOPES = ["https://www.googleapis.com/auth/calendar"];
const TOKEN_PATH = "token.json";
const SCRIPT_TAG = "SCHOOL_TIMETABLE_2026";

type DayCode = "MO" | "TU" | "WE" | "TH" | "FR";

const timetable: Record<DayCode, string[]> = {
  MO: [
    "3БД",
    "Фізична культура",
    "Математика",
    "Математика",
    "Українська мова",
  ],
  TU: [
    "Природознавство",
    "Фізична культура",
    "Зарубіжна література",
    "Українська література",
    "Англійська мова",
  ],
  WE: ["Інформатика", "Історія", "Українська мова", "Математика", "Математика"],
  TH: [
    "Природознавство",
    "Історія",
    "Українська мова",
    "Математика",
    "Українська література",
  ],
  FR: [
    "Англійська мова",
    "Українська мова",
    "Польська мова",
    "Фізична культура",
    "Образотворче мистецтво",
  ],
};

const lessonTimes = [
  ["08:30", "09:15"],
  ["09:25", "10:10"],
  ["10:30", "11:15"],
  ["11:35", "12:20"],
  ["12:30", "13:15"],
];

const teacherMap: Record<string, string> = {
  Інформатика: "Бовшик Андрій Миколайович",
  Історія: "Дмитрів Ігор Романович",
  Природознавство: "Зонтікова Віра Зенонівна",
  "3БД": "Кушнір Олена Валеріївна",
  "Образотворче мистецтво": "Лещук Оксана Орестівна",
  "Українська література": "Макар Марія Петрівна",
  Математика: "Матковський Денис Іринейович",
  "Українська мова": "Паращич Стефанія Михайлівна",
  "Зарубіжна література": "Пастушок Ірина Романівна",
  "Англійська мова": "Радчук Ілона Олексіївна",
};

async function authorize() {
  const credentials = JSON.parse(fs.readFileSync("credentials.json", "utf8"));
  const { client_secret, client_id, redirect_uris } = credentials.installed;

  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0],
  );

  if (fs.existsSync(TOKEN_PATH)) {
    const token = fs.readFileSync(TOKEN_PATH, "utf8");
    if (token.trim()) {
      oAuth2Client.setCredentials(JSON.parse(token));
      return oAuth2Client;
    }
  }

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
  });

  await open(authUrl);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const code = await new Promise<string>((resolve) => {
    rl.question("Enter code: ", resolve);
  });

  rl.close();

  const { tokens } = await oAuth2Client.getToken(code);
  oAuth2Client.setCredentials(tokens);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));

  return oAuth2Client;
}

const dayOffsets: Record<DayCode, number> = {
  MO: 0,
  TU: 1,
  WE: 2,
  TH: 3,
  FR: 4,
};

async function createEvents(auth: any, isDryRun: boolean = false) {
  const calendar = auth ? google.calendar({ version: "v3", auth }) : null;

  const startDateBase = "2026-02-16";
  const until = "20260531T235900Z";

  for (const [dayCode, subjects] of Object.entries(timetable)) {
    const offset = dayOffsets[dayCode as DayCode];
    const date = new Date(startDateBase);
    date.setDate(date.getDate() + offset);
    const currentDate = date.toISOString().split("T")[0];

    for (let i = 0; i < subjects.length; i++) {
      const subject = subjects[i];
      const teacher = teacherMap[subject] || "-";

      const [startTime, endTime] = lessonTimes[i];

      if (isDryRun) {
        console.log(
          `[DRY RUN] Would create: Date: ${currentDate} | Time: ${startTime}-${endTime} | ${subject} (${dayCode}) | Teacher: ${teacher}`,
        );
        continue;
      }

      const event: calendar_v3.Schema$Event = {
        summary: subject,
        description: `Teacher: ${teacher}\nTag: ${SCRIPT_TAG}`,
        start: {
          dateTime: `${currentDate}T${startTime}:00`,
          timeZone: "Europe/Kyiv",
        },
        end: {
          dateTime: `${currentDate}T${endTime}:00`,
          timeZone: "Europe/Kyiv",
        },
        recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=${dayCode};UNTIL=${until}`],
      };

      if (calendar) {
        await calendar.events.insert({
          calendarId: "primary",
          requestBody: event,
        });
        console.log(`Created: ${subject} (${dayCode})`);
      }
    }
  }
}

const isDryRun = process.argv.includes("--dry-run");

if (isDryRun) {
  console.log(
    "Starting DRY RUN (no events will be created, no auth required)...",
  );
  createEvents(null, true).catch(console.error);
} else {
  authorize()
    .then((auth) => createEvents(auth))
    .catch(console.error);
}
