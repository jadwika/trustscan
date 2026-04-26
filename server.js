require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const whois = require('whois-json');
const sslChecker = require('ssl-checker');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Known 100% legitimate domains
const SAFE_DOMAINS = [
  'amazon.in','amazon.com','flipkart.com','myntra.com','nykaa.com',
  'meesho.com','ajio.com','snapdeal.com','tatacliq.com','reliancedigital.in',
  'sbi.co.in','hdfcbank.com','icicibank.com','axisbank.com','kotak.com',
  'paytm.com','phonepe.com','razorpay.com','billdesk.com','npci.org.in',
  'google.com','youtube.com','facebook.com','instagram.com','twitter.com',
  'linkedin.com','naukri.com','shine.com','indeed.com','glassdoor.com','foundit.in',
  'ncs.gov.in','ssc.nic.in','upsc.gov.in','irctc.co.in','indianrailways.gov.in',
  'india.gov.in','mygov.in','digilocker.gov.in','uidai.gov.in','incometax.gov.in',
  'iit.ac.in','nit.ac.in','ugc.ac.in','aicte-india.org','cbse.gov.in'
];

// Fake patterns
const FAKE_EXTENSIONS = ['xyz','tk','ml','ga','cf','gq','top','club','online','site','buzz','icu','fun'];
const FAKE_KEYWORDS = [
  'deals','sale','cheap','free','win','offer','kyc','update','verify',
  'secure','alert','claim','prize','lucky','reward','bonus','gift',
  'sarkari','apply-now','job-alert','recruitment-free','govt-job',
  'clearance','discount','flash','limited','hurry','urgent',
  'loot','cashback','scheme','yojana','helpline','support-team',
  'refund','payment-free','delivery-free','win-prize'
];
const BRAND_NAMES = [
  'flipkart','amazon','myntra','meesho','nykaa','paytm','phonepe',
  'sbi','hdfc','icici','axis','kotak','irctc','upsc','ssc','ncs',
  'google','facebook','instagram','whatsapp','youtube','linkedin'
];

// Check known safe
function isKnownSafe(url) {
  try {
    const hostname = new URL(url).hostname.replace('www.','');
    return SAFE_DOMAINS.some(d => hostname === d || hostname.endsWith('.'+d));
  } catch { return false; }
}

// Layer 1 — Domain Analysis
function analyzeDomain(url) {
  try {
    const hostname = new URL(url).hostname.replace('www.','');
    const domainParts = hostname.split('.');
    const ext = domainParts.pop();
    const domainName = domainParts.join('.').toLowerCase();
    let riskScore = 0;
    let reasons = [];
    let detectedBrand = null;

    if (FAKE_EXTENSIONS.includes(ext)) {
      riskScore += 40;
      reasons.push(`Suspicious extension .${ext}`);
    }

    const foundKeywords = FAKE_KEYWORDS.filter(k => domainName.includes(k));
    if (foundKeywords.length > 0) {
      riskScore += foundKeywords.length * 20;
      reasons.push(`Suspicious keywords: ${foundKeywords.join(', ')}`);
    }

    const foundBrand = BRAND_NAMES.find(b => domainName.includes(b));
    if (foundBrand) {
      detectedBrand = foundBrand;
      const isReal = SAFE_DOMAINS.some(d => hostname === d);
      if (!isReal) {
        riskScore += 50;
        reasons.push(`Brand "${foundBrand}" impersonated`);
      }
    }

    if (/\d/.test(domainName)) { riskScore += 15; reasons.push('Numbers in domain'); }
    const hyphens = (domainName.match(/-/g) || []).length;
    if (hyphens >= 2) { riskScore += hyphens * 10; reasons.push('Multiple hyphens'); }
    if (domainName.length > 20) { riskScore += 10; reasons.push('Long domain name'); }

    const typos = ['amaz0n','fl1pkart','paytm1','sbi1','faceb00k','g00gle'];
    if (typos.some(t => domainName.includes(t))) {
      riskScore += 60;
      reasons.push('Typosquatting detected');
    }

    return {
      riskScore: Math.min(riskScore, 100),
      reasons, detectedBrand, ext, domainName,
      hasSuspiciousExt: FAKE_EXTENSIONS.includes(ext),
      hasFakeKeywords: foundKeywords.length > 0,
      hasBrandImpersonation: !!foundBrand && !SAFE_DOMAINS.some(d => hostname === d)
    };
  } catch {
    return { riskScore: 0, reasons: [], detectedBrand: null, hasSuspiciousExt: false, hasFakeKeywords: false, hasBrandImpersonation: false };
  }
}

// Layer 2 — WHOIS Domain Age Check
async function checkDomainAge(url) {
  try {
    const hostname = new URL(url).hostname.replace('www.','');
    const data = await whois(hostname);
    const createdDate = data.creationDate || data.created || data.registrationTime;
    if (!createdDate) return { ageInDays: -1, isNew: false, error: true };
    const created = new Date(Array.isArray(createdDate) ? createdDate[0] : createdDate);
    const ageInDays = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
    return {
      ageInDays,
      isNew: ageInDays < 30,
      isVeryNew: ageInDays < 7,
      createdDate: created.toDateString(),
      error: false
    };
  } catch {
    return { ageInDays: -1, isNew: false, error: true };
  }
}

// Layer 3 — SSL Certificate Check
async function checkSSL(url) {
  try {
    const hostname = new URL(url).hostname.replace('www.','');
    const result = await sslChecker(hostname, { method: 'GET', port: 443 });
    return {
      valid: result.valid,
      daysRemaining: result.daysRemaining,
      issuer: result.issuer || 'Unknown',
      isSelfSigned: result.daysRemaining < 0 || !result.valid,
      error: false
    };
  } catch {
    return { valid: false, daysRemaining: 0, issuer: 'Unknown', isSelfSigned: true, error: true };
  }
}

// Layer 4 — Extract assets + detect form harvesting
async function extractAndAnalyze(url) {
  try {
    const response = await axios.get(url, {
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const $ = cheerio.load(response.data);
    const images = [];
    $('img').each((i, el) => { const src = $(el).attr('src'); if (src) images.push(src); });
    const title = $('title').text();
    const metaDesc = $('meta[name="description"]').attr('content') || '';
    const bodyText = $('body').text().toLowerCase();

    // Form harvesting detection
    const hasAadhaar = bodyText.includes('aadhaar') || bodyText.includes('aadhar') || $('input[placeholder*="aadhaar" i]').length > 0;
    const hasPAN = bodyText.includes('pan number') || bodyText.includes('pan card');
    const hasPasswordField = $('input[type="password"]').length > 0;
    const hasOTPField = $('input[placeholder*="otp" i], input[placeholder*="pin" i]').length > 0;
    const hasRegistrationFee = bodyText.includes('registration fee') || bodyText.includes('application fee') || bodyText.includes('processing fee');
    const hasBankDetails = bodyText.includes('account number') || bodyText.includes('ifsc') || bodyText.includes('bank transfer');

    // Psychological manipulation detection (OUR UNIQUE FEATURE)
    const urgencyPhrases = ['limited time','hurry','act now','don\'t miss','expires soon','last chance','only today','24 hours','flash sale','urgent'];
    const unrealisticPhrases = ['100% free','guaranteed','no questions asked','instant approval','100% authentic','officially verified'];
    const authoritySpoof = ['✅ verified','✅ official','✅ authentic','government approved','rbi approved','100% legal'];
    const fearPhrases = ['account suspended','your account will be','immediate action','warning','alert','blocked'];

    const urgencyCount = urgencyPhrases.filter(p => bodyText.includes(p)).length;
    const unrealisticCount = unrealisticPhrases.filter(p => bodyText.includes(p)).length;
    const authoritySpoofCount = authoritySpoof.filter(p => bodyText.includes(p)).length;
    const fearCount = fearPhrases.filter(p => bodyText.includes(p)).length;
    const manipulationScore = (urgencyCount * 10) + (unrealisticCount * 15) + (authoritySpoofCount * 20) + (fearCount * 15);

    return {
      images, title, metaDesc,
      formHarvesting: { hasAadhaar, hasPAN, hasPasswordField, hasOTPField, hasRegistrationFee, hasBankDetails },
      manipulation: { urgencyCount, unrealisticCount, authoritySpoofCount, fearCount, manipulationScore },
      html: response.data.substring(0, 2000),
      bodyText: bodyText.substring(0, 1000)
    };
  } catch {
    return {
      images: [], title: '', metaDesc: '',
      formHarvesting: { hasAadhaar: false, hasPAN: false, hasPasswordField: false, hasOTPField: false, hasRegistrationFee: false, hasBankDetails: false },
      manipulation: { urgencyCount: 0, unrealisticCount: 0, authoritySpoofCount: 0, fearCount: 0, manipulationScore: 0 },
      html: '', bodyText: ''
    };
  }
}

// Layer 5 — Safe Browsing
async function checkSafeBrowsing(url) {
  try {
    if (!process.env.SAFE_BROWSING_KEY) return false;
    const response = await axios.post(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${process.env.SAFE_BROWSING_KEY}`,
      {
        client: { clientId: 'trustscan', clientVersion: '1.0' },
        threatInfo: {
          threatTypes: ['MALWARE','SOCIAL_ENGINEERING','UNWANTED_SOFTWARE'],
          platformTypes: ['ANY_PLATFORM'],
          threatEntryTypes: ['URL'],
          threatEntries: [{ url }]
        }
      }
    );
    return response.data.matches ? true : false;
  } catch { return false; }
}

// Layer 6 — Gemini AI (Smart analysis)
async function analyzeWithGemini(url, assets, domainAnalysis) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `
You are a strict cybersecurity expert detecting fake and fraudulent websites.

URL: ${url}
Page title: ${assets.title}
Meta description: ${assets.metaDesc}
Domain risk score: ${domainAnalysis.riskScore}/100
Domain risk reasons: ${domainAnalysis.reasons.join(', ') || 'none'}
Brand impersonation detected: ${domainAnalysis.detectedBrand || 'none'}
Asks for Aadhaar: ${assets.formHarvesting.hasAadhaar}
Asks for registration fee: ${assets.formHarvesting.hasRegistrationFee}
Asks for bank details: ${assets.formHarvesting.hasBankDetails}
Manipulation score: ${assets.manipulation.manipulationScore}/100
Urgency language count: ${assets.manipulation.urgencyCount}
Unrealistic promises count: ${assets.manipulation.unrealisticCount}
Authority spoofing count: ${assets.manipulation.authoritySpoofCount}
Page content sample: ${assets.bodyText.substring(0,500)}

STRICT RULES:
- Domain risk > 60 → trustScore MUST be below 20
- Domain risk > 40 → trustScore MUST be below 40
- Asks for Aadhaar/bank details/registration fee → trustScore MUST be below 25
- Manipulation score > 40 → reduce trustScore by 30
- Brand impersonation → trustScore MUST be below 25
- Only give trustScore above 80 if 100% sure legitimate

Respond ONLY in this exact JSON:
{
  "isFake": true or false,
  "brand": "impersonated brand or null",
  "category": "Shopping or Banking or Jobs or Government or Education or Other",
  "riskLevel": "High or Medium or Low",
  "stolenAssets": "what is stolen or none",
  "reason": "one clear sentence",
  "trustScore": number 0-100
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch (err) {
    console.error('Gemini error:', err.message);
    return {
      isFake: domainAnalysis.riskScore > 50,
      brand: domainAnalysis.detectedBrand,
      category: detectCategory(url),
      riskLevel: domainAnalysis.riskScore > 50 ? 'High' : 'Low',
      stolenAssets: domainAnalysis.hasBrandImpersonation ? 'Brand identity stolen' : 'none',
      reason: 'Analysis based on domain and content signals',
      trustScore: Math.max(0, 100 - domainAnalysis.riskScore)
    };
  }
}

// Category detector
function detectCategory(url) {
  const l = url.toLowerCase();
  if (l.includes('job')||l.includes('sarkari')||l.includes('recruitment')||l.includes('ncs')||l.includes('ssc')||l.includes('upsc')||l.includes('career')) return 'Jobs';
  if (l.includes('bank')||l.includes('sbi')||l.includes('hdfc')||l.includes('kyc')||l.includes('upi')||l.includes('paytm')||l.includes('finance')) return 'Banking';
  if (l.includes('gov')||l.includes('govt')||l.includes('government')||l.includes('india')||l.includes('nic')) return 'Government';
  if (l.includes('college')||l.includes('university')||l.includes('iit')||l.includes('admission')||l.includes('edu')||l.includes('school')) return 'Education';
  if (l.includes('shop')||l.includes('store')||l.includes('buy')||l.includes('deal')||l.includes('sale')||l.includes('flipkart')||l.includes('amazon')||l.includes('myntra')) return 'Shopping';
  return 'Other';
}

// MAIN SCAN ENDPOINT
app.post('/scan', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });

  try {
    console.log('\n--- Scanning:', url, '---');

    // Instantly return safe for verified domains
    if (isKnownSafe(url)) {
      console.log('✅ Known safe domain');
      return res.json({
        url, trustScore: 97, isFake: false, brand: null,
        category: 'Verified', riskLevel: 'Low',
        stolenAssets: 'none',
        reason: 'Verified legitimate website — all signals clean',
        signals: {
          blacklisted: false, suspiciousDomain: false,
          hasSuspiciousExt: false, hasBrandImpersonation: false,
          domainAge: 'Established', sslValid: true,
          formHarvesting: 'None detected', manipulationScore: 0,
          domainRiskReasons: []
        }
      });
    }

    // Run domain analysis first
    const domainAnalysis = analyzeDomain(url);
    console.log('Domain risk:', domainAnalysis.riskScore, domainAnalysis.reasons);

    // If clearly fake by domain — return fast
    if (domainAnalysis.riskScore >= 80) {
      console.log('🚨 Clearly fake domain');
      const trustScore = Math.max(3, 15 - domainAnalysis.riskScore / 10);
      return res.json({
        url, trustScore: Math.round(trustScore),
        isFake: true, brand: domainAnalysis.detectedBrand,
        category: detectCategory(url), riskLevel: 'High',
        stolenAssets: domainAnalysis.hasBrandImpersonation ? `${domainAnalysis.detectedBrand} brand assets stolen` : 'Domain identity theft',
        reason: domainAnalysis.reasons.join(' · '),
        signals: {
          blacklisted: false, suspiciousDomain: true,
          hasSuspiciousExt: domainAnalysis.hasSuspiciousExt,
          hasBrandImpersonation: domainAnalysis.hasBrandImpersonation,
          domainAge: 'Unknown', sslValid: false,
          formHarvesting: 'Not checked', manipulationScore: 0,
          domainRiskReasons: domainAnalysis.reasons
        }
      });
    }

    // Run all checks in parallel
    const [assets, isBlacklisted, domainAge, sslResult] = await Promise.all([
      extractAndAnalyze(url),
      checkSafeBrowsing(url),
      checkDomainAge(url),
      checkSSL(url)
    ]);

    console.log('Domain age:', domainAge.ageInDays, 'days');
    console.log('SSL valid:', sslResult.valid);
    console.log('Form harvesting:', assets.formHarvesting);
    console.log('Manipulation score:', assets.manipulation.manipulationScore);

    // Get Gemini analysis
    const geminiResult = await analyzeWithGemini(url, assets, domainAnalysis);
    let trustScore = geminiResult.trustScore;

    // Apply all signal penalties
    if (domainAnalysis.riskScore >= 50) trustScore = Math.min(trustScore, 25);
    else if (domainAnalysis.riskScore >= 30) trustScore = Math.min(trustScore, 45);

    // WHOIS penalties
    if (domainAge.isVeryNew) { trustScore -= 30; console.log('⚠️ Very new domain penalty'); }
    else if (domainAge.isNew) { trustScore -= 15; }

    // SSL penalties
    if (!sslResult.valid || sslResult.isSelfSigned) { trustScore -= 25; console.log('⚠️ SSL invalid penalty'); }

    // Form harvesting penalties (CRITICAL)
    if (assets.formHarvesting.hasAadhaar) { trustScore -= 40; console.log('🚨 Aadhaar harvesting detected'); }
    if (assets.formHarvesting.hasRegistrationFee) { trustScore -= 35; console.log('🚨 Registration fee detected'); }
    if (assets.formHarvesting.hasBankDetails) { trustScore -= 35; console.log('🚨 Bank details harvesting detected'); }

    // Psychological manipulation penalties (OUR UNIQUE FEATURE)
    if (assets.manipulation.manipulationScore > 50) { trustScore -= 30; console.log('🚨 High manipulation score'); }
    else if (assets.manipulation.manipulationScore > 25) { trustScore -= 15; }

    // Blacklist override
    if (isBlacklisted) { trustScore = Math.min(trustScore, 5); console.log('🚨 Blacklisted by Google'); }

    trustScore = Math.max(0, Math.min(100, Math.round(trustScore)));
    console.log('Final trust score:', trustScore);

    // Build signals summary
    let formHarvestingLabel = 'None detected';
    if (assets.formHarvesting.hasAadhaar) formHarvestingLabel = 'Aadhaar number harvesting';
    else if (assets.formHarvesting.hasRegistrationFee) formHarvestingLabel = 'Illegal registration fee';
    else if (assets.formHarvesting.hasBankDetails) formHarvestingLabel = 'Bank details harvesting';

    const result = {
      url, trustScore,
      isFake: geminiResult.isFake || isBlacklisted || trustScore < 30,
      brand: geminiResult.brand || domainAnalysis.detectedBrand,
      category: geminiResult.category || detectCategory(url),
      riskLevel: trustScore < 30 ? 'High' : trustScore < 60 ? 'Medium' : 'Low',
      stolenAssets: geminiResult.stolenAssets,
      reason: geminiResult.reason,
      signals: {
        blacklisted: isBlacklisted,
        suspiciousDomain: domainAnalysis.riskScore > 30,
        hasSuspiciousExt: domainAnalysis.hasSuspiciousExt,
        hasBrandImpersonation: domainAnalysis.hasBrandImpersonation,
        domainAge: domainAge.error ? 'Unknown' : domainAge.isVeryNew ? 'Less than 7 days' : domainAge.isNew ? 'Less than 30 days' : `${domainAge.ageInDays} days old`,
        sslValid: sslResult.valid,
        sslIssuer: sslResult.issuer,
        formHarvesting: formHarvestingLabel,
        manipulationScore: assets.manipulation.manipulationScore,
        urgencyLanguage: assets.manipulation.urgencyCount > 0,
        unrealisticPromises: assets.manipulation.unrealisticCount > 0,
        domainRiskReasons: domainAnalysis.reasons
      }
    };

    res.json(result);
  } catch (err) {
    console.error('Scan error:', err.message);
    res.status(500).json({ error: 'Scan failed. Please try again.' });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`TrustScan running on http://localhost:${PORT}`));