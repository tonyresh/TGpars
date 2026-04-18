import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { Bot, GrammyError, HttpError } from 'grammy';
import { GoogleGenAI } from '@google/genai';

import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Firebase Init ---
// In AI Studio, initializing with no arguments is the most reliable way 
// as it automatically uses the correct service account and project ID for the current container.
const adminApp = admin.apps.length ? admin.app() : admin.initializeApp();

// We use the databaseId from config, but we fall back to '(default)' if there's a permission issue 
// or if the database is not yet created in the current project.
let db: admin.firestore.Firestore;
try {
  db = getFirestore(adminApp, firebaseConfig.firestoreDatabaseId || undefined);
} catch (e) {
  console.warn('Could not initialize with custom databaseId, falling back to default.');
  db = getFirestore(adminApp);
}

// Test connectivity on startup
(async () => {
  try {
    await db.collection('settings').doc('config').get();
    console.log('Firebase Admin: Successfully connected.');
  } catch (error) {
    console.error('Firebase Admin: CONNECTION ERROR.', 
      'This usually means you need to re-run the "Set up Firebase" tool to refresh your project credentials.');
  }
})();

// --- AI Init ---
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

class AutomationEngine {
  private bot: Bot | null = null;
  private currentBotToken: string | null = null;

  async start() {
    console.log('Starting Automation Engine...');
    this.syncBot();
    // Periodically check if token changed or system activated
    setInterval(() => this.syncBot(), 30000);
  }

  private async syncBot() {
    try {
      const settingsDoc = await db.collection('settings').doc('config').get();
      const settings = settingsDoc.data();

      if (!settings?.isActive || !settings?.telegramBotToken) {
        if (this.bot) {
          console.log('Stopping bot...');
          await this.bot.stop();
          this.bot = null;
          this.currentBotToken = null;
        }
        return;
      }

      if (this.currentBotToken !== settings.telegramBotToken) {
        if (this.bot) await this.bot.stop();
        
        console.log('Initializing Bot with new token...');
        this.currentBotToken = settings.telegramBotToken;
        this.bot = new Bot(this.currentBotToken);

        // Handle incoming channel posts from donor channels
        this.bot.on('channel_post', async (ctx) => {
          await this.handleNewPost(ctx);
        });

        // Error handling
        this.bot.catch((err) => {
          const ctx = err.ctx;
          console.error(`Error while handling update ${ctx.update.update_id}:`);
          const e = err.error;
          if (e instanceof GrammyError) {
            console.error("Error in request:", e.description);
          } else if (e instanceof HttpError) {
            console.error("Could not contact Telegram:", e);
          } else {
            console.error("Unknown error:", e);
          }
        });

        this.bot.start();
        await this.log('Bot', 'success', 'Bot started and monitoring channels.');
      }
    } catch (error) {
      console.error('Sync error:', error);
    }
  }

  private async handleNewPost(ctx: any) {
    try {
      const chat = ctx.chat;
      const message = ctx.channelPost;
      
      if (!message.text && !message.caption) return;

      const channelId = String(chat.id);
      const username = chat.username ? `@${chat.username}` : null;

      // 1. Get Settings
      const settingsDoc = await db.collection('settings').doc('config').get();
      const settings = settingsDoc.data() || {};

      // 1.1 Check blocked keywords
      const originalText = message.text || message.caption || '';
      if (settings.blockedKeywords) {
        const keywords = settings.blockedKeywords.split(',').map((k: string) => k.trim().toLowerCase());
        const contentLower = originalText.toLowerCase();
        if (keywords.some((k: string) => k && contentLower.includes(k))) {
          await this.log('System', 'warning', `Post skipped due to blocked keywords.`);
          return;
        }
      }

      // 2. Check if registered Donor
      const donorsSnap = await db.collection('donor_channels').where('isActive', '==', true).get();
      const donor = donorsSnap.docs.find(d => {
        const dData = d.data();
        return dData.channelId === channelId || (username && dData.channelId === username);
      });

      if (!donor) return;

      await this.log(donor.data().title, 'info', `New post detected.`);

      // 3. Uniquize
      await this.log(donor.data().title, 'info', `Uniquizing content...`);
      const uniqueText = await this.uniquizeContent(originalText, settings.aiPrompt);

      // 4. Wrap with Header/Footer
      const finalHeader = settings.globalHeader ? `${settings.globalHeader}\n\n` : '';
      const finalFooter = settings.globalFooter ? `\n\n${settings.globalFooter}` : '';
      const finalText = `${finalHeader}${uniqueText}${finalFooter}`;

      // 5. Post to Targets with delay
      const targetsSnap = await db.collection('target_channels').where('isActive', '==', true).get();
      
      for (const targetDoc of targetsSnap.docs) {
        const target = targetDoc.data();
        try {
          // Delay to avoid flooding
          if (settings.postDelay) {
            await new Promise(resolve => setTimeout(resolve, settings.postDelay * 1000));
          }

          await this.bot?.api.sendMessage(target.channelId, finalText, {
            parse_mode: 'HTML'
          });
          
          await db.collection('posts').add({
            sourceChannelId: channelId,
            targetChannelId: target.channelId,
            originalText,
            uniquizedText: finalText,
            status: 'published',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
          
          await this.log(target.title, 'success', `Posted unique content.`);
        } catch (postError) {
          console.error(`Post Error:`, postError);
          await this.log(target.title, 'error', `Failed to post: ${String(postError)}`);
        }
      }

    } catch (error) {
      console.error('HandlePost Error:', error);
      await this.log('System', 'error', `Error processing post: ${String(error)}`);
    }
  }

  private async log(source: string, level: 'info' | 'success' | 'warning' | 'error', message: string) {
    await db.collection('logs').add({
      message: `[${source}] ${message}`,
      level,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  async uniquizeContent(text: string, customPrompt?: string) {
    try {
      const prompt = customPrompt || "Перепиши этот текст для Telegram канала, сохранив смысл, но сделав его уникальным. Измени заголовок и структуру. Верни только готовый текст без лишних комментариев.";
      
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=' + process.env.GEMINI_API_KEY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${prompt}\n\nТекст:\n${text}` }] }]
        })
      });
      
      const data = await response.json();
      const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      return aiText || text;
    } catch (error) {
      console.error('AI Error:', error);
      return text;
    }
  }

  isBotRunning() {
    return !!this.bot;
  }

  async publishManual(channelId: string, text: string) {
    if (!this.bot) throw new Error('Bot not started');
    await this.bot.api.sendMessage(channelId, text, { parse_mode: 'HTML' });
    await this.log('Manual', 'success', `Manually published to ${channelId}`);
  }
}

const engine = new AutomationEngine();
engine.start();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', engine: 'running' });
  });

  // Manual Trigger
  app.post('/api/trigger', async (req, res) => {
    // Logic to manually run check
    res.json({ success: true, message: 'Triggered' });
  });

  // Helper for AI uniquely (if requested from frontend)
  app.post('/api/uniquize', async (req, res) => {
    const { text, prompt } = req.body;
    const result = await engine.uniquizeContent(text, prompt);
    res.json({ text: result });
  });

  app.post('/api/post-manual', async (req, res) => {
    const { text, channelId } = req.body;
    if (!text || !channelId) return res.status(400).json({ error: 'Missing data' });
    
    try {
      if (!engine.isBotRunning()) {
        return res.status(500).json({ error: 'Бот не запущен. Проверьте настройки.' });
      }
      await engine.publishManual(channelId, text);
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Ошибка при публикации' });
    }
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
