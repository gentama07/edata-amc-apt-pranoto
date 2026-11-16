import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyKpis, alertsForDay, hourlyOccupancy } from '../src/lib/analytics.js';
import { airportDate, formatWita, validMovementTimes, minutesOf } from '../src/lib/time.js';
import { safeCsvCell, toCsv } from '../src/lib/csv.js';

const row = (id, values = {}) => ({ id, date: '2026-11-16', flightArr: '', flightDep: '', paxArr: 0, paxDep: 0, baggageKg: 0, cargoKg: 0, blockOn: '', blockOff: '', sta: '', ata: '', ...values });

test('daily KPI counts movement legs and sums passenger and cargo data', () => {
  const result = dailyKpis([
    row('one', { flightArr: 'IW-100', flightDep: 'IW-101', paxArr: 60, paxDep: 57, baggageKg: 400, cargoKg: 110 }),
    row('two', { flightArr: 'SI-200', paxArr: 8, baggageKg: 12 }),
  ]);
  assert.deepEqual(result, { arr: 2, dep: 1, paxArr: 68, paxDep: 57, baggage: 412, cargo: 110 });
});

test('time validation accepts valid values and rejects invalid order or clock values', () => {
  assert.equal(minutesOf('23:59'), 1439);
  assert.equal(minutesOf('24:00'), null);
  assert.deepEqual(validMovementTimes({ sta: '08:00', ata: '08:20', blockOn: '09:00', std: '09:10', blockOff: '08:50', atd: '' }), { blockOff: 'Waktu blockOff tidak boleh lebih awal dari blockOn.' });
  assert.deepEqual(validMovementTimes({ sta: '23:40', ata: '00:20', blockOn: '00:27', std: '', blockOff: '', atd: '' }), {});
});

test('airport clock uses Asia/Makassar and the requested HH:mm:ss WITA format', () => {
  assert.match(airportDate(new Date('2026-11-16T00:30:00Z')), /^2026-11-16$/);
  assert.match(formatWita(new Date('2026-11-16T00:30:00Z'), false), /^08:\d{2}:\d{2} WITA$/);
});

test('hourly occupancy includes on-block aircraft and excludes a completed aircraft', () => {
  const result = hourlyOccupancy([
    row('a', { blockOn: '06:20', blockOff: '08:10' }),
    row('b', { blockOn: '07:00', blockOff: '' }),
    row('other-day', { date: '2026-11-15', blockOn: '07:00' }),
  ], '2026-11-16');
  assert.equal(result[5].count, 0);
  assert.equal(result[6].count, 1);
  assert.equal(result[7].count, 2);
  assert.equal(result[8].count, 2);
  assert.equal(result[9].count, 1);
});

test('automatic alert flags ATA more than 30 minutes after STA and apron density of four', () => {
  const rows = [
    row('a', { registration: 'PK-A', flightArr: 'IW-1', sta: '08:00', ata: '08:31', blockOn: '08:35', blockOff: '10:00' }),
    row('b', { blockOn: '08:30', blockOff: '10:00' }),
    row('c', { blockOn: '08:40', blockOff: '10:00' }),
    row('d', { blockOn: '08:50', blockOff: '10:00' }),
  ];
  const alerts = alertsForDay(rows, '2026-11-16');
  assert.equal(alerts.length, 2);
  assert.match(alerts[0].title, /terlambat 31 menit/);
  assert.match(alerts[1].title, /Apron padat/);
  const overnight = alertsForDay([row('late', { registration: 'PK-NGT', flightArr: 'IW-2', sta: '23:45', ata: '00:20' })], '2026-11-16');
  assert.match(overnight[0].title, /terlambat 35 menit/);
});

test('CSV cells escape formula prefixes and double embedded quotes', () => {
  assert.equal(safeCsvCell('=HYPERLINK("https://evil.example")'), `"'=HYPERLINK(""https://evil.example"")"`);
  assert.equal(safeCsvCell('+1+1'), `"'+1+1"`);
  assert.equal(safeCsvCell('Normal "remark"'), `"Normal ""remark"""`);
  assert.match(toCsv([row('safe', { registration: '@SUM(1,1)' })]), /'@SUM/);
  assert.equal(toCsv([{ date: '2026-11-16', arr: 2 }], [['date', 'Tanggal'], ['arr', 'Kedatangan ARR']]), '"Tanggal","Kedatangan ARR"\r\n"2026-11-16","2"');
});
