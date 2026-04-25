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

  document.getElementById('result').classList.remove('on');
  document.getElementById('errorMsg').classList.remove('on');

  const sp = document.getElementById('scanProg');
  sp.classList.add('on');
  document.getElementById('scanUrl').textContent = url;

  const steps = ['Fetching', 'Domain', 'SSL Check', 'Gemini AI', 'Scoring'];
  const stepsEl = document.getElementById('progSteps');
  stepsEl.innerHTML = steps.map(s => `<span class="prog-step">${s}</span>`).join('');
  const stepEls = stepsEl.querySelectorAll('.prog-step');
  const labels = [
    'Fetching website assets...',
    'Analyzing domain signals...',
    'Checking SSL certificate & domain age...',
    'Running Gemini AI analysis...',
    'Calculating final trust score...'
  ];

  const pf = document.getElementById('progFill');
  let i = 0;

  const iv = setInterval(() => {
    if (i > 0) stepEls[i - 1].classList.add('done');
    document.getElementById('progLabel').textContent = labels[i];
    pf.style.width = ((i + 1) / steps.length * 100) + '%';
    i++;
    if (i >= steps.length) {
      stepEls[i - 1].classList.add('done');
      clearInterval(iv);
    }
  }, 600);

  try {
    const response = await fetch('/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    const data = await response.json();
    clearInterval(iv);
    setTimeout(() => {
      sp.classList.remove('on');
      pf.style.width = '0';
      stepEls.forEach(el => el.classList.remove('done'));
      showResult(data);
    }, 400);

  } catch (err) {
    clearInterval(iv);
    sp.classList.remove('on');
    pf.style.width = '0';
    const em = document.getElementById('errorMsg');
    em.textContent = 'Could not scan this URL. Make sure it starts with https:// and try again.';
    em.classList.add('on');
  }
}

function showResult(data) {
  const score = data.trustScore;

  // Score circle
  const sc = document.getElementById('scoreCircle');
  sc.textContent = score;
  if (score >= 60) sc.className = 'score-circle sc-safe';
  else if (score >= 30) sc.className = 'score-circle sc-warn';
  else sc.className = 'score-circle sc-danger';

  // Title and verdict
  let title, verdict, vcls;
  if (score >= 60) {
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

  // Build signals using ALL new data
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
      s: data.signals.domainAge === 'Established' || (data.signals.domainAge && data.signals.domainAge.includes('days') && parseInt(data.signals.domainAge) > 365)
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
      s: data.signals.urgencyLanguage ? 'Urgency/fear tactics detected in content'
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
      s: data.signals.blacklisted ? 'Google has flagged this site as dangerous' : 'No threats found in Google database',
      p: data.signals.blacklisted ? 99 : 3,
      f: data.signals.blacklisted ? 'f-danger' : 'f-safe'
    }
  ];

  document.getElementById('sigGrid').innerHTML = signals.map(s => `
    <div class="sig">
      <div class="sig-lbl">${s.l}</div>
      <div class="sig-val">${s.v}</div>
      <div class="sig-sub">${s.s}</div>
      <div class="sig-bar"><div class="sig-fill ${s.f}" style="width:${s.p}%"></div></div>
    </div>`).join('');

  // Detail rows
  const details = [
    {
      k: 'Brand impersonated',
      v: data.brand || 'None detected',
      t: data.brand ? 't-danger' : 't-safe'
    },
    {
      k: 'Category',
      v: data.category || 'Unknown',
      t: 't-safe'
    },
    {
      k: 'Stolen assets',
      v: data.stolenAssets || 'None',
      t: data.stolenAssets && data.stolenAssets !== 'none' ? 't-danger' : 't-safe'
    },
    {
      k: 'Threat level',
      v: data.riskLevel || 'Low',
      t: data.riskLevel === 'High' ? 't-danger' : data.riskLevel === 'Medium' ? 't-warn' : 't-safe'
    },
    {
      k: 'Brand impersonation',
      v: data.signals.hasBrandImpersonation ? 'Detected' : 'None',
      t: data.signals.hasBrandImpersonation ? 't-danger' : 't-safe'
    },
    {
      k: 'AI analysis',
      v: data.reason || 'Completed',
      t: score < 30 ? 't-danger' : score < 60 ? 't-warn' : 't-safe'
    }
  ];

  document.getElementById('detList').innerHTML = details.map(x => `
    <div class="det-row">
      <span class="det-k">${x.k}</span>
      <span class="tag ${x.t}">${x.v}</span>
    </div>`).join('');

  // Footer message
  document.getElementById('footTxt').textContent =
    score < 30
      ? '🚨 Do not enter personal details, pay money, or share documents on this site'
      : score < 60
      ? '⚠️ Proceed with caution — verify this site before making any payment'
      : '✅ Scanned via Gemini AI · Google Safe Browsing · SSL Check · Domain Analysis';

  document.getElementById('result').classList.add('on');
}