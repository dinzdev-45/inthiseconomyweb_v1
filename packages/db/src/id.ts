import { v7 as uuidv7 } from 'uuid';

/** Returns a new UUIDv7: time-ordered for index locality, non-sequential to clients. */
export function newId(): string {
  return uuidv7();
}
