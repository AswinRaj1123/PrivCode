# PrivCode Frontend

Next.js frontend for PrivCode - Private Offline Code Analysis System.

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
frontend/
├── app/              # Next.js App Router pages
├── components/       # Reusable React components
├── lib/             # Utility functions and API client
├── public/          # Static assets
└── package.json     # Dependencies
```

## Environment Variables

Create `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Build for Production

```bash
npm run build
npm start
```
