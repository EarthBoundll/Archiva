const fs = require('fs');
const path = require('path');

const icons = [
  'briefcase','trending-up','gift','monitor','users','landmark','coins',
  'file-text','chart-bar-increasing','clock','house','percent','scroll-text',
  'calendar-check','award','file-check','circle-play','link','package','bitcoin',
  'heart','scale','ticket','building-2','circle-dollar-sign','party-popper',
  'layout-dashboard','check','x','lightbulb','bus','hospital','shopping-cart',
  'graduation-cap','utensils','clapperboard','tv','dog','shirt','plane',
  'shopping-bag','repeat','shield','car','laptop','sun','credit-card','target',
  // Nuevos iconos para negocio y otros
  'store','wrench','trophy','rotate-ccw','sparkles','zap','banknote','wallet'
];

const outDir = path.join(__dirname, '..', 'src', 'app', 'core', 'utils');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const lines = ["export const LUCIDE_ICONS: Record<string, string> = {"];

for (const icon of icons) {
  const file = path.join(__dirname, '..', 'node_modules', 'lucide-angular', 'icons', `${icon}.d.ts`);
  if (!fs.existsSync(file)) { console.log('NOT FOUND:', icon); continue; }
  const content = fs.readFileSync(file, 'utf8');
  const m = content.match(/base64,([^)]+)/);
  if (!m) { console.log('NO BASE64:', icon); continue; }
  try {
    const svg = Buffer.from(m[1], 'base64').toString('utf8');
    const innerMatch = svg.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
    if (!innerMatch) { console.log('NO SVG CONTENT:', icon); continue; }
    let inner = innerMatch[1].trim().replace(/\r?\n\s*/g, ' ');
    inner = inner.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$');
    lines.push(`  "${icon}": "${inner}",`);
  } catch (e) {
    console.log('FAIL:', icon, e.message);
  }
}

lines.push("};");
fs.writeFileSync(path.join(outDir, 'lucide-icons.ts'), lines.join('\n'), 'utf8');
console.log('Done. Icons:', lines.length - 2);
