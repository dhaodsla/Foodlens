import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  app.post("/api/analyze-food", async (req, res) => {
    try {
      const { imageBase64, mimeType } = req.body;
      if (!imageBase64 || !mimeType) {
        return res.status(400).json({ error: "Missing imageBase64 or mimeType" });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash", 
        contents: [
          {
            inlineData: {
              data: imageBase64,
              mimeType: mimeType,
            },
          },
          "Analyze this food image. Identify the food item, estimate the total calories for the entire portion shown, estimate the portion weight in grams, provide the calories per 100g, and provide a rough macronutrient breakdown (protein, carbs, fat) for the entire portion. Also provide a list of key ingredients you suspect are in it. Respond in Korean.",
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              foodName: { type: Type.STRING, description: "음식 이름" },
              totalCalories: { type: Type.NUMBER, description: "총 제공량 기준 총 칼로리 추정치 (kcal)" },
              caloriesPer100g: { type: Type.NUMBER, description: "100g당 칼로리 (kcal)" },
              estimatedWeight: { type: Type.NUMBER, description: "사진 상의 총 제공량 추정치 (g)" },
              protein: { type: Type.NUMBER, description: "총 제공량 기준 단백질 추정치 (g)" },
              carbs: { type: Type.NUMBER, description: "총 제공량 기준 탄수화물 추정치 (g)" },
              fat: { type: Type.NUMBER, description: "총 제공량 기준 지방 추정치 (g)" },
              ingredients: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "주요 재료 목록",
              },
              description: { type: Type.STRING, description: "음식에 대한 짧은 설명 및 분석 이유" },
            },
            required: ["foodName", "totalCalories", "caloriesPer100g", "estimatedWeight", "protein", "carbs", "fat", "ingredients", "description"],
          },
        },
      });

      const text = response.text;
      if (text) {
        const jsonStr = text.trim();
        const result = JSON.parse(jsonStr);
        res.json(result);
      } else {
        res.status(500).json({ error: "Failed to generate content" });
      }
    } catch (error) {
      console.error("Analysis Error:", error);
      res.status(500).json({ error: "Failed to parse image with AI" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
