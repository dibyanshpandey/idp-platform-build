require('dotenv').config();
const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function run() {
  try {
    const models = await groq.models.list();
    console.log(models.data.map(m => m.id).join('\n'));
  } catch (err) {
    console.error(err);
  }
}
run();
