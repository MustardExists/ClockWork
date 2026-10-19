// Simple ClockWork - minimal, white style (fixed)
// Replaces locale-string parsing with a robust Date construction using formatToParts.
// Also ensures initialization runs after DOM content is ready and clears selects before populating.

(() => {
  const STORAGE_KEY = 'clockwork_simple_clocks';
  let timezones = [];

  // DOM refs (set in init)
  let tzSelect, mainTimeEl, mainYearEl, countdownEl, newClockForm, clockNameInput, clockTzSelect, clocksList;

  // Populate timezone selects
  function loadTimezones() {
    // clear existing options if any
    tzSelect.innerHTML = '';
    clockTzSelect.innerHTML = '';

    try {
      if (typeof Intl.supportedValuesOf === 'function') {
        timezones = Intl.supportedValuesOf('timeZone');
      }
    } catch (e) { /* ignore */ }

    if (!timezones || !timezones.length) {
      timezones = [
        'UTC','America/New_York','America/Chicago','America/Los_Angeles',
        'Europe/London','Europe/Berlin','Asia/Tokyo','Asia/Kolkata','Australia/Sydney'
      ];
    }

    // create separate option nodes for each select (avoid moving same node)
    timezones.forEach(tz => {
      const o1 = document.createElement('option');
      o1.value = tz; o1.textContent = tz;
      tzSelect.appendChild(o1);

      const o2 = document.createElement('option');
      o2.value = tz; o2.textContent = tz;
      clockTzSelect.appendChild(o2);
    });

    const user = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    tzSelect.value = timezones.includes(user) ? user : 'UTC';
    clockTzSelect.value = tzSelect.value;
  }

  // Use Intl.formatToParts to extract components for a given Date/timeZone
  function partsForZone(d = new Date(), timeZone = 'UTC') {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    const parts = {};
    for (const p of fmt.formatToParts(d)) {
      if (p.type !== 'literal') parts[p.type] = p.value;
    }
    // ensure zero-padded strings
    return {
      year: parts.year,
      month: parts.month,
      day: parts.day,
      hour: parts.hour,
      minute: parts.minute,
      second: parts.second
    };
  }

  // Build a Date object in the browser's local zone whose components match the wall-clock in the given timezone.
  // This avoids parsing locale strings and is consistent for countdown arithmetic.
  function nowAsDateInTZ(tz) {
    const p = partsForZone(new Date(), tz);
    // months are 0-based in JS Date constructor
    return new Date(
      Number(p.year),
      Number(p.month) - 1,
      Number(p.day),
      Number(p.hour),
      Number(p.minute),
      Number(p.second)
    );
  }

  // Update main clock display
  function updateMain() {
    const tz = tzSelect.value;
    const p = partsForZone(new Date(), tz);
    const hh = String(p.hour).padStart(2, '0');
    const mm = String(p.minute).padStart(2, '0');
    const ss = String(p.second).padStart(2, '0');
    mainTimeEl.textContent = `${hh}:${mm} ${ss} seconds`;
    mainYearEl.textContent = `Year ${p.year}`;
  }

  // Update countdown to next Christmas based on selected timezone
  function updateCountdown() {
    const tz = tzSelect.value;
    const now = nowAsDateInTZ(tz);
    let year = now.getFullYear();
    // create target midnight local-parsed date that matches wall-clock of TZ
    const target = new Date(year, 11, 25, 0, 0, 0); // month 11 = December
    // If 'now' (in tz wall-clock) is after target, move to next year
    if (now > target) {
      target.setFullYear(year + 1);
    }
    let diffSec = Math.floor((target - now) / 1000);
    if (diffSec < 0) diffSec = 0;
    const days = Math.floor(diffSec / 86400);
    diffSec %= 86400;
    const hours = String(Math.floor(diffSec / 3600)).padStart(2, '0'); diffSec %= 3600;
    const minutes = String(Math.floor(diffSec / 60)).padStart(2, '0');
    const seconds = String(diffSec % 60).padStart(2, '0');
    countdownEl.textContent = `${days} days ${hours}:${minutes}:${seconds}`;
  }

  // localStorage helpers for custom clocks
  function loadCustom() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch (e) { return []; }
  }
  function saveCustom(list) { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); }

  function getClockTime(tz) {
    const p = partsForZone(new Date(), tz);
    return `${String(p.hour).padStart(2,'0')}:${String(p.minute).padStart(2,'0')}:${String(p.second).padStart(2,'0')}`;
  }

  function renderCustom() {
    const list = loadCustom();
    clocksList.innerHTML = '';
    if (!list.length) {
      clocksList.innerHTML = '<li style="color:#6b7280">No clocks yet</li>';
      return;
    }
    list.forEach((c, i) => {
      const li = document.createElement('li'); li.className = 'clock-item';
      const left = document.createElement('div');
      left.innerHTML = `<div class="clock-name">${escapeHtml(c.name)}</div><div style="color:#9ca3af;font-size:12px">${escapeHtml(c.timezone)}</div>`;
      const right = document.createElement('div');
      right.style.display = 'flex';
      right.style.alignItems = 'center';
      right.style.gap = '10px';

      const t = document.createElement('div'); t.className = 'clock-time-small'; t.textContent = getClockTime(c.timezone);
      const rem = document.createElement('button'); rem.textContent = 'Remove';
      rem.onclick = () => {
        const next = loadCustom().filter((_, idx) => idx !== i);
        saveCustom(next);
        renderCustom();
      };

      right.appendChild(t);
      right.appendChild(rem);
      li.appendChild(left);
      li.appendChild(right);
      clocksList.appendChild(li);
    });
  }

  // init after DOM ready
  function init() {
    // bind DOM refs
    tzSelect = document.getElementById('tz-select');
    mainTimeEl = document.getElementById('main-time');
    mainYearEl = document.getElementById('main-year');
    countdownEl = document.getElementById('countdown');
    newClockForm = document.getElementById('new-clock-form');
    clockNameInput = document.getElementById('clock-name');
    clockTzSelect = document.getElementById('clock-tz');
    clocksList = document.getElementById('clocks-list');

    if (!tzSelect) {
      console.error('ClockWork: tz-select not found in DOM');
      return;
    }

    loadTimezones();
    renderCustom();

    // form handler
    if (newClockForm) {
      newClockForm.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const name = (clockNameInput && clockNameInput.value || '').trim();
        const tz = clockTzSelect && clockTzSelect.value;
        if (!name) return;
        const list = loadCustom();
        list.push({ name, timezone: tz });
        saveCustom(list);
        clockNameInput.value = '';
        renderCustom();
      });
    }

    // sync tz selects
    tzSelect.addEventListener('change', () => {
      if (clockTzSelect) clockTzSelect.value = tzSelect.value;
      updateMain();
      updateCountdown();
    });

    // first update and periodic tick
    updateMain();
    updateCountdown();
    setInterval(() => {
      updateMain();
      updateCountdown();
      // update small clocks
      document.querySelectorAll('.clock-time-small').forEach((el, idx) => {
        const list = loadCustom();
        if (list[idx]) el.textContent = getClockTime(list[idx].timezone);
      });
    }, 1000);
  }

  // safe HTML escape for names
  function escapeHtml(s){ return String(s).replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c])); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
