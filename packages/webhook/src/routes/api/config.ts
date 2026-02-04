import { Router } from "express";
import {
  getConfig,
  saveConfig,
  getBotDisplayName,
  CLAUDE_MODELS,
  isValidJiraUrl,
  type AppConfig,
} from "@mapthew/shared";

const router: Router = Router();

// GET /api/config
router.get("/", async (_req, res) => {
  try {
    const config = await getConfig();
    res.json({
      botName: config.botName,
      botDisplayName: getBotDisplayName(),
      claudeModel: config.claudeModel,
      availableModels: CLAUDE_MODELS,
      jiraBaseUrl: config.jiraBaseUrl,
    });
  } catch (error) {
    console.error("Error getting config:", error);
    res.status(500).json({ error: "Failed to get config" });
  }
});

// PUT /api/config
router.put("/", async (req, res) => {
  try {
    const { botName, claudeModel, jiraBaseUrl } = req.body as Partial<AppConfig>;
    const config = await getConfig();

    if (botName !== undefined) {
      const oldBotName = config.botName;
      config.botName = botName;
      if (oldBotName !== botName) {
        console.log(`Bot name updated: "${oldBotName}" -> "${botName}"`);
      }
    }

    if (claudeModel !== undefined) {
      if (!CLAUDE_MODELS.includes(claudeModel)) {
        res.status(400).json({
          error: `Invalid model. Must be one of: ${CLAUDE_MODELS.join(", ")}`,
        });
        return;
      }
      config.claudeModel = claudeModel;
    }

    if (jiraBaseUrl !== undefined) {
      if (!isValidJiraUrl(jiraBaseUrl)) {
        res.status(400).json({
          error: "Invalid JIRA base URL. Must be a valid HTTPS URL.",
        });
        return;
      }
      config.jiraBaseUrl = jiraBaseUrl;
    }

    await saveConfig(config);
    console.log(`Config updated: botName=${config.botName}, claudeModel=${config.claudeModel}, jiraBaseUrl=${config.jiraBaseUrl}`);

    const updatedConfig = await getConfig();
    res.json({
      botName: updatedConfig.botName,
      botDisplayName: getBotDisplayName(),
      claudeModel: updatedConfig.claudeModel,
      availableModels: CLAUDE_MODELS,
      jiraBaseUrl: updatedConfig.jiraBaseUrl,
    });
  } catch (error) {
    console.error("Error updating config:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
