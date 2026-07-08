const { appendMessage } = require('../server/chat-store');
const text = process.argv.slice(2).join(' ');
if (!text) { console.error('usage: node scripts/reply.js "<text>"'); process.exit(1); }
console.log(JSON.stringify(appendMessage({ from: 'assistant', text })));
