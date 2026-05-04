const PptxGenJS = require('pptxgenjs');

// Create presentation
const prs = new PptxGenJS();
prs.defineLayout({ name: 'LAYOUT1', width: 13.33, height: 7.5 });
prs.layout = 'LAYOUT1';

// Design System Constants
const colors = {
  darkNavy: '1E2761',
  white: 'FFFFFF',
  indigo: '4F46E5',
  iceBlue: 'CADCFC',
  textDark: '111827',
  textLight: 'FFFFFF',
  successGreen: '10B981',
  warningAmber: 'F59E0B',
  lightBg: 'EEF2FF',
  darkAccent: '2D3A8C',
  gray: '9CA3AF',
  gray2: '374151',
};

// Helper: Add title
function addTitle(slide, text, color = colors.textDark, size = 40) {
  slide.addText(text, {
    x: 0.5,
    y: 0.5,
    w: 12.33,
    h: 0.8,
    fontSize: size,
    bold: true,
    fontFace: 'Calibri',
    color: color,
    align: 'left',
  });
}

// Helper: Add subtitle
function addSubtitle(slide, text, y = 1.4, color = colors.indigo) {
  slide.addText(text, {
    x: 0.5,
    y: y,
    w: 12.33,
    h: 0.5,
    fontSize: 18,
    fontFace: 'Calibri',
    color: color,
    align: 'left',
  });
}

// Helper: Add rounded card with left border
function addCard(slide, x, y, w, h, title, body, borderColor = colors.indigo) {
  // Card background
  slide.addShape({
    type: 'roundRect',
    x: x,
    y: y,
    w: w,
    h: h,
    fill: { color: colors.lightBg },
    line: { color: borderColor, width: 4 },
    rectRadius: 0.15,
  });

  // Left border accent
  slide.addShape({
    type: 'rect',
    x: x,
    y: y,
    w: 0.08,
    h: h,
    fill: { color: borderColor },
    line: { type: 'none' },
  });

  // Title
  if (title) {
    slide.addText(title, {
      x: x + 0.2,
      y: y + 0.15,
      w: w - 0.4,
      h: 0.35,
      fontSize: 16,
      bold: true,
      fontFace: 'Calibri',
      color: colors.textDark,
      align: 'left',
    });
  }

  // Body
  if (body) {
    slide.addText(body, {
      x: x + 0.2,
      y: y + 0.55,
      w: w - 0.4,
      h: h - 0.7,
      fontSize: 13,
      fontFace: 'Calibri',
      color: colors.gray2,
      align: 'left',
      valign: 'top',
    });
  }
}

// Helper: Add icon circle
function addIconCircle(slide, x, y, icon, bgColor = colors.lightBg) {
  slide.addShape({
    type: 'ellipse',
    x: x,
    y: y,
    w: 0.4,
    h: 0.4,
    fill: { color: bgColor },
    line: { type: 'none' },
  });
  slide.addText(icon, {
    x: x,
    y: y,
    w: 0.4,
    h: 0.4,
    fontSize: 20,
    align: 'center',
    valign: 'middle',
  });
}

// Helper: Add stat block
function addStatBlock(slide, x, y, number, label) {
  slide.addText(number, {
    x: x,
    y: y,
    w: 2,
    h: 0.8,
    fontSize: 56,
    bold: true,
    fontFace: 'Calibri',
    color: colors.indigo,
    align: 'center',
  });
  slide.addText(label, {
    x: x,
    y: y + 0.9,
    w: 2,
    h: 0.4,
    fontSize: 11,
    fontFace: 'Calibri',
    color: colors.gray,
    align: 'center',
  });
}

// ============================================================
// SLIDE 1: TITLE SLIDE
// ============================================================
let slide1 = prs.addSlide();
slide1.background = { color: colors.darkNavy };

// Top text
slide1.addText('DATABASE MANAGEMENT SYSTEM — CIC-210', {
  x: 0.5,
  y: 0.4,
  w: 12.33,
  h: 0.3,
  fontSize: 12,
  fontFace: 'Calibri',
  color: colors.white,
  align: 'left',
});

slide1.addText('4th Semester, C-Section', {
  x: 0.5,
  y: 0.75,
  w: 12.33,
  h: 0.3,
  fontSize: 12,
  fontFace: 'Calibri',
  color: colors.white,
  align: 'left',
});

// Main title
slide1.addText('Advanced CRM Analytics &', {
  x: 0.5,
  y: 2,
  w: 12.33,
  h: 0.7,
  fontSize: 48,
  bold: true,
  fontFace: 'Calibri',
  color: colors.white,
  align: 'center',
});

slide1.addText('Sales Intelligence System', {
  x: 0.5,
  y: 2.75,
  w: 12.33,
  h: 0.7,
  fontSize: 48,
  bold: true,
  fontFace: 'Calibri',
  color: colors.white,
  align: 'center',
});

// NexCRM badge
slide1.addShape({
  type: 'roundRect',
  x: 5.3,
  y: 3.6,
  w: 2.7,
  h: 0.5,
  fill: { color: colors.indigo },
  line: { type: 'none' },
  rectRadius: 0.1,
});
slide1.addText('📊 NexCRM', {
  x: 5.3,
  y: 3.6,
  w: 2.7,
  h: 0.5,
  fontSize: 16,
  bold: true,
  fontFace: 'Calibri',
  color: colors.white,
  align: 'center',
  valign: 'middle',
});

// Tagline
slide1.addText('Managing Leads. Closing Deals. Driving Growth.', {
  x: 0.5,
  y: 4.2,
  w: 12.33,
  h: 0.4,
  fontSize: 16,
  italic: true,
  fontFace: 'Calibri',
  color: colors.iceBlue,
  align: 'center',
});

// Bottom left: Team info
slide1.addText('Param Aggarwal — 36617702724', {
  x: 0.5,
  y: 6.2,
  w: 4,
  h: 0.35,
  fontSize: 11,
  fontFace: 'Calibri',
  color: colors.white,
  align: 'left',
});

slide1.addText('Hridhay Chaudhary — 51717702724', {
  x: 0.5,
  y: 6.65,
  w: 4,
  h: 0.35,
  fontSize: 11,
  fontFace: 'Calibri',
  color: colors.white,
  align: 'left',
});

// Bottom right: Supervisor & logo
slide1.addText('Supervisor: Dr. Monika Bansal', {
  x: 8.8,
  y: 6.2,
  w: 4.03,
  h: 0.35,
  fontSize: 11,
  fontFace: 'Calibri',
  color: colors.white,
  align: 'right',
});

slide1.addShape({
  type: 'rect',
  x: 10.5,
  y: 6.65,
  w: 2.33,
  h: 0.6,
  fill: { color: colors.white },
  line: { color: colors.white, width: 1 },
});
slide1.addText('VIPS', {
  x: 10.5,
  y: 6.65,
  w: 2.33,
  h: 0.6,
  fontSize: 14,
  bold: true,
  fontFace: 'Calibri',
  color: colors.darkNavy,
  align: 'center',
  valign: 'middle',
});

// Geometric shape (circles grid)
for (let i = 0; i < 4; i++) {
  for (let j = 0; j < 3; j++) {
    slide1.addShape({
      type: 'ellipse',
      x: 11.5 + i * 0.4,
      y: 5.2 + j * 0.4,
      w: 0.25,
      h: 0.25,
      fill: { color: colors.darkAccent },
      line: { type: 'none' },
    });
  }
}

// ============================================================
// SLIDE 2: TABLE OF CONTENTS
// ============================================================
let slide2 = prs.addSlide();
slide2.background = { color: colors.white };

addTitle(slide2, 'What We\'ll Cover', colors.textDark, 40);

// 2-column grid of items
const tocItems = [
  { num: '01', title: 'Introduction & Motivation' },
  { num: '02', title: 'Problem Statement' },
  { num: '03', title: 'ER Diagram' },
  { num: '04', title: 'Technology Stack' },
  { num: '05', title: 'Database Schema & Normalization' },
  { num: '06', title: 'Project Implementation' },
  { num: '07', title: 'Project Results' },
  { num: '08', title: 'References' },
];

const cardWidth = 5.5;
const cardHeight = 0.8;
const gapX = 0.6;
const gapY = 0.5;
let tocX = 0.5;
let tocY = 1.5;

for (let i = 0; i < tocItems.length; i++) {
  const col = i % 2;
  const row = Math.floor(i / 2);
  const x = tocX + col * (cardWidth + gapX);
  const y = tocY + row * (cardHeight + gapY);

  addCard(slide2, x, y, cardWidth, cardHeight, `${tocItems[i].num} ${tocItems[i].title}`, null);
}

// ============================================================
// SLIDE 3: INTRODUCTION & MOTIVATION
// ============================================================
let slide3 = prs.addSlide();
slide3.background = { color: colors.white };

addTitle(slide3, 'Introduction & Motivation', colors.textDark, 40);

// Left column - 4 cards
const motCards = [
  { icon: '📊', title: 'What is a CRM?', body: 'Software that manages customer relationships and sales data' },
  { icon: '❌', title: 'The Problem', body: 'Salesforce & HubSpot are too expensive and complex for growing teams' },
  { icon: '💡', title: 'Our Solution', body: 'NexCRM: Modern, affordable, analytics-driven CRM built from scratch' },
  { icon: '🎯', title: 'Who it\'s for', body: 'Sales teams, startups, and businesses that need data-driven decisions' },
];

let motY = 1.5;
for (let i = 0; i < motCards.length; i++) {
  addIconCircle(slide3, 0.5, motY + 0.1, motCards[i].icon);
  slide3.addText(motCards[i].title, {
    x: 1.1,
    y: motY + 0.05,
    w: 4.5,
    h: 0.3,
    fontSize: 13,
    bold: true,
    fontFace: 'Calibri',
    color: colors.textDark,
  });
  slide3.addText(motCards[i].body, {
    x: 1.1,
    y: motY + 0.35,
    w: 4.5,
    h: 0.45,
    fontSize: 11,
    fontFace: 'Calibri',
    color: colors.gray2,
  });
  motY += 1.45;
}

// Right column - stat block
addStatBlock(slide3, 7.8, 1.6, '$91B', 'Global CRM Market Size (2025)');
addStatBlock(slide3, 10, 1.6, '91%', 'of businesses with 10+ employees use a CRM');
addStatBlock(slide3, 7.8, 3.8, '29%', 'average revenue increase after CRM adoption');

// ============================================================
// SLIDE 4: PROBLEM STATEMENT
// ============================================================
let slide4 = prs.addSlide();
slide4.background = { color: colors.darkNavy };

addTitle(slide4, 'The Problem We\'re Solving', colors.white, 40);

// 3 problem cards
const problems = [
  { icon: '😤', title: 'Too Complex', body: 'Enterprise CRMs like Salesforce require dedicated admins and months of training' },
  { icon: '💸', title: 'Too Expensive', body: 'HubSpot charges $90+/user/month at scale — unaffordable for growing teams' },
  { icon: '📉', title: 'No Real Insights', body: 'Most CRMs store data but don\'t help you understand it with actionable analytics' },
];

let probX = 0.5;
for (let i = 0; i < problems.length; i++) {
  slide4.addShape({
    type: 'roundRect',
    x: probX,
    y: 1.5,
    w: 4,
    h: 2.5,
    fill: { color: colors.white },
    line: { type: 'none' },
    rectRadius: 0.15,
  });

  slide4.addText(problems[i].icon, {
    x: probX + 0.15,
    y: 1.7,
    w: 0.5,
    h: 0.5,
    fontSize: 32,
    align: 'left',
  });

  slide4.addText(problems[i].title, {
    x: probX + 0.15,
    y: 2.3,
    w: 3.7,
    h: 0.4,
    fontSize: 16,
    bold: true,
    fontFace: 'Calibri',
    color: colors.textDark,
  });

  slide4.addText(problems[i].body, {
    x: probX + 0.15,
    y: 2.8,
    w: 3.7,
    h: 1,
    fontSize: 12,
    fontFace: 'Calibri',
    color: colors.gray2,
  });

  probX += 4.2;
}

// Solution box
slide4.addShape({
  type: 'roundRect',
  x: 0.5,
  y: 4.3,
  w: 12.33,
  h: 0.8,
  fill: { color: colors.indigo },
  line: { type: 'none' },
  rectRadius: 0.1,
});
slide4.addText('✓ NexCRM solves all three — modern UI, built-in analytics, and zero licensing cost.', {
  x: 0.5,
  y: 4.3,
  w: 12.33,
  h: 0.8,
  fontSize: 15,
  bold: true,
  fontFace: 'Calibri',
  color: colors.white,
  align: 'center',
  valign: 'middle',
});

// ============================================================
// SLIDE 5: ER DIAGRAM
// ============================================================
let slide5 = prs.addSlide();
slide5.background = { color: colors.white };

addTitle(slide5, 'Entity-Relationship Diagram', colors.textDark, 40);
addSubtitle(slide5, '6 core entities with normalized relationships', 1.4);

// ER Diagram boxes
const entities = [
  { name: 'USERS', attrs: '(id, name, email, role)' },
  { name: 'LEADS', attrs: '(id, name, status, assigned_to)' },
  { name: 'CUSTOMERS', attrs: '(id, name, lead_id)' },
  { name: 'DEALS', attrs: '(id, title, stage, customer_id)' },
  { name: 'ACTIVITIES', attrs: '(id, type, user_id, customer_id)' },
  { name: 'COMPANIES', attrs: '(id, name)' },
];

// Position entities in a circle-like layout
const positions = [
  { x: 1, y: 2.2 },
  { x: 5, y: 2.2 },
  { x: 9, y: 2.2 },
  { x: 1, y: 4.5 },
  { x: 5, y: 4.5 },
  { x: 9, y: 4.5 },
];

for (let i = 0; i < entities.length; i++) {
  slide5.addShape({
    type: 'roundRect',
    x: positions[i].x,
    y: positions[i].y,
    w: 3,
    h: 0.9,
    fill: { color: colors.lightBg },
    line: { color: colors.indigo, width: 2 },
    rectRadius: 0.1,
  });

  slide5.addText(entities[i].name, {
    x: positions[i].x + 0.1,
    y: positions[i].y + 0.05,
    w: 2.8,
    h: 0.35,
    fontSize: 12,
    bold: true,
    fontFace: 'Calibri',
    color: colors.indigo,
  });

  slide5.addText(entities[i].attrs, {
    x: positions[i].x + 0.1,
    y: positions[i].y + 0.4,
    w: 2.8,
    h: 0.35,
    fontSize: 9,
    fontFace: 'Calibri',
    color: colors.gray2,
  });
}

// Connection lines (simplified)
slide5.addShape({
  type: 'line',
  x: 4,
  y: 2.65,
  w: 1,
  h: 0,
  line: { color: colors.indigo, width: 1 },
});

slide5.addShape({
  type: 'line',
  x: 8,
  y: 2.65,
  w: 1,
  h: 0,
  line: { color: colors.indigo, width: 1 },
});

// Stats
const erStats = ['10 Tables', '22 Foreign Keys', '3NF Normalized'];
let statX = 1.5;
for (let stat of erStats) {
  slide5.addShape({
    type: 'roundRect',
    x: statX,
    y: 6.5,
    w: 3,
    h: 0.6,
    fill: { color: colors.indigo },
    line: { type: 'none' },
    rectRadius: 0.1,
  });
  slide5.addText(stat, {
    x: statX,
    y: 6.5,
    w: 3,
    h: 0.6,
    fontSize: 12,
    bold: true,
    fontFace: 'Calibri',
    color: colors.white,
    align: 'center',
    valign: 'middle',
  });
  statX += 3.5;
}

// ============================================================
// SLIDE 6: TECHNOLOGY STACK
// ============================================================
let slide6 = prs.addSlide();
slide6.background = { color: colors.white };

addTitle(slide6, 'Technology Stack', colors.textDark, 40);
addSubtitle(slide6, 'Modern full-stack architecture — production ready', 1.4);

// Tech grid - Frontend
const frontendTechs = [
  { icon: '⚛️', name: 'React.js', desc: 'Component-based UI' },
  { icon: '🎨', name: 'Tailwind CSS', desc: 'Utility-first styling' },
  { icon: '⚡', name: 'Vite', desc: 'Lightning fast build tool' },
];

const backendTechs = [
  { icon: '🟢', name: 'Node.js + Express', desc: 'REST API Server' },
  { icon: '🐘', name: 'PostgreSQL', desc: 'Relational Database' },
  { icon: '🔐', name: 'JWT + bcrypt', desc: 'Secure Authentication' },
];

let techX = 0.5;
let techY = 2.2;
for (let tech of frontendTechs) {
  slide6.addShape({
    type: 'roundRect',
    x: techX,
    y: techY,
    w: 3.9,
    h: 1.2,
    fill: { color: colors.lightBg },
    line: { color: colors.indigo, width: 2 },
    rectRadius: 0.1,
  });

  slide6.addText(tech.icon, {
    x: techX + 0.2,
    y: techY + 0.15,
    w: 0.8,
    h: 0.6,
    fontSize: 24,
    align: 'center',
  });

  slide6.addText(tech.name, {
    x: techX + 1.1,
    y: techY + 0.15,
    w: 2.6,
    h: 0.4,
    fontSize: 13,
    bold: true,
    fontFace: 'Calibri',
    color: colors.textDark,
  });

  slide6.addText(tech.desc, {
    x: techX + 1.1,
    y: techY + 0.6,
    w: 2.6,
    h: 0.4,
    fontSize: 11,
    fontFace: 'Calibri',
    color: colors.gray,
  });

  techX += 4.05;
}

// Backend
techX = 0.5;
techY = 3.7;
for (let tech of backendTechs) {
  slide6.addShape({
    type: 'roundRect',
    x: techX,
    y: techY,
    w: 3.9,
    h: 1.2,
    fill: { color: colors.lightBg },
    line: { color: colors.indigo, width: 2 },
    rectRadius: 0.1,
  });

  slide6.addText(tech.icon, {
    x: techX + 0.2,
    y: techY + 0.15,
    w: 0.8,
    h: 0.6,
    fontSize: 24,
    align: 'center',
  });

  slide6.addText(tech.name, {
    x: techX + 1.1,
    y: techY + 0.15,
    w: 2.6,
    h: 0.4,
    fontSize: 13,
    bold: true,
    fontFace: 'Calibri',
    color: colors.textDark,
  });

  slide6.addText(tech.desc, {
    x: techX + 1.1,
    y: techY + 0.6,
    w: 2.6,
    h: 0.4,
    fontSize: 11,
    fontFace: 'Calibri',
    color: colors.gray,
  });

  techX += 4.05;
}

// Architecture flow
const archBoxes = [
  { text: 'React\nFrontend', x: 1 },
  { text: 'Express\nREST API', x: 4.7 },
  { text: 'PostgreSQL\nDatabase', x: 8.4 },
];

for (let i = 0; i < archBoxes.length; i++) {
  slide6.addShape({
    type: 'roundRect',
    x: archBoxes[i].x,
    y: 5.9,
    w: 3,
    h: 0.9,
    fill: { color: colors.indigo },
    line: { type: 'none' },
    rectRadius: 0.1,
  });

  slide6.addText(archBoxes[i].text, {
    x: archBoxes[i].x,
    y: 5.9,
    w: 3,
    h: 0.9,
    fontSize: 11,
    bold: true,
    fontFace: 'Calibri',
    color: colors.white,
    align: 'center',
    valign: 'middle',
  });

  if (i < archBoxes.length - 1) {
    slide6.addShape({
      type: 'triangle',
      x: archBoxes[i].x + 3.2,
      y: 6.2,
      w: 0.3,
      h: 0.3,
      fill: { color: colors.indigo },
      line: { type: 'none' },
    });
  }
}

// ============================================================
// SLIDE 7: DATABASE SCHEMA
// ============================================================
let slide7 = prs.addSlide();
slide7.background = { color: colors.white };

addTitle(slide7, 'Database Schema & Normalization', colors.textDark, 40);

// Schema table (simplified)
const tableData = [
  { name: 'users', columns: 'id, name, email, role', relations: 'Referenced by all tables' },
  { name: 'leads', columns: 'id, name, status, assigned_to', relations: 'FK → users' },
  { name: 'customers', columns: 'id, name, lead_id, owner_id', relations: 'FK → leads, users' },
  { name: 'deals', columns: 'id, title, stage, value, customer_id', relations: 'FK → customers' },
  { name: 'activities', columns: 'id, type, user_id, customer_id', relations: 'FK → users, customers' },
  { name: 'companies', columns: 'id, name', relations: 'Referenced by all' },
];

// Table headers
const headerY = 1.6;
slide7.addShape({
  type: 'rect',
  x: 0.5,
  y: headerY,
  w: 6.5,
  h: 0.45,
  fill: { color: colors.indigo },
  line: { type: 'none' },
});

slide7.addText('Table', {
  x: 0.6,
  y: headerY,
  w: 1,
  h: 0.45,
  fontSize: 11,
  bold: true,
  fontFace: 'Calibri',
  color: colors.white,
  valign: 'middle',
});

slide7.addText('Columns', {
  x: 1.7,
  y: headerY,
  w: 2.3,
  h: 0.45,
  fontSize: 11,
  bold: true,
  fontFace: 'Calibri',
  color: colors.white,
  valign: 'middle',
});

slide7.addText('Relationships', {
  x: 4.1,
  y: headerY,
  w: 2.9,
  h: 0.45,
  fontSize: 11,
  bold: true,
  fontFace: 'Calibri',
  color: colors.white,
  valign: 'middle',
});

// Table rows
let rowY = headerY + 0.45;
for (let i = 0; i < tableData.length; i++) {
  const bgColor = i % 2 === 0 ? colors.white : colors.lightBg;
  slide7.addShape({
    type: 'rect',
    x: 0.5,
    y: rowY,
    w: 6.5,
    h: 0.5,
    fill: { color: bgColor },
    line: { color: colors.indigo, width: 0.5 },
  });

  slide7.addText(tableData[i].name, {
    x: 0.6,
    y: rowY,
    w: 1,
    h: 0.5,
    fontSize: 10,
    fontFace: 'Calibri',
    color: colors.textDark,
    valign: 'middle',
  });

  slide7.addText(tableData[i].columns, {
    x: 1.7,
    y: rowY,
    w: 2.3,
    h: 0.5,
    fontSize: 9,
    fontFace: 'Calibri',
    color: colors.gray2,
    valign: 'middle',
  });

  slide7.addText(tableData[i].relations, {
    x: 4.1,
    y: rowY,
    w: 2.9,
    h: 0.5,
    fontSize: 9,
    fontFace: 'Calibri',
    color: colors.gray2,
    valign: 'middle',
  });

  rowY += 0.5;
}

// Normalization cards - right side
const normCards = [
  { title: '1NF ✓', body: 'Atomic values, no repeating groups, PKs defined' },
  { title: '2NF ✓', body: 'No partial dependencies on composite keys' },
  { title: '3NF ✓', body: 'No transitive dependencies, data fully normalized' },
];

let normY = 1.6;
for (let norm of normCards) {
  slide7.addShape({
    type: 'roundRect',
    x: 7.5,
    y: normY,
    w: 5.33,
    h: 1.4,
    fill: { color: colors.lightBg },
    line: { color: colors.successGreen, width: 2 },
    rectRadius: 0.1,
  });

  slide7.addText(norm.title, {
    x: 7.7,
    y: normY + 0.1,
    w: 4.93,
    h: 0.35,
    fontSize: 14,
    bold: true,
    fontFace: 'Calibri',
    color: colors.successGreen,
  });

  slide7.addText(norm.body, {
    x: 7.7,
    y: normY + 0.5,
    w: 4.93,
    h: 0.75,
    fontSize: 11,
    fontFace: 'Calibri',
    color: colors.gray2,
  });

  normY += 1.7;
}

// ============================================================
// SLIDE 8: SECTION DIVIDER - IMPLEMENTATION
// ============================================================
let slide8 = prs.addSlide();
slide8.background = { color: colors.darkNavy };

slide8.addText('Project Implementation', {
  x: 0.5,
  y: 2.5,
  w: 12.33,
  h: 1,
  fontSize: 56,
  bold: true,
  fontFace: 'Calibri',
  color: colors.white,
  align: 'center',
});

slide8.addText('Features, Screenshots & Code Highlights', {
  x: 0.5,
  y: 3.6,
  w: 12.33,
  h: 0.5,
  fontSize: 20,
  fontFace: 'Calibri',
  color: colors.iceBlue,
  align: 'center',
});

// Bottom badges
const badges = ['7 Modules', '15 API Endpoints', '6 DB Tables', '878 Data Rows'];
let badgeX = 2;
for (let badge of badges) {
  slide8.addShape({
    type: 'roundRect',
    x: badgeX,
    y: 5.8,
    w: 2,
    h: 0.6,
    fill: { color: colors.indigo },
    line: { type: 'none' },
    rectRadius: 0.15,
  });

  slide8.addText(badge, {
    x: badgeX,
    y: 5.8,
    w: 2,
    h: 0.6,
    fontSize: 12,
    bold: true,
    fontFace: 'Calibri',
    color: colors.white,
    align: 'center',
    valign: 'middle',
  });

  badgeX += 2.3;
}

// ============================================================
// SLIDE 9: AUTHENTICATION & DASHBOARD
// ============================================================
let slide9 = prs.addSlide();
slide9.background = { color: colors.white };

addTitle(slide9, 'Authentication & Dashboard', colors.textDark, 40);

// Left column: Auth card
slide9.addShape({
  type: 'roundRect',
  x: 0.5,
  y: 1.5,
  w: 5.8,
  h: 5.2,
  fill: { color: colors.lightBg },
  line: { color: colors.indigo, width: 3 },
  rectRadius: 0.15,
});

slide9.addText('🔐 JWT Authentication', {
  x: 0.7,
  y: 1.75,
  w: 5.4,
  h: 0.35,
  fontSize: 15,
  bold: true,
  fontFace: 'Calibri',
  color: colors.textDark,
});

const authPoints = [
  'Split-screen login page (indigo left panel + form right)',
  'Role-based access: Admin / Manager / Sales Rep',
  'bcrypt password hashing',
  'Token stored in localStorage, auto-redirect on expiry',
];

let authY = 2.25;
for (let point of authPoints) {
  slide9.addText(point, {
    x: 0.7,
    y: authY,
    w: 5.4,
    h: 0.6,
    fontSize: 11,
    fontFace: 'Calibri',
    color: colors.gray2,
  });
  authY += 0.75;
}

// Right column: Dashboard card
slide9.addShape({
  type: 'roundRect',
  x: 6.83,
  y: 1.5,
  w: 5.8,
  h: 5.2,
  fill: { color: colors.lightBg },
  line: { color: colors.indigo, width: 3 },
  rectRadius: 0.15,
});

slide9.addText('📊 Smart Dashboard', {
  x: 7.03,
  y: 1.75,
  w: 5.4,
  h: 0.35,
  fontSize: 15,
  bold: true,
  fontFace: 'Calibri',
  color: colors.textDark,
});

const dashPoints = [
  '4 KPI cards: Revenue · Leads · Conversion · Deals',
  'Revenue trend line chart (6 months)',
  'Deal stage funnel chart',
  'Recent activity feed + Sales leaderboard',
];

let dashY = 2.25;
for (let point of dashPoints) {
  slide9.addText(point, {
    x: 7.03,
    y: dashY,
    w: 5.4,
    h: 0.6,
    fontSize: 11,
    fontFace: 'Calibri',
    color: colors.gray2,
  });
  dashY += 0.75;
}

// Bottom stat callouts
const dashStats = ['3 Roles', 'JWT Secured', 'Real-time KPIs'];
let statX2 = 2;
for (let stat of dashStats) {
  slide9.addShape({
    type: 'roundRect',
    x: statX2,
    y: 6.8,
    w: 2.8,
    h: 0.5,
    fill: { color: colors.indigo },
    line: { type: 'none' },
    rectRadius: 0.1,
  });

  slide9.addText(stat, {
    x: statX2,
    y: 6.8,
    w: 2.8,
    h: 0.5,
    fontSize: 11,
    bold: true,
    fontFace: 'Calibri',
    color: colors.white,
    align: 'center',
    valign: 'middle',
  });

  statX2 += 3;
}

// ============================================================
// SLIDE 10: LEAD & CUSTOMER MANAGEMENT
// ============================================================
let slide10 = prs.addSlide();
slide10.background = { color: colors.white };

addTitle(slide10, 'Lead & Customer Management', colors.textDark, 40);

// Left: Leads
slide10.addShape({
  type: 'roundRect',
  x: 0.5,
  y: 1.5,
  w: 5.8,
  h: 4.3,
  fill: { color: colors.lightBg },
  line: { color: colors.indigo, width: 3 },
  rectRadius: 0.15,
});

slide10.addText('👥 Lead Management', {
  x: 0.7,
  y: 1.75,
  w: 5.4,
  h: 0.35,
  fontSize: 14,
  bold: true,
  fontFace: 'Calibri',
  color: colors.textDark,
});

const leadPoints = [
  '15 leads in sample database',
  'Status tracking: New → Contacted → Qualified → Lost',
  'Search, filter, assign to users',
  'Right-side drawer panel on click (no page reload)',
  'Convert lead → customer button',
];

let leadY = 2.25;
for (let point of leadPoints) {
  slide10.addText(point, {
    x: 0.7,
    y: leadY,
    w: 5.4,
    h: 0.5,
    fontSize: 10,
    fontFace: 'Calibri',
    color: colors.gray2,
  });
  leadY += 0.65;
}

// Right: Customers
slide10.addShape({
  type: 'roundRect',
  x: 6.83,
  y: 1.5,
  w: 5.8,
  h: 4.3,
  fill: { color: colors.lightBg },
  line: { color: colors.indigo, width: 3 },
  rectRadius: 0.15,
});

slide10.addText('🏢 Customer Profiles', {
  x: 7.03,
  y: 1.75,
  w: 5.4,
  h: 0.35,
  fontSize: 14,
  bold: true,
  fontFace: 'Calibri',
  color: colors.textDark,
});

const custPoints = [
  '10 customers with full profiles',
  '3-tab layout: Overview · Deals · Activity Timeline',
  'Health score indicator (color-coded)',
  'Full interaction history per customer',
];

let custY = 2.25;
for (let point of custPoints) {
  slide10.addText(point, {
    x: 7.03,
    y: custY,
    w: 5.4,
    h: 0.65,
    fontSize: 10,
    fontFace: 'Calibri',
    color: colors.gray2,
  });
  custY += 0.85;
}

// Status flow
const statusFlow = [
  { text: 'New', color: colors.indigo },
  { text: 'Contacted', color: '#F59E0B' },
  { text: 'Qualified', color: '#10B981' },
  { text: 'Won/Lost', color: colors.successGreen },
];

let flowX = 1.5;
for (let i = 0; i < statusFlow.length; i++) {
  slide10.addShape({
    type: 'roundRect',
    x: flowX,
    y: 6.2,
    w: 1.5,
    h: 0.5,
    fill: { color: statusFlow[i].color },
    line: { type: 'none' },
    rectRadius: 0.1,
  });

  slide10.addText(statusFlow[i].text, {
    x: flowX,
    y: 6.2,
    w: 1.5,
    h: 0.5,
    fontSize: 10,
    bold: true,
    fontFace: 'Calibri',
    color: colors.white,
    align: 'center',
    valign: 'middle',
  });

  if (i < statusFlow.length - 1) {
    slide10.addShape({
      type: 'triangle',
      x: flowX + 1.6,
      y: 6.38,
      w: 0.25,
      h: 0.25,
      fill: { color: colors.indigo },
      line: { type: 'none' },
    });
  }

  flowX += 2.2;
}

// ============================================================
// SLIDE 11: PIPELINE & ACTIVITIES
// ============================================================
let slide11 = prs.addSlide();
slide11.background = { color: colors.white };

addTitle(slide11, 'Sales Pipeline & Activity Logging', colors.textDark, 40);

// Left: Pipeline
slide11.addShape({
  type: 'roundRect',
  x: 0.5,
  y: 1.5,
  w: 5.8,
  h: 4.3,
  fill: { color: colors.lightBg },
  line: { color: colors.indigo, width: 3 },
  rectRadius: 0.15,
});

slide11.addText('📋 Kanban Pipeline', {
  x: 0.7,
  y: 1.75,
  w: 5.4,
  h: 0.35,
  fontSize: 14,
  bold: true,
  fontFace: 'Calibri',
  color: colors.textDark,
});

const pipelinePoints = [
  'Drag & drop between 6 stages',
  'Stages: Lead In · Contacted · Proposal · Negotiation · Won · Lost',
  'Each card shows: company, value, due date, assigned rep',
  'Won/Lost columns have green/red tint',
  '15 deals across all stages in sample data',
];

let pipelineY = 2.25;
for (let point of pipelinePoints) {
  slide11.addText(point, {
    x: 0.7,
    y: pipelineY,
    w: 5.4,
    h: 0.55,
    fontSize: 10,
    fontFace: 'Calibri',
    color: colors.gray2,
  });
  pipelineY += 0.7;
}

// Right: Activities
slide11.addShape({
  type: 'roundRect',
  x: 6.83,
  y: 1.5,
  w: 5.8,
  h: 4.3,
  fill: { color: colors.lightBg },
  line: { color: colors.indigo, width: 3 },
  rectRadius: 0.15,
});

slide11.addText('📅 Activity System', {
  x: 7.03,
  y: 1.75,
  w: 5.4,
  h: 0.35,
  fontSize: 14,
  bold: true,
  fontFace: 'Calibri',
  color: colors.textDark,
});

const activityPoints = [
  'Log calls, emails, meetings',
  'Timeline view per customer',
  '20 activities in sample database',
  'Upcoming activities trigger notifications',
  'Completed vs pending status tracking',
];

let activityY = 2.25;
for (let point of activityPoints) {
  slide11.addText(point, {
    x: 7.03,
    y: activityY,
    w: 5.4,
    h: 0.55,
    fontSize: 10,
    fontFace: 'Calibri',
    color: colors.gray2,
  });
  activityY += 0.7;
}

// Kanban visual
const kanbanStages = ['Lead In', 'Contacted', 'Proposal', 'Negotiation', 'Won', 'Lost'];
let kanbanX = 0.8;
for (let stage of kanbanStages) {
  slide11.addShape({
    type: 'rect',
    x: kanbanX,
    y: 6.2,
    w: 1.8,
    h: 0.5,
    fill: { color: colors.indigo },
    line: { type: 'none' },
  });

  slide11.addText(stage, {
    x: kanbanX,
    y: 6.2,
    w: 1.8,
    h: 0.5,
    fontSize: 9,
    bold: true,
    fontFace: 'Calibri',
    color: colors.white,
    align: 'center',
    valign: 'middle',
  });

  kanbanX += 2;
}

// ============================================================
// SLIDE 12: ANALYTICS ENGINE
// ============================================================
let slide12 = prs.addSlide();
slide12.background = { color: colors.white };

addTitle(slide12, 'Analytics & AI Insights', colors.textDark, 40);
addSubtitle(slide12, 'Turn data into decisions', 1.4);

// 2x2 grid
const analyticsCards = [
  { title: '📈 Revenue Trends', body: 'Line chart, filterable by 7D/30D/90D/1Y' },
  { title: '🔻 Conversion Funnel', body: 'Lead → Contact → Qualify → Win stages with % drop-off' },
  { title: '🏆 Sales Leaderboard', body: 'Per-rep performance: deals closed, revenue, conversion %' },
  { title: '✨ AI Insight Cards', body: 'Smart alerts: stale deals, follow-up reminders, pattern insights' },
];

const analyticsX = [0.5, 6.83];
const analyticsY = [2.1, 4.4];
let cardIndex = 0;

for (let row = 0; row < 2; row++) {
  for (let col = 0; col < 2; col++) {
    const x = analyticsX[col];
    const y = analyticsY[row];

    slide12.addShape({
      type: 'roundRect',
      x: x,
      y: y,
      w: 5.8,
      h: 1.9,
      fill: { color: colors.lightBg },
      line: { color: colors.indigo, width: 2 },
      rectRadius: 0.1,
    });

    slide12.addText(analyticsCards[cardIndex].title, {
      x: x + 0.2,
      y: y + 0.15,
      w: 5.4,
      h: 0.35,
      fontSize: 13,
      bold: true,
      fontFace: 'Calibri',
      color: colors.textDark,
    });

    slide12.addText(analyticsCards[cardIndex].body, {
      x: x + 0.2,
      y: y + 0.55,
      w: 5.4,
      h: 1.1,
      fontSize: 11,
      fontFace: 'Calibri',
      color: colors.gray2,
    });

    cardIndex++;
  }
}

// Insight box
slide12.addShape({
  type: 'roundRect',
  x: 0.5,
  y: 6.5,
  w: 12.33,
  h: 0.8,
  fill: { color: colors.lightBg },
  line: { color: colors.warningAmber, width: 2 },
  rectRadius: 0.1,
});

slide12.addText('⚠️ 8 deals in \'Negotiation\' have been stale for 14+ days — review them now', {
  x: 0.7,
  y: 6.5,
  w: 11.93,
  h: 0.8,
  fontSize: 12,
  fontFace: 'Calibri',
  color: colors.textDark,
  valign: 'middle',
});

// ============================================================
// SLIDE 13: DEVELOPER CONSOLE
// ============================================================
let slide13 = prs.addSlide();
slide13.background = { color: colors.darkNavy };

addTitle(slide13, 'Developer Console', colors.white, 40);
addSubtitle(slide13, 'Secure database inspection tool — isolated from main CRM', 1.4, colors.iceBlue);

// 3 feature cards
const devConsoleCards = [
  { icon: '🔐', title: 'Separate Login', body: 'Own JWT secret, master password, rate limited (5 attempts/15min)' },
  { icon: '🗄️', title: 'Table Browser', body: 'Paginated viewer for all DB tables, company filter, search, export CSV' },
  { icon: '⚡', title: 'Query Runner', body: 'Read-only SQL console, SELECT only, query history, 100 row limit' },
];

let devX = 0.5;
for (let card of devConsoleCards) {
  slide13.addShape({
    type: 'roundRect',
    x: devX,
    y: 2.5,
    w: 4,
    h: 3.2,
    fill: { color: colors.white },
    line: { type: 'none' },
    rectRadius: 0.15,
  });

  slide13.addText(card.icon, {
    x: devX + 0.15,
    y: 2.75,
    w: 3.7,
    h: 0.5,
    fontSize: 32,
    align: 'center',
  });

  slide13.addText(card.title, {
    x: devX + 0.15,
    y: 3.4,
    w: 3.7,
    h: 0.4,
    fontSize: 13,
    bold: true,
    fontFace: 'Calibri',
    color: colors.textDark,
    align: 'center',
  });

  slide13.addText(card.body, {
    x: devX + 0.15,
    y: 3.85,
    w: 3.7,
    h: 1.6,
    fontSize: 11,
    fontFace: 'Calibri',
    color: colors.gray2,
    align: 'center',
  });

  devX += 4.1;
}

// Bottom stats
const devStats = ['10 Tables Visible', 'Read-Only Safe'];
let devStatX = 2.5;
for (let stat of devStats) {
  slide13.addShape({
    type: 'roundRect',
    x: devStatX,
    y: 6,
    w: 3,
    h: 0.7,
    fill: { color: colors.indigo },
    line: { type: 'none' },
    rectRadius: 0.1,
  });

  slide13.addText(stat, {
    x: devStatX,
    y: 6,
    w: 3,
    h: 0.7,
    fontSize: 12,
    bold: true,
    fontFace: 'Calibri',
    color: colors.white,
    align: 'center',
    valign: 'middle',
  });

  devStatX += 3.5;
}

slide13.addText('Accessible at /dev-console/login', {
  x: 0.5,
  y: 6.8,
  w: 12.33,
  h: 0.4,
  fontSize: 10,
  fontFace: 'Calibri',
  color: colors.iceBlue,
  align: 'center',
});

// ============================================================
// SLIDE 14: RESULTS
// ============================================================
let slide14 = prs.addSlide();
slide14.background = { color: colors.white };

addTitle(slide14, 'Project Results', colors.textDark, 40);

// Left: Results table
const resultsData = [
  { module: 'JWT Auth + RBAC', status: '✅' },
  { module: 'Dashboard + KPIs', status: '✅' },
  { module: 'Lead Management', status: '✅' },
  { module: 'Customer Profiles', status: '✅' },
  { module: 'Kanban Pipeline', status: '✅' },
  { module: 'Analytics Charts', status: '✅' },
  { module: 'Dev Console', status: '✅' },
  { module: 'Landing Page', status: '✅' },
];

let resultTableY = 1.5;
for (let result of resultsData) {
  const bgColor = resultsData.indexOf(result) % 2 === 0 ? colors.lightBg : colors.white;
  slide14.addShape({
    type: 'rect',
    x: 0.5,
    y: resultTableY,
    w: 5.8,
    h: 0.45,
    fill: { color: bgColor },
    line: { color: colors.indigo, width: 0.5 },
  });

  slide14.addText(result.module, {
    x: 0.6,
    y: resultTableY,
    w: 5,
    h: 0.45,
    fontSize: 11,
    fontFace: 'Calibri',
    color: colors.textDark,
    valign: 'middle',
  });

  slide14.addText(result.status, {
    x: 5.9,
    y: resultTableY,
    w: 0.4,
    h: 0.45,
    fontSize: 12,
    bold: true,
    fontFace: 'Calibri',
    color: colors.successGreen,
    align: 'center',
    valign: 'middle',
  });

  resultTableY += 0.45;
}

// Right: Stat callouts (2x2)
const resultStats = [
  { num: '878', label: 'Total DB Rows' },
  { num: '15', label: 'API Endpoints' },
  { num: '7', label: 'Complete Modules' },
  { num: '<200ms', label: 'API Response Time' },
];

const resultStatsX = [6.83, 9.58];
const resultStatsY = [1.5, 3.5];
let statsIndex = 0;

for (let row = 0; row < 2; row++) {
  for (let col = 0; col < 2; col++) {
    const x = resultStatsX[col];
    const y = resultStatsY[row];

    slide14.addShape({
      type: 'roundRect',
      x: x,
      y: y,
      w: 2.55,
      h: 1.7,
      fill: { color: colors.lightBg },
      line: { color: colors.indigo, width: 2 },
      rectRadius: 0.1,
    });

    slide14.addText(resultStats[statsIndex].num, {
      x: x + 0.1,
      y: y + 0.35,
      w: 2.35,
      h: 0.7,
      fontSize: 32,
      bold: true,
      fontFace: 'Calibri',
      color: colors.indigo,
      align: 'center',
    });

    slide14.addText(resultStats[statsIndex].label, {
      x: x + 0.1,
      y: y + 1.05,
      w: 2.35,
      h: 0.5,
      fontSize: 10,
      fontFace: 'Calibri',
      color: colors.gray,
      align: 'center',
    });

    statsIndex++;
  }
}

// ============================================================
// SLIDE 15: REFERENCES & CONCLUSION
// ============================================================
let slide15 = prs.addSlide();
slide15.background = { color: colors.darkNavy };

// Top: Conclusion
slide15.addText('Conclusion', {
  x: 0.5,
  y: 0.6,
  w: 12.33,
  h: 0.6,
  fontSize: 40,
  bold: true,
  fontFace: 'Calibri',
  color: colors.white,
  align: 'center',
});

// Conclusion cards
const conclusionPoints = [
  '✓ Demonstrated DBMS concepts: 3NF, indexing, FK constraints, complex queries',
  '✓ Built a production-ready full-stack CRM with modern SaaS-quality UI',
  '✓ Delivered all 8 project objectives from the proposal',
];

let concX = 1;
for (let i = 0; i < conclusionPoints.length; i++) {
  slide15.addShape({
    type: 'roundRect',
    x: concX,
    y: 1.5 + i * 0.9,
    w: 11.33,
    h: 0.75,
    fill: { color: colors.white },
    line: { type: 'none' },
    rectRadius: 0.1,
  });

  slide15.addText(conclusionPoints[i], {
    x: concX + 0.2,
    y: 1.5 + i * 0.9,
    w: 10.93,
    h: 0.75,
    fontSize: 12,
    bold: true,
    fontFace: 'Calibri',
    color: colors.textDark,
    valign: 'middle',
  });
}

// References
const references = [
  '[1] PostgreSQL Documentation — postgresql.org',
  '[2] React.js Docs — react.dev',
  '[3] R. Ramakrishnan, "Database Management Systems," McGraw-Hill, 2002',
  '[4] JWT RFC 7519 — tools.ietf.org/html/rfc7519',
  '[5] HubSpot CRM — hubspot.com',
  '[6] Tailwind CSS Docs — tailwindcss.com',
];

let refY = 4.6;
for (let ref of references) {
  slide15.addText(ref, {
    x: 1.5,
    y: refY,
    w: 10.33,
    h: 0.3,
    fontSize: 10,
    fontFace: 'Calibri',
    color: colors.iceBlue,
  });
  refY += 0.35;
}

// Thank you
slide15.addText('Thank You', {
  x: 0.5,
  y: 6.3,
  w: 12.33,
  h: 0.5,
  fontSize: 36,
  bold: true,
  fontFace: 'Calibri',
  color: colors.white,
  align: 'center',
});

slide15.addText('Questions?', {
  x: 0.5,
  y: 6.9,
  w: 12.33,
  h: 0.4,
  fontSize: 18,
  fontFace: 'Calibri',
  color: colors.indigo,
  align: 'center',
});

// Save presentation
prs.writeFile({ fileName: 'CRM_Project_Presentation.pptx' });
console.log('✅ Presentation generated: CRM_Project_Presentation.pptx');
