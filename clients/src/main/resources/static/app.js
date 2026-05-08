'use strict';

// ══════════════════════════════════════════════════════════════
// RBAC — Six-node topology (MatchingAuthority added)
// ══════════════════════════════════════════════════════════════
const ROLES = {
  hospital_a: {
    id: 'hospital_a', label: 'Hospital A', node: 'HospitalA', city: 'Hyderabad',
    port: 8080, color: '#0c9488', icon: '🏥',
    credentials: { username: 'hospitalA', password: 'HospA@2024' },
    permissions: new Set(['register_donor','register_recipient','view_donors','view_recipients','view_matches','view_transport','my_records','settings']),
    badge: 'HOSPITAL', dashboardStats: ['donors','recipients','matches','transport']
  },
  hospital_b: {
    id: 'hospital_b', label: 'Hospital B', node: 'HospitalB', city: 'Mumbai',
    port: 8081, color: '#2563eb', icon: '🏥',
    credentials: { username: 'hospitalB', password: 'HospB@2024' },
    permissions: new Set(['register_donor','register_recipient','view_donors','view_recipients','view_matches','view_transport','my_records','settings']),
    badge: 'HOSPITAL', dashboardStats: ['donors','recipients','matches','transport']
  },
  matching_authority: {
    id: 'matching_authority', label: 'Matching Authority', node: 'MatchingAuthority', city: 'Chennai',
    port: 8082, color: '#4f46e5', icon: '🔐',
    credentials: { username: 'matchingAuth', password: 'MatchAuth@2024' },
    // Only the MA can trigger matching and view decrypted summaries
    permissions: new Set(['view_donors','view_recipients','trigger_match','view_matches','view_summary','view_transport','audit','settings']),
    badge: 'MATCHING-AUTH', dashboardStats: ['donors','recipients','matches','transport']
  },
  admin: {
    id: 'admin', label: 'Admin Node', node: 'AdminNode', city: 'Chennai',
    port: 8083, color: '#b45309', icon: '⚕️',
    credentials: { username: 'admin', password: 'Admin@2024' },
    permissions: new Set(['view_donors','view_recipients','confirm_match','reject_match','dispatch_transport','view_matches','view_transport','audit','settings']),
    badge: 'ADMIN', dashboardStats: ['donors','recipients','matches','transport']
  },
  government: {
    id: 'government', label: 'Government', node: 'Government', city: 'Delhi',
    port: 8084, color: '#7c3aed', icon: '🏛️',
    credentials: { username: 'govt', password: 'Govt@2024' },
    permissions: new Set(['view_donors','view_recipients','view_matches','view_transport','audit']),
    badge: 'GOVT', dashboardStats: ['donors','recipients','matches','transport']
  },
  transporter: {
    id: 'transporter', label: 'Transporter', node: 'Transporter', city: 'Chennai',
    port: 8085, color: '#16a34a', icon: '🚑',
    credentials: { username: 'transporter', password: 'Trans@2024' },
    permissions: new Set(['update_transport','view_transport','settings']),
    badge: 'TRANSPORT', dashboardStats: ['transport']
  }
};

const PERM_LABELS = {
  register_donor: 'Register Donor', register_recipient: 'Register Patient',
  view_donors: 'View Donors', view_recipients: 'View Recipients',
  trigger_match: 'Trigger Matching', confirm_match: 'Confirm Match',
  reject_match: 'Reject Match', view_matches: 'View Matches',
  view_summary: 'Decrypted Summary',
  view_transport: 'View Transport', dispatch_transport: 'Dispatch',
  update_transport: 'Update Status', audit: 'Audit Trail',
  my_records: 'My Records', settings: 'Settings'
};

const NAV_ITEMS = [
  { id: 'dashboard',  label: 'Dashboard',   icon: '◈', perm: null },
  { id: 'my-records', label: 'My Records',  icon: '🪪', perm: 'my_records' },
  { id: 'donors',     label: 'Donors',      icon: '❤', perm: 'view_donors' },
  { id: 'recipients', label: 'Recipients',  icon: '👤', perm: 'view_recipients' },
  { id: 'matching',   label: 'Matching',    icon: '🔗', perm: 'view_matches' },
  { id: 'transport',  label: 'Transport',   icon: '🚑', perm: 'view_transport' },
  { id: 'audit',      label: 'Audit Trail', icon: '📋', perm: 'audit' },
  { id: 'settings',   label: 'Settings',    icon: '⚙', perm: 'settings' },
];

const VIABILITY = {
  HEART: 4, LUNG: 6, LIVER: 24, PANCREAS: 24,
  KIDNEY: 36, SMALL_INTESTINE: 8, CORNEA: 336
};

// ══════════════════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════════════════
let state = {
  role: null,
  apiBase: 'http://localhost:8080',
  currentPage: 'dashboard',
  donors: [], recipients: [], matches: [], transports: [],
  notifications: [], timerIntervals: [],
  pendingMatchCount: 0,
};

// ══════════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  buildRoleGrid();
  buildCompatChart();
  document.addEventListener('click', e => {
    if (!e.target.closest('#notif-btn') && !e.target.closest('#notif-panel'))
      document.getElementById('notif-panel').classList.remove('open');
  });
});

// ══════════════════════════════════════════════════════════════
// LOGIN
// ══════════════════════════════════════════════════════════════
let pendingRoleId = null;

function buildRoleGrid() {
  const grid = document.getElementById('role-grid');
  grid.innerHTML = '';
  Object.values(ROLES).forEach(role => {
    const card = document.createElement('div');
    card.className = 'role-card';
    card.style.setProperty('--role-color', role.color);
    card.onclick = () => openCredModal(role.id);
    const perms = [...role.permissions].slice(0, 3)
      .map(p => `<span class="perm-tag">${PERM_LABELS[p] || p}</span>`).join('');
    card.innerHTML = `
      <div class="role-icon">${role.icon}</div>
      <div class="role-name">${role.label}</div>
      <div class="role-city">${role.city} · :${role.port}</div>
      <div class="role-perms">${perms}${role.permissions.size > 3 ? `<span class="perm-tag">+${role.permissions.size - 3} more</span>` : ''}</div>
    `;
    grid.appendChild(card);
  });
}

function openCredModal(roleId) {
  pendingRoleId = roleId;
  const role = ROLES[roleId];
  const banner = document.getElementById('cred-node-banner');
  banner.querySelector('.cred-node-icon').textContent = role.icon;
  banner.querySelector('.cred-node-icon').style.background = role.color + '18';
  banner.querySelector('.cred-node-name').textContent = role.label;
  banner.querySelector('.cred-node-sub').textContent = `${role.city} · port ${role.port}`;
  document.getElementById('cred-username').value = role.credentials.username;
  document.getElementById('cred-password').value = '';
  document.getElementById('cred-error').textContent = '';
  document.getElementById('cred-modal').classList.add('open');
  setTimeout(() => document.getElementById('cred-password').focus(), 100);
}

function submitCredentials() {
  const role = ROLES[pendingRoleId];
  if (!role) return;
  const user = document.getElementById('cred-username').value.trim();
  const pass = document.getElementById('cred-password').value;
  const errEl = document.getElementById('cred-error');

  if (user !== role.credentials.username || pass !== role.credentials.password) {
    errEl.textContent = 'Incorrect username or password.';
    document.getElementById('cred-password').value = '';
    document.getElementById('cred-password').focus();
    return;
  }

  closeModal('cred-modal');
  state.role = role;
  state.apiBase = `http://localhost:${role.port}`;
  document.getElementById('settings-api-url').value = state.apiBase;
  initApp();
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('cred-password')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') submitCredentials();
  });
});

function initApp() {
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('app').classList.add('active');
  buildSidebar();
  populateUserBadge();
  // Show/hide hospital-only buttons
  const isHospital = state.role.permissions.has('register_donor');
  const isMA       = state.role.id === 'matching_authority';
  document.getElementById('btn-register-donor')?.style && (document.getElementById('btn-register-donor').style.display = isHospital ? '' : 'none');
  document.getElementById('btn-register-recipient')?.style && (document.getElementById('btn-register-recipient').style.display = isHospital ? '' : 'none');
  // Show trigger-match column only for MatchingAuthority
  const thTrigger = document.getElementById('th-trigger-match');
  if (thTrigger) thTrigger.style.display = isMA ? '' : 'none';
  navigate('dashboard');
  addNotif('Signed in', `Welcome, ${state.role.label} (${state.role.city})`, 'success');
}

function logout() {
  state.timerIntervals.forEach(clearInterval);
  state.timerIntervals = [];
  pendingRoleId = null;
  state.role = null;
  document.getElementById('app').classList.remove('active');
  document.getElementById('login-page').style.display = '';
  state = { ...state, role: null, donors: [], recipients: [], matches: [], transports: [], notifications: [], timerIntervals: [] };
}

// ══════════════════════════════════════════════════════════════
// SIDEBAR + NAV
// ══════════════════════════════════════════════════════════════
function buildSidebar() {
  const nav = document.getElementById('sidebar-nav');
  nav.innerHTML = '';
  NAV_ITEMS.forEach(item => {
    if (item.perm && !state.role.permissions.has(item.perm)) return;
    const el = document.createElement('div');
    el.className = 'nav-item' + (item.id === 'matching' && state.role.id === 'matching_authority' ? ' ma-nav' : '');
    el.dataset.page = item.id;
    el.onclick = () => navigate(item.id);
    el.innerHTML = `<span class="nav-icon">${item.icon}</span>${item.label}`;
    if (item.id === 'matching') el.id = 'nav-matching';
    nav.appendChild(el);
  });
}

function populateUserBadge() {
  const r = state.role;
  const badge = document.getElementById('user-badge');
  badge.textContent = r.badge;
  badge.style.background = r.color + '18';
  badge.style.color = r.color;
  badge.style.border = `1px solid ${r.color}33`;
  document.getElementById('user-name').textContent = r.label;
  document.getElementById('user-location').textContent = `${r.city} · :${r.port}`;
  document.getElementById('topbar-user-chip').innerHTML = `${r.icon} ${r.label}`;
}

function navigate(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const el = document.getElementById(`page-${pageId}`);
  const nav = document.querySelector(`[data-page="${pageId}"]`);
  if (!el) return;
  el.classList.add('active');
  if (nav) nav.classList.add('active');
  state.currentPage = pageId;
  document.getElementById('topbar-title').textContent =
    NAV_ITEMS.find(i => i.id === pageId)?.label || pageId;
  refreshCurrentPage();
}

function refreshCurrentPage() {
  const p = state.currentPage;
  if (p === 'dashboard')   loadDashboard();
  else if (p === 'donors')     loadDonors();
  else if (p === 'recipients') loadRecipients();
  else if (p === 'matching')   loadMatches();
  else if (p === 'transport')  loadTransport();
  else if (p === 'audit')      loadAudit();
  else if (p === 'my-records') loadMyRecords();
}

// ══════════════════════════════════════════════════════════════
// API HELPER
// ══════════════════════════════════════════════════════════════
async function api(method, path, body) {
  try {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(state.apiBase + path, opts);
    const json = await res.json();
    return { ok: res.ok, status: res.status, data: json };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ══════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════
async function loadDashboard() {
  const [donors, recips, matches, transports] = await Promise.all([
    api('GET', '/api/donor/list'),
    api('GET', '/api/recipient/list'),
    api('GET', '/api/match/list'),
    api('GET', '/api/transport/list'),
  ]);

  const dList = donors.ok  ? donors.data?.data  || [] : [];
  const rList = recips.ok  ? recips.data?.data  || [] : [];
  const mList = matches.ok ? matches.data?.data || [] : [];
  const tList = transports.ok ? transports.data?.data || [] : [];

  state.donors = dList; state.recipients = rList;
  state.matches = mList; state.transports = tList;

  document.getElementById('stat-donors').textContent    = dList.filter(d => d.status === 'AVAILABLE').length;
  document.getElementById('stat-recipients').textContent= rList.filter(r => r.status === 'WAITING').length;
  document.getElementById('stat-pending').textContent   = mList.filter(m => m.status === 'PENDING_CONFIRMATION').length;
  document.getElementById('stat-transport').textContent = tList.filter(t => t.status === 'IN_TRANSIT' || t.status === 'DISPATCHED').length;
  document.getElementById('last-refresh-time').textContent = new Date().toLocaleTimeString('en-IN');

  // Recent matches
  const rmEl = document.getElementById('recent-matches-list');
  const recent = [...mList].sort((a,b) => new Date(b.matchedAt) - new Date(a.matchedAt)).slice(0,5);
  rmEl.innerHTML = recent.length ? recent.map(m => `
    <div style="display:flex;align-items:center;gap:0.75rem;padding:0.625rem 1.25rem;border-bottom:1px solid var(--border)">
      <span style="font-size:1.1rem">${organIcon(m.organType)}</span>
      <div style="flex:1">
        <div style="font-size:0.82rem;font-weight:600">${m.organType} — Score ${m.matchScore?.toFixed(1)}</div>
        <div style="font-size:0.72rem;color:var(--text-3)">${m.donorHospital} → ${m.recipientHospital}</div>
      </div>
      ${getMatchBadge(m.status)}
    </div>`).join('') : '<div class="empty-state"><div class="empty-icon">🔗</div><p>No matches yet</p></div>';

  // Recent transports
  const rtEl = document.getElementById('recent-transport-list');
  const recentT = [...tList].sort((a,b) => new Date(b.dispatchTime) - new Date(a.dispatchTime)).slice(0,5);
  rtEl.innerHTML = recentT.length ? recentT.map(t => `
    <div style="display:flex;align-items:center;gap:0.75rem;padding:0.625rem 1.25rem;border-bottom:1px solid var(--border)">
      <span style="font-size:1.1rem">🚑</span>
      <div style="flex:1">
        <div style="font-size:0.82rem;font-weight:600">${t.organType} · ${t.viabilityWindowHours}h window</div>
        <div style="font-size:0.72rem;color:var(--text-3)">${t.originHospital} → ${t.destinationHospital}</div>
      </div>
      ${getTransportStatusBadge(t.status)}
    </div>`).join('') : '<div class="empty-state"><div class="empty-icon">🚑</div><p>No transports yet</p></div>';

  // Pending match badge on nav
  const pending = mList.filter(m => m.status === 'PENDING_CONFIRMATION').length;
  state.pendingMatchCount = pending;
  const navMatch = document.getElementById('nav-matching');
  if (navMatch) {
    const existing = navMatch.querySelector('.nav-badge');
    if (existing) existing.remove();
    if (pending > 0) navMatch.insertAdjacentHTML('beforeend', `<span class="nav-badge">${pending}</span>`);
  }
}

// ══════════════════════════════════════════════════════════════
// DONORS
// Medical fields are ENCRYPTED — display as "🔒 Encrypted" pill
// ══════════════════════════════════════════════════════════════
async function loadDonors() {
  const res = await api('GET', '/api/donor/list');
  state.donors = res.ok ? res.data?.data || [] : [];
  document.getElementById('donors-count').textContent = state.donors.length;
  renderDonors();
}

function renderDonors() {
  const filter = document.getElementById('donor-filter-status')?.value || '';
  const list   = filter ? state.donors.filter(d => d.status === filter) : state.donors;
  const isMA   = state.role?.id === 'matching_authority';
  const tbody  = document.getElementById('donors-tbody');

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">❤</div><p>No donors found</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(d => `
    <tr>
      <td><span class="audit-id">${shortId(d.linearId)}</span></td>
      <td>${getDonorStatusBadge(d.status)}</td>
      <td><span class="encrypted-cell">🔒 encrypted</span></td>
      <td><span class="encrypted-cell">🔒 encrypted</span></td>
      <td><span class="encrypted-cell">🔒 encrypted</span></td>
      <td style="font-size:0.8rem">${d.registeredBy}</td>
      <td style="font-size:0.75rem;color:var(--text-3)">${fmtDate(d.registrationTime)}</td>
      <td style="${isMA ? '' : 'display:none'}">${
        isMA && d.status === 'AVAILABLE'
          ? `<button class="btn btn-indigo btn-sm" onclick="triggerMatch('${d.linearId}')">🔐 Run Matching</button>`
          : '—'
      }</td>
    </tr>`).join('');
}

// ══════════════════════════════════════════════════════════════
// RECIPIENTS
// ══════════════════════════════════════════════════════════════
async function loadRecipients() {
  const res = await api('GET', '/api/recipient/list');
  state.recipients = res.ok ? res.data?.data || [] : [];
  document.getElementById('recipients-count').textContent = state.recipients.length;
  renderRecipients();
}

function renderRecipients() {
  const filter = document.getElementById('recipient-filter-status')?.value || '';
  const list   = filter ? state.recipients.filter(r => r.status === filter) : state.recipients;
  const tbody  = document.getElementById('recipients-tbody');

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">👤</div><p>No recipients found</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(r => `
    <tr>
      <td><span class="audit-id">${shortId(r.linearId)}</span></td>
      <td>${getRecipientStatusBadge(r.status)}</td>
      <td><span class="encrypted-cell">🔒 encrypted</span></td>
      <td><span class="encrypted-cell">🔒 encrypted</span></td>
      <td><span class="encrypted-cell">🔒 encrypted</span></td>
      <td><span class="encrypted-cell">🔒 encrypted</span></td>
      <td style="font-size:0.8rem">${r.registeredBy}</td>
      <td style="font-size:0.75rem;color:var(--text-3)">${fmtDate(r.registrationTime)}</td>
    </tr>`).join('');
}

// ══════════════════════════════════════════════════════════════
// MATCHING
// ══════════════════════════════════════════════════════════════
async function loadMatches() {
  const res = await api('GET', '/api/match/list');
  state.matches = res.ok ? res.data?.data || [] : [];
  document.getElementById('matching-count').textContent = state.matches.length;
  renderMatches();
}

function renderMatches() {
  const filter = document.getElementById('match-filter-status')?.value || '';
  const list   = filter ? state.matches.filter(m => m.status === filter) : state.matches;
  const canConfirm = state.role?.permissions.has('confirm_match');
  const canReject  = state.role?.permissions.has('reject_match');
  const canSummary = state.role?.permissions.has('view_summary');
  const tbody  = document.getElementById('matches-tbody');

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">🔗</div><p>No matches found</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(m => {
    let actions = '';
    if (m.status === 'PENDING_CONFIRMATION') {
      if (canConfirm) actions += `<button class="btn btn-primary btn-sm" onclick="confirmMatch('${m.linearId}')">✓ Confirm</button> `;
      if (canReject)  actions += `<button class="btn btn-danger btn-sm" onclick="openRejectModal('${m.linearId}')">✕ Reject</button> `;
    }
    if (m.status === 'CONFIRMED' && canSummary) {
      actions += `<button class="btn btn-indigo btn-sm" onclick="fetchMatchSummary('${m.linearId}')">🔓 Summary</button>`;
    }
    if (!actions) actions = `<button class="btn btn-ghost btn-sm" onclick="showScoreModal(${JSON.stringify(m).replace(/"/g,'&quot;')})">Score ▸</button>`;
    return `
    <tr>
      <td><span class="audit-id">${shortId(m.linearId)}</span></td>
      <td>${organIcon(m.organType)} ${m.organType}</td>
      <td><strong>${m.matchScore?.toFixed(1)}</strong></td>
      <td><span class="badge badge-green">${m.crossMatchResult}</span></td>
      <td style="font-size:0.8rem">${m.donorHospital}</td>
      <td style="font-size:0.8rem">${m.recipientHospital}</td>
      <td>${getMatchBadge(m.status)}</td>
      <td style="font-size:0.72rem;color:var(--text-3)">${fmtDate(m.matchedAt)}</td>
      <td style="display:flex;gap:4px;flex-wrap:wrap">${actions}</td>
    </tr>`;
  }).join('');
}

// ══════════════════════════════════════════════════════════════
// REGISTER DONOR  (sends all fields — backend encrypts all)
// ══════════════════════════════════════════════════════════════
async function registerDonor() {
  const body = {
    name:       document.getElementById('d-name').value.trim(),
    contact:    document.getElementById('d-contact').value.trim(),
    bloodType:  document.getElementById('d-blood').value,
    organType:  document.getElementById('d-organ').value,
    age:        parseInt(document.getElementById('d-age').value),
    weightKg:   parseFloat(document.getElementById('d-weight').value),
    heightCm:   parseFloat(document.getElementById('d-height').value),
    isDeceased: document.getElementById('d-deceased').checked,
    location:   document.getElementById('d-location').value.trim(),
  };

  if (!body.name || !body.contact || !body.bloodType || !body.organType || !body.location) {
    showToast('warning','Missing Fields','Please fill all required fields'); return;
  }

  const res = await api('POST', '/api/donor/register', body);
  if (res.ok) {
    closeModal('donor-modal');
    showToast('success','Donor Registered','All fields AES-256-GCM encrypted and written to Corda ledger');
    addNotif('Donor Registered', `${body.organType} donor — all fields encrypted`, 'success');
    loadDonors();
  } else {
    showToast('error','Registration Failed', res.data?.message || res.error);
  }
}

// ══════════════════════════════════════════════════════════════
// REGISTER RECIPIENT
// ══════════════════════════════════════════════════════════════
async function registerRecipient() {
  const body = {
    name:           document.getElementById('r-name').value.trim(),
    contact:        document.getElementById('r-contact').value.trim(),
    bloodType:      document.getElementById('r-blood').value,
    organNeeded:    document.getElementById('r-organ').value,
    age:            parseInt(document.getElementById('r-age').value),
    weightKg:       parseFloat(document.getElementById('r-weight').value),
    heightCm:       parseFloat(document.getElementById('r-height').value),
    conditionScore: parseInt(document.getElementById('r-condition').value),
    serialNumber:   parseInt(document.getElementById('r-serial').value),
    hasPairedDonor: document.getElementById('r-paired').checked,
    location:       document.getElementById('r-location').value.trim(),
  };

  if (!body.name || !body.contact || !body.bloodType || !body.organNeeded || !body.location) {
    showToast('warning','Missing Fields','Please fill all required fields'); return;
  }

  const res = await api('POST', '/api/recipient/register', body);
  if (res.ok) {
    closeModal('recipient-modal');
    showToast('success','Patient Registered','All fields AES-256-GCM encrypted and written to Corda ledger');
    addNotif('Recipient Registered', `${body.organNeeded} patient — all fields encrypted`, 'success');
    loadRecipients();
  } else {
    showToast('error','Registration Failed', res.data?.message || res.error);
  }
}

// ══════════════════════════════════════════════════════════════
// TRIGGER MATCH (MatchingAuthority only)
// Calls POST /api/match/trigger/{donorLinearId} on MA's Spring Boot server.
// The MA decrypts all donor + recipient fields, runs Algorithm 1, creates MatchState.
// ══════════════════════════════════════════════════════════════
async function triggerMatch(donorLinearId) {
  showToast('info','Running Algorithm','MatchingAuthority decrypting fields and running Algorithm 1…');
  const res = await api('POST', `/api/match/trigger/${donorLinearId}`);
  if (res.ok) {
    if (res.data?.data) {
      showToast('success','Match Found!', `Score: ${res.data.data.matchScore?.toFixed(1)} · ${res.data.data.organType}`);
      addNotif('Match Found', `Organ: ${res.data.data.organType} · Score: ${res.data.data.matchScore?.toFixed(1)}`, 'success');
    } else {
      showToast('info','No Match','No compatible recipient found for this donor at this time');
    }
    loadDonors(); loadMatches();
  } else {
    showToast('error','Matching Failed', res.data?.message || res.error);
  }
}

// ══════════════════════════════════════════════════════════════
// CONFIRM / REJECT MATCH
// ══════════════════════════════════════════════════════════════
async function confirmMatch(matchLinearId) {
  showToast('info','Confirming…','Running ConfirmMatchFlow + dispatching decrypted summary to hospitals');
  const res = await api('POST', `/api/match/confirm/${matchLinearId}`);
  if (res.ok) {
    showToast('success','Match Confirmed','Decrypted match summary sent to both hospitals over TLS-secured P2P');
    addNotif('Match Confirmed', `ID: ${shortId(matchLinearId)}`, 'success');
    loadMatches();
  } else {
    showToast('error','Confirmation Failed', res.data?.message || res.error);
  }
}

function openRejectModal(matchLinearId) {
  document.getElementById('reject-match-id').value = matchLinearId;
  document.getElementById('reject-reason').value = '';
  openModal('reject-modal');
}

async function confirmReject() {
  const id     = document.getElementById('reject-match-id').value;
  const reason = document.getElementById('reject-reason').value.trim();
  if (!reason) { showToast('warning','Required','Please enter a rejection reason'); return; }

  const res = await api('POST', `/api/match/reject/${id}`, { reason });
  if (res.ok) {
    closeModal('reject-modal');
    showToast('success','Match Rejected', reason);
    loadMatches();
  } else {
    showToast('error','Rejection Failed', res.data?.message || res.error);
  }
}

// ══════════════════════════════════════════════════════════════
// FETCH DECRYPTED MATCH SUMMARY (MatchingAuthority only)
// Calls GET /api/match/summary/{matchLinearId}
// MA decrypts both parties' details and returns MatchSummaryResponse.
// ══════════════════════════════════════════════════════════════
async function fetchMatchSummary(matchLinearId) {
  const el = document.getElementById('summary-modal-content');
  el.innerHTML = '<div class="loading-row"><span class="spinner"></span> Decrypting via MatchingAuthority…</div>';
  openModal('summary-modal');

  const res = await api('GET', `/api/match/summary/${matchLinearId}`);
  if (!res.ok) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🔒</div><p>Decryption failed: ${res.data?.message || res.error}</p></div>`;
    return;
  }

  const s = res.data.data;
  el.innerHTML = `
    <div class="summary-panel">
      <div class="summary-panel-header">
        <span class="summary-lock">🔓</span>
        Decrypted Match Summary — ${s.matchLinearId?.slice(0,18)}…
      </div>
      <div class="summary-panel-body">
        <div class="summary-col">
          <div class="summary-col-label">🩸 Donor Details</div>
          <div class="summary-field"><div class="summary-field-label">Name</div><div class="summary-field-value">${s.donorName}</div></div>
          <div class="summary-field"><div class="summary-field-label">Contact</div><div class="summary-field-value">${s.donorContact}</div></div>
          <div class="summary-field"><div class="summary-field-label">Blood Type</div><div class="summary-field-value">${s.donorBloodType?.replace('_',' ')}</div></div>
          <div class="summary-field"><div class="summary-field-label">Organ</div><div class="summary-field-value">${organIcon(s.donorOrganType)} ${s.donorOrganType}</div></div>
          <div class="summary-field"><div class="summary-field-label">Location</div><div class="summary-field-value">${s.donorLocation}</div></div>
          <div class="summary-field"><div class="summary-field-label">Deceased</div><div class="summary-field-value">${s.donorIsDeceased ? 'Yes' : 'No'}</div></div>
        </div>
        <div class="summary-col">
          <div class="summary-col-label">👤 Recipient Details</div>
          <div class="summary-field"><div class="summary-field-label">Name</div><div class="summary-field-value">${s.recipientName}</div></div>
          <div class="summary-field"><div class="summary-field-label">Contact</div><div class="summary-field-value">${s.recipientContact}</div></div>
          <div class="summary-field"><div class="summary-field-label">Blood Type</div><div class="summary-field-value">${s.recipientBloodType?.replace('_',' ')}</div></div>
          <div class="summary-field"><div class="summary-field-label">Organ Needed</div><div class="summary-field-value">${organIcon(s.recipientOrganType)} ${s.recipientOrganType}</div></div>
          <div class="summary-field"><div class="summary-field-label">Location</div><div class="summary-field-value">${s.recipientLocation}</div></div>
          <div class="summary-field"><div class="summary-field-label">Condition Score</div><div class="summary-field-value">${s.recipientCondition} / 10</div></div>
        </div>
      </div>
      <div class="summary-score">
        <span>Algorithm 1 Match Score:</span>
        <strong>${s.matchScore?.toFixed(2)}</strong>
        <span style="margin-left:auto;font-size:0.7rem;opacity:0.7">Decrypted by MatchingAuthority · transmitted over Corda TLS P2P</span>
      </div>
    </div>`;
}

// ══════════════════════════════════════════════════════════════
// SCORE MODAL
// ══════════════════════════════════════════════════════════════
function showScoreModal(m) {
  const maxScore = 110;
  document.getElementById('score-modal-content').innerHTML = `
    <div style="margin-bottom:0.75rem">
      <div style="font-size:0.78rem;color:var(--text-3);margin-bottom:0.25rem">Match ID</div>
      <div style="font-family:var(--font-mono);font-size:0.75rem">${m.linearId}</div>
    </div>
    <div class="score-breakdown">
      ${scoreRow('Total Score',m.matchScore,maxScore)}
    </div>
    <div class="divider"></div>
    <div style="font-size:0.75rem;color:var(--text-3);line-height:1.6">
      <strong>Scoring criteria:</strong><br/>
      Location match (deceased): +15 · Paired donor (KPE): +20<br/>
      BMI compatibility: +15 · Age compatibility: +10<br/>
      Condition score × 5: up to +50 · Serial tie-break: −0.001×serial
    </div>`;
  openModal('score-modal');
}

function scoreRow(label, val, max) {
  const pct = Math.min(100, Math.round((val / max) * 100));
  return `<div class="score-row">
    <span class="score-row-label">${label}</span>
    <div class="score-bar-bg"><div class="score-bar-fill" style="width:${pct}%"></div></div>
    <span class="score-row-val">${val?.toFixed ? val.toFixed(1) : val}</span>
  </div>`;
}

// ══════════════════════════════════════════════════════════════
// TRANSPORT
// ══════════════════════════════════════════════════════════════
async function loadTransport() {
  const res = await api('GET', '/api/transport/list');
  state.transports = res.ok ? res.data?.data || [] : [];
  document.getElementById('transport-count').textContent = state.transports.length;

  const canDispatch = state.role?.permissions.has('dispatch_transport');
  const canUpdate   = state.role?.permissions.has('update_transport');
  const tbody = document.getElementById('transport-tbody');

  if (!state.transports.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">🚑</div><p>No transports</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = state.transports.map(t => {
    let actions = '';
    if (canDispatch && t.status === 'DISPATCHED') actions += `<button class="btn btn-amber btn-sm" onclick="openTransportUpdate('${t.linearId}')">Update</button>`;
    if (canUpdate) actions += `<button class="btn btn-ghost btn-sm" onclick="openTransportUpdate('${t.linearId}')">Update</button>`;
    if (!actions) actions = '—';
    return `
    <tr>
      <td><span class="audit-id">${shortId(t.linearId)}</span></td>
      <td>${organIcon(t.organType)} ${t.organType}</td>
      <td style="font-size:0.8rem">${t.originHospital}</td>
      <td style="font-size:0.8rem">${t.destinationHospital}</td>
      <td><span class="viability-timer timer-${t.viabilityWindowHours <= 6 ? 'critical' : t.viabilityWindowHours <= 12 ? 'warning' : 'ok'}">${t.viabilityWindowHours}h</span></td>
      <td>${getTransportStatusBadge(t.status)}</td>
      <td style="font-size:0.72rem;color:var(--text-3)">${fmtDate(t.dispatchTime)}</td>
      <td>${actions}</td>
    </tr>`;
  }).join('');
}

function openTransportUpdate(id) {
  document.getElementById('update-transport-id').value = id;
  openModal('transport-update-modal');
}

async function submitTransportUpdate() {
  const id     = document.getElementById('update-transport-id').value;
  const status = document.getElementById('transport-new-status').value;
  const res = await api('POST', `/api/transport/update/${id}`, { newStatus: status });
  if (res.ok) {
    closeModal('transport-update-modal');
    showToast('success','Transport Updated', `Status: ${status}`);
    loadTransport();
  } else {
    showToast('error','Update Failed', res.data?.message || res.error);
  }
}

// ══════════════════════════════════════════════════════════════
// AUDIT
// ══════════════════════════════════════════════════════════════
async function loadAudit() {
  const [d, r, m, t] = await Promise.all([
    api('GET','/api/donor/list'), api('GET','/api/recipient/list'),
    api('GET','/api/match/list'), api('GET','/api/transport/list'),
  ]);
  const el = document.getElementById('audit-list');
  const events = [];

  (d.ok && d.data?.data || []).forEach(x => events.push({
    time: x.registrationTime, color: '#0c9488', icon: '❤',
    action: `Donor Registered — status: ${x.status}`,
    meta: `Registered by ${x.registeredBy} · All fields AES-256 encrypted`, id: x.linearId
  }));
  (r.ok && r.data?.data || []).forEach(x => events.push({
    time: x.registrationTime, color: '#2563eb', icon: '👤',
    action: `Patient Registered — status: ${x.status}`,
    meta: `Registered by ${x.registeredBy} · All fields AES-256 encrypted`, id: x.linearId
  }));
  (m.ok && m.data?.data || []).forEach(x => {
    events.push({ time: x.matchedAt, color: '#4f46e5', icon: '🔐',
      action: `Match Created by MatchingAuthority — ${x.organType}`,
      meta: `Score ${x.matchScore?.toFixed(1)} · ${x.donorHospital} → ${x.recipientHospital}`, id: x.linearId });
    if (x.resolvedAt) events.push({ time: x.resolvedAt, color: x.status === 'CONFIRMED' ? '#16a34a' : '#dc2626', icon: x.status === 'CONFIRMED' ? '✅' : '✕',
      action: `Match ${x.status}`, meta: x.rejectionReason || 'Admin approved', id: x.linearId });
  });
  (t.ok && t.data?.data || []).forEach(x => {
    events.push({ time: x.dispatchTime, color: '#7c3aed', icon: '🚑',
      action: `Transport Dispatched — ${x.organType}`,
      meta: `${x.originHospital} → ${x.destinationHospital} · ${x.viabilityWindowHours}h`, id: x.linearId });
    if (x.deliveredAt) events.push({ time: x.deliveredAt, color: '#16a34a', icon: '✅',
      action: `Organ Delivered — ${x.organType}`,
      meta: `Delivered to ${x.destinationHospital}`, id: x.linearId });
  });

  events.sort((a, b) => new Date(b.time) - new Date(a.time));
  if (!events.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>No ledger events found</p></div>'; return;
  }
  el.innerHTML = events.map(e => `
    <div class="audit-entry">
      <div style="display:flex;flex-direction:column;align-items:center;gap:0;margin-top:3px">
        <div style="width:24px;height:24px;border-radius:50%;background:${e.color}18;border:2px solid ${e.color};display:flex;align-items:center;justify-content:center;font-size:0.7rem;flex-shrink:0">${e.icon}</div>
        <div style="width:1px;flex:1;background:var(--border);margin-top:4px;min-height:16px"></div>
      </div>
      <div class="audit-content" style="padding-bottom:0.75rem">
        <div class="audit-action">${e.action}</div>
        <div class="audit-meta">${e.meta}</div>
        <div style="display:flex;gap:0.5rem;align-items:center;margin-top:4px">
          <span class="audit-id">${shortId(e.id)}</span>
          <span class="text-sm">${fmtDate(e.time)}</span>
          <span style="font-size:0.7rem;color:var(--text-3)">${timeAgo(e.time)}</span>
        </div>
      </div>
    </div>`).join('');
}

// ══════════════════════════════════════════════════════════════
// MY RECORDS
// ══════════════════════════════════════════════════════════════
async function loadMyRecords() {
  const [donors, recips] = await Promise.all([
    api('GET','/api/donor/list'), api('GET','/api/recipient/list')
  ]);
  const myNode = state.role?.node;
  document.getElementById('my-records-title').textContent = `Records for ${myNode}`;

  const myDonors = (donors.ok ? donors.data?.data || [] : []).filter(d => d.registeredBy === myNode);
  const myRecips = (recips.ok ? recips.data?.data || [] : []).filter(r => r.registeredBy === myNode);

  const renderCard = (list, type) => list.length ? list.map(item => `
    <div style="padding:0.75rem;border-bottom:1px solid var(--border)">
      <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.25rem">
        ${type === 'donor' ? getDonorStatusBadge(item.status) : getRecipientStatusBadge(item.status)}
        <span class="audit-id">${shortId(item.linearId)}</span>
      </div>
      <div style="font-size:0.72rem;color:var(--text-3)">${fmtDate(item.registrationTime)}</div>
      <div style="font-size:0.72rem;color:var(--text-3);margin-top:2px">
        <span class="encrypted-cell">🔒 medical fields encrypted</span>
      </div>
    </div>`).join('')
    : `<div class="empty-state"><div class="empty-icon">${type === 'donor' ? '❤' : '👤'}</div><p>No ${type}s registered by this node</p></div>`;

  document.getElementById('my-donors-list').innerHTML    = renderCard(myDonors, 'donor');
  document.getElementById('my-recipients-list').innerHTML = renderCard(myRecips, 'recipient');
}

// ══════════════════════════════════════════════════════════════
// SETTINGS
// ══════════════════════════════════════════════════════════════
function saveSettings() {
  const newUrl = document.getElementById('settings-api-url').value.replace(/\/$/, '');
  state.apiBase = newUrl;
  showToast('success', 'Settings Saved', `API base URL → ${newUrl}`);
}
async function testConnection() {
  const res = await api('GET', '/api/donor/list');
  if (res.ok) showToast('success', 'Connection OK', 'Server is reachable');
  else showToast('error', 'Connection Failed', res.error || `HTTP ${res.status}`);
}

// ══════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ══════════════════════════════════════════════════════════════
function addNotif(title, body, type = 'info') {
  state.notifications.unshift({ title, body, type, time: new Date() });
  renderNotifList();
  document.getElementById('notif-dot').classList.add('active');
}
function renderNotifList() {
  const list = document.getElementById('notif-list');
  if (!state.notifications.length) { list.innerHTML = '<div class="notif-empty">No notifications</div>'; return; }
  list.innerHTML = state.notifications.slice(0, 20).map(n => `
    <div class="notif-item">
      <div class="notif-item-title">${n.title}</div>
      <div class="text-sm">${n.body}</div>
      <div class="notif-item-time">${timeAgo(n.time)}</div>
    </div>`).join('');
}
function toggleNotifPanel() {
  document.getElementById('notif-panel').classList.toggle('open');
  document.getElementById('notif-dot').classList.remove('active');
}
function clearNotifs() { state.notifications = []; renderNotifList(); }

// ══════════════════════════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════════════════════════
function showToast(type, title, body) {
  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span style="font-size:1rem;color:var(--${type==='success'?'green':type==='error'?'red':type==='warning'?'amber':'blue'})">${icons[type]||'ℹ'}</span>
    <div class="toast-msg">
      ${title ? `<div class="toast-title">${title}</div>` : ''}
      ${body  ? `<div class="toast-body">${body}</div>`   : ''}
    </div>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0'; toast.style.transform = 'translateX(16px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

// ══════════════════════════════════════════════════════════════
// MODALS
// ══════════════════════════════════════════════════════════════
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('open');
});

// ══════════════════════════════════════════════════════════════
// BLOOD TYPE COMPAT CHART
// ══════════════════════════════════════════════════════════════
function buildCompatChart() {
  const types  = ['O-','O+','A-','A+','B-','B+','AB-','AB+'];
  const compat = { 'O-':['O-','O+','A-','A+','B-','B+','AB-','AB+'],'O+':['O+','A+','B+','AB+'],'A-':['A-','A+','AB-','AB+'],'A+':['A+','AB+'],'B-':['B-','B+','AB-','AB+'],'B+':['B+','AB+'],'AB-':['AB-','AB+'],'AB+':['AB+'] };
  const el = document.getElementById('compat-chart');
  if (!el) return;
  let html = '<div class="compat-grid"><div class="compat-cell compat-hdr">D→R</div>';
  types.forEach(t => html += `<div class="compat-cell compat-hdr">${t}</div>`);
  types.forEach(rec => {
    html += `<div class="compat-cell compat-hdr">${rec}</div>`;
    types.forEach(don => { const ok = compat[don]?.includes(rec); html += `<div class="compat-cell ${ok?'compat-yes':'compat-no'}">${ok?'✓':'·'}</div>`; });
  });
  html += '</div><p class="form-hint" style="margin-top:0.5rem">D = Donor blood type (column), R = Recipient blood type (row)</p>';
  el.innerHTML = html;
}

// ══════════════════════════════════════════════════════════════
// UTILITIES
// ══════════════════════════════════════════════════════════════
function shortId(id) {
  if (!id) return '—';
  const part = id.split(',')[0].replace(/[{}]/g,'');
  return part.length > 12 ? part.slice(0, 8) + '…' : part;
}
function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) + ' ' + d.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });
}
function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
  return `${Math.floor(diff/86400000)}d ago`;
}
function organIcon(type) {
  return { KIDNEY:'🫘', LIVER:'🫀', HEART:'❤️', LUNG:'🫁', PANCREAS:'🧬', CORNEA:'👁️', SMALL_INTESTINE:'🌀' }[type] || '🫀';
}
function getDonorStatusBadge(s) {
  return `<span class="badge ${{ AVAILABLE:'badge-teal', ASSIGNED:'badge-amber', EXPIRED:'badge-red' }[s]||'badge-gray'}">${s}</span>`;
}
function getRecipientStatusBadge(s) {
  return `<span class="badge ${{ WAITING:'badge-blue', MATCHED:'badge-amber', TRANSPLANTED:'badge-green', REMOVED:'badge-red' }[s]||'badge-gray'}">${s}</span>`;
}
function getMatchBadge(s) {
  return `<span class="badge ${{ PENDING_CONFIRMATION:'badge-amber', CONFIRMED:'badge-green', REJECTED:'badge-red' }[s]||'badge-gray'}">${s.replace(/_/g,' ')}</span>`;
}
function getTransportStatusBadge(s) {
  return `<span class="badge ${{ DISPATCHED:'badge-blue', IN_TRANSIT:'badge-amber', DELIVERED:'badge-green', FAILED:'badge-red' }[s]||'badge-gray'}">${s.replace(/_/g,' ')}</span>`;
}
function setTableLoading(tbodyId, cols) {
  document.getElementById(tbodyId).innerHTML = `<tr><td colspan="${cols}"><div class="loading-row"><span class="spinner"></span> Loading…</div></td></tr>`;
}
