#!/usr/bin/env node
/**
 * A/B test harness v2 — more robust against model output variation.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TRIALS = parseInt(process.env.TRIALS || '3', 10);
const MODEL = process.env.MODEL || 'openrouter:nvidia/nemotron-3-ultra-550b-a55b:free';

/* ── Prompt loading ── */

function parsePrompt(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const sections = new Map();
    const lines = content.split('\n');
    let h = '', buf = [];
    for (const line of lines) {
        const m = line.match(/^##\s+(.+)$/);
        if (m) {
            if (h) sections.set(h.trim().toLowerCase(), buf.join('\n').trim());
            h = m[1]; buf = [];
        } else { buf.push(line); }
    }
    if (h) sections.set(h.trim().toLowerCase(), buf.join('\n').trim());
    return sections;
}

const worktreeRoot = path.resolve(__dirname, '..');
const mainRoot = path.resolve(worktreeRoot, '../..');
const oldSections = parsePrompt(path.join(mainRoot, 'packages/pi-ask-user-glimpse/prompts/ask-user.md'));
const newSections = parsePrompt(path.join(worktreeRoot, 'packages/pi-ask-user-glimpse/prompts/ask-user.md'));

/* ── System prompt builder ── */

function buildSystemPrompt(sections) {
    const snippet = sections.get('snippet') || '';
    const description = sections.get('description') || '';
    const guidelinesRaw = sections.get('guidelines') || '';
    const guidelines = guidelinesRaw.split('\n').map(l => l.trim()).filter(l => l.length > 0).map(l => l.replace(/^\d+\.\s*/, ''));
    
    return `You are a coding assistant. You have ONE tool available:

Tool: ask_user
Summary: ${snippet}

${description}

Guidelines:
${guidelines.map((g, i) => `${i+1}. ${g}`).join('\n')}

Parameters: question (required), context (optional markdown/html), contextFormat (optional "markdown"|"html"), options (optional array of {title, description?, recommended?}), questions (optional for questionnaire), allowMultiple (optional bool), allowFreeform (optional bool, default true), allowComment (optional bool), allowSkip (optional bool)

───

When a user message arrives, decide whether to call ask_user or proceed directly.
End your response with EXACTLY one of these markers on its own line:

<<<ASK>>>
<<<PROCEED>>>

Put nothing after the marker. Brief reasoning before the marker is OK.`;
}

/* ── Scenarios ── */

const scenarios = [
    { id: 'ambiguous', text: 'Add auth', expect: 'ASK', desc: 'Ambiguous — multiple auth approaches exist' },
    { id: 'clear', text: 'Rename getCwd to getCurrentWorkingDirectory in src/utils.ts', expect: 'PROCEED', desc: 'Clear directive' },
    { id: 'tradeoff', text: 'Which database should we use?', expect: 'ASK', desc: 'Trade-off decision' },
    { id: 'trivial', text: "I've been working on this all day. Added 3 tests, fixed 1 bug. Should I commit everything?", expect: 'PROCEED', desc: 'Trivial confirmation' }
];

/* ── Parser ── */

function stripThinkBlocks(text) {
    return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

function parseDecision(raw) {
    const cleaned = stripThinkBlocks(raw);
    
    // Check for markers
    const askMatch = cleaned.match(/<<<ASK>>>/);
    const proceedMatch = cleaned.match(/<<<PROCEED>>>/);
    
    if (askMatch && !proceedMatch) return 'ASK';
    if (proceedMatch && !askMatch) return 'PROCEED';
    if (askMatch && proceedMatch) {
        // Use the last marker
        const askPos = cleaned.lastIndexOf('<<<ASK>>>');
        const proceedPos = cleaned.lastIndexOf('<<<PROCEED>>>');
        return askPos > proceedPos ? 'ASK' : 'PROCEED';
    }
    
    // Fallback: check for ask_user mentions in the response (not in think blocks)
    const afterThink = stripThinkBlocks(raw);
    if (/\bask_user\b|call ask|use ask|I would ask/i.test(afterThink)) return 'ASK';
    if (/\bproceed\b|I would just|execute directly|go ahead/i.test(afterThink)) return 'PROCEED';
    
    // Default: UNKNOWN
    return 'UNKNOWN';
}

/* ── Runner ── */

function runOne(systemPrompt, userMessage) {
    try {
        const result = spawnSync('aichat', [
            '--model', MODEL,
            '-S',
            '--prompt', systemPrompt
        ], {
            input: userMessage,
            encoding: 'utf-8',
            timeout: 60000,
            maxBuffer: 1024 * 1024
        });
        
        const output = (result.stdout || '').trim();
        if (result.error) {
            if (result.error.code === 'ETIMEDOUT') return { decision: 'TIMEOUT', raw: '' };
            return { decision: 'ERROR', error: result.error.message, raw: output };
        }
        
        return { decision: parseDecision(output), raw: output };
    } catch (err) {
        return { decision: 'ERROR', error: err.message, raw: '' };
    }
}

/* ── Batch ── */

function runBatch(variantName, sections) {
    const systemPrompt = buildSystemPrompt(sections);
    const results = [];
    
    for (const s of scenarios) {
        for (let t = 0; t < TRIALS; t++) {
            process.stderr.write(`  [${variantName}] ${s.id} trial ${t+1}/${TRIALS}... `);
            const r = runOne(systemPrompt, s.text);
            process.stderr.write(`${r.decision}\n`);
            results.push({ variant: variantName, scenario: s.id, expect: s.expect, trial: t+1, ...r });
        }
    }
    return results;
}

/* ── Summarize ── */

function summarize(variantResults, label) {
    console.log(`\n=== ${label} ===\n`);
    
    for (const s of scenarios) {
        const sr = variantResults.filter(r => r.scenario === s.id);
        const correct = sr.filter(r => r.decision === s.expect).length;
        const wrong = sr.filter(r => r.decision !== s.expect && r.decision !== 'TIMEOUT' && r.decision !== 'ERROR' && r.decision !== 'UNKNOWN');
        const timeouts = sr.filter(r => r.decision === 'TIMEOUT').length;
        const errors = sr.filter(r => r.decision === 'ERROR').length;
        const unknowns = sr.filter(r => r.decision === 'UNKNOWN').length;
        const total = sr.length;
        
        const rate = total > 0 ? (correct / total * 100).toFixed(0) : 'N/A';
        console.log(`  ${s.id.padEnd(12)} expect ${s.expect.padEnd(8)} → ${correct}/${total} correct (${rate}%) [${wrong.length} wrong, ${timeouts} TO, ${errors} err, ${unknowns} unk]`);
        
        if (wrong.length > 0) {
            for (const w of wrong) {
                const snippet = w.raw.substring(0, 120).replace(/\n/g, ' ');
                console.log(`    trial ${w.trial}: ${w.decision} | "${snippet}..."`);
            }
        }
    }
    
    const valid = variantResults.filter(r => r.decision !== 'TIMEOUT' && r.decision !== 'ERROR' && r.decision !== 'UNKNOWN');
    const correct = valid.filter(r => r.decision === r.expect).length;
    
    const overAsk = valid.filter(r => r.expect === 'PROCEED' && r.decision === 'ASK').length;
    const overAskTotal = valid.filter(r => r.expect === 'PROCEED').length;
    const underAsk = valid.filter(r => r.expect === 'ASK' && r.decision === 'PROCEED').length;
    const underAskTotal = valid.filter(r => r.expect === 'ASK').length;
    
    console.log(`\n  Accuracy:     ${correct}/${valid.length} (${valid.length > 0 ? (correct/valid.length*100).toFixed(0) : 'N/A'}%)`);
    console.log(`  Over-ask:     ${overAsk}/${overAskTotal} (${overAskTotal > 0 ? (overAsk/overAskTotal*100).toFixed(0) : 'N/A'}%)`);
    console.log(`  Under-ask:    ${underAsk}/${underAskTotal} (${underAskTotal > 0 ? (underAsk/underAskTotal*100).toFixed(0) : 'N/A'}%)`);
    
    return { correct, total: valid.length, overAsk, overAskTotal, underAsk, underAskTotal };
}

/* ── Main ── */

console.error(`A/B Testing ask_user prompts — ${TRIALS} trials × 4 scenarios (model: ${MODEL})\n`);

const allResults = [];
allResults.push(...runBatch('old', oldSections));
allResults.push(...runBatch('new', newSections));

const oldSummary = summarize(allResults.filter(r => r.variant === 'old'), 'OLD PROMPT');
const newSummary = summarize(allResults.filter(r => r.variant === 'new'), 'NEW PROMPT');

console.log(`\n=== COMPARISON ===`);
const oldAcc = oldSummary.total > 0 ? (oldSummary.correct / oldSummary.total * 100).toFixed(0) : 'N/A';
const newAcc = newSummary.total > 0 ? (newSummary.correct / newSummary.total * 100).toFixed(0) : 'N/A';
console.log(`  Accuracy:   Old ${oldAcc}% → New ${newAcc}%`);

const oldOv = oldSummary.overAskTotal > 0 ? (oldSummary.overAsk / oldSummary.overAskTotal * 100).toFixed(0) : 'N/A';
const newOv = newSummary.overAskTotal > 0 ? (newSummary.overAsk / newSummary.overAskTotal * 100).toFixed(0) : 'N/A';
console.log(`  Over-ask:   Old ${oldOv}% → New ${newOv}% ${oldSummary.overAsk > newSummary.overAsk ? '✓ lower is better' : oldSummary.overAsk < newSummary.overAsk ? '✗ higher is worse' : '(same)'}`);

const oldUn = oldSummary.underAskTotal > 0 ? (oldSummary.underAsk / oldSummary.underAskTotal * 100).toFixed(0) : 'N/A';
const newUn = newSummary.underAskTotal > 0 ? (newSummary.underAsk / newSummary.underAskTotal * 100).toFixed(0) : 'N/A';
console.log(`  Under-ask:  Old ${oldUn}% → New ${newUn}% ${oldSummary.underAsk > newSummary.underAsk ? '✓ lower is better' : oldSummary.underAsk < newSummary.underAsk ? '✗ higher is worse' : '(same)'}`);
