import { GoogleGenAI } from "@google/genai";
import { CountryCode, Proposal } from "../types";

const COUNTRIES: Record<CountryCode, { name: string; systemInstruction: string }> = {
  DE: {
    name: '德國 (Germany)',
    systemInstruction: "你扮演德國內政部長。立場：重視財政紀律與國內安全。反對直接債務共同化，要求難民進入前必須篩選。你受到國內選民壓力，發言務實且強硬。"
  },
  GR: {
    name: '希臘 (Greece)',
    systemInstruction: "你扮演希臘移民部長。立場：作為地中海前線，你要求強制配額分流與歐盟全額補助。語氣帶有急迫感，強調希臘正在為全歐洲擋下壓力。"
  },
  FR: {
    name: '法國 (France)',
    systemInstruction: "你扮演法國總統特使。立場：尋求歐洲折衷方案，致力於避免歐盟分裂。發言充滿外交辭令，宏觀優雅。"
  },
  HU: {
    name: '匈牙利 (Hungary)',
    systemInstruction: "你扮演匈牙利總理代表。立場：強烈主權主義，將強制配額視為勒索。要求建立堡壘化邊界，發言極度強硬且頻繁威脅行使否決權。"
  }
};

export async function callAI(
  code: CountryCode,
  text: string,
  proposal: Proposal,
  apiKey: string
): Promise<string> {
  if (!apiKey) {
    throw new Error("API Key is required");
  }

  const ai = new GoogleGenAI({ apiKey });
  const country = COUNTRIES[code];
  const prompt = `${country.systemInstruction}
目前政策提案參數：
- 邊境管控強度：${proposal.borderControl}%
- 強制團結配額：${proposal.quotaMandatory}%
- 前線財務補償：${proposal.financialSupport}%

高峰會主席（使用者）聲明：「${text}」

請以該國代表的身分進行回應。回應應在 50-100 字之間，展現你的國家立場、對目前參數的滿意度或不滿，以及對主席聲明的看法。請直接輸出回應內容，不要包含角色名稱。`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: prompt }] }],
    });

    return response.text || "（代表陷入沉思，暫無回應）";
  } catch (error) {
    console.error(`Error calling Gemini for ${code}:`, error);
    return "（通訊中斷，該國暫時無法回應）";
  }
}
