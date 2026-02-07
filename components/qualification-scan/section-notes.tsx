'use client';

import { useState, useEffect, useTransition, useOptimistic } from 'react';
import { MessageSquare, Pencil, Trash2, X, Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  createNote,
  getNotesForSection,
  updateNote,
  deleteNote,
} from '@/lib/qualification-scan/notes/actions';
import type { SectionNote } from '@/lib/db/schema';

interface SectionNotesProps {
  qualificationId: string;
  sectionId: string;
}

type OptimisticAction =
  | { type: 'add'; note: SectionNote }
  | { type: 'update'; noteId: string; content: string }
  | { type: 'delete'; noteId: string };

export function SectionNotes({ qualificationId, sectionId }: SectionNotesProps) {
  const [notes, setNotes] = useState<SectionNote[]>([]);
  const [newContent, setNewContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [optimisticNotes, addOptimistic] = useOptimistic(
    notes,
    (state: SectionNote[], action: OptimisticAction) => {
      switch (action.type) {
        case 'add':
          return [action.note, ...state];
        case 'update':
          return state.map(n => (n.id === action.noteId ? { ...n, content: action.content } : n));
        case 'delete':
          return state.filter(n => n.id !== action.noteId);
      }
    }
  );

  useEffect(() => {
    if (isOpen) {
      void getNotesForSection(qualificationId, sectionId)
        .then(result => {
          if (result.success && result.notes) setNotes(result.notes);
        })
        .catch(() => {
          // Ignore load failures here; UI remains empty.
        });
    }
  }, [isOpen, qualificationId, sectionId]);

  function handleCreate() {
    if (!newContent.trim()) return;

    const tempNote: SectionNote = {
      id: `temp-${Date.now()}`,
      qualificationId,
      sectionId,
      userId: '',
      content: newContent,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    startTransition(async () => {
      addOptimistic({ type: 'add', note: tempNote });
      const result = await createNote(qualificationId, sectionId, newContent);
      if (result.success && result.note) {
        setNotes(prev => [result.note!, ...prev]);
      }
    });
    setNewContent('');
  }

  function handleUpdate(noteId: string) {
    if (!editContent.trim()) return;

    startTransition(async () => {
      addOptimistic({ type: 'update', noteId, content: editContent });
      const result = await updateNote(noteId, editContent);
      if (result.success && result.note) {
        setNotes(prev => prev.map(n => (n.id === noteId ? result.note! : n)));
      }
    });
    setEditingId(null);
  }

  function handleDelete(noteId: string) {
    startTransition(async () => {
      addOptimistic({ type: 'delete', noteId });
      const result = await deleteNote(noteId);
      if (result.success) {
        setNotes(prev => prev.filter(n => n.id !== noteId));
      }
    });
  }

  return (
    <div className="mt-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="text-muted-foreground hover:text-foreground"
      >
        <MessageSquare className="mr-2 h-4 w-4" />
        Notizen {notes.length > 0 && `(${notes.length})`}
      </Button>

      {isOpen && (
        <div className="mt-2 space-y-3 rounded-lg border p-4">
          {/* New note input */}
          <div className="flex gap-2">
            <Textarea
              placeholder="Notiz hinzufügen…"
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              className="min-h-[60px] resize-none"
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleCreate();
              }}
            />
            <Button size="sm" onClick={handleCreate} disabled={!newContent.trim() || isPending}>
              Speichern
            </Button>
          </div>

          {/* Notes list */}
          {optimisticNotes.map(note => (
            <div key={note.id} className="group rounded-md border p-3">
              {editingId === note.id ? (
                <div className="flex gap-2">
                  <Textarea
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    className="min-h-[60px] resize-none"
                  />
                  <div className="flex flex-col gap-1">
                    <Button size="icon" variant="ghost" onClick={() => handleUpdate(note.id)}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {note.createdAt ? new Date(note.createdAt).toLocaleString('de-DE') : ''}
                    </p>
                  </div>
                  <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => {
                        setEditingId(note.id);
                        setEditContent(note.content);
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => handleDelete(note.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {optimisticNotes.length === 0 && (
            <p className="text-muted-foreground py-2 text-center text-sm">
              Noch keine Notizen für diese Section.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
