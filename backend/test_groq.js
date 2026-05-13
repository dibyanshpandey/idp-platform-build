require('dotenv').config();
const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function test() {
  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: "You are a test bot." },
        { role: "user", content: "Hello" }
      ],
      model: "llama-3.1-8b-instant",
      response_format: { type: "json_object" }
    });
    console.log("Success:", chatCompletion.choices[0]?.message?.content);
  } catch (error) {
    console.error("Error:", error);
  }
}
test();
