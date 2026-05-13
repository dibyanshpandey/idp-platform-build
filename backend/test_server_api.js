const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

async function test() {
  try {
    const formData = new FormData();
    formData.append('document', fs.createReadStream('/Users/dibyanshpandey/.gemini/antigravity/brain/ec2e4dce-d3a1-4444-a1e7-7d18265eaa3d/sample_document_1777363449206.png'));
    
    console.log("Sending request...");
    const response = await axios.post('http://localhost:3001/api/documents/upload', formData, {
      headers: {
        ...formData.getHeaders()
      }
    });
    console.log("SUCCESS");
    console.log(JSON.stringify(response.data, null, 2).slice(0, 500) + "\n...");
  } catch (error) {
    console.error("FAILED:", error.response?.data || error.message);
  }
}
test();
