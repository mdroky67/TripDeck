import { getToken } from './auth.js';
import { getDriveFileId, setDriveFileId } from '../store/db.js';
import { localDate } from '../store/schema.js';

const FILE = 'tripdeck.json';
const API = 'https://www.googleapis.com/drive/v3';
const UP  = 'https://www.googleapis.com/upload/drive/v3';

const authHeader = async () => ({ Authorization: `Bearer ${await getToken()}` });

async function jsonOrThrow(r, what) {
  if (!r.ok) throw new Error(`${what}: ${r.status} ${await r.text().catch(() => '')}`.slice(0, 200));
  return r.json();
}

export async function findFile() {
  const known = await getDriveFileId();
  if (known) {
    const r = await fetch(`${API}/files/${known}?fields=id,modifiedTime,size`, { headers: await authHeader() });
    if (r.ok) return r.json();
  }
  const q = encodeURIComponent(`name='${FILE}' and trashed=false`);
  const r = await fetch(
    `${API}/files?spaces=appDataFolder&q=${q}&fields=files(id,modifiedTime,size)&pageSize=1`,
    { headers: await authHeader() });
  const { files } = await jsonOrThrow(r, 'ফাইল খোঁজা');
  const f = files?.[0] || null;
  if (f) await setDriveFileId(f.id);
  return f;
}

export async function download(id) {
  const r = await fetch(`${API}/files/${id}?alt=media`, { headers: await authHeader() });
  return jsonOrThrow(r, 'ডাউনলোড');
}

export async function upload(docObj, id, name = FILE) {
  const meta = id ? {} : { name, parents: ['appDataFolder'] };
  const body = new FormData();
  body.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
  body.append('file', new Blob([JSON.stringify(docObj)], { type: 'application/json' }));
  const url = id ? `${UP}/files/${id}?uploadType=multipart&fields=id,modifiedTime`
                 : `${UP}/files?uploadType=multipart&fields=id,modifiedTime`;
  const r = await fetch(url, { method: id ? 'PATCH' : 'POST', headers: await authHeader(), body });
  const out = await jsonOrThrow(r, 'আপলোড');
  if (out.id) await setDriveFileId(out.id);
  return out;
}

export async function listBackups() {
  const q = encodeURIComponent(`name contains 'tripdeck-backup-' and trashed=false`);
  const r = await fetch(`${API}/files?spaces=appDataFolder&q=${q}&fields=files(id,name,modifiedTime,size)&orderBy=name desc`,
    { headers: await authHeader() });
  const { files } = await jsonOrThrow(r, 'ব্যাকআপ তালিকা');
  return files || [];
}

export async function remove(id) {
  await fetch(`${API}/files/${id}`, { method: 'DELETE', headers: await authHeader() });
}

/** Once a day: keep the last seven backups, drop the rest */
export async function rotateBackups(docObj) {
  const stamp = localDate().replace(/-/g, '');
  const name = `tripdeck-backup-${stamp}.json`;
  const existing = await listBackups();
  if (existing.some((f) => f.name === name)) return;
  await upload(docObj, null, name);
  const all = (await listBackups()).sort((a, b) => b.name.localeCompare(a.name));
  for (const f of all.slice(7)) await remove(f.id);
}

export async function usage() {
  const f = await findFile();
  const backups = await listBackups().catch(() => []);
  return { file: f, backups: backups.length, bytes: Number(f?.size || 0) };
}
