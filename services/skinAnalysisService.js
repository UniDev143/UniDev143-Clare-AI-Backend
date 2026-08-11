const Anthropic = require("@anthropic-ai/sdk");
const {
  SKIN_ANALYSIS_SYSTEM_PROMPT,
  SKIN_ANALYSIS_USER_PROMPT,
  PROMPT_VERSION,
} = require("../prompts/skinAnalysisPrompt");
const { validateAnalysis } = require("./analysisValidator");

const client = new Anthropic({
  apiKey:     process.env.ANTHROPIC_API_KEY,
  timeout:    30 * 1000,   // 30s per attempt
  maxRetries: 0,           // we handle retries ourselves in analyseSkinWithRetry
});

// ── MAIN ANALYSIS FUNCTION ─────────────────────────────────
const analyseSkin = async (
  imageData,
  mimeType = "image/jpeg",
  questionnaire = null,
) => {
  // Build prompt — inject questionnaire context if available
  let userPrompt = SKIN_ANALYSIS_USER_PROMPT;

  if (questionnaire) {
    userPrompt += `

Additional context provided by the user (use to inform but not override visual observations):
- Skin sensitivity: ${questionnaire.skinSensitivity}
- Primary concern: ${questionnaire.primaryConcern}
- Current routine: ${questionnaire.currentRoutine}
- Budget level: ${questionnaire.budget}
- Known allergies: ${questionnaire.allergies?.join(", ") || "none stated"}

Base ALL severity ratings purely on visual evidence. Questionnaire context only informs the aiSummary tone.`;
  }

  console.log(
    `[SkinAnalysis] Calling Anthropic API (prompt v${PROMPT_VERSION})`,
  );
  const startTime = Date.now();

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      temperature: 0.2, // ← ADD THIS — low = consistent structured output
      system: SKIN_ANALYSIS_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType,
                data: imageData,
              },
            },
            {
              type: "text",
              text: userPrompt,
            },
          ],
        },
      ],
    });

    const elapsed = Date.now() - startTime;
    const rawText = response.content[0]?.text || "";
    const tokens = response.usage;

    console.log(
      `[SkinAnalysis] Response in ${elapsed}ms | tokens: ${tokens?.input_tokens}in / ${tokens?.output_tokens}out`,
    );

    // ── PARSE JSON ──────────────────────────────────────
    let parsed;
    try {
      // Strip markdown fences if model accidentally includes them
      const cleaned = rawText.replace(/```json\n?|\n?```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch (parseError) {
      console.error(
        "[SkinAnalysis] JSON parse failed. Raw response:",
        rawText.substring(0, 500),
      );
      throw new Error("AI returned invalid JSON — analysis failed");
    }

    // ── VALIDATE ────────────────────────────────────────
    const validation = validateAnalysis(parsed);

    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(", ")}`);
    }

    // Log non-fatal corrections for prompt tuning
    if (validation.errors.length > 0) {
      console.log("[SkinAnalysis] Non-fatal corrections:", validation.errors);
    }

    return {
      success: true,
      rejected: validation.rejected || false,
      rejectionReason: validation.rejectionReason || null,
      data: validation.data,
    };
  } catch (error) {
    // Anthropic API errors
    if (error.status === 401) throw new Error("Invalid Anthropic API key");
    if (error.status === 429)
      throw new Error("API rate limit reached — try again in a moment");
    if (error.status === 400)
      throw new Error("Image format not supported by API");
    throw error;
  }
};

// ── RETRY WRAPPER ──────────────────────────────────────────
// For transient failures (network blips, rate limits), retry once
const NON_RETRYABLE = ['Invalid Anthropic', 'Image format not supported'];

const analyseSkinWithRetry = async (imageData, mimeType, questionnaire, retries = 1) => {
  try {
    return await analyseSkin(imageData, mimeType, questionnaire);
  } catch (error) {
    const permanent = NON_RETRYABLE.some(m => error.message.includes(m));
    if (retries > 0 && !permanent) {
      console.log(`[SkinAnalysis] Retrying after error: ${error.message}`);
      await new Promise(r => setTimeout(r, 2000));
      return analyseSkinWithRetry(imageData, mimeType, questionnaire, retries - 1);
    }
    throw error;
  }
};

module.exports = { analyseSkin, analyseSkinWithRetry };
