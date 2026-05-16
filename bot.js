const TelegramBot = require('node-telegram-bot-api');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const axios = require('axios');
const http = require('http'); // <-- ADICIONADO

const CONFIG = {
  TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN || '8519128033:AAGXuuGLY_Fyyk4scteq3ut9bblo-33bu1g',
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || '6334476401',
  EMAIL_USER: process.env.EMAIL_USER || 'miguelboco21@gmail.com',
  EMAIL_PASS: process.env.EMAIL_PASS || 'ipjx jjug vvfq dqla',
  EMAIL_TO: process.env.EMAIL_TO || 'miguelboco21@gmail.com',
  CHECK_INTERVAL_MINUTES: 1,
  VFS_URL: 'https://visa.vfsglobal.com/prt/pt/prt/book-an-appointment',
};

const bot = new TelegramBot(CONFIG.TELEGRAM_TOKEN, { polling: false });
let scanCount = 0;

async function checkVFS() {
  scanCount++;
  console.log(`Scan #${scanCount} - ${new Date().toLocaleString('pt-PT')}`);
  try {
    const res = await axios.get(CONFIG.VFS_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 15000
    });
    const html = res.data.toLowerCase();
    const noSlot = ['no appointment','no slots','sem vagas','fully booked','not available','currently unavailable'].some(k => html.includes(k));
    const hasSlot = ['book appointment','select date','available','agendar','selecionar'].some(k => html.includes(k));
    if (hasSlot && !noSlot) {
      console.log('VAGA ENCONTRADA!');
      await sendTelegram('🚨 VAGA ENCONTRADA no VFS Global!\n\n👉 ' + CONFIG.VFS_URL);
      await sendEmail();
    } else {
      console.log('Sem vagas.');
    }
  } catch(e) {
    console.log('Erro:', e.message);
  }
}

async function sendTelegram(msg) {
  try {
    await bot.sendMessage(CONFIG.TELEGRAM_CHAT_ID, msg);
    console.log('Telegram enviado!');
  } catch(e) { console.log('Telegram erro:', e.message); }
}

async function sendEmail() {
  try {
    const t = nodemailer.createTransport({ service:'gmail', auth:{ user:CONFIG.EMAIL_USER, pass:CONFIG.EMAIL_PASS }});
    await t.sendMail({ from:CONFIG.EMAIL_USER, to:CONFIG.EMAIL_TO, subject:'🚨 VAGA VFS ENCONTRADA!', text:'Vaga disponível! Acede agora: ' + CONFIG.VFS_URL });
    console.log('Email enviado!');
  } catch(e) { console.log('Email erro:', e.message); }
}

// SERVIDOR HTTP para o Railway não encerrar o processo
const PORT = process.env.PORT || 8080;
http.createServer((req, res) => {
  res.writeHead(200);
  res.end(`VFS Monitor ativo. Scans: ${scanCount}`);
}).listen(PORT, () => console.log(`Servidor HTTP na porta ${PORT}`));

async function main() {
  console.log('VFS Monitor iniciado!');
  await sendTelegram('✅ VFS Monitor ACTIVO!\nVou avisar quando aparecer vaga.\n\nA verificar a cada ' + CONFIG.CHECK_INTERVAL_MINUTES + ' minuto(s).');
  await checkVFS();
  cron.schedule(`*/${CONFIG.CHECK_INTERVAL_MINUTES} * * * *`, checkVFS);
}

main().catch(console.error);
