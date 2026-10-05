import { badRequest, ApiError } from '../errors';

const CALENDAR_ENDPOINT =
  'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1';

/** Only links on these hosts are ever stored as a lesson's meeting link. */
const ALLOWED_MEET_HOSTS = new Set([
  'meet.google.com',
  'meet.jit.si',
]);

/**
 * Validate a meeting URL before it is persisted or rendered into an `href`.
 *
 * `meet_link` used to be written straight through and rendered as a link the
 * counterpart clicks, which made it a phishing primitive (and, depending on
 * the React version, a `javascript:` sink).
 */
export function assertSafeMeetLink(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw badRequest('Meeting link is not a valid URL.');
  }
  if (url.protocol !== 'https:') {
    throw badRequest('Meeting link must use https.');
  }
  if (!ALLOWED_MEET_HOSTS.has(url.hostname)) {
    throw badRequest('Meeting link host is not allowed.');
  }
  return url.toString();
}

/**
 * Create a Google Calendar event with a Meet link attached.
 *
 * Runs on the server: the Google access token arrives in the request from the
 * signed-in user's OAuth session and is used once, here, rather than being
 * held in browser state across the session.
 */
export async function createMeetEvent({
  token,
  lessonId,
  summary,
  description,
  date,
  time,
  durationMin = 60,
  timeZone = 'Europe/Vilnius',
  attendeeEmails = [],
}) {
  if (!token) throw badRequest('Missing Google authorisation.');
  if (!lessonId || !date || !time) throw badRequest('Missing event fields.');

  const startISO = `${date}T${time.length === 5 ? `${time}:00` : time}`;
  const endDate = new Date(startISO);
  if (Number.isNaN(endDate.getTime())) throw badRequest('Invalid lesson date or time.');
  endDate.setMinutes(endDate.getMinutes() + durationMin);

  const pad = (n) => String(n).padStart(2, '0');
  const endISO =
    `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}` +
    `T${pad(endDate.getHours())}:${pad(endDate.getMinutes())}:00`;

  const response = await fetch(CALENDAR_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      summary,
      description,
      start: { dateTime: startISO, timeZone },
      end: { dateTime: endISO, timeZone },
      attendees: attendeeEmails.filter(Boolean).map((email) => ({ email })),
      conferenceData: {
        createRequest: {
          requestId: lessonId,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
      guestsCanInviteOthers: false,
      guestsCanModify: false,
    }),
  });

  if (!response.ok) {
    // Google's body can echo request details; log it, don't forward it.
    const detail = await response.text().catch(() => '');
    console.error('[calendar] Google API error', response.status, detail);
    throw new ApiError(
      502,
      'calendar_failed',
      'Could not create the Google Meet link.',
    );
  }

  const data = await response.json();
  const rawLink =
    data.hangoutLink ??
    data.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri ??
    null;

  return {
    meetLink: rawLink ? assertSafeMeetLink(rawLink) : null,
    eventId: data.id ?? null,
  };
}
