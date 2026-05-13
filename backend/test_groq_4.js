require('dotenv').config();
const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function test() {
  const systemPrompt = `
  You are a document extraction API. 
  Extract all relevant key-value pairs from the following OCR text. 
  Try to identify fields like Account Number, Date, Invoice Number, Amounts, Names, Addresses, etc.
  Return ONLY a valid, flat JSON object where the keys are snake_case representations of the field names, and the values are the exact strings as they appear in the text.
  `;

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Document Text:\nInvoice 1234\nTotal: 50.00" }
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
