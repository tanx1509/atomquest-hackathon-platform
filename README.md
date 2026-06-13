# AtomQuest Real-Time Video Support Platform

This repository contains the submission for the **AtomQuest Hackathon 1.0 Grand Finale**. It implements a complete, end-to-end real-time video support platform with custom-hosted media routing.

## 🏗 Architecture & Design Choices

The platform is designed with a strong emphasis on meeting the hackathon's strict constraints: **No third-party hosted video APIs (Twilio, Agora, etc.) and no direct peer-to-peer (P2P) media connections**.

To achieve this, we embedded a **Mediasoup WebRTC SFU (Selective Forwarding Unit)** into a custom Node.js backend. This acts as the central router for all media, meaning all audio and video streams flow directly through our proprietary server rather than directly between clients.

### Architecture Diagram

\`\`\`mermaid
flowchart TD
    subgraph Frontend [Client - Next.js (Web Browser)]
        A[Agent UI] <--> |Socket.io (Signaling)| B
        C[Customer UI] <--> |Socket.io (Signaling)| B
        A <--> |WebRTC Media| D
        C <--> |WebRTC Media| D
    end

    subgraph Backend [Server - Node.js]
        B(Express + Socket.io\nSignaling Server) <--> |Controls| D
        D((Mediasoup SFU\nMedia Server))
        B <--> |Persist/Retrieve| E[(SQLite Database)]
    end

    E --> |Stores| F[Sessions\nChats]
\`\`\`

## 🚀 Setup Instructions

Follow these steps to run the platform locally.

### Prerequisites
- Node.js (v18+)
- Python 3 & C++ build tools (required for Mediasoup to compile)

### 1. Backend Setup (SFU & Signaling)
1. Open a terminal and navigate to the \`backend\` directory:
   \`\`\`bash
   cd backend
   \`\`\`
2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`
3. Start the server:
   \`\`\`bash
   npm start
   \`\`\`
   *The server runs on http://localhost:4000*

### 2. Frontend Setup (Next.js UI)
1. Open a new terminal and navigate to the \`frontend\` directory:
   \`\`\`bash
   cd frontend
   \`\`\`
2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`
3. Run the development server:
   \`\`\`bash
   npm run dev
   \`\`\`
   *The application is accessible at http://localhost:3000*

## 🧑‍💻 How to Test the Demo (Judging Steps)
1. Open `http://localhost:3000` in your web browser.
2. Click **Login to Dashboard** under the Support Agents section.
3. Click **Generate Session** to create a secure room.
4. Click **Copy Invite URL**.
5. Open an **Incognito Window** (or a different browser profile) and paste the URL. You will automatically join as the Customer.
6. In your primary window, click **Join Session as Agent**.
7. Grant camera and microphone permissions in both windows.
8. You should see both video feeds and hear the audio. Test the **In-Call Chat**, muting/unmuting, and ending the call!

## ⚠️ Known Limitations
- **Call Recording**: The call recording feature currently implements client-side recording (via `MediaRecorder`). While functional, enterprise-grade recording requires a dedicated headless browser or GStreamer implementation on the server, which was outside the scope of a rapid prototype.
- **SQLite Concurrency**: SQLite is used for simplicity and ease of setup for judges. In a production environment with hundreds of concurrent sessions, a PostgreSQL or Redis implementation would be preferred.
- **STUN/TURN**: Local WebRTC connections generally succeed without TURN servers. For production deployment across strict NATs, a custom Coturn server should be integrated.
