#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const merchantDialogues = require('../src/constants/merchantDialogues');

const merchantDir = path.join(__dirname, '..', 'src', 'database', 'merchant_data');

const fileMapping = {
  seoyena: { folder: 'Seoyena', file: 'Seoyena.json' },
  mari: { folder: 'Mari', file: 'Mari.json' },
  kimsehwui: { folder: 'Kimsehwui', file: 'Kimsehwui.json' },
  anipark: { folder: 'Anipark', file: 'Anipark.json' },
  catarinachoi: { folder: 'Catarinachoi', file: 'Catarinachoi.json' },
  jinbaekho: { folder: 'Jinbaekho', file: 'jinbaekho.json' },
  jubulsu: { folder: 'Jubulsu', file: 'jubulsu.json' },
  kijuri: { folder: 'Kijuri', file: 'Kijuri.json' },
  alicegang: { folder: 'Alicegang', file: 'Alicegang.json' }
};

function findNpcEntry(json, slug) {
  if (!json.npcs) return null;
  const entries = Object.entries(json.npcs);
  for (const [key, npc] of entries) {
    const candidateId = (npc.id || key || '').toLowerCase();
    const candidateName = (npc.name || '').replace(/\s+/g, '').toLowerCase();
    if (candidateId === slug || candidateName === slug) {
      return { key, npc };
    }
  }
  return null;
}

for (const [slug, dialogueSet] of Object.entries(merchantDialogues)) {
  const mapping = fileMapping[slug];
  if (!mapping) {
    console.warn(`⚠️  No file mapping found for slug ${slug}. Skipping.`);
    continue;
  }

  const filePath = path.join(merchantDir, mapping.folder, mapping.file);
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  File not found: ${filePath}. Skipping.`);
    continue;
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const json = JSON.parse(raw);
  const entry = findNpcEntry(json, slug);
  if (!entry) {
    console.warn(`⚠️  NPC entry not found for slug ${slug} in ${filePath}. Skipping.`);
    continue;
  }

  entry.npc.dialogues = dialogueSet;
  if (Array.isArray(entry.npc.dialogue) && entry.npc.dialogue.length > 0 && !entry.npc.dialogues.greeting) {
    entry.npc.dialogues.greeting = entry.npc.dialogue;
  }

  const formatted = JSON.stringify(json, null, 2);
  fs.writeFileSync(filePath, `${formatted}\n`, 'utf8');
  console.log(`✅ Updated dialogues for ${slug} -> ${filePath}`);
}

