// Original vector schematics: conceptual cues, never measurement standards.
let serial = 0;
export function flowerSvg(color = 'white', contrast = 'low', botanical = false, { ring = false, variation = 'none' } = {}) {
  const id = `flower-${++serial}`;
  const strong = contrast === true || contrast === 'high';
  const medium = contrast === 'medium';
  const palettes = { white: ['#fffef5', '#eef0dd'], purple: ['#e2cbea', '#b089cd'], pink: ['#f6d4e0', '#e49fba'] };
  const [light, dark] = palettes[color];
  const petals = Array.from({ length: 5 }, (_, i) => `<g transform="rotate(${i * 72} 200 185)"><path d="M197 192C164 171 130 136 136 92C140 55 163 33 187 42Q201 50 209 42C236 29 260 56 259 91C257 132 228 176 203 192Z" fill="url(#${id})" stroke="#718566" stroke-opacity=".27" stroke-width="1.2"/><g fill="none" stroke="#874c85" stroke-width="${strong ? '2.5' : medium ? '1.7' : '1'}" opacity="${strong ? '.9' : medium ? '.55' : '.12'}"><path d="M201 183Q198 110 198 54M198 178Q175 129 155 74M200 173Q186 107 174 58M203 177Q219 111 228 60M205 181Q236 126 246 81M184 142Q157 124 146 105M215 140Q243 122 249 108"/></g></g>`).join('');
  const plant = botanical ? '<g fill="none" stroke="#728766"><path d="M201 190Q193 255 219 325" stroke-width="3"/><path d="M214 297Q155 273 111 318M213 286Q266 270 306 303" stroke-width="2"/></g><g fill="#87a079" stroke="#5b7850" stroke-width="1"><path d="M111 317C74 314 57 287 68 279Q88 267 108 298C99 266 117 248 131 260Q151 281 111 317Z"/><path d="M111 317C76 325 64 346 81 353Q107 363 113 328C119 360 143 364 152 350Q159 330 111 317Z"/><path d="M306 303C276 286 278 264 293 263Q310 262 311 287C322 262 342 262 346 276Q351 294 306 303Z"/><path d="M306 303C278 300 263 318 273 330Q291 343 307 314C304 346 328 349 338 338Q349 318 306 303Z"/></g>' : '';
  const base = color === 'white' ? light : dark;
  const ringStops = ring === 'faint' ? [[.17, light], [.21, light], [.32, base]] : ring ? [[.17, '#fffef5'], [.28, '#fffef5'], [.34, base]] : [[.17, base]];
  const ringLabel = ring === 'faint' ? 'faint white center ring' : ring ? 'clear white center ring' : 'no distinct ring';
  const stops = [[0, '#deb64b'], [.13, '#deb64b'], ...ringStops, [.38, base], [.6, variation === 'high' ? '#fff8f0' : variation === 'low' ? '#e9b0c5' : base], [.95, variation === 'high' ? '#b84e7c' : base]];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 ${botanical ? 380 : 365}" role="img" aria-label="Schematic: ${color} petals, ${strong ? 'high' : medium ? 'medium' : 'low'} vein contrast, ${ringLabel}, ${variation} pigment variation"><defs><radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="200" cy="185" r="150">${stops.map(([offset, fill]) => `<stop offset="${offset}" stop-color="${fill}"/>`).join('')}</radialGradient></defs>${plant}${petals}<circle cx="200" cy="185" r="13" fill="#acba59"/><g fill="#e0c457" stroke="#af9d42" stroke-width=".7">${Array.from({ length: 10 }, (_, i) => `<ellipse cx="${200 + 10 * Math.sin(i * .628)}" cy="${185 + 10 * Math.cos(i * .628)}" rx="2.3" ry="3.5"/>`).join('')}</g><circle cx="200" cy="185" r="4" fill="#d6e1ac"/></svg>`;
}
