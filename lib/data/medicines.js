import { v4 as uuidv4 } from 'uuid';

// Acesso aos dados de medicamentos e do histórico ("medicines" e "history").
// Quem é "dono" do dado decide a consulta: quem está numa família enxerga os
// medicamentos da família; quem não está, só os próprios (scopeFilter).

const COL = 'medicines';
const HIST = 'history';

const PERSONAL = [{ family_id: null }, { family_id: { $exists: false } }];

/** Filtro de visibilidade: { family_id } para quem está em família, senão só os da própria pessoa. */
export function scopeFilter(user) {
  return user.family_id
    ? { family_id: user.family_id }
    : { user_email: user.email, $or: PERSONAL };
}

// ---------- medicamentos ----------

/** Do mais novo para o mais antigo. `extra` acrescenta filtros (ex.: { categoria }). */
export const listMedicines = (db, user, extra = {}) =>
  db.collection(COL).find({ ...scopeFilter(user), ...extra }).sort({ created_at: -1 }).toArray();

export const listMedicineIds = async (db, user) =>
  (await db.collection(COL).find(scopeFilter(user)).project({ id: 1 }).toArray()).map(m => m.id);

export const findMedicine = (db, user, id) => db.collection(COL).findOne({ id, ...scopeFilter(user) });

export const findMedicineByBarcode = (db, user, code) =>
  db.collection(COL).findOne({ ...scopeFilter(user), codigo_barras: code });

export const insertMedicine = (db, doc) => db.collection(COL).insertOne(doc);

/** `unset` (opcional) lista campos a remover. */
export const updateMedicine = (db, user, id, set, unset) =>
  db.collection(COL).updateOne({ id, ...scopeFilter(user) }, unset ? { $set: set, $unset: unset } : { $set: set });

export const deleteMedicine = (db, user, id) => db.collection(COL).deleteOne({ id, ...scopeFilter(user) });

/** Ao criar uma família, os medicamentos pessoais de quem criou passam a ser dela. */
export const moveMedicinesToFamily = (db, email, familyId) =>
  db.collection(COL).updateMany({ user_email: email, $or: PERSONAL }, { $set: { family_id: familyId } });

/** Ao desfazer a família, os medicamentos voltam a ser pessoais. */
export const releaseFamilyMedicines = (db, familyId) =>
  db.collection(COL).updateMany({ family_id: familyId }, { $set: { family_id: null } });

export const deleteMedicinesOf = (db, email) => db.collection(COL).deleteMany({ user_email: email });

// ---------- histórico ----------

/** Registra um evento do histórico (id e data são gerados aqui, a menos que venham em `entry`). */
export const logHistory = (db, entry) =>
  db.collection(HIST).insertOne({ id: uuidv4(), created_at: new Date().toISOString(), ...entry });

export const historyOf = (db, medicineId) =>
  db.collection(HIST).find({ medicine_id: medicineId }).sort({ created_at: -1 }).toArray();

export const deleteHistoryOf = (db, email) => db.collection(HIST).deleteMany({ user_email: email });

export const doseLogsForDay = (db, medicineIds, date) =>
  medicineIds.length
    ? db.collection(HIST).find({ medicine_id: { $in: medicineIds }, action: 'dose_taken', dose_date: date }).toArray()
    : Promise.resolve([]);

export const findDoseTaken = (db, medicineId, date, time) =>
  db.collection(HIST).findOne({ medicine_id: medicineId, action: 'dose_taken', dose_date: date, dose_time: time });
