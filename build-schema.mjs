// Generates schema.sql from schema.template.sql + seed-data.js (taxonomy only).
// Run: node build-schema.mjs
import { readFileSync, writeFileSync } from 'node:fs';
const src = readFileSync('./seed-data.js', 'utf8');
const g = {}; new Function('globalThis', src)(g); // seed-data assigns to globalThis.SEED
const { GROUPS } = g.SEED;
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
let groups = [], subs = [];
GROUPS.forEach(([gid, gname, region, subList], gi) => {
  groups.push(`  (${q(gid)}, ${q(gname)}, ${q(region)}, ${gi + 1})`);
  subList.forEach(([sid, sname], si) => {
    subs.push(`  (${q(gid + '.' + sid)}, ${q(gid)}, ${q(sname)}, ${si + 1})`);
  });
});
const seedSql = `insert into public.muscle_groups (id, name, region, position) values\n${groups.join(',\n')}\non conflict (id) do update set name = excluded.name, region = excluded.region, position = excluded.position;\n\ninsert into public.sub_groups (id, group_id, name, position) values\n${subs.join(',\n')}\non conflict (id) do update set name = excluded.name, position = excluded.position;`;
const tpl = readFileSync('./schema.template.sql', 'utf8');
writeFileSync('./schema.sql', tpl.replace('-- {{TAXONOMY_SEED}}', seedSql));
console.log(`schema.sql written: ${groups.length} groups, ${subs.length} sub-groups`);
