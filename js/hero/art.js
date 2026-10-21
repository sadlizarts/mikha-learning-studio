// Placeholder hero art (v1.9.0): an original character drawn as layered SVG on the 1024x1536 rig.
// Same canvas, baseline (y 1440) and anchors as the AI asset spec, so approved AI layers can replace any of these 1:1.
// Identity (locked): face, proportions, navy hair with one red streak, amber eyes.

export const W = 1024, H = 1536;
export const ANCHORS = { neck: [512, 600], hip: [512, 930], grip: [722, 884], aura: [512, 820] };
const INK = '#1B1826', SW = 7;
const SKIN = '#FFDCC4', SKIN_SH = '#F0B999', HAIR = '#223064', HAIR_HI = '#3A4F9A', HAIR_SH = '#151D40', STREAK = '#E8473C';
const S = `stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round" stroke-linecap="round"`;
const s2 = (w) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;

export const STAGES = [
  { belt: '#F4F1EA', gi: '#FBF7EE', giSh: '#DCD5C6', pants: '#8C8A9A', pantsSh: '#6E6C7D', trim: '#C9C2B2' },
  { belt: '#FFD233', gi: '#FBF7EE', giSh: '#DCD5C6', pants: '#2E3A66', pantsSh: '#212B4F', trim: '#C9C2B2' },
  { belt: '#FF8A1F', gi: '#FBF7EE', giSh: '#DCD5C6', pants: '#2E3A66', pantsSh: '#212B4F', trim: '#D6453A' },
  { belt: '#1FA463', gi: '#FBF7EE', giSh: '#DCD5C6', pants: '#26324F', pantsSh: '#1A2340', trim: '#1FA463', wraps: true, pad: true },
  { belt: '#2F6FE0', gi: '#FBF7EE', giSh: '#DCD5C6', pants: '#1E2847', pantsSh: '#141B33', trim: '#2F6FE0', wraps: true, pad: true, haori: '#24407F', haoriSh: '#182C5C' },
  { belt: '#7A4BE0', gi: '#FBF7EE', giSh: '#DCD5C6', pants: '#1E2140', pantsSh: '#141630', trim: '#7A4BE0', wraps: true, pad: true, haori: '#3B2A78', haoriSh: '#2A1D57', cape: '#5B3CC0', capeSh: '#3F2A8C' },
  { belt: '#8A5A2B', gi: '#FBF7EE', giSh: '#DCD5C6', pants: '#1C1A2E', pantsSh: '#121020', trim: '#C9862E', wraps: true, pad: true, haori: '#3A2A1C', haoriSh: '#271C12', cape: '#7A2E24', capeSh: '#55201A', plate: '#B9793A', plateSh: '#8A5626' },
  { belt: '#1B1826', gi: '#F4F1EA', giSh: '#D6CFBF', pants: '#15131F', pantsSh: '#0C0B14', trim: '#F5C400', wraps: true, pad: true, haori: '#17152A', haoriSh: '#0E0D1B', cape: '#1B1730', capeSh: '#0F0D1E', plate: '#2C2A40', plateSh: '#1C1A2C', gold: true },
];

/* ---------------- locked identity layers ---------------- */
export function hairBack() {
  return `<path d="M318 470 C280 360 300 230 380 175 L360 120 L430 160 L452 92 L500 150 L548 84 L572 150 L640 104 L630 170 C720 210 760 330 716 470 L742 540 L676 512 L690 590 L630 540 L600 470 L424 470 L396 540 L332 590 L346 512 L282 540 Z" fill="${HAIR}" ${S}/>
    <path d="M330 470 L300 532 L352 506 Z M700 470 L726 532 L676 506 Z" fill="${HAIR_SH}"/>`;
}

export function body() {
  // undersuit + skin; legs, torso, arms, hands, neck, head (face)
  return `
  <g id="legs">
    <path d="M420 940 L404 1380 L494 1380 L506 960 Z" fill="#2A2540" ${S}/>
    <path d="M520 960 L532 1380 L622 1380 L604 940 Z" fill="#2A2540" ${S}/>
    <path d="M392 1372 C380 1404 386 1438 440 1440 L506 1440 C514 1410 508 1384 498 1372 Z" fill="#3A2E28" ${S}/>
    <path d="M528 1372 C518 1384 512 1410 520 1440 L588 1440 C640 1438 646 1404 632 1372 Z" fill="#3A2E28" ${S}/>
  </g>
  <g id="arms">
    <path d="M356 650 C318 700 300 790 296 880 L344 886 C350 806 366 736 392 690 Z" fill="#2A2540" ${S}/>
    <path d="M668 650 C708 690 736 760 742 840 L700 860 C694 790 676 730 640 690 Z" fill="#2A2540" ${S}/>
  </g>
  <path d="M352 640 C400 612 624 612 672 640 L640 900 C600 930 424 930 384 900 Z" fill="#2A2540" ${S}/>
  <g id="hands">
    <path d="M292 872 C276 900 284 944 318 950 C350 954 358 920 352 884 Z" fill="${SKIN}" ${S}/>
    <path d="M300 916 l-8 22 M318 922 l-4 24" ${s2(4)}/>
    <path d="M694 852 C684 884 700 916 732 916 C766 914 772 880 752 852 Z" fill="${SKIN}" ${S}/>
    <path d="M700 880 C716 872 742 872 760 878" ${s2(4)} fill="none"/>
  </g>
  <path d="M480 548 L478 616 C496 632 528 632 546 616 L544 548 Z" fill="${SKIN}" ${S}/>
  <path d="M480 588 C500 604 524 604 544 588 L544 560 L480 560 Z" fill="${SKIN_SH}"/>
  <g id="head">
    <path d="M512 214 C640 214 690 300 682 400 C676 470 640 530 578 562 C548 578 528 584 512 584 C496 584 476 578 446 562 C384 530 348 470 342 400 C334 300 384 214 512 214 Z" fill="${SKIN}" ${S}/>
    <path d="M640 470 C626 520 596 552 560 568 C600 548 632 512 646 460 Z" fill="${SKIN_SH}"/>
    <ellipse cx="420" cy="500" rx="30" ry="14" fill="#FF9C8A" opacity=".35"/>
    <ellipse cx="604" cy="500" rx="30" ry="14" fill="#FF9C8A" opacity=".35"/>
    <path d="M330 420 C318 400 316 444 332 462 Z M694 420 C706 400 708 444 692 462 Z" fill="${SKIN}" ${s2(5)}/>
    <!-- eyes -->
    <g id="eyeL">
      <path d="M396 438 C404 392 470 384 488 428 L486 470 C470 486 412 486 398 468 Z" fill="#fff" ${s2(5)}/>
      <ellipse cx="446" cy="442" rx="27" ry="34" fill="#E89A2C"/>
      <ellipse cx="446" cy="452" rx="20" ry="22" fill="#B35F14"/>
      <ellipse cx="447" cy="448" rx="10" ry="15" fill="${INK}"/>
      <circle cx="436" cy="428" r="9" fill="#fff"/><circle cx="458" cy="464" r="4.5" fill="#fff"/>
      <path d="M390 430 C410 396 470 388 494 424" fill="none" ${s2(10)}/>
    </g>
    <g id="eyeR">
      <path d="M536 428 C554 384 620 392 628 438 L626 468 C612 486 554 486 538 470 Z" fill="#fff" ${s2(5)}/>
      <ellipse cx="578" cy="442" rx="27" ry="34" fill="#E89A2C"/>
      <ellipse cx="578" cy="452" rx="20" ry="22" fill="#B35F14"/>
      <ellipse cx="577" cy="448" rx="10" ry="15" fill="${INK}"/>
      <circle cx="568" cy="428" r="9" fill="#fff"/><circle cx="590" cy="464" r="4.5" fill="#fff"/>
      <path d="M530 424 C554 388 614 396 634 430" fill="none" ${s2(10)}/>
    </g>
    <path d="M396 372 L478 386 M628 372 L546 386" ${s2(12)}/>
    <path d="M512 486 l-8 20 l12 2" fill="none" ${s2(4)}/>
    <path d="M482 530 C498 544 528 544 544 528" fill="none" ${s2(5)}/>
  </g>`;
}

export function hairFront() {
  return `<path d="M346 400 C330 300 380 196 512 190 C640 196 700 300 680 400 L660 360 L640 420 L612 330 L586 400 L560 316 L530 392 L506 312 L478 394 L452 318 L426 404 L404 336 L384 420 L364 368 Z" fill="${HAIR}" ${S}/>
    <path d="M506 312 L530 392 L548 340 L530 250 Z" fill="${STREAK}" ${s2(5)}/>
    <path d="M400 250 C440 220 480 214 520 216 C470 230 440 250 420 290 Z" fill="${HAIR_HI}"/>
    <path d="M346 400 L330 500 L370 450 L362 520 L398 462 Z M680 400 L696 500 L656 450 L664 520 L628 462 Z" fill="${HAIR}" ${S}/>
    <path d="M620 260 C650 290 666 330 668 370 L640 330 Z" fill="${HAIR_SH}"/>`;
}

/* ---------------- evolution stage layers ---------------- */
export function back(stage) {
  const st = STAGES[stage] || STAGES[0];
  let out = '';
  if (st.cape) out += `<path d="M360 640 C300 900 270 1180 300 1400 C420 1360 600 1360 724 1400 C752 1180 724 900 664 640 Z" fill="${st.cape}" ${S}/>
    <path d="M600 680 C660 900 690 1160 690 1380 C710 1390 724 1400 724 1400 C752 1180 724 900 664 640 Z" fill="${st.capeSh}"/>`;
  if (st.gold) out += `<g opacity=".95"><circle cx="512" cy="330" r="232" fill="none" stroke="#F5C400" stroke-width="10" stroke-dasharray="4 26" stroke-linecap="round"/>
    <path d="M512 74 l18 52 l-18 -12 l-18 12 Z M290 160 l40 36 l-22 0 l-6 20 Z M734 160 l-40 36 l22 0 l6 20 Z" fill="#F5C400" ${s2(4)}/></g>`;
  return out;
}

export function outfit(stage) {
  const st = STAGES[stage] || STAGES[0];
  const pants = `<path d="M396 930 C380 1060 368 1240 374 1380 L502 1380 L512 1010 L522 1380 L650 1380 C656 1240 644 1060 628 930 Z" fill="${st.pants}" ${S}/>
    <path d="M560 990 C590 1100 604 1240 606 1380 L650 1380 C656 1240 644 1060 628 930 Z" fill="${st.pantsSh}"/>
    <path d="M440 1010 L428 1360 M584 1010 L596 1360" ${s2(4)} opacity=".6"/>`;
  const gi = `<path d="M352 640 C410 610 614 610 672 640 L700 760 L650 770 L640 930 L384 930 L374 770 L324 760 Z" fill="${st.gi}" ${S}/>
    <path d="M560 640 C600 700 620 800 640 930 L640 780 L700 760 L672 640 Z" fill="${st.giSh}"/>
    <path d="M454 616 L512 760 L570 616" fill="none" stroke="${st.trim}" stroke-width="18" stroke-linejoin="round"/>
    <path d="M454 616 L512 760 L570 616" fill="none" ${s2(5)}/>
    <path d="M324 760 C316 800 304 840 298 870 L346 876 C350 840 360 806 374 770 Z" fill="${st.gi}" ${S}/>
    <path d="M700 760 C710 790 722 820 740 846 L700 864 C690 834 664 800 650 770 Z" fill="${st.gi}" ${S}/>`;
  const belt = `<path d="M378 880 L646 880 L644 936 L380 936 Z" fill="${st.belt}" ${S}/>
    <path d="M500 900 L470 1010 L506 1004 L520 940 Z M524 900 L560 1000 L528 1002 L512 940 Z" fill="${st.belt}" ${s2(5)}/>
    <rect x="490" y="886" width="44" height="44" rx="8" fill="${st.belt}" ${s2(5)}/>`;
  const haori = st.haori ? `<path d="M340 646 C320 760 316 900 330 1060 L420 1060 L430 760 L456 620 Z" fill="${st.haori}" ${S}/>
    <path d="M684 646 C704 760 708 900 694 1060 L604 1060 L594 760 L568 620 Z" fill="${st.haori}" ${S}/>
    <path d="M640 700 C660 820 668 940 662 1060 L694 1060 C708 900 704 760 684 646 Z" fill="${st.haoriSh}"/>
    <path d="M336 1040 L424 1040 M600 1040 L690 1040" stroke="${st.trim}" stroke-width="10"/>` : '';
  const wraps = st.wraps ? `<path d="M300 830 L350 836 M298 852 L348 858 M736 818 L694 836 M744 838 L702 856" stroke="#EDE6D6" stroke-width="16" stroke-linecap="round"/>` : '';
  const pad = st.pad ? `<path d="M330 630 C350 600 410 596 436 626 L420 690 C392 676 356 680 330 700 Z" fill="${st.plate || '#6B7A8F'}" ${S}/>
    <path d="M694 630 C674 600 614 596 588 626 L604 690 C632 676 668 680 694 700 Z" fill="${st.plate || '#6B7A8F'}" ${S}/>
    ${st.gold ? '<path d="M340 640 C362 618 404 616 424 636 M684 640 C662 618 620 616 600 636" fill="none" stroke="#F5C400" stroke-width="6"/>' : ''}` : '';
  const plate = st.plate ? `<path d="M410 680 C450 660 574 660 614 680 L604 860 C570 880 454 880 420 860 Z" fill="${st.plate}" ${S}/>
    <path d="M540 670 C580 700 600 780 604 860 C590 870 570 876 556 878 C560 800 556 720 540 670 Z" fill="${st.plateSh}"/>
    ${st.gold ? '<path d="M512 690 l26 50 l-26 70 l-26 -70 Z" fill="#F5C400" stroke="#1B1826" stroke-width="5" stroke-linejoin="round"/><path d="M420 860 C454 880 570 880 604 860" fill="none" stroke="#F5C400" stroke-width="8"/>' : `<path d="M450 760 L574 760" ${s2(5)} opacity=".5"/>`}` : '';
  return pants + gi + haori + plate + belt + pad + wraps;
}

/* ---------------- equipment items ---------------- */
const ITEMS_ART = {
  // weapons: grip (722, 884)
  'w-bokken': () => `<g transform="rotate(20 722 884)"><rect x="708" y="430" width="30" height="430" rx="12" fill="#B07A43" ${S}/><rect x="712" y="440" width="10" height="400" rx="5" fill="#D29A5E"/><rect x="694" y="858" width="58" height="18" rx="6" fill="#5A3A22" ${s2(5)}/><rect x="710" y="876" width="24" height="120" rx="10" fill="#7A5232" ${S}/></g>`,
  'w-ember-staff': () => `<g transform="rotate(10 722 884)"><rect x="712" y="380" width="22" height="760" rx="10" fill="#5B3A24" ${S}/><path d="M723 300 C760 340 760 390 723 410 C686 390 686 340 723 300 Z" fill="#FF6A2E" ${S}/><path d="M723 330 C740 350 740 380 723 392 C706 380 706 350 723 330 Z" fill="#FFD233"/><rect x="704" y="404" width="38" height="22" rx="6" fill="#C9862E" ${s2(5)}/></g>`,
  'w-compass-blade': () => `<g transform="rotate(16 722 884)"><path d="M722 360 L748 420 L740 840 L704 840 L696 420 Z" fill="#CFE0FF" ${S}/><path d="M722 380 L736 420 L730 830 L722 830 Z" fill="#fff"/><circle cx="722" cy="856" r="34" fill="none" stroke="#1D5FD0" stroke-width="14"/><circle cx="722" cy="856" r="34" fill="none" ${s2(5)}/><path d="M722 822 L722 890 M688 856 L756 856" ${s2(5)}/><rect x="710" y="886" width="24" height="110" rx="10" fill="#1D5FD0" ${S}/></g>`,
  'w-prism-staff': () => `<g transform="rotate(8 722 884)"><rect x="712" y="420" width="22" height="720" rx="10" fill="#2E6B4A" ${S}/><path d="M723 290 L770 360 L723 440 L676 360 Z" fill="#7FE3B5" ${S}/><path d="M723 290 L770 360 L723 360 Z" fill="#C9F5E0"/><path d="M690 440 C700 420 746 420 756 440" fill="none" stroke="#157F4B" stroke-width="14"/></g>`,
  'w-quill-lance': () => `<g transform="rotate(12 722 884)"><rect x="714" y="420" width="18" height="760" rx="8" fill="#5E3FE0" ${S}/><path d="M723 230 C786 300 780 420 723 470 C700 400 690 300 723 230 Z" fill="#F4EFFF" ${S}/><path d="M723 250 L723 460" ${s2(4)}/><path d="M723 300 L752 280 M723 340 L758 322 M723 380 L756 366" ${s2(3)}/></g>`,
  'w-grand-katana': () => `<g transform="rotate(18 722 884)"><path d="M716 320 C742 420 744 640 734 840 L708 840 C714 640 712 440 716 320 Z" fill="#E9EEF8" ${S}/><path d="M718 340 C730 440 732 640 726 830" stroke="#9FD3FF" stroke-width="5" fill="none"/><ellipse cx="722" cy="852" rx="46" ry="16" fill="#F5C400" ${s2(5)}/><rect x="710" y="866" width="24" height="140" rx="10" fill="#1B1826" stroke="#F5C400" stroke-width="5"/><path d="M714 890 l16 16 M714 920 l16 16 M714 950 l16 16" stroke="#F5C400" stroke-width="4"/></g>`,
  // accessories
  'a-headband': () => `<path d="M352 330 C420 300 604 300 672 330 L668 362 C604 336 420 336 356 362 Z" fill="#D6453A" ${S}/><circle cx="512" cy="330" r="20" fill="#FBF7EE" ${s2(5)}/><path d="M670 340 C730 350 770 380 800 420 L770 430 C740 396 712 376 666 362 Z M680 350 C730 380 750 420 760 470 L734 466 C724 426 706 396 672 366 Z" fill="#D6453A" ${S}/>`,
  'a-amulet': () => `<path d="M470 610 C480 680 544 680 554 610" fill="none" stroke="#C9862E" stroke-width="6"/><path d="M512 676 L540 706 L512 750 L484 706 Z" fill="#7FD4FF" ${S}/><path d="M512 684 L528 706 L512 730 Z" fill="#fff"/>`,
  'a-aksara-scarf': () => `<path d="M420 580 C460 620 564 620 604 580 L620 640 C570 676 454 676 404 640 Z" fill="#C42A2F" ${S}/><path d="M430 610 l20 0 M470 626 l20 0 M530 626 l20 0 M574 610 l20 0" stroke="#FBF7EE" stroke-width="6"/><path d="M590 640 C610 700 620 760 640 820 L600 830 C590 770 576 710 560 656 Z" fill="#C42A2F" ${S}/>`,
  'a-dawn-lantern': () => `<path d="M386 936 L386 990" ${s2(5)}/><path d="M356 990 L416 990 L424 1080 L348 1080 Z" fill="#FFE9A8" ${S}/><path d="M372 1000 L400 1000 L404 1070 L368 1070 Z" fill="#FFC94A"/><path d="M350 990 C360 970 412 970 422 990 M346 1080 L426 1080" fill="none" ${s2(7)}/>`,
  // armor
  'r-shoulder': () => `<path d="M318 640 C336 590 420 586 446 628 L428 712 C390 694 346 700 318 724 Z" fill="#8C98AD" ${S}/><path d="M706 640 C688 590 604 586 578 628 L596 712 C634 694 678 700 706 724 Z" fill="#8C98AD" ${S}/><path d="M650 610 C680 620 696 650 700 690 L660 690 Z" fill="#6C778C"/>`,
  'r-gauntlets': () => `<path d="M290 820 L352 828 L348 880 L286 874 Z" fill="#8C98AD" ${S}/><path d="M690 830 L744 812 L758 866 L702 884 Z" fill="#8C98AD" ${S}/>`,
  'r-unity-guard': () => `<circle cx="372" cy="664" r="70" fill="#8A5A00" ${S}/><circle cx="372" cy="664" r="50" fill="#FFC43D" ${s2(5)}/><path d="M372 628 l10 26 l28 0 l-22 16 l8 28 l-24 -16 l-24 16 l8 -28 l-22 -16 l28 0 Z" fill="#FBF7EE" ${s2(4)}/>`,
  'r-sealbreaker': () => `<path d="M404 670 C450 640 574 640 620 670 L608 880 C570 904 454 904 416 880 Z" fill="#4B2A8C" ${S}/><path d="M512 680 C560 700 580 760 512 860 C444 760 464 700 512 680 Z" fill="#8B5CF6" ${s2(5)}/><path d="M512 700 L512 840 M470 760 L554 760" stroke="#F5C400" stroke-width="7"/>`,
};
export const itemArt = (key) => (ITEMS_ART[key] ? ITEMS_ART[key]() : '');

export const svgDoc = (inner, { w = W, h = H, view = `0 0 ${W} ${H}` } = {}) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${view}" width="${w}" height="${h}">${inner}</svg>`;

/** Static composite (cards, previews): layer order = asset spec z-order. */
export function heroSVG({ stage = 0, equipped = {}, silhouette = false } = {}, opts) {
  const inner = [back(stage), hairBack(), body(), outfit(stage), itemArt(equipped.armor), hairFront(), itemArt(equipped.accessory), itemArt(equipped.weapon)].join('');
  if (silhouette) return svgDoc(`<g style="filter:brightness(0)">${inner}</g>`, opts);
  return svgDoc(inner, opts);
}

/** Per-layer SVG documents for the runtime renderer (same z-order). */
export function layerSVGs({ stage = 0, equipped = {} } = {}) {
  return {
    back: back(stage), hairBack: hairBack(), body: body(), outfit: outfit(stage),
    armor: itemArt(equipped.armor), hairFront: hairFront(), accessory: itemArt(equipped.accessory), weapon: itemArt(equipped.weapon),
  };
}
