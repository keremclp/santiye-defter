import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connectDatabase, disconnectDatabase } from '../src/db/connection.js';
import { testDatabaseUri } from './helpers/database.js';

describe('bellek içi replica set', () => {
  beforeAll(async () => {
    await connectDatabase(testDatabaseUri());
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await disconnectDatabase();
  });

  it('transaction tamamlanınca bütün yazılar kalıcı olur', async () => {
    const collection = mongoose.connection.collection('altyapi_deneme');

    await mongoose.connection.transaction(async (session) => {
      await collection.insertOne({ ad: 'birinci' }, { session });
      await collection.insertOne({ ad: 'ikinci' }, { session });
    });

    expect(await collection.countDocuments()).toBe(2);
  });

  it('transaction içinde hata olursa hiçbir yazı kalmaz', async () => {
    const collection = mongoose.connection.collection('altyapi_geri_alma');

    await expect(
      mongoose.connection.transaction(async (session) => {
        await collection.insertOne({ ad: 'yarim' }, { session });
        throw new Error('yarıda kesildi');
      }),
    ).rejects.toThrow('yarıda kesildi');

    expect(await collection.countDocuments()).toBe(0);
  });
});

describe('connectDatabase', () => {
  it('replica set olmayan MongoDB bağlantısını reddeder', async () => {
    const standalone = await MongoMemoryServer.create();
    try {
      await expect(connectDatabase(standalone.getUri())).rejects.toThrow(/replica set/);
      expect(mongoose.connection.readyState).toBe(mongoose.ConnectionStates.disconnected);
    } finally {
      await standalone.stop();
    }
  });
});
