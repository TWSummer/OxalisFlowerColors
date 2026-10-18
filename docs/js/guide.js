import { TRAITS } from './data.js';
import { flowerSvg } from './flowers.js';
export const GUIDE = {
  color: {
    white: ['White or near-white interveinal tissue, including the pale cool-looking examples I–L. Colored veins do not change this label.', 'white', 'high'],
    pink: ['Rose, pink, or pale pink-lilac tissue, including E and F in our key. Judge the pigmented background outside the center ring.', 'pink', 'low'],
    purple: ['A clearly violet background like G and H. This project uses a narrower purple group than the paper.', 'purple', 'low']
  },
  veins: {
    low: ['Veins are faint, subtle, or not visible at the standard view. Low does not mean anatomically absent.', 'pink', 'low'],
    medium: ['Veins are readily visible but remain secondary to the petal background, as in A, F, and H.', 'pink', 'medium'],
    high: ['A strong contrasting vein network is a dominant visual feature, as in O and P.', 'white', 'high']
  },
  ring: {
    absent: ['No pale or white band interrupts the colored tissue before the yellow/orange throat. At least three petal bases must be clearly visible; a hidden band is not an absent band.', 'pink', 'low'],
    faint: ['A weak pale band blends softly into the outer tissue just outside the throat on at least three petals. The view is adequate: Faint describes the ring, not uncertainty. Width alone does not decide the category.', 'pink', 'low', { ring: 'faint' }],
    clear: ['A distinct white band separates the yellow/orange throat from the colored outer petal on at least three petals. Veins may cross it.', 'pink', 'low', { ring: 'clear' }]
  },
  variation: {
    none: ['Nearly uniform background outside the throat, veins, and any white center ring. Overall pale or dark flowers can both be None.', 'pink', 'low'],
    low: ['A subtle but repeatable change in background pigment intensity across the petal, without clearly distinct pale and dark zones.', 'pink', 'low', { variation: 'low' }],
    high: ['Clearly distinct pale and dark regions across the petal, as in F: pink near the base, nearly white middle, deeper pink margin.', 'pink', 'medium', { variation: 'high' }]
  }
};
export function drawGuide(config) {
  document.getElementById('hero-flower').innerHTML = flowerSvg('white', 'high', true);
  for (const [trait, examples] of Object.entries(GUIDE)) {
    const container = document.getElementById(`${trait}-cards`);
    for (const [value, [description, color, contrast, options]] of Object.entries(examples)) {
      const card = document.createElement('article'); card.className = 'color-card';
      const anchors = config.figure1Anchors[trait][TRAITS[trait].options[value].label];
      card.innerHTML = `<div class="specimen"><span class="specimen-id">SCHEMATIC</span>${flowerSvg(color, contrast, false, options)}</div><h3>${TRAITS[trait].options[value].label}</h3><p>${description}</p><p class="paper-reference">${anchors.length ? `Our Figure 1 key: ${anchors.join(', ')}` : 'No Figure 1 anchor specified; use the written rule.'}</p>`;
      container.append(card);
    }
    const fieldLink = document.getElementById(`${trait}-field`);
    fieldLink.textContent = config.fields[trait].name; fieldLink.href = `https://www.inaturalist.org/observation_fields/${config.fields[trait].id}`;
  }
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  function select(index) { tabs.forEach((tab, i) => { tab.setAttribute('aria-selected', String(i === index)); tab.tabIndex = i === index ? 0 : -1; document.getElementById(tab.getAttribute('aria-controls')).hidden = i !== index; }); }
  tabs.forEach((tab, index) => { tab.addEventListener('click', () => select(index)); tab.addEventListener('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault(); const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (index + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    select(next); tabs[next].focus();
  }); });
}
