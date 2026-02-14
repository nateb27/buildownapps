const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// ---------------------------------------------------------------------------
// Data persistence helpers
// ---------------------------------------------------------------------------
const DATA_DIR = path.join(__dirname, 'data');
const PROSPECTS_FILE = path.join(DATA_DIR, 'prospects.json');
const CAMPAIGNS_FILE = path.join(DATA_DIR, 'campaigns.json');
const ICP_FILE = path.join(DATA_DIR, 'icp.json');
const TEMPLATES_FILE = path.join(DATA_DIR, 'templates.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJSON(filepath, fallback) {
  ensureDataDir();
  if (!fs.existsSync(filepath)) {
    fs.writeFileSync(filepath, JSON.stringify(fallback, null, 2));
    return fallback;
  }
  return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
}

function writeJSON(filepath, data) {
  ensureDataDir();
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
}

// ---------------------------------------------------------------------------
// Claude AI integration
// ---------------------------------------------------------------------------
let anthropicClient = null;

function getAnthropicClient() {
  if (anthropicClient) return anthropicClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const Anthropic = require('@anthropic-ai/sdk');
  anthropicClient = new Anthropic({ apiKey });
  return anthropicClient;
}

async function callClaude(systemPrompt, userPrompt) {
  const client = getAnthropicClient();
  if (!client) {
    throw new Error('ANTHROPIC_API_KEY not configured. Set it in your .env file.');
  }
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });
  return response.content[0].text;
}

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------
const DEFAULT_ICP = {
  name: 'Default ICP',
  titles: ['VP of Sales', 'Head of Growth', 'Director of Business Development', 'CEO', 'Founder'],
  industries: ['SaaS', 'Technology', 'Professional Services', 'Marketing Agency'],
  companySize: { min: 10, max: 500 },
  painPoints: [
    'Slow lead response times',
    'Manual prospecting is time-consuming',
    'Low conversion from outreach',
    'Difficulty scaling outbound sales',
  ],
  keywords: ['growth', 'sales', 'pipeline', 'revenue', 'outbound'],
};

const DEFAULT_TEMPLATES = [
  {
    id: 'tmpl-connection-1',
    name: 'Connection Request - Mutual Value',
    type: 'connection',
    subject: '',
    body: "Hi {{firstName}}, I came across your profile and was impressed by your work at {{company}}. I'm focused on helping {{industry}} leaders solve {{painPoint}}. Would love to connect and share ideas.",
    createdAt: new Date().toISOString(),
  },
  {
    id: 'tmpl-followup-1',
    name: 'Follow-up #1 - Value Lead',
    type: 'followup_1',
    subject: '',
    body: "Hi {{firstName}}, thanks for connecting! I noticed {{company}} is growing fast in the {{industry}} space. Many leaders I work with struggle with {{painPoint}}. I put together a quick framework that's helped similar companies — happy to share if you're interested.",
    createdAt: new Date().toISOString(),
  },
  {
    id: 'tmpl-followup-2',
    name: 'Follow-up #2 - Social Proof',
    type: 'followup_2',
    subject: '',
    body: "Hi {{firstName}}, just wanted to circle back. We recently helped a {{industry}} company similar to {{company}} cut their prospecting time by 60% while doubling their response rates. Would a quick 15-min chat be worth your time this week?",
    createdAt: new Date().toISOString(),
  },
  {
    id: 'tmpl-breakup-1',
    name: 'Break-up Message',
    type: 'breakup',
    subject: '',
    body: "Hi {{firstName}}, I know you're busy so I'll keep this short. I've reached out a couple times about helping {{company}} with {{painPoint}}. If the timing isn't right, no worries at all. But if this is something you'd like to explore down the road, I'm just a message away. Wishing you and the team continued success!",
    createdAt: new Date().toISOString(),
  },
];

// ---------------------------------------------------------------------------
// API Routes — Prospects
// ---------------------------------------------------------------------------
app.get('/api/prospects', (req, res) => {
  const prospects = readJSON(PROSPECTS_FILE, []);
  res.json(prospects);
});

app.get('/api/prospects/:id', (req, res) => {
  const prospects = readJSON(PROSPECTS_FILE, []);
  const prospect = prospects.find((p) => p.id === req.params.id);
  if (!prospect) return res.status(404).json({ error: 'Prospect not found' });
  res.json(prospect);
});

app.post('/api/prospects', (req, res) => {
  const prospects = readJSON(PROSPECTS_FILE, []);
  const prospect = {
    id: uuidv4(),
    firstName: req.body.firstName || '',
    lastName: req.body.lastName || '',
    title: req.body.title || '',
    company: req.body.company || '',
    industry: req.body.industry || '',
    companySize: req.body.companySize || '',
    linkedinUrl: req.body.linkedinUrl || '',
    email: req.body.email || '',
    location: req.body.location || '',
    bio: req.body.bio || '',
    notes: req.body.notes || '',
    status: 'new',
    score: req.body.score || 0,
    tags: req.body.tags || [],
    campaignId: req.body.campaignId || null,
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  prospects.push(prospect);
  writeJSON(PROSPECTS_FILE, prospects);
  res.status(201).json(prospect);
});

app.put('/api/prospects/:id', (req, res) => {
  const prospects = readJSON(PROSPECTS_FILE, []);
  const idx = prospects.findIndex((p) => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Prospect not found' });
  prospects[idx] = { ...prospects[idx], ...req.body, updatedAt: new Date().toISOString() };
  writeJSON(PROSPECTS_FILE, prospects);
  res.json(prospects[idx]);
});

app.delete('/api/prospects/:id', (req, res) => {
  let prospects = readJSON(PROSPECTS_FILE, []);
  prospects = prospects.filter((p) => p.id !== req.params.id);
  writeJSON(PROSPECTS_FILE, prospects);
  res.json({ success: true });
});

// Bulk import prospects
app.post('/api/prospects/import', (req, res) => {
  const prospects = readJSON(PROSPECTS_FILE, []);
  const imported = (req.body.prospects || []).map((p) => ({
    id: uuidv4(),
    firstName: p.firstName || '',
    lastName: p.lastName || '',
    title: p.title || '',
    company: p.company || '',
    industry: p.industry || '',
    companySize: p.companySize || '',
    linkedinUrl: p.linkedinUrl || '',
    email: p.email || '',
    location: p.location || '',
    bio: p.bio || '',
    notes: p.notes || '',
    status: 'new',
    score: 0,
    tags: p.tags || [],
    campaignId: null,
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
  prospects.push(...imported);
  writeJSON(PROSPECTS_FILE, prospects);
  res.status(201).json({ imported: imported.length, total: prospects.length });
});

// ---------------------------------------------------------------------------
// API Routes — Campaigns
// ---------------------------------------------------------------------------
app.get('/api/campaigns', (req, res) => {
  const campaigns = readJSON(CAMPAIGNS_FILE, []);
  res.json(campaigns);
});

app.post('/api/campaigns', (req, res) => {
  const campaigns = readJSON(CAMPAIGNS_FILE, []);
  const campaign = {
    id: uuidv4(),
    name: req.body.name || 'Untitled Campaign',
    status: 'draft',
    icpName: req.body.icpName || 'Default ICP',
    sequence: req.body.sequence || [
      { step: 1, type: 'connection', delayDays: 0, templateId: null },
      { step: 2, type: 'followup_1', delayDays: 3, templateId: null },
      { step: 3, type: 'followup_2', delayDays: 5, templateId: null },
      { step: 4, type: 'breakup', delayDays: 7, templateId: null },
    ],
    stats: { sent: 0, replied: 0, meetings: 0, converted: 0 },
    prospectIds: req.body.prospectIds || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  campaigns.push(campaign);
  writeJSON(CAMPAIGNS_FILE, campaigns);
  res.status(201).json(campaign);
});

app.put('/api/campaigns/:id', (req, res) => {
  const campaigns = readJSON(CAMPAIGNS_FILE, []);
  const idx = campaigns.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Campaign not found' });
  campaigns[idx] = { ...campaigns[idx], ...req.body, updatedAt: new Date().toISOString() };
  writeJSON(CAMPAIGNS_FILE, campaigns);
  res.json(campaigns[idx]);
});

app.delete('/api/campaigns/:id', (req, res) => {
  let campaigns = readJSON(CAMPAIGNS_FILE, []);
  campaigns = campaigns.filter((c) => c.id !== req.params.id);
  writeJSON(CAMPAIGNS_FILE, campaigns);
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// API Routes — ICP (Ideal Customer Profile)
// ---------------------------------------------------------------------------
app.get('/api/icp', (req, res) => {
  const icp = readJSON(ICP_FILE, DEFAULT_ICP);
  res.json(icp);
});

app.put('/api/icp', (req, res) => {
  const icp = { ...DEFAULT_ICP, ...req.body };
  writeJSON(ICP_FILE, icp);
  res.json(icp);
});

// ---------------------------------------------------------------------------
// API Routes — Templates
// ---------------------------------------------------------------------------
app.get('/api/templates', (req, res) => {
  const templates = readJSON(TEMPLATES_FILE, DEFAULT_TEMPLATES);
  res.json(templates);
});

app.post('/api/templates', (req, res) => {
  const templates = readJSON(TEMPLATES_FILE, DEFAULT_TEMPLATES);
  const template = {
    id: uuidv4(),
    name: req.body.name || 'Untitled Template',
    type: req.body.type || 'connection',
    subject: req.body.subject || '',
    body: req.body.body || '',
    createdAt: new Date().toISOString(),
  };
  templates.push(template);
  writeJSON(TEMPLATES_FILE, templates);
  res.status(201).json(template);
});

app.put('/api/templates/:id', (req, res) => {
  const templates = readJSON(TEMPLATES_FILE, DEFAULT_TEMPLATES);
  const idx = templates.findIndex((t) => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Template not found' });
  templates[idx] = { ...templates[idx], ...req.body };
  writeJSON(TEMPLATES_FILE, templates);
  res.json(templates[idx]);
});

app.delete('/api/templates/:id', (req, res) => {
  let templates = readJSON(TEMPLATES_FILE, DEFAULT_TEMPLATES);
  templates = templates.filter((t) => t.id !== req.params.id);
  writeJSON(TEMPLATES_FILE, templates);
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// API Routes — AI-Powered Features
// ---------------------------------------------------------------------------

// Score a prospect against the ICP
app.post('/api/ai/score-prospect', async (req, res) => {
  try {
    const icp = readJSON(ICP_FILE, DEFAULT_ICP);
    const prospect = req.body.prospect;
    if (!prospect) return res.status(400).json({ error: 'Prospect data required' });

    const systemPrompt = `You are an expert B2B sales analyst. Score prospects against an Ideal Customer Profile (ICP).
Return a JSON object with:
- "score": a number from 0-100
- "reasons": an array of 3-5 short strings explaining the score
- "recommendation": one of "hot_lead", "warm_lead", "cold_lead", or "not_a_fit"

Return ONLY valid JSON, no markdown fences or extra text.`;

    const userPrompt = `Score this prospect against our ICP.

ICP:
- Target titles: ${icp.titles.join(', ')}
- Target industries: ${icp.industries.join(', ')}
- Company size: ${icp.companySize.min}-${icp.companySize.max} employees
- Pain points we solve: ${icp.painPoints.join(', ')}

Prospect:
- Name: ${prospect.firstName} ${prospect.lastName}
- Title: ${prospect.title}
- Company: ${prospect.company}
- Industry: ${prospect.industry}
- Company size: ${prospect.companySize}
- Bio: ${prospect.bio || 'N/A'}
- Notes: ${prospect.notes || 'N/A'}`;

    const result = await callClaude(systemPrompt, userPrompt);
    const parsed = JSON.parse(result);
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate personalized outreach message
app.post('/api/ai/generate-message', async (req, res) => {
  try {
    const { prospect, messageType, context } = req.body;
    if (!prospect) return res.status(400).json({ error: 'Prospect data required' });

    const icp = readJSON(ICP_FILE, DEFAULT_ICP);
    const typeLabels = {
      connection: 'LinkedIn connection request (max 300 characters)',
      followup_1: 'first follow-up message after connecting',
      followup_2: 'second follow-up with social proof or case study',
      breakup: 'polite break-up / last-chance message',
      inmail: 'LinkedIn InMail (can be longer, include subject line)',
    };

    const systemPrompt = `You are an elite LinkedIn outreach copywriter. You write messages that feel personal, relevant, and human — never salesy or generic.

Rules:
- Use the prospect's first name naturally
- Reference their specific role, company, or industry
- Lead with value, not a pitch
- Keep it conversational and concise
- Never use phrases like "I hope this finds you well" or "I'd love to pick your brain"
- For connection requests, stay under 300 characters
- Match the tone to the message type

Return a JSON object with:
- "subject": subject line (only for InMail type, empty string otherwise)
- "body": the message text

Return ONLY valid JSON, no markdown fences or extra text.`;

    const userPrompt = `Generate a ${typeLabels[messageType] || 'LinkedIn message'} for this prospect.

Prospect:
- First name: ${prospect.firstName}
- Last name: ${prospect.lastName}
- Title: ${prospect.title}
- Company: ${prospect.company}
- Industry: ${prospect.industry}
- Bio: ${prospect.bio || 'N/A'}
- Notes: ${prospect.notes || 'N/A'}

Our pain points we solve: ${icp.painPoints.join(', ')}

${context ? `Additional context: ${context}` : ''}`;

    const result = await callClaude(systemPrompt, userPrompt);
    const parsed = JSON.parse(result);
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Analyze a prospect's profile and suggest talking points
app.post('/api/ai/analyze-prospect', async (req, res) => {
  try {
    const prospect = req.body.prospect;
    if (!prospect) return res.status(400).json({ error: 'Prospect data required' });

    const icp = readJSON(ICP_FILE, DEFAULT_ICP);

    const systemPrompt = `You are an expert B2B sales researcher. Analyze a prospect's profile and provide actionable insights for outreach.

Return a JSON object with:
- "summary": 2-3 sentence overview of the prospect
- "talkingPoints": array of 3-5 specific talking points or hooks for outreach
- "painPointMatch": array of pain points from our ICP that likely resonate with this prospect
- "approachStrategy": recommended approach (e.g., "Lead with industry expertise", "Reference mutual connections", etc.)
- "riskFactors": array of 1-3 potential objections or reasons they might not be interested

Return ONLY valid JSON, no markdown fences or extra text.`;

    const userPrompt = `Analyze this prospect for LinkedIn outreach:

Prospect:
- Name: ${prospect.firstName} ${prospect.lastName}
- Title: ${prospect.title}
- Company: ${prospect.company}
- Industry: ${prospect.industry}
- Company size: ${prospect.companySize || 'Unknown'}
- Location: ${prospect.location || 'Unknown'}
- Bio: ${prospect.bio || 'N/A'}
- Notes: ${prospect.notes || 'N/A'}

Our ICP pain points: ${icp.painPoints.join(', ')}
Our target industries: ${icp.industries.join(', ')}`;

    const result = await callClaude(systemPrompt, userPrompt);
    const parsed = JSON.parse(result);
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk score all prospects
app.post('/api/ai/bulk-score', async (req, res) => {
  try {
    const prospects = readJSON(PROSPECTS_FILE, []);
    const icp = readJSON(ICP_FILE, DEFAULT_ICP);

    if (prospects.length === 0) {
      return res.json({ scored: 0 });
    }

    const systemPrompt = `You are an expert B2B sales analyst. Score a batch of prospects against an Ideal Customer Profile.

For each prospect, return a score from 0-100 and a recommendation.

Return a JSON array where each element has:
- "id": the prospect's id
- "score": number 0-100
- "recommendation": one of "hot_lead", "warm_lead", "cold_lead", "not_a_fit"

Return ONLY a valid JSON array, no markdown fences or extra text.`;

    const prospectSummaries = prospects.map(
      (p) =>
        `ID: ${p.id} | ${p.firstName} ${p.lastName} | ${p.title} at ${p.company} | Industry: ${p.industry} | Size: ${p.companySize || 'Unknown'}`
    );

    const userPrompt = `Score these prospects against our ICP.

ICP:
- Target titles: ${icp.titles.join(', ')}
- Target industries: ${icp.industries.join(', ')}
- Company size: ${icp.companySize.min}-${icp.companySize.max} employees
- Pain points: ${icp.painPoints.join(', ')}

Prospects:
${prospectSummaries.join('\n')}`;

    const result = await callClaude(systemPrompt, userPrompt);
    const scores = JSON.parse(result);

    // Update prospects with scores
    const scoreMap = new Map(scores.map((s) => [s.id, s]));
    const updated = prospects.map((p) => {
      const scoreData = scoreMap.get(p.id);
      if (scoreData) {
        return { ...p, score: scoreData.score, recommendation: scoreData.recommendation, updatedAt: new Date().toISOString() };
      }
      return p;
    });
    writeJSON(PROSPECTS_FILE, updated);

    res.json({ scored: scores.length, results: scores });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// API Routes — Dashboard stats
// ---------------------------------------------------------------------------
app.get('/api/stats', (req, res) => {
  const prospects = readJSON(PROSPECTS_FILE, []);
  const campaigns = readJSON(CAMPAIGNS_FILE, []);

  const statusCounts = {
    new: 0,
    contacted: 0,
    replied: 0,
    meeting_booked: 0,
    converted: 0,
    not_interested: 0,
  };

  let totalScore = 0;
  let scoredCount = 0;

  prospects.forEach((p) => {
    statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
    if (p.score > 0) {
      totalScore += p.score;
      scoredCount++;
    }
  });

  res.json({
    totalProspects: prospects.length,
    statusCounts,
    avgScore: scoredCount > 0 ? Math.round(totalScore / scoredCount) : 0,
    activeCampaigns: campaigns.filter((c) => c.status === 'active').length,
    totalCampaigns: campaigns.length,
    conversionRate:
      prospects.length > 0
        ? Math.round(((statusCounts.meeting_booked + statusCounts.converted) / prospects.length) * 100)
        : 0,
    replyRate:
      statusCounts.contacted > 0
        ? Math.round(
            ((statusCounts.replied + statusCounts.meeting_booked + statusCounts.converted) /
              (statusCounts.contacted + statusCounts.replied + statusCounts.meeting_booked + statusCounts.converted)) *
              100
          )
        : 0,
  });
});

// ---------------------------------------------------------------------------
// API Routes — AI config check
// ---------------------------------------------------------------------------
app.get('/api/ai/status', (req, res) => {
  const hasKey = !!process.env.ANTHROPIC_API_KEY;
  res.json({ configured: hasKey });
});

// ---------------------------------------------------------------------------
// Serve the SPA
// ---------------------------------------------------------------------------
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`LinkedIn Prospecting Agent running on http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('WARNING: ANTHROPIC_API_KEY not set. AI features will be unavailable.');
    console.log('Set it with: export ANTHROPIC_API_KEY=your_key_here');
  }
});
