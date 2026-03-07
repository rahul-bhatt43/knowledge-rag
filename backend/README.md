# Company Knowledge AI - Backend

A production-grade Retrieval-Augmented Generation (RAG) backend built with Node.js, TypeScript, and Express. It enables intelligent document processing, semantic search, and grounded AI chat with citations.

## 🚀 System Architecture

The core of this system is a RAG pipeline that bridges structured document storage with unstructured vector search.

### 📄 Document Ingestion Pipeline
1.  **File Upload**: Accepts PDF, DOCX, and TXT files.
2.  **Semantic Chunking**: Uses LangChain's `RecursiveCharacterTextSplitter` to intelligently split text into manageable segments with overlap.
3.  **OpenAI Embeddings**: Converts text chunks into high-dimensional vectors via the `text-embedding-3-small` model.
4.  **Vector Store (Pinecone)**: Upserts vectors and metadata into a serverless Pinecone index for fast similarity search.
5.  **Metadata Store (MongoDB)**: Saves chunk mappings and document status for reliable retrieval and management.

### 💬 Chat & Retrieval Pipeline
1.  **Query Embedding**: The user's question is converted into a vector.
2.  **Similarity Search**: Pinecone returns the most relevant chunks from the knowledge base.
3.  **Context Construction**: Full text is retrieved from MongoDB and formatted into a grounded prompt.
4.  **Streaming AI**: OpenAI's `gpt-4o` generates responses with inline citations, streamed back to the frontend via Server-Sent Events (SSE).
5.  **Token Management**: Every interaction tracks prompt and completion tokens for usage analytics.

## 🛠️ Tech Stack
- **Runtime**: Node.js & TypeScript
- **Framework**: Express.js
- **Vector DB**: [Pinecone](https://pinecone.io)
- **Database**: MongoDB (Mongoose)
- **AI Services**: OpenAI (Embeddings & GPT-4o)
- **Orchestration**: LangChain (Text Splitters)

## ⚙️ Setup & Installation

### 1. Prerequisites
- Node.js (v18+)
- MongoDB (Local or Atlas)
- Pinecone Account & Index
- OpenAI API Key

### 2. Configure Environment
Copy `.env.example` to `.env` and provide the following:
```env
# Server
PORT=5000
MONGODB_URI=your_mongodb_uri

# AI & Vector DB
OPENAI_API_KEY=your_openai_key
PINECONE_API_KEY=your_pinecone_key
PINECONE_INDEX_NAME=company-knowledge
PINECONE_ENVIRONMENT=us-east-1-aws
PINECONE_NAMESPACE=production
```

### 3. Install & Run
```bash
npm install
npm run dev
```

## 📂 Directory Structure
- `src/services/ingestion.service.ts`: Document processing and indexing logic.
- `src/services/chat.service.ts`: The RAG retrieval and streaming pipeline.
- `src/services/vectorDb.service.ts`: Abstraction layer for Pinecone operations.
- `src/models/`: Mongoose schemas for Users, Documents, and ChatSessions.
- `src/routes/`: API endpoint definitions.
