import mongoose from 'mongoose';

// Çok dokümanlı transaction zorunlu olduğu için yalnız replica set kabul edilir.
export async function connectDatabase(uri: string): Promise<mongoose.Connection> {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  const { connection } = mongoose;

  const hello = (await connection.db?.admin().command({ hello: 1 })) as
    { setName?: string } | undefined;
  if (!hello?.setName) {
    await mongoose.disconnect();
    throw new Error('MongoDB replica set olarak çalışmıyor; transaction kullanılamaz.');
  }

  return connection;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
