const columns = [
  ['date', 'Tanggal'], ['operator', 'Operator'], ['aircraftType', 'Tipe Pesawat'], ['registration', 'Registrasi'],
  ['flightArr', 'No. Penerbangan ARR'], ['flightDep', 'No. Penerbangan DEP'], ['origin', 'Origin'], ['destination', 'Destination'],
  ['sta', 'STA'], ['ata', 'ATA'], ['blockOn', 'Block ON'], ['std', 'STD'], ['blockOff', 'Block OFF'], ['atd', 'ATD'],
  ['handler', 'Ground Handling'], ['stand', 'Parking Stand'], ['riu', 'RIU'], ['paxArr', 'Penumpang ARR'], ['paxDep', 'Penumpang DEP'],
  ['baggageArrKg', 'Bagasi ARR (kg)'], ['baggageDepKg', 'Bagasi DEP (kg)'], ['cargoArrKg', 'Kargo ARR (kg)'], ['cargoDepKg', 'Kargo DEP (kg)'], ['remark', 'Remark'],
];

export function safeCsvCell(value) {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function toCsv(rows, schema = columns) {
  return [schema.map(([, label]) => safeCsvCell(label)).join(','), ...rows.map(row => schema.map(([key]) => safeCsvCell(row[key])).join(','))].join('\r\n');
}

export function downloadCsv(rows, filename = 'log-pergerakan.csv', schema = columns) {
  const blob = new Blob(['\uFEFF', toCsv(rows, schema)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}
