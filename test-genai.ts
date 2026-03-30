import { GoogleGenAI } from "@google/genai";
async function run() {
  try {
    const ai = new GoogleGenAI({});
    const res = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Hello",
    });
    console.log(res.text);
  } catch (e) {
    console.error("Error:", e);
  }
}
run();
