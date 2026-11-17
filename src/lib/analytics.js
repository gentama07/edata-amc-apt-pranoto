import { minutesOf } from './time.js';

export function getDirection(row) {
  if (row.flightArr && row.flightDep) return 'turnaround';
  if (row.flightArr) return 'arr';
  if (row.flightDep) return 'dep';
  return 'other';
}

export function dailyKpis(rows) {
  return rows.reduce((sum, row) => {
    sum.arr += Number(Boolean(row.flightArr));
    sum.dep += Number(Boolean(row.flightDep));
    sum.paxArr += Number(row.paxArr || 0);
    sum.paxDep += Number(row.paxDep || 0);
    sum.baggage += Number(row.baggageArrKg ?? row.baggageKg ?? 0) + Number(row.baggageDepKg || 0);
    sum.cargo += Number(row.cargoArrKg ?? row.cargoKg ?? 0) + Number(row.cargoDepKg || 0);
    return sum;
  }, { arr: 0, dep: 0, paxArr: 0, paxDep: 0, baggage: 0, cargo: 0 });
}

export function monthlyTraffic(rows, dateString) {
  const [year, month] = dateString.split('-');
  const map = new Map();
  for (const row of rows.filter(item => item.date?.startsWith(`${year}-${month}`))) {
    const day = Number(row.date.slice(-2));
    const value = map.get(day) || { day, arr: 0, dep: 0 };
    value.arr += Number(Boolean(row.flightArr));
    value.dep += Number(Boolean(row.flightDep));
    map.set(day, value);
  }
  return [...map.values()].sort((a, b) => a.day - b.day);
}

export function parkingIntervals(rows, selectedDate, now = new Date()) {
  return rows.filter(row => row.date === selectedDate && row.blockOn).map(row => {
    const start = minutesOf(row.blockOn);
    let end = minutesOf(row.blockOff);
    if (end === null) {
      const current = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit', hour12: false }).format(now).replace(':', ''));
      end = Math.max(start + 20, Math.floor(current / 100) * 60 + current % 100);
    }
    if (end < start) end += 24 * 60;
    return { ...row, start, end: Math.min(end, 24 * 60), ongoing: !row.blockOff };
  });
}

export function hourlyOccupancy(rows, selectedDate) {
  return Array.from({ length: 24 }, (_, hour) => {
    const count = rows.filter(row => {
      if (row.date !== selectedDate || !row.blockOn) return false;
      const start = minutesOf(row.blockOn);
      let end = minutesOf(row.blockOff);
      if (end === null) end = 24 * 60;
      if (end < start) end += 24 * 60;
      return start < (hour + 1) * 60 && end > hour * 60;
    }).length;
    return { hour, count };
  });
}

export function alertsForDay(rows, selectedDate) {
  const daily = rows.filter(row => row.date === selectedDate);
  const alerts = [];
  for (const row of daily) {
    const sta = minutesOf(row.sta);
    const ata = minutesOf(row.ata);
    if (sta !== null && ata !== null) {
      const rawDelay = ata - sta;
      const delay = rawDelay < -12 * 60 ? rawDelay + 24 * 60 : rawDelay;
      if (delay > 30) alerts.push({ type: 'delay', title: `Kedatangan terlambat ${delay} menit`, detail: `${row.flightArr || 'Penerbangan'} · ${row.registration || 'Registrasi belum diisi'}` });
    }
  }
  for (const hour of hourlyOccupancy(rows, selectedDate)) {
    if (hour.count >= 4) { alerts.push({ type: 'density', title: 'Apron padat', detail: `${hour.count} pesawat berada di apron sekitar pukul ${String(hour.hour).padStart(2, '0')}:00 WITA` }); break; }
  }
  return alerts;
}
