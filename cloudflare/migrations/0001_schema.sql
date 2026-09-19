CREATE TABLE IF NOT EXISTS registros (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data TEXT NOT NULL,
  presidencia TEXT,
  pais TEXT NOT NULL DEFAULT 'Brasil',
  local TEXT,
  estado TEXT,
  cidade TEXT,
  meninas_1 INTEGER NOT NULL DEFAULT 0,
  meninas_2 INTEGER NOT NULL DEFAULT 0,
  meninas_3 INTEGER NOT NULL DEFAULT 0,
  meninas_4 INTEGER NOT NULL DEFAULT 0,
  meninas_5 INTEGER NOT NULL DEFAULT 0,
  meninas_6 INTEGER NOT NULL DEFAULT 0,
  meninos_1 INTEGER NOT NULL DEFAULT 0,
  meninos_2 INTEGER NOT NULL DEFAULT 0,
  meninos_3 INTEGER NOT NULL DEFAULT 0,
  meninos_4 INTEGER NOT NULL DEFAULT 0,
  meninos_5 INTEGER NOT NULL DEFAULT 0,
  meninos_6 INTEGER NOT NULL DEFAULT 0,
  recitativos_individuais INTEGER NOT NULL DEFAULT 0,
  testemunhos INTEGER NOT NULL DEFAULT 0,
  visitas TEXT NOT NULL DEFAULT '',
  auxiliares_presentes TEXT NOT NULL DEFAULT '',
  auxiliares_masculinos INTEGER NOT NULL DEFAULT 0,
  auxiliares_femininos INTEGER NOT NULL DEFAULT 0,
  oracao_pai_nosso TEXT,
  recitativo_coletivo INTEGER NOT NULL DEFAULT 0,
  livro TEXT,
  capitulo TEXT,
  versiculo TEXT,
  presidido_por TEXT,
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TEXT
);

CREATE INDEX IF NOT EXISTS idx_registros_data ON registros(data);
CREATE INDEX IF NOT EXISTS idx_registros_local ON registros(local);
CREATE INDEX IF NOT EXISTS idx_registros_presidencia ON registros(presidencia);
