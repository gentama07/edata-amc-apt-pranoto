export const AIRPORT_TZ = 'Asia/Makassar';

export function airportDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en', { timeZone: AIRPORT_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function formatWita(date = new Date(), includeDate = true) {
  const clock = new Intl.DateTimeFormat('en-GB', { timeZone: AIRPORT_TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const values = Object.fromEntries(clock.map(part => [part.type, part.value]));
  const time = `${values.hour}:${values.minute}:${values.second}`;
  const day = new Intl.DateTimeFormat('id-ID', { timeZone: AIRPORT_TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  return includeDate ? `${time} WITA · ${day}` : `${time} WITA`;
}

export function minutesOf(value) {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(':').map(Number);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function validMovementTimes(data) {
  const errors = {};
  const sta = minutesOf(data.sta);
  const ata = minutesOf(data.ata);
  const blockOn = minutesOf(data.blockOn);
  const std = minutesOf(data.std);
  const blockOff = minutesOf(data.blockOff);
  const atd = minutesOf(data.atd);
  for (const [key, value] of Object.entries({ sta: data.sta, ata: data.ata, blockOn: data.blockOn, std: data.std, blockOff: data.blockOff, atd: data.atd })) {
    if (value && minutesOf(value) === null) errors[key] = 'Gunakan format jam 00:00–23:59.';
  }
  const pairs = [['ata', ata, 'sta', sta], ['blockOn', blockOn, 'ata', ata], ['blockOff', blockOff, 'blockOn', blockOn], ['atd', atd, 'std', std]];
  for (const [laterKey, later, earlierKey, earlier] of pairs) {
    if (later !== null && earlier !== null) {
      const elapsed = later - earlier < -12 * 60 ? later - earlier + 24 * 60 : later - earlier;
      if (elapsed < 0) errors[laterKey] = `Waktu ${laterKey} tidak boleh lebih awal dari ${earlierKey}.`;
    }
  }
  return errors;
}

export function monthDays(dateString) {
  const [year, month] = dateString.split('-').map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function formatDateLong(dateString) {
  const date = new Date(`${dateString}T12:00:00+08:00`);
  return new Intl.DateTimeFormat('id-ID', { timeZone: AIRPORT_TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}
