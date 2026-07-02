/* =========================================================
   AIRCRAFT SEAT SELECTION — LOGIC
   Modular sections: data, render, interaction, panels, fx
   ========================================================= */
(() => {
  'use strict';

  /* ---------------------------------------------------------
     1. SEAT DATA MODEL
     --------------------------------------------------------- */
  const COLUMNS = ['A', 'B', 'C', 'D', 'E', 'F'];
  const TOTAL_ROWS = 24;
  const EXIT_ROWS = [4, 13];
  const PREMIUM_ROWS = [1, 2, 3];
  const BUSINESS_ROWS = []; // reserved for future cabin split
  const BOOKED_RATIO = 0.16;

  const PRICE = {
    standard: 900,
    window: 1200,
    aisle: 1500,
    premium: 2400,
    exit: 1800,
    business: 4200,
    vip: 6000
  };

  const TYPE_LABEL = {
    standard: 'Standard',
    window: 'Window',
    aisle: 'Aisle (Extra Legroom)',
    premium: 'Premium',
    exit: 'Emergency Exit',
    business: 'Business',
    vip: 'VIP Suite'
  };

  const LEGROOM_LABEL = {
    standard: 'Standard',
    window: 'Standard',
    aisle: 'Extra',
    premium: 'Extra',
    exit: 'Maximum',
    business: 'Fully Flat',
    vip: 'Fully Flat +'
  };

  /** Deterministic pseudo-random so layout is stable across reloads within a session */
  let seed = 42;
  function rand() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  }

  function classifySeat(row, col) {
    const isWindow = col === 'A' || col === 'F';
    const isAisle = col === 'C' || col === 'D';
    if (PREMIUM_ROWS.includes(row)) return 'premium';
    if (EXIT_ROWS.includes(row)) return 'exit';
    if (isWindow) return 'window';
    if (isAisle) return 'aisle';
    return 'standard';
  }

  function buildSeats() {
    const seats = [];
    for (let row = 1; row <= TOTAL_ROWS; row++) {
      for (const col of COLUMNS) {
        const type = classifySeat(row, col);
        const isBooked = rand() < BOOKED_RATIO;
        seats.push({
          id: `${row}${col}`,
          row,
          column: col,
          type,
          class: PREMIUM_ROWS.includes(row) ? 'Premium Economy' : 'Economy',
          price: PRICE[type],
          status: isBooked ? 'booked' : 'available',
          available: !isBooked
        });
      }
    }
    return seats;
  }

  const seats = buildSeats();
  const seatById = new Map(seats.map(s => [s.id, s]));
  const selectedSeatIds = [];

  /* ---------------------------------------------------------
     2. DOM REFS
     --------------------------------------------------------- */
  const $ = sel => document.querySelector(sel);
  const seatMapEl = $('#seatMap');
  const columnHeadersEl = $('#columnHeaders');
  const cabinFrontEl = document.querySelector('.cabin-front');
  const aircraftOutline = $('#aircraftOutline');
  const tooltip = $('#seatTooltip');
  const selectedListEl = $('#selectedList');
  const emptyStateEl = $('#emptyState');
  const totalPriceEl = $('#totalPrice');
  const seatCountBadge = $('#seatCountBadge');
  const continueBtn = $('#continueBtn');
  const loader = $('#loader');
  const loaderBar = $('#loaderBar');

  /* ---------------------------------------------------------
     3. GRID TEMPLATE (column headers + seat rows)
     --------------------------------------------------------- */
  const GRID_TEMPLATE = '28px 36px 36px 36px 18px 36px 36px 36px';
  // row-num | A | B | C | aisle | D | E | F

  function renderColumnHeaders() {
    columnHeadersEl.style.display = 'grid';
    columnHeadersEl.style.gridTemplateColumns = GRID_TEMPLATE;
    columnHeadersEl.style.width = 'fit-content';
    columnHeadersEl.innerHTML = `
      <span></span>
      <span>A</span><span>B</span><span>C</span>
      <span class="aisle-gap"></span>
      <span>D</span><span>E</span><span>F</span>
    `;
  }

  function seatIconSVG(type) {
    // minimal unique glyphs per class, kept tiny & subtle
    switch (type) {
      case 'premium':
        return '<svg class="seat-icon" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.5 7H22l-6 4.5 2.3 7L12 16l-6.3 4.5 2.3-7L2 9h7.5z" fill="currentColor"/></svg>';
      case 'exit':
        return '<svg class="seat-icon" viewBox="0 0 24 24" fill="none"><path d="M4 4h16v16H4z" fill="none"/><path d="M9 3v18M3 12h9m0 0l-3-3m3 3l-3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
      case 'business':
        return '<svg class="seat-icon" viewBox="0 0 24 24" fill="none"><rect x="3" y="9" width="18" height="10" rx="2" fill="currentColor"/></svg>';
      case 'vip':
        return '<svg class="seat-icon" viewBox="0 0 24 24" fill="none"><path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z" fill="currentColor"/></svg>';
      default:
        return '';
    }
  }

  function renderSeatMap() {
    seatMapEl.innerHTML = '';
    for (let row = 1; row <= TOTAL_ROWS; row++) {
      if (EXIT_ROWS.includes(row)) {
        const flag = document.createElement('div');
        flag.className = 'exit-flag';
        flag.style.gridColumn = '1 / -1';
        flag.textContent = 'EXIT ROW';
        const wrap = document.createElement('div');
        wrap.appendChild(flag);
        seatMapEl.appendChild(flag);
      }

      const rowEl = document.createElement('div');
      rowEl.className = 'seat-row' + (EXIT_ROWS.includes(row) ? ' exit-row' : '');
      rowEl.style.gridTemplateColumns = GRID_TEMPLATE;
      rowEl.style.width = 'fit-content';
      rowEl.style.margin = '0 auto';

      const rowNum = document.createElement('span');
      rowNum.className = 'row-num';
      rowNum.textContent = row;
      rowEl.appendChild(rowNum);

      ['A', 'B', 'C'].forEach(col => rowEl.appendChild(buildSeatButton(row, col)));
      const gap = document.createElement('span');
      gap.className = 'aisle-space';
      rowEl.appendChild(gap);
      ['D', 'E', 'F'].forEach(col => rowEl.appendChild(buildSeatButton(row, col)));

      seatMapEl.appendChild(rowEl);
    }
  }

  function buildSeatButton(row, col) {
    const seat = seatById.get(`${row}${col}`);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `seat is-${seat.type}` + (seat.status === 'booked' ? ' is-booked' : '');
    btn.dataset.seatId = seat.id;
    btn.setAttribute('role', 'gridcell');
    btn.setAttribute('aria-label', `Seat ${seat.id}, ${TYPE_LABEL[seat.type]}, ${seat.status === 'booked' ? 'booked' : 'available'}, price ₹${seat.price}`);
    btn.setAttribute('tabindex', '-1');
    btn.disabled = seat.status === 'booked';
    btn.innerHTML = `<span aria-hidden="true">${col}</span>${seatIconSVG(seat.type)}`;
    return btn;
  }

  /* ---------------------------------------------------------
     4. ASSEMBLY ANIMATION (progressive reveal)
     --------------------------------------------------------- */
  function assembleSeats() {
    const seatEls = Array.from(seatMapEl.querySelectorAll('.seat'));
    seatEls.forEach((el, i) => {
      setTimeout(() => el.classList.add('is-assembled'), 8 * i);
    });
  }

  /* ---------------------------------------------------------
     5. TOOLTIP
     --------------------------------------------------------- */
  let tooltipTarget = null;

  function showTooltip(el) {
    const seat = seatById.get(el.dataset.seatId);
    if (!seat) return;
    tooltipTarget = el;
    $('#ttSeatId').textContent = seat.id;
    $('#ttType').textContent = TYPE_LABEL[seat.type];
    $('#ttLegroom').textContent = LEGROOM_LABEL[seat.type];
    $('#ttStatus').textContent = seat.status === 'booked' ? 'Booked' : (selectedSeatIds.includes(seat.id) ? 'Selected' : 'Available');
    $('#ttPrice').textContent = `₹${seat.price.toLocaleString('en-IN')}`;
    positionTooltip(el);
    tooltip.classList.add('is-visible');
    tooltip.setAttribute('aria-hidden', 'false');
  }

  function positionTooltip(el) {
    const rect = el.getBoundingClientRect();
    tooltip.style.left = `${rect.left + rect.width / 2}px`;
    tooltip.style.top = `${rect.top}px`;
  }

  function hideTooltip() {
    tooltip.classList.remove('is-visible');
    tooltip.setAttribute('aria-hidden', 'true');
    tooltipTarget = null;
  }

  /* ---------------------------------------------------------
     6. SELECTION LOGIC
     --------------------------------------------------------- */
  function toggleSeat(seatId) {
    const seat = seatById.get(seatId);
    if (!seat || seat.status === 'booked') return;

    const idx = selectedSeatIds.indexOf(seatId);
    const el = seatMapEl.querySelector(`[data-seat-id="${seatId}"]`);

    if (idx === -1) {
      selectedSeatIds.push(seatId);
      seat.status = 'selected';
      el.classList.add('is-selected');
      addSeatCard(seat);
    } else {
      selectedSeatIds.splice(idx, 1);
      seat.status = 'available';
      el.classList.remove('is-selected');
      el.classList.add('is-deselecting');
      setTimeout(() => el.classList.remove('is-deselecting'), 320);
      removeSeatCard(seatId);
    }
    updateSummary();
    if (tooltipTarget === el) showTooltip(el);
    announce(`Seat ${seatId} ${idx === -1 ? 'selected' : 'deselected'}`);
  }

  /* ---------------------------------------------------------
     7. BOOKING PANEL — seat cards
     --------------------------------------------------------- */
  function cardTypeClass(type) {
    if (type === 'premium' || type === 'exit') return 'type-premium';
    if (type === 'business' || type === 'vip') return 'type-business';
    return '';
  }

  function addSeatCard(seat) {
    emptyStateEl.style.display = 'none';
    const card = document.createElement('div');
    card.className = `seat-card ${cardTypeClass(seat.type)}`;
    card.dataset.seatId = seat.id;
    card.innerHTML = `
      <div class="seat-card-badge">${seat.id}</div>
      <div class="seat-card-info">
        <div class="seat-card-class">${seat.class}</div>
        <div class="seat-card-sub">${TYPE_LABEL[seat.type]}</div>
      </div>
      <div class="seat-card-right">
        <span class="seat-card-price">₹${seat.price.toLocaleString('en-IN')}</span>
        <button class="seat-card-remove" aria-label="Remove seat ${seat.id}">×</button>
      </div>
    `;
    card.querySelector('.seat-card-remove').addEventListener('click', () => toggleSeat(seat.id));
    selectedListEl.appendChild(card);
  }

  function removeSeatCard(seatId) {
    const card = selectedListEl.querySelector(`.seat-card[data-seat-id="${seatId}"]`);
    if (!card) return;
    card.classList.add('is-removing');
    setTimeout(() => {
      card.remove();
      if (selectedSeatIds.length === 0) emptyStateEl.style.display = 'flex';
    }, 260);
  }

  /* ---------------------------------------------------------
     8. SUMMARY — animated total + CTA state
     --------------------------------------------------------- */
  let displayedTotal = 0;

  function updateSummary() {
    const count = selectedSeatIds.length;
    seatCountBadge.textContent = `${count} Seat${count === 1 ? '' : 's'}`;
    const target = selectedSeatIds.reduce((sum, id) => sum + seatById.get(id).price, 0);
    animateCounter(target);
    continueBtn.disabled = count === 0;
  }

  function animateCounter(target) {
    const start = displayedTotal;
    const diff = target - start;
    const duration = 420;
    const startTime = performance.now();
    function step(now) {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      displayedTotal = Math.round(start + diff * eased);
      totalPriceEl.textContent = displayedTotal.toLocaleString('en-IN');
      if (t < 1) requestAnimationFrame(step);
      else displayedTotal = target;
    }
    requestAnimationFrame(step);
  }

  /* ---------------------------------------------------------
     9. ZOOM CONTROLS
     --------------------------------------------------------- */
  const cabinStage = $('#cabinStage');
  let zoom = 1;
  const ZOOM_MIN = 0.6, ZOOM_MAX = 1.4, ZOOM_STEP = 0.1;

  function applyZoom() {
    cabinStage.style.transform = `scale(${zoom})`;
    $('#zoomLevel').textContent = `${Math.round(zoom * 100)}%`;
  }
  $('#zoomIn').addEventListener('click', () => { zoom = Math.min(ZOOM_MAX, zoom + ZOOM_STEP); applyZoom(); });
  $('#zoomOut').addEventListener('click', () => { zoom = Math.max(ZOOM_MIN, zoom - ZOOM_STEP); applyZoom(); });
  $('#zoomReset').addEventListener('click', () => { zoom = 1; applyZoom(); });

  /* ---------------------------------------------------------
     10. MOUSE PARALLAX + CURSOR SPOTLIGHT
     --------------------------------------------------------- */
  const spotlight = $('#spotlight');
  const viewport = $('#cabinViewport');

  document.addEventListener('mousemove', e => {
    spotlight.style.opacity = '1';
    spotlight.style.left = `${e.clientX}px`;
    spotlight.style.top = `${e.clientY}px`;
  });
  document.addEventListener('mouseleave', () => { spotlight.style.opacity = '0'; });

  let parallaxRAF = null;
  viewport.addEventListener('mousemove', e => {
    if (parallaxRAF) return;
    parallaxRAF = requestAnimationFrame(() => {
      const rect = viewport.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      aircraftOutline.style.transform = `translate(calc(-50% + ${px * 8}px), ${py * 6}px)`;
      parallaxRAF = null;
    });
  });
  viewport.addEventListener('mouseleave', () => {
    aircraftOutline.style.transform = 'translate(-50%, 0)';
  });

  /* ---------------------------------------------------------
     11. MAGNETIC CTA BUTTON + RIPPLE
     --------------------------------------------------------- */
  continueBtn.addEventListener('mousemove', e => {
    const rect = continueBtn.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) * 0.12;
    const y = (e.clientY - rect.top - rect.height / 2) * 0.3;
    continueBtn.style.transform = `translate(${x}px, ${y - 2}px)`;
  });
  continueBtn.addEventListener('mouseleave', () => { continueBtn.style.transform = ''; });
  continueBtn.addEventListener('click', e => {
    if (continueBtn.disabled) return;
    const rect = continueBtn.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'cta-ripple is-active';
    const size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
    continueBtn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 650);
    advanceStep(2);
  });

  /* ---------------------------------------------------------
     12. STEP PROGRESS (left rail)
     --------------------------------------------------------- */
  function advanceStep(n) {
    document.querySelectorAll('.step').forEach(step => {
      const stepNum = Number(step.dataset.step);
      step.classList.toggle('is-complete', stepNum < n);
      step.classList.toggle('is-active', stepNum === n);
    });
  }

  /* ---------------------------------------------------------
     13. EVENT DELEGATION — hover / click / keyboard on seat grid
     --------------------------------------------------------- */
  seatMapEl.addEventListener('mouseover', e => {
    const seatEl = e.target.closest('.seat');
    if (seatEl) showTooltip(seatEl);
  });
  seatMapEl.addEventListener('mouseout', e => {
    const seatEl = e.target.closest('.seat');
    if (seatEl && !seatEl.contains(e.relatedTarget)) hideTooltip();
  });
  seatMapEl.addEventListener('focusin', e => {
    const seatEl = e.target.closest('.seat');
    if (seatEl) showTooltip(seatEl);
  });
  seatMapEl.addEventListener('focusout', hideTooltip);
  seatMapEl.addEventListener('click', e => {
    const seatEl = e.target.closest('.seat');
    if (seatEl && !seatEl.disabled) toggleSeat(seatEl.dataset.seatId);
  });

  // Keyboard grid navigation
  let focusIndex = 0;
  const allSeatEls = () => Array.from(seatMapEl.querySelectorAll('.seat'));

  seatMapEl.addEventListener('keydown', e => {
    const els = allSeatEls();
    const current = document.activeElement;
    let idx = els.indexOf(current);
    if (idx === -1) idx = 0;
    const cols = 6;
    switch (e.key) {
      case 'ArrowRight': idx = Math.min(els.length - 1, idx + 1); break;
      case 'ArrowLeft': idx = Math.max(0, idx - 1); break;
      case 'ArrowDown': idx = Math.min(els.length - 1, idx + cols); break;
      case 'ArrowUp': idx = Math.max(0, idx - cols); break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (current && !current.disabled) toggleSeat(current.dataset.seatId);
        return;
      default: return;
    }
    e.preventDefault();
    els[idx].focus();
  });

  // Make first seat tabbable, rest reachable via roving tabindex
  function initRovingTabindex() {
    const els = allSeatEls();
    els.forEach((el, i) => el.setAttribute('tabindex', i === 0 ? '0' : '-1'));
    els.forEach(el => {
      el.addEventListener('focus', () => {
        els.forEach(e2 => e2.setAttribute('tabindex', '-1'));
        el.setAttribute('tabindex', '0');
      });
    });
  }

  /* ---------------------------------------------------------
     14. LIVE CLOCK
     --------------------------------------------------------- */
  function tickClock() {
    const el = $('#liveClock');
    if (!el) return;
    const now = new Date();
    let h = now.getHours();
    const m = String(now.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    el.textContent = `${h}:${m} ${ampm}`;
  }
  setInterval(tickClock, 1000 * 30);

  /* ---------------------------------------------------------
     15. STARFIELD GENERATION
     --------------------------------------------------------- */
  function buildStars() {
    const layer = $('#bgStars');
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 70; i++) {
      const s = document.createElement('span');
      s.className = 'star';
      s.style.left = `${Math.random() * 100}%`;
      s.style.top = `${Math.random() * 100}%`;
      s.style.animationDelay = `${Math.random() * 5}s`;
      s.style.animationDuration = `${3 + Math.random() * 4}s`;
      frag.appendChild(s);
    }
    layer.appendChild(frag);
  }

  /* ---------------------------------------------------------
     16. HELP MODAL
     --------------------------------------------------------- */
  const helpOverlay = $('#helpOverlay');
  $('#helpBtn').addEventListener('click', () => {
    helpOverlay.hidden = false;
    $('#helpClose').focus();
  });
  $('#helpClose').addEventListener('click', () => { helpOverlay.hidden = true; $('#helpBtn').focus(); });
  helpOverlay.addEventListener('click', e => { if (e.target === helpOverlay) helpOverlay.hidden = true; });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !helpOverlay.hidden) helpOverlay.hidden = true;
  });

  /* ---------------------------------------------------------
     17. VIEW AIRCRAFT (aircraft card link) — quick zoom pulse
     --------------------------------------------------------- */
  $('#viewAircraftBtn').addEventListener('click', () => {
    viewport.scrollIntoView({ behavior: 'smooth', block: 'center' });
    cabinStage.style.transition = 'transform 500ms cubic-bezier(.22,.9,.32,1)';
    zoom = 1.15; applyZoom();
    setTimeout(() => { zoom = 1; applyZoom(); }, 650);
  });

  /* ---------------------------------------------------------
     18. MOBILE DRAG / PINCH ZOOM
     --------------------------------------------------------- */
  (function enableTouchGestures() {
    let startX = 0, startY = 0, scrollLeft = 0, scrollTop = 0, dragging = false;
    let lastDist = null;

    viewport.addEventListener('touchstart', e => {
      if (e.touches.length === 1) {
        dragging = true;
        startX = e.touches[0].clientX; startY = e.touches[0].clientY;
        scrollLeft = viewport.scrollLeft; scrollTop = viewport.scrollTop;
      } else if (e.touches.length === 2) {
        lastDist = touchDist(e.touches);
      }
    }, { passive: true });

    viewport.addEventListener('touchmove', e => {
      if (e.touches.length === 1 && dragging) {
        viewport.scrollLeft = scrollLeft - (e.touches[0].clientX - startX);
        viewport.scrollTop = scrollTop - (e.touches[0].clientY - startY);
      } else if (e.touches.length === 2 && lastDist) {
        const dist = touchDist(e.touches);
        const delta = (dist - lastDist) * 0.003;
        zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom + delta));
        applyZoom();
        lastDist = dist;
      }
    }, { passive: true });

    viewport.addEventListener('touchend', () => { dragging = false; lastDist = null; });

    function touchDist(touches) {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.hypot(dx, dy);
    }
  })();

  /* ---------------------------------------------------------
     19. BOOT SEQUENCE
     --------------------------------------------------------- */
  function boot() {
    buildStars();
    renderColumnHeaders();
    renderSeatMap();
    tickClock();

    // meta counts
    $('#seatTotalMeta').textContent = seats.length;
    $('#rowTotalMeta').textContent = TOTAL_ROWS;

    requestAnimationFrame(() => {
      loaderBar.style.width = '100%';
    });

    setTimeout(() => {
      loader.classList.add('is-hidden');
      aircraftOutline.classList.add('is-drawn');
    }, 500);

    setTimeout(() => {
      cabinFrontEl.classList.add('is-visible');
    }, 1350);

    setTimeout(() => {
      assembleSeats();
      initRovingTabindex();
    }, 1500);
  }

  function announce(msg) {
    const live = $('#srLive');
    if (live) live.textContent = msg;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
