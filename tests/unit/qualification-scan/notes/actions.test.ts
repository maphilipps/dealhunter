import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock auth
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

// Mock DB
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
    orderBy: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  },
}));

vi.mock('@/lib/db/schema', () => ({
  sectionNotes: {
    id: 'id',
    qualificationId: 'qualificationId',
    sectionId: 'sectionId',
    userId: 'userId',
    content: 'content',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  },
}));

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  createNote,
  getNotesForSection,
  updateNote,
  deleteNote,
} from '@/lib/qualification-scan/notes/actions';

const mockAuth = vi.mocked(auth);
const mockDb = vi.mocked(db);

describe('Section Notes CRUD', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createNote', () => {
    it('should return error when not authenticated', async () => {
      mockAuth.mockResolvedValue(null as never);
      const result = await createNote('q1', 'tech-stack', 'Note content');
      expect(result).toEqual({ success: false, error: 'Nicht authentifiziert' });
    });

    it('should create note and return it', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'u1' } } as never);

      const createdNote = {
        id: 'note-1',
        qualificationId: 'q1',
        sectionId: 'tech-stack',
        userId: 'u1',
        content: 'My note',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Chain: db.insert().values().returning()
      const returningMock = vi.fn().mockResolvedValue([createdNote]);
      const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
      const insertMock = vi.fn().mockReturnValue({ values: valuesMock });
      (mockDb as Record<string, unknown>).insert = insertMock;

      const result = await createNote('q1', 'tech-stack', 'My note');
      expect(result.success).toBe(true);
      expect(result.note).toEqual(createdNote);
    });

    it('should return error on DB failure', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'u1' } } as never);

      const insertMock = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(new Error('DB error')),
        }),
      });
      (mockDb as Record<string, unknown>).insert = insertMock;

      const result = await createNote('q1', 'sec', 'text');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Notiz konnte nicht erstellt werden');
    });
  });

  describe('getNotesForSection', () => {
    it('should return error when not authenticated', async () => {
      mockAuth.mockResolvedValue(null as never);
      const result = await getNotesForSection('q1', 'tech-stack');
      expect(result).toEqual({ success: false, error: 'Nicht authentifiziert' });
    });

    it('should return notes ordered by createdAt desc', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'u1' } } as never);

      const notes = [
        { id: 'n2', content: 'Newer note', createdAt: new Date('2026-02-02') },
        { id: 'n1', content: 'Older note', createdAt: new Date('2026-02-01') },
      ];

      const orderByMock = vi.fn().mockResolvedValue(notes);
      const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      const selectMock = vi.fn().mockReturnValue({ from: fromMock });
      (mockDb as Record<string, unknown>).select = selectMock;

      const result = await getNotesForSection('q1', 'tech-stack');
      expect(result.success).toBe(true);
      expect(result.notes).toHaveLength(2);
    });
  });

  describe('updateNote', () => {
    it('should return error when not authenticated', async () => {
      mockAuth.mockResolvedValue(null as never);
      const result = await updateNote('n1', 'new content');
      expect(result).toEqual({ success: false, error: 'Nicht authentifiziert' });
    });

    it('should return error when note not found', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'u1' } } as never);

      const limitMock = vi.fn().mockResolvedValue([]);
      const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      const selectMock = vi.fn().mockReturnValue({ from: fromMock });
      (mockDb as Record<string, unknown>).select = selectMock;

      const result = await updateNote('non-existent', 'new content');
      expect(result).toEqual({ success: false, error: 'Notiz nicht gefunden' });
    });

    it('should return error when user is not owner', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'u1' } } as never);

      const existingNote = { id: 'n1', userId: 'u2', content: 'old' };
      const limitMock = vi.fn().mockResolvedValue([existingNote]);
      const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      const selectMock = vi.fn().mockReturnValue({ from: fromMock });
      (mockDb as Record<string, unknown>).select = selectMock;

      const result = await updateNote('n1', 'new content');
      expect(result).toEqual({ success: false, error: 'Keine Berechtigung' });
    });

    it('should update note when owner matches', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'u1' } } as never);

      const existingNote = { id: 'n1', userId: 'u1', content: 'old' };
      const updatedNote = { ...existingNote, content: 'updated' };

      // select().from().where().limit() -> existing note
      const limitMock = vi.fn().mockResolvedValue([existingNote]);
      const selectWhereMock = vi.fn().mockReturnValue({ limit: limitMock });
      const fromMock = vi.fn().mockReturnValue({ where: selectWhereMock });
      const selectMock = vi.fn().mockReturnValue({ from: fromMock });
      (mockDb as Record<string, unknown>).select = selectMock;

      // update().set().where().returning()
      const returningMock = vi.fn().mockResolvedValue([updatedNote]);
      const updateWhereMock = vi.fn().mockReturnValue({ returning: returningMock });
      const setMock = vi.fn().mockReturnValue({ where: updateWhereMock });
      const updateMock = vi.fn().mockReturnValue({ set: setMock });
      (mockDb as Record<string, unknown>).update = updateMock;

      const result = await updateNote('n1', 'updated');
      expect(result.success).toBe(true);
      expect(result.note).toEqual(updatedNote);
    });
  });

  describe('deleteNote', () => {
    it('should return error when not authenticated', async () => {
      mockAuth.mockResolvedValue(null as never);
      const result = await deleteNote('n1');
      expect(result).toEqual({ success: false, error: 'Nicht authentifiziert' });
    });

    it('should return error when note not found', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'u1' } } as never);

      const limitMock = vi.fn().mockResolvedValue([]);
      const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      const selectMock = vi.fn().mockReturnValue({ from: fromMock });
      (mockDb as Record<string, unknown>).select = selectMock;

      const result = await deleteNote('non-existent');
      expect(result).toEqual({ success: false, error: 'Notiz nicht gefunden' });
    });

    it('should return error when user is not owner', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'u1' } } as never);

      const existingNote = { id: 'n1', userId: 'u2' };
      const limitMock = vi.fn().mockResolvedValue([existingNote]);
      const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      const selectMock = vi.fn().mockReturnValue({ from: fromMock });
      (mockDb as Record<string, unknown>).select = selectMock;

      const result = await deleteNote('n1');
      expect(result).toEqual({ success: false, error: 'Keine Berechtigung' });
    });

    it('should delete note when owner matches', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'u1' } } as never);

      const existingNote = { id: 'n1', userId: 'u1' };

      // select for ownership check
      const limitMock = vi.fn().mockResolvedValue([existingNote]);
      const selectWhereMock = vi.fn().mockReturnValue({ limit: limitMock });
      const fromMock = vi.fn().mockReturnValue({ where: selectWhereMock });
      const selectMock = vi.fn().mockReturnValue({ from: fromMock });
      (mockDb as Record<string, unknown>).select = selectMock;

      // delete().where()
      const deleteWhereMock = vi.fn().mockResolvedValue(undefined);
      const deleteMock = vi.fn().mockReturnValue({ where: deleteWhereMock });
      (mockDb as Record<string, unknown>).delete = deleteMock;

      const result = await deleteNote('n1');
      expect(result).toEqual({ success: true });
    });
  });
});
