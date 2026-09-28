/**
 * Gemini API (Nano Banana Pro) による画像生成
 *
 * ai-channnel-infographic-test/.agent/skills/image-gen/image_gen.js を
 * CLI から呼び出し可能な関数に作り直したもの
 */

const { GoogleGenAI } = require('@google/genai');
const { requireEnv } = require('./config');

const MODEL_NAME = process.env.NANOBANANA_MODEL || 'gemini-3-pro-image-preview';

let client = null;
function getClient() {
  if (!client) {
    const { GEMINI_API_KEY } = requireEnv(['GEMINI_API_KEY']);
    client = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  }
  return client;
}

/**
 * プロンプトから画像を1枚生成
 * @param {string} prompt - 画像生成プロンプト
 * @param {Object} [options]
 * @param {string} [options.aspectRatio='4:5'] - Instagram縦長フィード
 * @param {string} [options.imageSize='2K'] - 1K / 2K / 4K（大文字K必須）
 * @returns {Promise<Buffer>} 画像データ（PNG）
 */
async function generateImage(prompt, { aspectRatio = '4:5', imageSize = '2K' } = {}) {
  const response = await getClient().models.generateContent({
    model: MODEL_NAME,
    contents: [{ text: prompt }],
    config: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { imageSize, aspectRatio },
    },
  });

  const parts = (response.candidates && response.candidates[0] && response.candidates[0].content
    && response.candidates[0].content.parts) || [];
  const imagePart = parts.find((p) => p.inlineData && p.inlineData.data);
  if (!imagePart) {
    const text = parts.filter((p) => p.text).map((p) => p.text).join('\n');
    throw new Error(`画像が返ってこなかった（model: ${MODEL_NAME}）${text ? `: ${text}` : ''}`);
  }
  return Buffer.from(imagePart.inlineData.data, 'base64');
}

module.exports = { generateImage, MODEL_NAME };
