# Company Knowledge AI - Frontend

A high-performance, enterprise-grade dashboard built with **Next.js 15**, designed for cognitive document interaction and knowledge management.

## ✨ Key Features

- **🧠 RAG Chat Interface**: Intelligent, multi-turn chat with your company's knowledge base. Includes real-time streaming and interactive citations (Source files or Web URLs).
- **📄 Document Manager**: Seamlessly upload and manage PDF, DOCX, TXT, and **SQL** files. Track indexing status in real-time.
- **📊 Resource Tracking**: Embedded token usage counter to monitor AI consumption per session.
- **🌓 Adaptive Theming**: Elegant implementation of Light and Dark modes with a custom "Glass" design system.
- **📱 Responsive by Design**: Fully optimized for mobile, tablet, and desktop viewports with a native-feel mobile drawer.
- **⚡ SSE Streaming**: Low-latency Server-Sent Events for fluid AI response delivery.

## 🛠️ Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Engine**: Tailwind CSS 4.0
- **Icons**: Lucide React
- **Theme**: `next-themes`
- **Data Fetching**: TanStack Query (React Query)
- **Styling**: Vanilla CSS Variables for premium theme handling

## ⚙️ Getting Started

### 1. Installation
We recommend using `pnpm` for development:
```bash
pnpm install
```

### 2. Configuration
Create a `.env.local` file:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

### 3. Launch
```bash
pnpm dev
```
Visit [http://localhost:3000](http://localhost:3000) to start exploring.

## 📂 Architecture Overview

- **`app/`**: Route-based pages and server layout definitions.
- **`components/chat/`**: The core AI interaction engine (Message area, Input, Sources).
- **`components/layout/`**: Structural components (Sidebar, Global Header).
- **`components/ui/`**: Reusable decorative and interactive primitives.
- **`lib/`**: API clients and business logic utilities.
