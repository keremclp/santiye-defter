import { Router } from 'express';
import { model, Schema, Types } from 'mongoose';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  companyScopedPlugin,
  forCompany,
  type CompanyScopedFields,
} from '../src/db/company-scope.js';
import { requireCustomer, routeParam } from '../src/http/request-context.js';
import { sendSuccess } from '../src/http/respond.js';
import { customerAuth } from '../src/middleware/auth.js';
import { buildTestApp, useTestDatabase } from './helpers/app.js';
import { expectCompanyIsolation } from './helpers/isolation.js';

useTestDatabase();

// Yalnız test için firma kapsamlı örnek model.
interface Note extends CompanyScopedFields {
  _id: Types.ObjectId;
  text: string;
}
const noteSchema = new Schema<Note>({ text: { type: String, required: true } });
noteSchema.plugin(companyScopedPlugin);
const NoteModel = model<Note>('TestNote', noteSchema);

const companyA = new Types.ObjectId();
const companyB = new Types.ObjectId();
const userA = new Types.ObjectId();

beforeEach(async () => {
  await NoteModel.init();
  await NoteModel.collection.deleteMany({});
});

describe('companyScopedPlugin', () => {
  it('ortak alanları ekler: companyId, silme, oluşturan/güncelleyen, geçmiş, zamanlar', async () => {
    const note = await forCompany(NoteModel, companyA).create({ text: 'not' }, userA);
    expect(note.toObject()).toMatchObject({
      companyId: companyA,
      deletedAt: null,
      deletedBy: null,
      deleteReason: null,
      createdBy: userA,
      updatedBy: userA,
      history: [],
    });
    expect(note.createdAt).toBeInstanceOf(Date);
  });

  it('companyId filtresi olmayan sorguları reddeder', async () => {
    const message = /companyId filtresi olmadan/;
    await expect(NoteModel.find({})).rejects.toThrow(message);
    await expect(NoteModel.findById(new Types.ObjectId())).rejects.toThrow(message);
    await expect(NoteModel.countDocuments({ text: 'x' })).rejects.toThrow(message);
    await expect(NoteModel.updateOne({ text: 'x' }, { text: 'y' })).rejects.toThrow(message);
    await expect(NoteModel.deleteOne({ text: 'x' })).rejects.toThrow(message);
    await expect(NoteModel.aggregate([{ $group: { _id: null } }])).rejects.toThrow(message);
  });

  it('companyId filtreli sorgulara izin verir', async () => {
    await expect(NoteModel.find({ companyId: companyA })).resolves.toEqual([]);
    await expect(NoteModel.aggregate([{ $match: { companyId: companyA } }])).resolves.toEqual([]);
  });

  it('companyId sonradan değiştirilemez', async () => {
    const note = await forCompany(NoteModel, companyA).create({ text: 'not' }, userA);
    note.companyId = companyB;
    await note.save();
    const stored = await forCompany(NoteModel, companyA).findById(note._id.toString());
    expect(stored?.companyId).toEqual(companyA);
  });
});

describe('forCompany', () => {
  it('istemciden gelen companyId yok sayılır', async () => {
    const data = { text: 'not', companyId: companyB } as unknown as { text: string };
    const note = await forCompany(NoteModel, companyA).create(data, userA);
    expect(note.companyId).toEqual(companyA);
  });

  it('başka firmanın kaydı bulunamamış gibi davranır; findByIdOrThrow 404 verir', async () => {
    const note = await forCompany(NoteModel, companyA).create({ text: 'gizli' }, userA);
    const scopeB = forCompany(NoteModel, companyB);

    expect(await scopeB.findById(note._id.toString())).toBeNull();
    await expect(scopeB.findByIdOrThrow(note._id.toString())).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
    expect(await scopeB.find()).toEqual([]);
    expect(await scopeB.countDocuments()).toBe(0);
  });

  it('silinmiş kayıtlar varsayılan sorgulardan çıkar, istenirse görünür', async () => {
    const scope = forCompany(NoteModel, companyA);
    const note = await scope.create({ text: 'silinecek' }, userA);
    await NoteModel.updateOne({ _id: note._id, companyId: companyA }, { deletedAt: new Date() });

    expect(await scope.findById(note._id.toString())).toBeNull();
    expect(await scope.findById(note._id.toString(), { includeDeleted: true })).not.toBeNull();
  });

  it('geçersiz kimlik 404 ile aynı sonuç verir', async () => {
    expect(await forCompany(NoteModel, companyA).findById('gecersiz')).toBeNull();
  });
});

describe('firma yalıtım test altyapısı', () => {
  it('örnek uç: başka firma kimliğiyle çağrı 404, veri sızmaz', async () => {
    const testApp = buildTestApp({
      extraRoutes: ({ customerAuth: service }) => {
        const router = Router();
        router.get(
          '/deneme/notlar/:id',
          customerAuth(service, { access: 'auto' }),
          async (req, res) => {
            const { companyId } = requireCustomer(req);
            const note = await forCompany(NoteModel, companyId).findByIdOrThrow(
              routeParam(req, 'id'),
            );
            sendSuccess(res, { text: note.text });
          },
        );
        return router;
      },
    });

    await expectCompanyIsolation(testApp, {
      name: 'GET /deneme/notlar/:id',
      arrange: async ({ owner }) => {
        const note = await forCompany(NoteModel, owner.company._id).create(
          { text: 'Gizli not 4815' },
          owner.user._id,
        );
        return {
          method: 'get',
          path: `/deneme/notlar/${note._id.toString()}`,
          secret: 'Gizli not 4815',
        };
      },
    });
  });
});
