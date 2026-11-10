import { File, Paths } from 'expo-file-system';

import type { Session } from './stats';

export const sessionsFile = new File(Paths.document, 'sessions.json');

export async function loadSessions(): Promise<Session[]> {
  if (!sessionsFile.exists) return [];
  try {
    return JSON.parse(await sessionsFile.text());
  } catch {
    return [];
  }
}

const write = (sessions: Session[]) => sessionsFile.write(JSON.stringify(sessions));

export const addSession = async (s: Session) => write([s, ...(await loadSessions())]);
export const deleteSession = async (id: string) => write((await loadSessions()).filter((s) => s.id !== id));
export const deleteAllSessions = () => sessionsFile.exists && sessionsFile.delete();
