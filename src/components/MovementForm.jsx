import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Clock3, PlaneTakeoff, Scale } from 'lucide-react';
import { airportOptions } from '../config/airportOptions';
import { validMovementTimes } from '../lib/time';
import { PageHeading } from './Shell';

const blank = date => ({ date, operator: '', aircraftType: '', registration: '', flightArr: '', flightDep: '', origin: '', destination: '', handler: '', stand: '', riu: 'Domestik', sta: '', ata: '', blockOn: '', std: '', blockOff: '', atd: '', paxArr: '', paxDep: '', baggageArrKg: '', baggageDepKg: '', cargoArrKg: '', cargoDepKg: '', remark: '' });

function Field({ label, name, children, required, hint, error }) {
  return <div className="field"><label htmlFor={name}>{label}{required && <span className="required-mark"> *</span>}</label>{children}{hint && <small className="field-hint">{hint}</small>}{error && <small className="field-error">{error}</small>}</div>;
}
const select = (name, value, onChange, options, placeholder) => <select id={name} name={name} value={value || ''} onChange={onChange}><option value="">{placeholder || 'Pilih opsi'}</option>{options.map(option => <option key={option} value={option}>{option}</option>)}</select>;
const input = (name, value, onChange, type = 'text', props = {}) => <input id={name} name={name} type={type} value={value ?? ''} onChange={onChange} {...props} />;

export default function MovementForm({ date, initial, onCancel, onSave, setError }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(() => initial ? { ...blank(date), ...initial } : blank(date));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { setForm(initial ? { ...blank(date), ...initial } : blank(date)); setStep(0); setErrors({}); }, [initial, date]);
  const update = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }));

  const validateStep = () => {
    const next = {};
    if (step === 0) {
      if (!form.date) next.date = 'Tanggal operasional wajib diisi.';
      if (!form.operator) next.operator = 'Operator wajib dipilih.';
      if (!form.aircraftType) next.aircraftType = 'Tipe pesawat wajib dipilih.';
      if (!form.registration.trim()) next.registration = 'Registrasi pesawat wajib diisi.';
      if (!form.flightArr.trim() && !form.flightDep.trim()) next.flightArr = 'Isi nomor penerbangan ARR, DEP, atau keduanya.';
      if (!form.stand) next.stand = 'Parking stand wajib dipilih.';
    }
    if (step === 1) Object.assign(next, validMovementTimes(form));
    if (step === 2) {
      for (const field of ['paxArr', 'paxDep', 'baggageArrKg', 'baggageDepKg', 'cargoArrKg', 'cargoDepKg']) if (form[field] !== '' && (!Number.isFinite(Number(form[field])) || Number(form[field]) < 0)) next[field] = 'Isi angka nol atau lebih.';
    }
    setErrors(next);
    if (Object.keys(next).length) requestAnimationFrame(() => document.getElementById(Object.keys(next)[0])?.focus());
    return Object.keys(next).length === 0;
  };
  const save = async event => {
    event.preventDefault(); if (!validateStep()) return;
    if (step < 2) { setStep(step + 1); return; }
    setSaving(true);
    try { await onSave({ ...form, paxArr: Number(form.paxArr || 0), paxDep: Number(form.paxDep || 0), baggageArrKg: Number(form.baggageArrKg || 0), baggageDepKg: Number(form.baggageDepKg || 0), cargoArrKg: Number(form.cargoArrKg || 0), cargoDepKg: Number(form.cargoDepKg || 0) }); onCancel(); }
    catch (error) { setError(error.message || 'Data tidak dapat disimpan.'); }
    finally { setSaving(false); }
  };
  const steps = ['Data penerbangan', 'Waktu operasional', 'Muatan & remark'];
  return <div className="form-page">
    <PageHeading eyebrow={initial ? 'PERUBAHAN PERGERAKAN' : 'PENCATATAN OPERASIONAL'} title={initial ? 'Ubah data pergerakan' : 'Input data pergerakan'} description="Lengkapi informasi penerbangan dalam tiga langkah." action={<button className="button-secondary" onClick={onCancel}><ArrowLeft size={16} />Kembali ke log</button>} />
    <section className="panel wizard-panel">
      <div className="wizard-progress" aria-label={`Langkah ${step + 1} dari 3`}>{steps.map((label, index) => <div className={`wizard-step ${index < step ? 'wizard-done' : ''} ${index === step ? 'wizard-current' : ''}`} key={label}><span className="wizard-number">{index < step ? <Check size={14} /> : index + 1}</span><span>{label}</span></div>)}</div>
      <form onSubmit={save} noValidate>
        {step === 0 && <div className="wizard-content"><div className="form-section-intro"><div className="flight-icon"><PlaneTakeoff size={21} aria-hidden="true" /></div><div><h2>Data penerbangan</h2><p>Identitas pesawat, rute, dan penempatan di apron.</p></div></div><div className="form-grid form-grid-3">
          <Field label="Tanggal operasional" name="date" required>{input('date', form.date, update, 'date', { required: true })}</Field>
          <Field label="Operator" name="operator" required error={errors.operator}>{select('operator', form.operator, update, airportOptions.operators)}</Field>
          <Field label="Tipe pesawat" name="aircraftType" required error={errors.aircraftType}>{select('aircraftType', form.aircraftType, update, airportOptions.aircraftTypes)}</Field>
          <Field label="Registrasi" name="registration" required error={errors.registration}>{input('registration', form.registration, update, 'text', { placeholder: 'Contoh: PK-WJL', autoComplete: 'off' })}</Field>
          <Field label="Nomor penerbangan ARR" name="flightArr" error={errors.flightArr}>{input('flightArr', form.flightArr, update, 'text', { placeholder: 'Contoh: IW-1368' })}</Field>
          <Field label="Nomor penerbangan DEP" name="flightDep">{input('flightDep', form.flightDep, update, 'text', { placeholder: 'Contoh: IW-1369' })}</Field>
          <Field label="Origin" name="origin">{select('origin', form.origin, update, airportOptions.routes)}</Field>
          <Field label="Destination" name="destination">{select('destination', form.destination, update, airportOptions.routes)}</Field>
          <Field label="Ground handling" name="handler">{select('handler', form.handler, update, airportOptions.handlers)}</Field>
          <Field label="Parking stand" name="stand" required error={errors.stand}>{select('stand', form.stand, update, airportOptions.stands)}</Field>
          <Field label="RIU" name="riu">{select('riu', form.riu, update, airportOptions.riu)}</Field>
        </div></div>}
        {step === 1 && <div className="wizard-content"><div className="form-section-intro"><div className="flight-icon"><Clock3 size={20} aria-hidden="true" /></div><div><h2>Waktu operasional</h2><p>Masukkan waktu rencana dan aktual dalam WITA.</p></div></div><div className="form-grid form-grid-3">
          {[['sta','STA'],['ata','ATA'],['blockOn','Block ON'],['std','STD'],['blockOff','Block OFF'],['atd','ATD']].map(([name,label]) => <Field key={name} label={`${label} · WITA`} name={name} error={errors[name]} hint={name === 'blockOff' && form.blockOn && !form.blockOff ? 'Kosongkan jika pesawat masih on-block.' : undefined}><span className="time-input-control">{input(name, form[name], update, 'time', { readOnly: !['sta','std'].includes(name) })}{!['sta','std'].includes(name) && <button type="button" className="time-now-button" aria-label={`Isi ${label} dengan waktu saat ini WITA`} onClick={() => setForm(current => ({ ...current, [name]: new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()) }))}><Clock3 size={14} />Waktu sekarang</button>}</span></Field>)}
        </div><div className="form-note"><ClockIcon /> Waktu harus berurutan: rencana, aktual, lalu Block ON/OFF. Block OFF dapat dikosongkan jika pesawat masih berada di apron.</div></div>}
        {step === 2 && <div className="wizard-content"><div className="form-section-intro"><div className="flight-icon"><Scale size={20} aria-hidden="true" /></div><div><h2>Muatan & remark</h2><p>Catat jumlah penumpang, berat barang, dan catatan lapangan.</p></div></div><div className="form-grid form-grid-2">
          <Field label="Penumpang datang (ARR)" name="paxArr" error={errors.paxArr}>{input('paxArr', form.paxArr, update, 'number', { min: 0, step: 1, placeholder: '0' })}</Field>
          <Field label="Penumpang berangkat (DEP)" name="paxDep" error={errors.paxDep}>{input('paxDep', form.paxDep, update, 'number', { min: 0, step: 1, placeholder: '0' })}</Field>
          <Field label="Bagasi datang (ARR · kg)" name="baggageArrKg" error={errors.baggageArrKg}>{input('baggageArrKg', form.baggageArrKg, update, 'number', { min: 0, step: '0.1', placeholder: '0' })}</Field>
          <Field label="Bagasi berangkat (DEP · kg)" name="baggageDepKg" error={errors.baggageDepKg}>{input('baggageDepKg', form.baggageDepKg, update, 'number', { min: 0, step: '0.1', placeholder: '0' })}</Field>
          <Field label="Kargo datang (ARR · kg)" name="cargoArrKg" error={errors.cargoArrKg}>{input('cargoArrKg', form.cargoArrKg, update, 'number', { min: 0, step: '0.1', placeholder: '0' })}</Field>
          <Field label="Kargo berangkat (DEP · kg)" name="cargoDepKg" error={errors.cargoDepKg}>{input('cargoDepKg', form.cargoDepKg, update, 'number', { min: 0, step: '0.1', placeholder: '0' })}</Field>
          <Field label="Remark operasional" name="remark" hint="Catat kondisi apron, keterlambatan, atau informasi penting lainnya."><textarea id="remark" name="remark" value={form.remark} onChange={update} rows={4} placeholder="Tulis catatan operasional…" /></Field>
        </div><div className="review-strip"><span>RINGKASAN</span><strong>{form.operator || 'Operator belum dipilih'} · {form.registration || 'Registrasi belum diisi'}</strong><small>{form.flightArr || '—'} / {form.flightDep || '—'} · {form.stand || 'Stand belum dipilih'}</small></div></div>}
        <div className="wizard-actions">{step > 0 ? <button type="button" className="button-secondary" onClick={() => { setErrors({}); setStep(step - 1); }}><ArrowLeft size={16} />Langkah sebelumnya</button> : <span className="required-note"><span className="required-mark">*</span> Wajib diisi</span>}<button type="submit" className="button-primary" disabled={saving}>{saving ? 'Menyimpan…' : step === 2 ? <><Check size={16} />Simpan pergerakan</> : <>Lanjutkan<ArrowRight size={16} /></>}</button></div>
      </form>
    </section>
  </div>;
}

function ClockIcon() { return <Clock3 size={16} aria-hidden="true" className="note-clock" />; }
