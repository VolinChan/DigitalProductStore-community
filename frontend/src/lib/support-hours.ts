// A weekly schedule, not live agent availability or a public-holiday calendar.
const santiagoClock = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Santiago', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function isWithinSupportHours(now: Date): boolean {
  const parts = santiagoClock.formatToParts(now);
  const weekday = parts.find((part) => part.type === 'weekday')?.value;
  const minutes = Number(parts.find((part) => part.type === 'hour')?.value) * 60
    + Number(parts.find((part) => part.type === 'minute')?.value);
  if (weekday === 'Sat') return minutes >= 630 && minutes < 930;
  if (weekday && ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(weekday)) return minutes >= 600 && minutes < 1050;
  return false;
}
