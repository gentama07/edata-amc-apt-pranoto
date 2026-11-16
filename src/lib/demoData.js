import { airportDate } from './time';

const today = airportDate();
const make = (id, values) => ({ id, date: today, operator: 'Wings Air', aircraftType: 'ATR72-600', registration: 'PK-WJL', origin: 'BPN (Balikpapan)', destination: 'AAP (Samarinda)', handler: 'Gapura Angkasa', stand: 'Stand 2', riu: 'Domestik', paxArr: 62, paxDep: 59, baggageKg: 410, cargoKg: 120, remark: '', ...values });

export const initialMovements = [
  make('demo-1', { flightArr: 'IW-1368', flightDep: 'IW-1369', sta: '06:25', ata: '06:38', blockOn: '06:44', std: '07:10', blockOff: '07:12', atd: '07:20', registration: 'PK-WJL', stand: 'Stand 2', remark: 'Rotasi pagi, boarding tepat waktu.' }),
  make('demo-2', { operator: 'Batik Air', aircraftType: 'A320', registration: 'PK-LUV', flightArr: 'ID-6674', flightDep: 'ID-6675', origin: 'CGK (Jakarta)', destination: 'AAP (Samarinda)', sta: '08:10', ata: '08:54', blockOn: '09:02', std: '09:35', blockOff: '09:41', atd: '09:48', stand: 'Stand 1', paxArr: 148, paxDep: 141, baggageKg: 1180, cargoKg: 260, remark: 'Kedatangan tertunda karena cuaca.' }),
  make('demo-3', { operator: 'Susi Air', aircraftType: 'C208B (Grand Caravan)', registration: 'PK-BVM', flightArr: 'SI-734', flightDep: '', origin: 'Datah Dawai', destination: 'AAP (Samarinda)', sta: '10:15', ata: '10:09', blockOn: '10:15', std: '', blockOff: '', atd: '', stand: 'Stand 4', paxArr: 9, paxDep: 0, baggageKg: 42, cargoKg: 18, remark: 'Standby menunggu cuaca.' }),
  make('demo-4', { operator: 'Super Air Jet', aircraftType: 'A320', registration: 'PK-SAW', flightArr: 'IU-654', flightDep: 'IU-655', origin: 'SUB (Surabaya)', destination: 'AAP (Samarinda)', sta: '12:30', ata: '12:26', blockOn: '12:33', std: '13:15', blockOff: '13:18', atd: '13:27', stand: 'Stand 3', paxArr: 162, paxDep: 157, baggageKg: 1360, cargoKg: 190 }),
  make('demo-5', { operator: 'Smart Aviation', aircraftType: 'C208B (Grand Caravan)', registration: 'PK-SNA', flightArr: 'SI-211', flightDep: '', origin: 'AAP (Samarinda)', destination: 'Melak', sta: '14:20', ata: '14:16', blockOn: '14:23', std: '', blockOff: '', atd: '', stand: 'Stand 5', paxArr: 7, paxDep: 0, baggageKg: 25, cargoKg: 32 }),
];

export const initialLetters = [
  { id: 'letter-1', reference: 'UM.208/07/04/AMC-2026', date: today, sender: 'Kantor Otoritas Bandar Udara Wilayah VII', subject: 'Penyampaian laporan kegiatan apron', status: 'Perlu ditindaklanjuti', fileName: 'surat-kegiatan-apron.pdf', driveFileId: '' },
  { id: 'letter-2', reference: 'AMC/OPS/118/XI/2026', date: today, sender: 'AirNav Indonesia Samarinda', subject: 'Koordinasi perubahan jadwal operasi', status: 'Diarsipkan', fileName: '', driveFileId: '' },
];
