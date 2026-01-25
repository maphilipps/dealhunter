-- Vector Indexes for pgvector (IVFFlat)
--
-- IVFFlat is faster to build than HNSW and uses less memory,
-- good for datasets < 1M vectors. Switch to HNSW for larger datasets.
--
-- Cosine distance (<=> operator) is used for semantic similarity search.
-- Lists = sqrt(n) where n = expected number of vectors (start with 100)

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Index for deal_embeddings table (primary RAG storage)
-- Expected: ~10k-100k embeddings, using 100 lists
CREATE INDEX IF NOT EXISTS deal_embeddings_embedding_idx
ON deal_embeddings USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Index for raw_chunks table (document chunks)
-- Expected: ~1k-10k chunks, using 50 lists
CREATE INDEX IF NOT EXISTS raw_chunks_embedding_idx
ON raw_chunks USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 50);

-- Index for pre_qualifications description embeddings
-- Expected: ~1k-10k, using 50 lists
CREATE INDEX IF NOT EXISTS pre_qualifications_embedding_idx
ON pre_qualifications USING ivfflat (description_embedding vector_cosine_ops)
WITH (lists = 50);

-- Performance tuning for IVFFlat
-- Increase probes for better recall (default is 1)
-- Higher probes = better accuracy but slower queries
-- Recommended: probes = sqrt(lists)
SET ivfflat.probes = 10;

-- Note: After initial data load, analyze tables to update statistics
-- ANALYZE deal_embeddings;
-- ANALYZE raw_chunks;
-- ANALYZE pre_qualifications;
