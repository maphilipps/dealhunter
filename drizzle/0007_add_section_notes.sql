-- Section Notes: User comments per scan section
CREATE TABLE section_notes (
  id TEXT PRIMARY KEY,
  qualification_id TEXT NOT NULL REFERENCES pre_qualifications(id) ON DELETE CASCADE,
  section_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX section_notes_qualification_idx ON section_notes(qualification_id);
CREATE INDEX section_notes_section_idx ON section_notes(qualification_id, section_id);
CREATE INDEX section_notes_user_idx ON section_notes(user_id);
