// Seed script: populates sample prospects and a campaign for demo purposes.
// Run with: node seed.js

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const now = new Date().toISOString();

const prospects = [
  {
    id: uuidv4(), firstName: 'Sarah', lastName: 'Chen', title: 'VP of Sales',
    company: 'CloudScale AI', industry: 'SaaS', companySize: '120',
    linkedinUrl: '', email: 'sarah.chen@cloudscale.io',
    location: 'San Francisco, CA',
    bio: 'Sales leader with 12+ years scaling B2B SaaS revenue from $2M to $40M ARR. Passionate about AI-driven sales enablement and building high-performance teams.',
    notes: 'Active on LinkedIn, posts about sales strategy weekly.',
    status: 'new', score: 0, tags: [], campaignId: null, messages: [],
    createdAt: now, updatedAt: now,
  },
  {
    id: uuidv4(), firstName: 'Marcus', lastName: 'Johnson', title: 'Head of Growth',
    company: 'Fintech Solutions', industry: 'Technology', companySize: '250',
    linkedinUrl: '', email: 'mjohnson@fintechsolutions.com',
    location: 'New York, NY',
    bio: 'Growth marketer turned revenue leader. Led demand gen at two unicorn startups. Currently building the GTM engine at Fintech Solutions.',
    notes: 'Spoke at SaaStr conference last year about outbound strategies.',
    status: 'contacted', score: 0, tags: [], campaignId: null, messages: [],
    createdAt: now, updatedAt: now,
  },
  {
    id: uuidv4(), firstName: 'Emily', lastName: 'Rodriguez', title: 'Director of Business Development',
    company: 'Apex Consulting Group', industry: 'Professional Services', companySize: '75',
    linkedinUrl: '', email: 'emily.r@apexconsulting.com',
    location: 'Austin, TX',
    bio: 'Helping professional services firms grow through strategic partnerships and outbound sales. Former McKinsey consultant.',
    notes: 'Company recently raised Series B. Likely expanding sales team.',
    status: 'new', score: 0, tags: [], campaignId: null, messages: [],
    createdAt: now, updatedAt: now,
  },
  {
    id: uuidv4(), firstName: 'David', lastName: 'Kim', title: 'CEO',
    company: 'PipelineIQ', industry: 'SaaS', companySize: '35',
    linkedinUrl: '', email: 'david@pipelineiq.com',
    location: 'Seattle, WA',
    bio: 'Second-time founder building AI tools for sales teams. Previously sold DataFlow to Salesforce. YC W22.',
    notes: 'Competitor adjacent - could be a partner or customer.',
    status: 'new', score: 0, tags: [], campaignId: null, messages: [],
    createdAt: now, updatedAt: now,
  },
  {
    id: uuidv4(), firstName: 'Lisa', lastName: 'Wang', title: 'Founder & CEO',
    company: 'GrowthLab Agency', industry: 'Marketing Agency', companySize: '20',
    linkedinUrl: '', email: 'lisa@growthlabagency.com',
    location: 'Los Angeles, CA',
    bio: 'Running a boutique growth marketing agency. We help B2B SaaS companies generate qualified pipeline through content, paid, and outbound.',
    notes: 'Agency owner who might use this for her clients too. High leverage prospect.',
    status: 'replied', score: 0, tags: [], campaignId: null, messages: [],
    createdAt: now, updatedAt: now,
  },
  {
    id: uuidv4(), firstName: 'James', lastName: 'Peterson', title: 'VP of Revenue',
    company: 'Nexus Platforms', industry: 'Technology', companySize: '400',
    linkedinUrl: '', email: 'j.peterson@nexusplatforms.io',
    location: 'Chicago, IL',
    bio: 'Revenue operations leader. Built and led revenue teams at three venture-backed startups. Obsessed with process and data.',
    notes: 'Big enough company to have budget. Title suggests decision-making authority.',
    status: 'new', score: 0, tags: [], campaignId: null, messages: [],
    createdAt: now, updatedAt: now,
  },
  {
    id: uuidv4(), firstName: 'Amanda', lastName: 'Torres', title: 'Head of Sales Operations',
    company: 'Bright Health Tech', industry: 'Healthcare', companySize: '180',
    linkedinUrl: '', email: 'atorres@brighthealthtech.com',
    location: 'Boston, MA',
    bio: 'Sales ops leader focused on enabling reps with better tools and processes. Background in healthcare SaaS.',
    notes: 'Healthcare is outside our primary ICP but still in tech.',
    status: 'new', score: 0, tags: [], campaignId: null, messages: [],
    createdAt: now, updatedAt: now,
  },
  {
    id: uuidv4(), firstName: 'Ryan', lastName: 'Mitchell', title: 'Founder',
    company: 'OutreachPro', industry: 'SaaS', companySize: '15',
    linkedinUrl: '', email: 'ryan@outreachpro.io',
    location: 'Denver, CO',
    bio: 'Building tools to help sales teams prospect smarter. Former SDR who got tired of manual prospecting.',
    notes: 'Small company, might not have budget yet. But perfect ICP match on pain points.',
    status: 'new', score: 0, tags: [], campaignId: null, messages: [],
    createdAt: now, updatedAt: now,
  },
  {
    id: uuidv4(), firstName: 'Jennifer', lastName: 'Clark', title: 'CMO',
    company: 'Retail Analytics Co', industry: 'Retail', companySize: '90',
    linkedinUrl: '', email: 'jclark@retailanalytics.com',
    location: 'Miami, FL',
    bio: 'Marketing executive with deep expertise in retail tech. Driving digital transformation for brick-and-mortar retailers.',
    notes: 'Not in our target industry but interesting profile.',
    status: 'not_interested', score: 0, tags: [], campaignId: null, messages: [],
    createdAt: now, updatedAt: now,
  },
  {
    id: uuidv4(), firstName: 'Michael', lastName: 'Brooks', title: 'Director of Sales',
    company: 'Venture CRM', industry: 'SaaS', companySize: '60',
    linkedinUrl: '', email: 'mbrooks@venturecrm.com',
    location: 'Portland, OR',
    bio: 'Building the sales org at Venture CRM. Focused on product-led growth meets outbound. Previously at HubSpot.',
    notes: 'Ex-HubSpot. Likely knows the space well. Reference HubSpot experience in outreach.',
    status: 'meeting_booked', score: 0, tags: [], campaignId: null, messages: [],
    createdAt: now, updatedAt: now,
  },
];

const campaignId = uuidv4();
const campaigns = [
  {
    id: campaignId,
    name: 'Q1 2026 SaaS Sales Leaders',
    status: 'active',
    icpName: 'Default ICP',
    sequence: [
      { step: 1, type: 'connection', delayDays: 0, templateId: null },
      { step: 2, type: 'followup_1', delayDays: 3, templateId: null },
      { step: 3, type: 'followup_2', delayDays: 5, templateId: null },
      { step: 4, type: 'breakup', delayDays: 7, templateId: null },
    ],
    stats: { sent: 8, replied: 2, meetings: 1, converted: 0 },
    prospectIds: prospects.slice(0, 6).map(p => p.id),
    createdAt: now,
    updatedAt: now,
  },
];

fs.writeFileSync(path.join(DATA_DIR, 'prospects.json'), JSON.stringify(prospects, null, 2));
fs.writeFileSync(path.join(DATA_DIR, 'campaigns.json'), JSON.stringify(campaigns, null, 2));

console.log(`Seeded ${prospects.length} prospects and ${campaigns.length} campaign.`);
console.log('Run "npm start" to launch the app.');
