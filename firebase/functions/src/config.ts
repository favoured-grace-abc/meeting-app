export const config = {
  livekit: {
    apiKey: process.env.LIVEKIT_API_KEY || '',
    apiSecret: process.env.LIVEKIT_API_SECRET || '',
    serverUrl: process.env.LIVEKIT_SERVER_URL || 'wss://your-livekit-instance.com',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },
  webhook: {
    secret: process.env.WEBHOOK_SECRET || '',
  },
};
