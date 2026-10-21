// Hero art v2 (v2.0.0): an original anime learning-companion drawn as layered SVG on the 1024x1536 rig.
// Same canvas, baseline (y 1440) and anchors as the AI asset spec, so approved AI layers can replace any layer 1:1.
// Identity (locked): teen proportions (~5 heads), navy hair swept right with ONE red streak, amber eyes, confident smirk.

export const W = 1024, H = 1536;
export const ANCHORS = { neck: [512, 560], hip: [512, 930], grip: [722, 884], aura: [512, 820] };
const INK = '#17132B', SW = 5;
const SKIN = '#FFE1CC', SKIN_SH = '#F2B99C', SKIN_DEEP = '#E09A7E';
const S = `stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round" stroke-linecap="round"`;
const s2 = (w) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const lg = (id, stops, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</linearGradient>`;

export const STAGES = [
  { belt: '#F4F1EA', gi: '#FBF8F1', giSh: '#D9D2C4', pants: '#8D8BA0', pantsSh: '#5F5D72', trim: '#CFC8B8' },
  { belt: '#FFD233', gi: '#FBF8F1', giSh: '#D9D2C4', pants: '#34416F', pantsSh: '#1D2649', trim: '#CFC8B8' },
  { belt: '#FF8A1F', gi: '#FBF8F1', giSh: '#D9D2C4', pants: '#34416F', pantsSh: '#1D2649', trim: '#D6453A' },
  { belt: '#1FA463', gi: '#FBF8F1', giSh: '#D9D2C4', pants: '#2A3557', pantsSh: '#161D36', trim: '#1FA463', wraps: true, pad: true },
  { belt: '#2F6FE0', gi: '#FBF8F1', giSh: '#D9D2C4', pants: '#222C50', pantsSh: '#121831', trim: '#2F6FE0', wraps: true, pad: true, haori: '#2A4A92', haoriSh: '#162B5E' },
  { belt: '#7A4BE0', gi: '#FBF8F1', giSh: '#D9D2C4', pants: '#221F45', pantsSh: '#121029', trim: '#9B6BFF', wraps: true, pad: true, haori: '#3E2C80', haoriSh: '#221650', cape: '#5B3CC0', capeSh: '#2E1D72' },
  { belt: '#8A5A2B', gi: '#FBF8F1', giSh: '#D9D2C4', pants: '#1E1B30', pantsSh: '#100E1B', trim: '#D8963C', wraps: true, pad: true, haori: '#3B2A1E', haoriSh: '#21160F', cape: '#8A2F25', capeSh: '#4E1712', plate: '#C08443', plateSh: '#7E4F22' },
  { belt: '#1B1826', gi: '#F4F1EA', giSh: '#CFC7B6', pants: '#16141F', pantsSh: '#08070D', trim: '#F5C400', wraps: true, pad: true, haori: '#1A1830', haoriSh: '#0B0A16', cape: '#1D1838', capeSh: '#0A0818', plate: '#2E2C46', plateSh: '#16152A', gold: true },
];

/* ---------------- locked identity layers ---------------- */
export function hairBack() {
  return `<defs>${lg('hb-g', [[0, '#3A4FA0'], [0.55, '#1E2A62'], [1, '#0E1433']])}</defs>
    <path d="M372 372 C350 268 382 176 468 142 L446 84 L520 122 L566 58 L590 130 L664 92 L650 168 C716 214 712 330 680 390 L712 440 L650 422 L640 478 L604 410 L424 410 L392 478 L380 424 L326 446 Z" fill="url(#hb-g)" ${S}/>
    <path d="M664 92 L650 168 C690 196 704 240 704 288 C690 240 664 210 636 196 Z" fill="#0E1433" opacity=".55"/>`;
}

export function body() {
  return `<defs>
    ${lg('bd-skin', [[0, SKIN], [1, SKIN_SH]], 1, 0)}
    ${lg('bd-suit', [[0, '#3A3458'], [1, '#1C1830']], 1, 0)}
    ${lg('bd-iris', [[0, '#FFD27A'], [0.5, '#E8962C'], [1, '#9C4A0C']])}
    ${lg('bd-boot', [[0, '#4A3A34'], [1, '#231915']])}
    <clipPath id="bd-eyeL"><path d="M426 372 C438 348 482 342 498 362 C494 384 476 398 460 398 C442 398 430 388 426 372 Z"/></clipPath>
    <clipPath id="bd-eyeR"><path d="M598 372 C586 348 542 342 526 362 C530 384 548 398 564 398 C582 398 594 388 598 372 Z"/></clipPath>
  </defs>
  <g id="legs">
    <path d="M436 930 L424 1370 L500 1370 L508 950 Z" fill="url(#bd-suit)" ${S}/>
    <path d="M588 930 L600 1370 L524 1370 L516 950 Z" fill="url(#bd-suit)" ${S}/>
    <path d="M412 1360 C400 1400 404 1436 452 1440 L506 1440 C514 1410 510 1380 500 1360 Z" fill="url(#bd-boot)" ${S}/>
    <path d="M612 1360 C624 1400 620 1436 572 1440 L518 1440 C510 1410 514 1380 524 1360 Z" fill="url(#bd-boot)" ${S}/>
    <path d="M420 1384 L500 1380 M420 1404 L502 1400 M604 1384 L524 1380 M604 1404 L522 1400" stroke="#C9B9A8" stroke-width="5" opacity=".7"/>
  </g>
  <g id="arms">
    <path d="M372 596 C336 650 316 760 306 868 L350 872 C356 770 372 690 404 640 Z" fill="url(#bd-suit)" ${S}/>
    <path d="M652 596 C690 650 716 750 736 846 L698 864 C684 776 664 700 624 640 Z" fill="url(#bd-suit)" ${S}/>
  </g>
  <path d="M368 590 C420 564 604 564 656 590 L636 930 L388 930 Z" fill="url(#bd-suit)" ${S}/>
  <g id="hands">
    <path d="M300 862 C284 892 290 936 322 944 C352 950 364 914 356 868 Z" fill="url(#bd-skin)" ${S}/>
    <path d="M306 912 l-6 18 M322 918 l-3 20 M338 914 l0 18" ${s2(3)}/>
    <path d="M692 850 C682 882 696 916 728 918 C762 916 770 882 752 850 Z" fill="url(#bd-skin)" ${S}/>
    <path d="M698 878 C716 870 742 870 762 876 M700 898 C718 892 740 892 758 896" ${s2(3)} fill="none"/>
  </g>
  <path d="M484 446 L482 560 C500 574 524 574 542 560 L540 446 Z" fill="url(#bd-skin)" ${S}/>
  <path d="M484 462 C500 492 524 492 540 462 L540 504 C524 516 500 516 484 504 Z" fill="${SKIN_DEEP}" opacity=".55"/>
  <g id="head">
    <path d="M392 330 C372 322 364 366 384 394 L398 390 Z M632 330 C652 322 660 366 640 394 L626 390 Z" fill="${SKIN_SH}" ${s2(4)}/>
    <path d="M512 196 C602 196 642 260 638 338 C636 380 626 410 606 438 C580 468 546 486 512 494 C478 486 444 468 418 438 C398 410 388 380 386 338 C382 260 422 196 512 196 Z" fill="url(#bd-skin)" ${S}/>
    <path d="M612 352 C606 408 584 446 546 470 C588 460 618 428 630 380 Z" fill="${SKIN_SH}" opacity=".9"/>
    <ellipse cx="444" cy="420" rx="22" ry="9" fill="#FF8E7A" opacity=".28"/><ellipse cx="582" cy="420" rx="22" ry="9" fill="#FF8E7A" opacity=".28"/>
    <g transform="translate(462 372) scale(1.04 1.22) translate(-462 -372)">
    <!-- left eye -->
    <path d="M426 372 C438 348 482 342 498 362 C494 384 476 398 460 398 C442 398 430 388 426 372 Z" fill="#FBF3EE"/>
    <g clip-path="url(#bd-eyeL)"><ellipse cx="465" cy="374" rx="23" ry="28" fill="url(#bd-iris)"/><ellipse cx="466" cy="376" rx="9" ry="14" fill="${INK}"/><circle cx="458" cy="362" r="6" fill="#fff"/><circle cx="474" cy="386" r="3" fill="#fff" opacity=".9"/><path d="M420 352 C450 346 490 348 504 360 L504 366 C480 356 446 356 420 368 Z" fill="#000" opacity=".18"/></g>
    <path d="M420 370 C434 340 486 334 504 358 L500 362 C482 348 442 350 428 374 Z" fill="${INK}"/>
    <path d="M422 366 L408 356 L418 372 Z" fill="${INK}"/>
    </g>
    <g transform="translate(562 372) scale(1.04 1.22) translate(-562 -372)">
    <!-- right eye -->
    <path d="M598 372 C586 348 542 342 526 362 C530 384 548 398 564 398 C582 398 594 388 598 372 Z" fill="#FBF3EE"/>
    <g clip-path="url(#bd-eyeR)"><ellipse cx="559" cy="374" rx="23" ry="28" fill="url(#bd-iris)"/><ellipse cx="558" cy="376" rx="9" ry="14" fill="${INK}"/><circle cx="550" cy="362" r="6" fill="#fff"/><circle cx="566" cy="386" r="3" fill="#fff" opacity=".9"/><path d="M604 352 C574 346 534 348 520 360 L520 366 C544 356 578 356 604 368 Z" fill="#000" opacity=".18"/></g>
    <path d="M604 370 C590 340 538 334 520 358 L524 362 C542 348 582 350 596 374 Z" fill="${INK}"/>
    <path d="M602 366 L616 356 L606 372 Z" fill="${INK}"/>
    </g>
    <!-- brows, nose, mouth -->
    <path d="M430 296 C450 284 476 284 494 294 L492 300 C474 292 452 292 434 302 Z" fill="#1A2350"/>
    <path d="M594 296 C574 284 548 284 530 294 L532 300 C550 292 572 292 590 302 Z" fill="#1A2350"/>
    <path d="M516 392 L506 422 L520 424" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M520 400 L528 420 L520 424 Z" fill="${SKIN_SH}"/>
    <path d="M488 456 C500 464 522 464 540 452" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
    <path d="M540 452 l6 -4" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
  </g>`;
}

export function hairFront() {
  return `<defs>${lg('hf-g', [[0, '#4A62BE'], [0.45, '#25336F'], [1, '#121A42']])}</defs>
    <path d="M382 356 C368 252 418 172 512 166 C608 170 658 236 644 336 L630 296 L620 334 L596 284 L574 326 L554 266 L530 322 L506 254 L480 324 L462 276 L444 330 L420 298 L404 356 Z" fill="url(#hf-g)" ${S}/>
    <path d="M394 324 L370 452 L404 408 L404 470 L430 382 Z" fill="url(#hf-g)" ${S}/>
    <path d="M632 324 L660 446 L626 404 L622 464 L598 380 Z" fill="url(#hf-g)" ${S}/>
    <path d="M506 254 L530 322 L544 290 L528 206 Z" fill="#E8473C" ${s2(4)}/>
    <path d="M512 214 L530 306" stroke="#FF8A7A" stroke-width="4" stroke-linecap="round" opacity=".8"/>
    <path d="M412 250 C452 212 524 196 598 212 C544 220 474 234 428 282 Z" fill="#8AA2F0" opacity=".55"/>
    <path d="M470 196 C520 180 580 186 620 214" fill="none" stroke="#B8C7FF" stroke-width="5" stroke-linecap="round" opacity=".5"/>
    <path d="M444 238 L432 300 M566 228 L582 290 M600 240 L612 300" stroke="#0E1433" stroke-width="3" opacity=".45" stroke-linecap="round"/>`;
}

/* ---------------- evolution stage layers ---------------- */
export function back(stage) {
  const st = STAGES[stage] || STAGES[0];
  let out = '';
  if (st.cape) out += `<defs>${lg(`bk-c${stage}`, [[0, st.cape], [1, st.capeSh]], 1, 1)}</defs>
    <path d="M362 610 C300 880 268 1170 296 1404 C420 1366 604 1366 728 1404 C756 1170 724 880 662 610 Z" fill="url(#bk-c${stage})" ${S}/>
    <path d="M420 700 C400 900 392 1150 400 1380 M604 700 C624 900 632 1150 624 1380" stroke="#000" stroke-width="4" opacity=".25" fill="none"/>`;
  if (st.gold) out += `<g opacity=".95"><circle cx="512" cy="300" r="236" fill="none" stroke="#F5C400" stroke-width="8" stroke-dasharray="3 22" stroke-linecap="round"/>
    <circle cx="512" cy="300" r="214" fill="none" stroke="#FFE7A0" stroke-width="2" opacity=".6"/>
    <path d="M512 40 l18 52 l-18 -12 l-18 12 Z M296 130 l40 36 l-22 0 l-6 20 Z M728 130 l-40 36 l22 0 l6 20 Z" fill="#F5C400" ${s2(3)}/></g>`;
  return out;
}

export function outfit(stage) {
  const st = STAGES[stage] || STAGES[0], id = (k) => `of${stage}-${k}`;
  const defs = `<defs>
    ${lg(id('gi'), [[0, st.gi], [0.62, st.gi], [1, st.giSh]], 1, 0)}
    ${lg(id('pt'), [[0, st.pants], [1, st.pantsSh]], 1, 0)}
    ${st.haori ? lg(id('ha'), [[0, st.haori], [1, st.haoriSh]], 1, 0) : ''}
    ${st.plate ? lg(id('pl'), [[0, st.plate], [1, st.plateSh]], 1, 0) : ''}
  </defs>`;
  const pants = `<path d="M392 926 C376 1060 362 1240 366 1378 L504 1378 L512 1010 L520 1378 L658 1378 C662 1240 648 1060 632 926 Z" fill="url(#${id('pt')})" ${S}/>
    <path d="M444 1010 L430 1366 M478 1000 L470 1370 M576 1000 L586 1370 M548 1010 L552 1370" stroke="#000" stroke-width="3.5" opacity=".28"/>
    <path d="M404 960 C398 1100 392 1240 392 1370" stroke="#fff" stroke-width="4" opacity=".18" fill="none"/>`;
  const gi = `<path d="M362 596 C420 566 604 566 662 596 L700 740 L652 756 L644 930 L380 930 L372 756 L324 740 Z" fill="url(#${id('gi')})" ${S}/>
    <path d="M324 740 C312 790 302 830 296 864 L354 870 C358 830 366 790 372 756 Z" fill="url(#${id('gi')})" ${S}/>
    <path d="M700 740 C712 780 724 818 744 848 L702 868 C690 830 668 790 652 756 Z" fill="url(#${id('gi')})" ${S}/>
    <path d="M470 566 L512 700 L554 566 Z" fill="#2B2547"/>
    <path d="M448 566 L512 724 L576 566" fill="none" stroke="${st.trim}" stroke-width="20" stroke-linejoin="round"/>
    <path d="M448 566 L512 724 L576 566" fill="none" ${s2(4)}/>
    <path d="M422 640 C432 700 434 780 430 862 M602 640 C594 720 594 800 598 872 M372 760 C390 770 410 772 428 768" stroke="#000" stroke-width="3" opacity=".18" fill="none"/>
    <path d="M370 612 C352 660 344 700 340 740" stroke="#fff" stroke-width="5" opacity=".6" fill="none" stroke-linecap="round"/>`;
  const belt = `<path d="M380 884 L644 884 L642 938 L382 938 Z" fill="${st.belt}" ${S}/>
    <path d="M384 896 L640 896" stroke="#fff" stroke-width="3" opacity=".35"/>
    <path d="M500 902 L472 1012 L506 1006 L520 942 Z M524 902 L560 1002 L528 1004 L512 942 Z" fill="${st.belt}" ${s2(4)}/>
    <rect x="490" y="888" width="44" height="46" rx="8" fill="${st.belt}" ${s2(4)}/>`;
  const haori = st.haori ? `<path d="M352 600 C330 720 326 880 336 1082 L428 1082 L436 760 L458 584 Z" fill="url(#${id('ha')})" ${S}/>
    <path d="M672 600 C694 720 698 880 688 1082 L596 1082 L588 760 L566 584 Z" fill="url(#${id('ha')})" ${S}/>
    <path d="M338 1060 L428 1060 M596 1060 L688 1060" stroke="${st.trim}" stroke-width="9"/>
    <path d="M448 590 L432 760 L428 1076 M576 590 L592 760 L596 1076" stroke="${st.trim}" stroke-width="5" fill="none" opacity=".9"/>
    <path d="M360 640 C344 760 340 900 344 1040" stroke="#fff" stroke-width="4" opacity=".22" fill="none"/>` : '';
  const wraps = st.wraps ? `<path d="M306 824 L354 830 M304 846 L352 852 M736 812 L696 830 M744 832 L704 850" stroke="#EFE8D8" stroke-width="13" stroke-linecap="round"/>` : '';
  const padC = st.plate ? `url(#${id('pl')})` : '#7D8BA3';
  const pad = st.pad ? `<path d="M330 618 C350 588 410 582 438 612 L422 678 C394 664 356 668 330 688 Z" fill="${padC}" ${S}/>
    <path d="M694 618 C674 588 614 582 586 612 L602 678 C630 664 668 668 694 688 Z" fill="${padC}" ${S}/>
    <path d="M342 626 C362 606 400 604 424 622" fill="none" stroke="${st.gold ? '#F5C400' : '#fff'}" stroke-width="${st.gold ? 6 : 3}" opacity="${st.gold ? 1 : 0.5}"/>
    <path d="M682 626 C662 606 624 604 600 622" fill="none" stroke="${st.gold ? '#F5C400' : '#fff'}" stroke-width="${st.gold ? 6 : 3}" opacity="${st.gold ? 1 : 0.5}"/>` : '';
  const plate = st.plate ? `<path d="M410 660 C450 640 574 640 614 660 L604 860 C570 880 454 880 420 860 Z" fill="url(#${id('pl')})" ${S}/>
    <path d="M424 676 C440 740 444 800 436 852" stroke="#fff" stroke-width="5" opacity=".3" fill="none"/>
    ${st.gold ? `<path d="M512 676 l26 50 l-26 70 l-26 -70 Z" fill="#F5C400" ${s2(4)}/><path d="M420 860 C454 880 570 880 604 860" fill="none" stroke="#F5C400" stroke-width="7"/>` : `<path d="M450 760 L574 760" ${s2(4)} opacity=".45"/>`}` : '';
  return defs + pants + gi + haori + plate + belt + pad + wraps;
}

/* ---------------- equipment items ---------------- */
const ITEMS_ART = {
  // weapons: grip (722, 884)
  'w-bokken': () => `<g transform="rotate(20 722 884)"><rect x="708" y="430" width="30" height="430" rx="12" fill="#B07A43" ${S}/><rect x="712" y="440" width="10" height="400" rx="5" fill="#D9A46A"/><rect x="694" y="858" width="58" height="18" rx="6" fill="#5A3A22" ${s2(4)}/><rect x="710" y="876" width="24" height="120" rx="10" fill="#7A5232" ${S}/></g>`,
  'w-ember-staff': () => `<g transform="rotate(10 722 884)"><rect x="712" y="380" width="22" height="760" rx="10" fill="#5B3A24" ${S}/><path d="M723 290 C766 336 766 392 723 414 C680 392 680 336 723 290 Z" fill="#FF6A2E" ${S}/><path d="M723 326 C742 348 742 382 723 396 C704 382 704 348 723 326 Z" fill="#FFD233"/><rect x="704" y="404" width="38" height="22" rx="6" fill="#C9862E" ${s2(4)}/></g>`,
  'w-compass-blade': () => `<g transform="rotate(16 722 884)"><path d="M722 350 L750 420 L740 840 L704 840 L694 420 Z" fill="#CFE0FF" ${S}/><path d="M722 372 L738 420 L730 830 L722 830 Z" fill="#fff"/><circle cx="722" cy="856" r="34" fill="none" stroke="#1D5FD0" stroke-width="14"/><circle cx="722" cy="856" r="34" fill="none" ${s2(4)}/><path d="M722 822 L722 890 M688 856 L756 856" ${s2(4)}/><rect x="710" y="886" width="24" height="110" rx="10" fill="#1D5FD0" ${S}/></g>`,
  'w-prism-staff': () => `<g transform="rotate(8 722 884)"><rect x="712" y="420" width="22" height="720" rx="10" fill="#2E6B4A" ${S}/><path d="M723 284 L772 360 L723 444 L674 360 Z" fill="#7FE3B5" ${S}/><path d="M723 284 L772 360 L723 360 Z" fill="#D2F8E6"/><path d="M690 440 C700 420 746 420 756 440" fill="none" stroke="#157F4B" stroke-width="14"/></g>`,
  'w-quill-lance': () => `<g transform="rotate(12 722 884)"><rect x="714" y="420" width="18" height="760" rx="8" fill="#5E3FE0" ${S}/><path d="M723 224 C788 296 782 420 723 472 C698 400 688 296 723 224 Z" fill="#F4EFFF" ${S}/><path d="M723 246 L723 462" ${s2(3)}/><path d="M723 300 L752 280 M723 340 L758 322 M723 380 L756 366" ${s2(2.5)}/></g>`,
  'w-grand-katana': () => `<g transform="rotate(18 722 884)"><path d="M716 314 C742 420 744 640 734 840 L708 840 C714 640 712 440 716 314 Z" fill="#E9EEF8" ${S}/><path d="M718 340 C730 440 732 640 726 830" stroke="#9FD3FF" stroke-width="5" fill="none"/><ellipse cx="722" cy="852" rx="46" ry="16" fill="#F5C400" ${s2(4)}/><rect x="710" y="866" width="24" height="140" rx="10" fill="#17132B" stroke="#F5C400" stroke-width="5"/><path d="M714 890 l16 16 M714 920 l16 16 M714 950 l16 16" stroke="#F5C400" stroke-width="4"/></g>`,
  // accessories (fitted to the v2 head: forehead ~y 300, neck ~y 540)
  'a-headband': () => `<path d="M384 300 C440 276 584 276 640 300 L636 330 C584 308 440 308 388 330 Z" fill="#D6453A" ${S}/><circle cx="512" cy="300" r="17" fill="#FBF7EE" ${s2(4)}/><path d="M638 308 C694 318 732 346 760 384 L732 394 C706 362 680 344 634 330 Z M648 318 C694 346 712 384 722 430 L698 426 C688 388 672 362 640 334 Z" fill="#D6453A" ${S}/>`,
  'a-amulet': () => `<path d="M476 556 C484 630 540 630 548 556" fill="none" stroke="#C9862E" stroke-width="5"/><path d="M512 626 L540 656 L512 700 L484 656 Z" fill="#7FD4FF" ${S}/><path d="M512 634 L528 656 L512 680 Z" fill="#fff"/>`,
  'a-aksara-scarf': () => `<path d="M424 540 C464 580 560 580 600 540 L618 600 C568 636 456 636 406 600 Z" fill="#C42A2F" ${S}/><path d="M432 570 l20 0 M472 586 l20 0 M532 586 l20 0 M574 570 l20 0" stroke="#FBF7EE" stroke-width="5"/><path d="M590 600 C610 660 620 720 640 780 L600 790 C590 730 576 670 560 616 Z" fill="#C42A2F" ${S}/>`,
  'a-dawn-lantern': () => `<path d="M386 936 L386 990" ${s2(4)}/><path d="M356 990 L416 990 L424 1080 L348 1080 Z" fill="#FFE9A8" ${S}/><path d="M372 1000 L400 1000 L404 1070 L368 1070 Z" fill="#FFC94A"/><path d="M350 990 C360 970 412 970 422 990 M346 1080 L426 1080" fill="none" ${s2(6)}/>`,
  // armor
  'r-shoulder': () => `<path d="M316 628 C334 576 420 572 446 614 L428 698 C390 680 346 686 316 710 Z" fill="#8C98AD" ${S}/><path d="M708 628 C690 576 604 572 578 614 L596 698 C634 680 678 686 708 710 Z" fill="#8C98AD" ${S}/><path d="M330 640 C352 604 410 600 432 626" fill="none" stroke="#fff" stroke-width="4" opacity=".5"/>`,
  'r-gauntlets': () => `<path d="M290 820 L352 828 L348 880 L286 874 Z" fill="#8C98AD" ${S}/><path d="M690 830 L744 812 L758 866 L702 884 Z" fill="#8C98AD" ${S}/>`,
  'r-unity-guard': () => `<circle cx="376" cy="640" r="66" fill="#8A5A00" ${S}/><circle cx="376" cy="640" r="48" fill="#FFC43D" ${s2(4)}/><path d="M376 606 l10 26 l28 0 l-22 16 l8 28 l-24 -16 l-24 16 l8 -28 l-22 -16 l28 0 Z" fill="#FBF7EE" ${s2(3)}/>`,
  'r-sealbreaker': () => `<path d="M404 660 C450 630 574 630 620 660 L608 880 C570 904 454 904 416 880 Z" fill="#4B2A8C" ${S}/><path d="M512 670 C560 690 580 750 512 850 C444 750 464 690 512 670 Z" fill="#8B5CF6" ${s2(4)}/><path d="M512 690 L512 830 M470 750 L554 750" stroke="#F5C400" stroke-width="7"/>`,
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
