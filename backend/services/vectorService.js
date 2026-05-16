const { pipeline } = require('@xenova/transformers');
const fs = require('fs');
const path = require('path');

const VECTOR_STORE_PATH = path.join(__dirname, '../data/vector_store.json');

let extractor = null;

/**
 * Initializes the embedding model (Lazy Loading)
 */
async function getExtractor() {
  if (!extractor) {
    console.log("Loading embedding model (all-MiniLM-L6-v2)...");
    extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return extractor;
}

/**
 * Generates an embedding for a given text
 */
async function generateEmbedding(text) {
  const model = await getExtractor();
  const output = await model(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

/**
 * Calculates cosine similarity between two vectors
 */
function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
  }
  return dotProduct; // Vectors are normalized by the pipeline
}

/**
 * Adds a document to the local vector store
 */
async function addDocument(id, text, metadata = {}) {
  const embedding = await generateEmbedding(text);
  let store = [];
  
  if (fs.existsSync(VECTOR_STORE_PATH)) {
    store = JSON.parse(fs.readFileSync(VECTOR_STORE_PATH, 'utf8'));
  }
  
  store.push({ id, text, metadata, embedding });
  fs.writeFileSync(VECTOR_STORE_PATH, JSON.stringify(store, null, 2));
}

/**
 * Performs semantic search
 */
async function searchSimilar(queryText, limit = 3) {
  if (!fs.existsSync(VECTOR_STORE_PATH)) return [];
  
  const queryEmbedding = await generateEmbedding(queryText);
  const store = JSON.parse(fs.readFileSync(VECTOR_STORE_PATH, 'utf8'));
  
  const results = store.map(doc => ({
    ...doc,
    similarity: cosineSimilarity(queryEmbedding, doc.embedding)
  }));
  
  return results
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)
    .map(({ embedding, ...doc }) => doc); // Remove embedding from output
}

module.exports = { addDocument, searchSimilar };
