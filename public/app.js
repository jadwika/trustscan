function showPage(id, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  btn.classList.add('active');
}

function tryUrl(u) {
  document.getElementById('urlInput').value = u;
  startScan();
}

document.querySelectorAll('.cat-chip').forEach(c => {
  c.onclick = function () {
    document.querySelectorAll('.cat-chip').forEach(x => x.classList.remove('active'));
    this.classList.add('active');
  };
});

async function startScan() {
  const url = document.getElementById('urlInput').value.trim();
  if (!url) return;

  // Hide previous results
  document.getElementById('result').classList.remove('on');
  document.getElementById('errorMsg').classList.remove('on');

  // Remove old short message box if exists
  const oldMsg = document.getElementById('shortMsgBox');
  if (oldMsg) oldMsg.remove();

  // Remove old analysis section if exists
  const oldAnalysis = document.getElementById('analysisSection');
  if (oldAnalysis) oldAnalysis.remove();

  // Show dot loader
  showDotLoader(url);

  try {
    const response = await fetch('/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    const data = await response.json();

    // Hide dot loader
    hideDotLoader();

    // Show result with new flow
    showResult(data);

  } catch (err) {
    hideDotLoader();
    const em = document.getElementById('errorMsg');
    em.textContent = 'Could not scan this URL. Make sure it starts with https:// and try again.';
    em.classList.add('on');
  }
}

function showDotLoader(url) {
  const sp = document.getElementById('scanProg');
  sp.classList.add('on');
  sp.innerHTML = `
    <div class="scan-url" id="scanUrl">${url}</div>
    <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin:18px 0 10px">
      <span class="ts-dot-loader"></span>
      <span style="font-size:13px;color:var(--muted);font-family:'Inter',sans-serif">Analysing with Gemini AI...</span>
    </div>
  `;
}

function hideDotLoader() {
  const sp = document.getElementById('scanProg');
  sp.classList.remove('on');
  sp.innerHTML = '';
}

function typeMessage(element, text, callback) {
  element.textContent = '';
  let i = 0;
  const speed = 18;
  function type() {
    if (i < text.length) {
      element.textContent += text.charAt(i);
      i++;
      setTimeout(type, speed);
    } else {
      if (callback) callback();
    }
  }
  type();
}

function showResult(data) {
  const score = data.trustScore;
  const result = document.getElementById('result');

  // Score circle
  const sc = document.getElementById('scoreCircle');
  sc.textContent = score;
  if (score >= 60) sc.className = 'score-circle sc-safe';
  else if (score >= 30) sc.className = 'score-circle sc-warn';
  else sc.className = 'score-circle sc-danger';

  // Title and verdict
  let title, verdict, vcls;
  if (data.category === 'Piracy') {
    title = 'Illegal — piracy website';
    verdict = 'Warning — ' + (data.reason || 'illegal piracy site');
    vcls = 'v-warn';
  } else if (score >= 60) {
    title = 'Legitimate website';
    verdict = 'Verified — this website appears safe to use';
    vcls = 'v-safe';
  } else if (score >= 30) {
    title = 'Suspicious — verify carefully';
    verdict = 'Caution — ' + (data.reason || 'some signals look unusual');
    vcls = 'v-warn';
  } else {
    title = 'Dangerous — likely fake website';
    verdict = 'Warning — ' + (data.reason || 'this site shows signs of fraud');
    vcls = 'v-danger';
  }

  document.getElementById('resTitle').textContent = title;
  document.getElementById('resUrl').textContent = data.url;
  const rv = document.getElementById('resVerdict');
  rv.textContent = verdict;
  rv.className = 'res-verdict ' + vcls;
  document.getElementById('catBadge').innerHTML = `<div class="cat-badge">${data.category || 'Website'}</div>`;

  // Clear sigGrid and detList for now — will show on View Analysis click
  document.getElementById('sigGrid').innerHTML = '';
  document.getElementById('detList').innerHTML = '';

  // Show result card (only top part visible)
  result.classList.add('on');

  // Inject short message box with typing effect
  if (data.shortMessage) {
    let msgBg, msgBorder, msgIcon, msgLabelColor, msgTextColor, msgLabel;

    if (data.category === 'Piracy') {
      msgBg = '#fff8e1'; msgBorder = '#ffe082';
      msgIcon = '⚠️'; msgLabelColor = '#e65100';
      msgLabel = 'Why this is dangerous';
      msgTextColor = '#bf360c';
    } else if (score >= 60) {
      msgBg = '#edfaf3'; msgBorder = '#c8ecd8';
      msgIcon = '✅'; msgLabelColor = '#2e7d32';
      msgLabel = 'Why this is safe';
      msgTextColor = '#1b5e3a';
    } else if (score >= 30) {
      msgBg = '#fff8e1'; msgBorder = '#ffe082';
      msgIcon = '⚠️'; msgLabelColor = '#e65100';
      msgLabel = 'Why you should be careful';
      msgTextColor = '#bf360c';
    } else {
      msgBg = '#ffebee'; msgBorder = '#ffcdd2';
      msgIcon = '🚨'; msgLabelColor = '#c62828';
      msgLabel = 'Why this is dangerous';
      msgTextColor = '#b71c1c';
    }

    const msgBox = document.createElement('div');
    msgBox.id = 'shortMsgBox';
    msgBox.style.cssText = `
      padding:14px 22px;
      border-bottom:1px solid ${msgBorder};
      background:${msgBg};
      display:flex;
      align-items:flex-start;
      gap:12px;
      opacity:0;
      transition:opacity 0.4s ease;
    `;
    msgBox.innerHTML = `
      <div style="width:36px;height:36px;border-radius:10px;background:${msgBorder};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:16px">${msgIcon}</div>
      <div style="flex:1">
        <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:${msgLabelColor};margin-bottom:5px;font-family:'Inter',sans-serif">${msgLabel}</div>
        <div id="typingText" style="font-size:13px;line-height:1.65;color:${msgTextColor};font-family:'Inter',sans-serif;min-height:20px"></div>
      </div>
    `;

    const resultTop = document.querySelector('.result-top');
    resultTop.insertAdjacentElement('afterend', msgBox);

    // Fade in message box
    setTimeout(() => {
      msgBox.style.opacity = '1';

      // Start typing effect
      const typingEl = document.getElementById('typingText');
      typeMessage(typingEl, data.shortMessage, () => {
        // After typing done — show View Analysis button
        showViewAnalysisButton(data, score, msgBox);
      });
    }, 300);
  }

  // Update footer
  document.getElementById('footTxt').textContent =
    data.category === 'Piracy'
      ? '⚠️ Visiting piracy sites is illegal in India — use JioCinema, Hotstar or Netflix instead'
      : score < 30
      ? '🚨 Do not enter personal details, pay money, or share documents on this site'
      : score < 60
      ? '⚠️ Proceed with caution — verify this site before making any payment'
      : '✅ Scanned via Gemini AI · Google Safe Browsing · SSL Check · Domain Analysis';
}

function showViewAnalysisButton(data, score, afterElement) {
  // Remove old button if exists
  const oldBtn = document.getElementById('viewAnalysisBtn');
  if (oldBtn) oldBtn.remove();

  const btnWrap = document.createElement('div');
  btnWrap.id = 'viewAnalysisBtn';
  btnWrap.style.cssText = `
    padding:14px 22px;
    border-bottom:1px solid var(--border);
    display:flex;
    justify-content:center;
    opacity:0;
    transition:opacity 0.4s ease;
  `;
  btnWrap.innerHTML = `
    <button onclick="showFullAnalysis(this)" style="
      background:linear-gradient(135deg,#4CAF82,#5BBFB5,#7B9FE0);
      color:#fff;
      border:none;
      border-radius:12px;
      padding:11px 28px;
      font-size:14px;
      font-weight:600;
      font-family:'Inter',sans-serif;
      cursor:pointer;
      display:flex;
      align-items:center;
      gap:8px;
      box-shadow:0 4px 14px rgba(76,175,130,.35);
      transition:all .2s;
    " onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='translateY(0)'">
      View Analysis
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
    </button>
  `;

  afterElement.insertAdjacentElement('afterend', btnWrap);

  // Fade in button
  setTimeout(() => { btnWrap.style.opacity = '1'; }, 100);

  // Store data for later use
  window._lastScanData = data;
  window._lastScanScore = score;
}

function showFullAnalysis(btn) {
  const data = window._lastScanData;
  const score = window._lastScanScore;

  // Hide button
  const btnWrap = document.getElementById('viewAnalysisBtn');
  if (btnWrap) btnWrap.style.display = 'none';

  // Remove old analysis section
  const oldAnalysis = document.getElementById('analysisSection');
  if (oldAnalysis) oldAnalysis.remove();

  // Build signals
  const signals = [
    {
      l: 'Domain signals',
      v: data.signals.suspiciousDomain ? 'Suspicious' : 'Normal',
      s: data.signals.domainRiskReasons && data.signals.domainRiskReasons.length > 0
        ? data.signals.domainRiskReasons[0]
        : 'Domain looks normal',
      p: data.signals.suspiciousDomain ? 80 : 5,
      f: data.signals.suspiciousDomain ? 'f-danger' : 'f-safe'
    },
    {
      l: 'Domain age',
      v: data.signals.domainAge || 'Unknown',
      s: data.signals.domainAge === 'Established'
        ? 'Established trusted domain'
        : data.signals.domainAge && data.signals.domainAge.includes('Less than')
        ? '⚠️ Very recently registered'
        : 'Domain age verified',
      p: data.signals.domainAge && data.signals.domainAge.includes('Less than 7') ? 95
        : data.signals.domainAge && data.signals.domainAge.includes('Less than 30') ? 70
        : 5,
      f: data.signals.domainAge && data.signals.domainAge.includes('Less than') ? 'f-danger' : 'f-safe'
    },
    {
      l: 'SSL certificate',
      v: data.signals.sslValid ? 'Valid & Secure' : 'Invalid / Missing',
      s: data.signals.sslValid
        ? `Issued by: ${data.signals.sslIssuer || 'Trusted CA'}`
        : 'Certificate not verified — risky',
      p: data.signals.sslValid ? 5 : 85,
      f: data.signals.sslValid ? 'f-safe' : 'f-danger'
    },
    {
      l: 'Form harvesting',
      v: data.signals.formHarvesting === 'None detected' ? 'None detected' : '⚠️ ' + data.signals.formHarvesting,
      s: data.signals.formHarvesting === 'None detected'
        ? 'No suspicious data collection'
        : 'Illegal personal data collection detected',
      p: data.signals.formHarvesting === 'None detected' ? 3 : 95,
      f: data.signals.formHarvesting === 'None detected' ? 'f-safe' : 'f-danger'
    },
    {
      l: 'Manipulation score',
      v: data.signals.manipulationScore > 50 ? 'High — scam patterns found'
        : data.signals.manipulationScore > 25 ? 'Medium — some red flags'
        : 'Low — no manipulation',
      s: data.signals.urgencyLanguage ? 'Urgency/fear tactics detected'
        : data.signals.unrealisticPromises ? 'Unrealistic promises detected'
        : 'No psychological manipulation detected',
      p: Math.min(data.signals.manipulationScore || 0, 100),
      f: data.signals.manipulationScore > 50 ? 'f-danger'
        : data.signals.manipulationScore > 25 ? 'f-warn'
        : 'f-safe'
    },
    {
      l: 'Safe Browsing',
      v: data.signals.blacklisted ? '🚨 Blacklisted by Google' : 'Not listed',
      s: data.signals.blacklisted ? 'Google has flagged this site' : 'No threats found in Google database',
      p: data.signals.blacklisted ? 99 : 3,
      f: data.signals.blacklisted ? 'f-danger' : 'f-safe'
    }
  ];

  const details = [
    { k: 'Brand impersonated', v: data.brand || 'None detected', t: data.brand ? 't-danger' : 't-safe' },
    { k: 'Category', v: data.category || 'Unknown', t: data.category === 'Piracy' ? 't-warn' : 't-safe' },
    { k: 'Stolen assets', v: data.stolenAssets || 'None', t: data.stolenAssets && data.stolenAssets !== 'none' ? 't-danger' : 't-safe' },
    { k: 'Threat level', v: data.riskLevel || 'Low', t: data.riskLevel === 'High' ? 't-danger' : data.riskLevel === 'Medium' ? 't-warn' : 't-safe' },
    { k: 'Brand impersonation', v: data.signals.hasBrandImpersonation ? 'Detected' : 'None', t: data.signals.hasBrandImpersonation ? 't-danger' : 't-safe' },
    { k: 'AI analysis', v: data.reason || 'Completed', t: score < 30 ? 't-danger' : score < 60 ? 't-warn' : 't-safe' }
  ];

  // Create analysis section
  const analysisSection = document.createElement('div');
  analysisSection.id = 'analysisSection';
  analysisSection.style.cssText = 'opacity:0;transition:opacity 0.5s ease;';
  analysisSection.innerHTML = `
    <div class="sig-grid" id="sigGrid">
      ${signals.map(s => `
        <div class="sig">
          <div class="sig-lbl">${s.l}</div>
          <div class="sig-val">${s.v}</div>
          <div class="sig-sub">${s.s}</div>
          <div class="sig-bar"><div class="sig-fill ${s.f}" style="width:${s.p}%"></div></div>
        </div>`).join('')}
    </div>
    <div class="det-list" id="detList">
      ${details.map(x => `
        <div class="det-row">
          <span class="det-k">${x.k}</span>
          <span class="tag ${x.t}">${x.v}</span>
        </div>`).join('')}
    </div>
  `;

  // Insert before footer
  const resFooter = document.querySelector('.res-foot');
  resFooter.insertAdjacentElement('beforebegin', analysisSection);

  // Fade in
  setTimeout(() => { analysisSection.style.opacity = '1'; }, 50);

  // Scroll to analysis
  analysisSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}