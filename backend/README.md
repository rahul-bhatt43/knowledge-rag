# Company Knowledge AI - Backend

A production-grade Retrieval-Augmented Generation (RAG) backend built with Node.js, TypeScript, and Express. It enables intelligent document processing, semantic search, and grounded AI chat with citations.

## 🚀 System Architecture

The core of this system is a RAG pipeline that bridges structured document storage with unstructured vector search.

### 📄 Document Ingestion Pipeline
1.  **File Upload**: Accepts PDF, DOCX, TXT, and **SQL** files.
2.  **Semantic Chunking**: Uses LangChain's `RecursiveCharacterTextSplitter` for intelligent context preservation.
3.  **OpenAI Embeddings**: Converts text chunks into high-dimensional vectors via `text-embedding-ada-002` (or configured model).
4.  **Vector Store (Pinecone)**: Upserts vectors into a global knowledge base and session-specific memory namespaces.
5.  **Metadata Store (MongoDB)**: Saves chunk mappings for reliable retrieval and management.

### 💬 Chat & Retrieval Pipeline
1.  **Query Refinement**: Uses NLP to condense multi-turn history and follow-up questions into standalone search queries.
2.  **Intent Detection**: Automatically detects 'Aggregation' or 'External' intent to adjust retrieval depth or trigger web search.
3.  **Hybrid Retrieval**: Searches the core Knowledge Base and Session Memory with a configurable similarity threshold.
4.  **Tavily Internet Fallback**: Automatically triggers Tavily search if no relevant internal context is found or if "External" intent is detected.
5.  **Streaming AI**: OpenAI's `gpt-4o` generates grounded responses with inline citations (Source filenames or Web URLs).
6.  **Context persistence**: Every message pair is automatically indexed into a session-specific vector memory for long-term coherence.

## 🛠️ Tech Stack
- **Runtime**: Node.js & TypeScript
- **Framework**: Express.js
- **Vector DB**: [Pinecone](https://pinecone.io)
- **Database**: MongoDB (Mongoose)
- **AI Services**: OpenAI (GPT-4o & Embeddings), **Tavily** (Web Retrieval)
- **Orchestration**: LangChain, Axios (HTTP)

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
TAVILY_API_KEY=your_tavily_key
AI_SIMILARITY_THRESHOLD=0.81
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
