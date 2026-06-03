import {
  AuthenticationState,
  SignalDataTypeMap,
  initAuthCreds,
  BufferJSON,
} from '@whiskeysockets/baileys';
import { Repository } from 'typeorm';
import { WhatsappSession } from '../../database/entities/whatsapp-session.entity';
import { encrypt, decrypt } from '../../shared/utils/crypto.util';

export async function usePostgresAuthState(
  tenantId: string,
  repo: Repository<WhatsappSession>,
  encryptionKey: string,
): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> {
  const session = await repo.findOne({ where: { tenantId } });

  let creds: ReturnType<typeof initAuthCreds>;
  let keys: Record<string, any> = {};

  if (session?.authState) {
    try {
      const decrypted = decrypt(session.authState, encryptionKey);
      const parsed = JSON.parse(decrypted, BufferJSON.reviver);
      creds = parsed.creds;
      keys = parsed.keys ?? {};
    } catch {
      creds = initAuthCreds();
      keys = {};
    }
  } else {
    creds = initAuthCreds();
    keys = {};
  }

  const persist = async () => {
    const serialized = JSON.stringify({ creds, keys }, BufferJSON.replacer);
    const encrypted = encrypt(serialized, encryptionKey);
    await repo.update({ tenantId }, { authState: encrypted });
  };

  return {
    state: {
      creds,
      keys: {
        get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
          const result: { [id: string]: SignalDataTypeMap[T] } = {};
          for (const id of ids) {
            const val = keys[`${type}-${id}`];
            if (val !== undefined) result[id] = val;
          }
          return result;
        },
        set: async (data: Partial<{ [T in keyof SignalDataTypeMap]: { [id: string]: SignalDataTypeMap[T] } }>) => {
          for (const [type, entries] of Object.entries(data)) {
            for (const [id, val] of Object.entries(entries ?? {})) {
              const key = `${type}-${id}`;
              if (val != null) {
                keys[key] = val;
              } else {
                delete keys[key];
              }
            }
          }
          await persist();
        },
      },
    },
    saveCreds: persist,
  };
}
