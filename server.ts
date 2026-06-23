import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProduction = process.env.NODE_ENV === 'production';
const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(express.json());

  // Instantiate Gemini API client securely on the server
  // User-Agent: 'aistudio-build' is required for telemetry
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // Secure proxy API endpoint for Gemini
  app.post('/api/chat', async (req, res) => {
    try {
      const { message, history, systemInstruction, model } = req.body;
      
      const modelToUse = model || 'gemini-3.5-flash';
      
      // Structure the final messages content array
      const contents = history ? [...history] : [];
      contents.push({ role: 'user', parts: [{ text: message }] });

      // Run generateContent call server-side
      const response = await ai.models.generateContent({
        model: modelToUse,
        contents,
        config: systemInstruction ? { systemInstruction } : undefined,
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error('Gemini API Server Error:', error);
      res.status(500).json({ 
        error: error?.message || 'Failed to generate response',
        details: error?.status ? `Status code: ${error.status}` : undefined
      });
    }
  });

  if (!isProduction) {
    // In development mode, integrate Vite in middleware mode to serve frontend
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    
    app.use(vite.middlewares);
    
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = await vite.transformIndexHtml(url, `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI Studio Hub</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    // In production mode, serve compiled static files from dist/
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] AI Hub running at http://localhost:${PORT} (${isProduction ? 'Production' : 'Development'})`);
  });
}

startServer().catch((err) => {
  console.error('[Server] Failed to start:', err);
});
