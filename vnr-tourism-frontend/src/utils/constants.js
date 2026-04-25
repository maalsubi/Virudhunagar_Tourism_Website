export const TALUKS = [
  { name: 'Virudhunagar', color: '#e63946', desc: 'District headquarters, known for firecrackers and matches industry' },
  { name: 'Sivakasi',     color: '#f4a261', desc: 'Printing capital of India, fireworks & printing hub' },
  { name: 'Srivilliputhur', color: '#2a9d8f', desc: 'Famous for Palkova sweet & Sri Andal Temple' },
  { name: 'Rajapalayam',  color: '#457b9d', desc: 'Known for Rajapalayam dogs & textile industry' },
  { name: 'Aruppukottai', color: '#e9c46a', desc: 'Historical town with temples and dams' },
  { name: 'Sattur',       color: '#264653', desc: 'Industrial town known for fireworks' },
  { name: 'Tiruchuli',    color: '#a8dadc', desc: 'Birthplace of Ramana Maharishi' },
];

export const TALUK_COLORS = Object.fromEntries(TALUKS.map(t => [t.name, t.color]));

export const CATEGORIES = [
  'Temple', 'Waterfalls', 'Dam', 'Park/Garden', 'Wildlife Sanctuary',
  'Viewpoint/Hills', 'Museum', 'Memorial', 'Tourist Attraction',
];

export const CATEGORY_ICONS = {
  'Temple':             '🛕',
  'Waterfalls':         '💧',
  'Dam':                '🌊',
  'Park/Garden':        '🌳',
  'Wildlife Sanctuary': '🐾',
  'Viewpoint/Hills':    '⛰️',
  'Museum':             '🏛️',
  'Memorial':           '🏛️',
  'Tourist Attraction': '🎡',
};

export const CATEGORY_COLORS = {
  'Temple':             '#f4a261',
  'Waterfalls':         '#48cae4',
  'Dam':                '#023e8a',
  'Park/Garden':        '#40916c',
  'Wildlife Sanctuary': '#588157',
  'Viewpoint/Hills':    '#9c6644',
  'Museum':             '#6d6875',
  'Memorial':           '#b5838d',
  'Tourist Attraction': '#e9c46a',
};

export const COMMUNITY_COLORS = [
  '#e63946','#457b9d','#2a9d8f','#e9c46a','#f4a261',
  '#a8dadc','#264653','#6d6875','#b5838d','#40916c',
];