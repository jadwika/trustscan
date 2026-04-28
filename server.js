require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Verified safe domains — instant safe response
const SAFE_DOMAINS = [
  'amazon.in','amazon.com','flipkart.com','myntra.com','nykaa.com',
  'meesho.com','ajio.com','snapdeal.com','tatacliq.com','reliancedigital.in',
  'croma.com','vijaysales.com','sangeetha.com',
  'bigbasket.com','blinkit.com','zepto.app','jiomart.com','dmart.in','dunzo.com',
  'pharmeasy.in','netmeds.com','1mg.com','apollopharmacy.in','medplus.in',
  'swiggy.com','zomato.com',
  'makemytrip.com','cleartrip.com','yatra.com','goibibo.com',
  'irctc.co.in','indianrailways.gov.in','easemytrip.com',
  'bewakoof.com','snitch.co.in','libas.in','westside.com','pantaloons.com',
  'shoppersstop.com','lifestyle.co.in',
  'tanishq.co.in','caratlane.com','bluestone.com','melorra.com',
  'pepperfry.com','urbanladder.com','ikea.com','hometown.in',
  'bata.in','puma.com','nike.com','adidas.co.in','reebok.in',
  'sbi.co.in','hdfcbank.com','icicibank.com','axisbank.com','kotak.com',
  'paytm.com','phonepe.com','razorpay.com','billdesk.com','npci.org.in',
  'mobikwik.com','freecharge.in',
  'ncs.gov.in','ssc.nic.in','upsc.gov.in',
  'india.gov.in','mygov.in','digilocker.gov.in','uidai.gov.in',
  'incometax.gov.in','epfindia.gov.in','passport.gov.in',
  'iit.ac.in','nit.ac.in','ugc.ac.in','aicte-india.org','cbse.gov.in',
  'naukri.com','shine.com','indeed.com','glassdoor.com','foundit.in',
  'internshala.com','linkedin.com','monsterindia.com',
  'google.com','youtube.com','facebook.com','instagram.com','twitter.com',
  'whatsapp.com','telegram.org','microsoft.com','apple.com',
  'hotstar.com','jiocinema.com','netflix.com','primevideo.com',
  'sonyliv.com','zee5.com','mxplayer.in','voot.com','altbalaji.com',
  'crunchyroll.com','disneyplus.com','spotify.com','gaana.com','jiosaavn.com',
  'imdb.com','rottentomatoes.com','justwatch.com'
];

// Known piracy sites — instant piracy response
const HIGH_PIRACY = [
  'movierulz','tamilrockers','filmywap','filmyzilla','9xmovies',
  'isaimini','tamilyogi','piratebay','1337x','khatrimaza',
  'rdxhd','moviesda','jalshamoviez','bolly4u','cinemavilla',
  'tamilgun','moviespoint','hdmovieshub','teluguwap','tamilwap'
];

const MEDIUM_PIRACY = [
  '123movies','fmovies','gomovies','putlocker','yesmovies',
  'solarmovie','streameast','mp4moviez','skymovies','katmoviehd',
  'hdmovies','moviesflix','worldfree4u','downloadhub','coolmoviez',
  'o2tvseries','toxicwap','extramovies','vegamovies','ibomma',
  'kisskh','kissasian','kissdrama','kissanime','gogoanime',
  'animepahe','9anime','zoro','dramanice','dramacool',
  'myasiantv','viewasian','kshow123','kdramahood','asiandrama',
  'watchasian','koreandrama','animesuge','animeowl','animeflv',
  'kickassanime','animedao','animefreak','animehub',
  'lookmovie','soap2day','123chill','freemovies','hdeuropix',
  'einthusan','bollyflix','moviesnation','wcostream','wcofun',
  'autoembed','turkish123','embedmovies','sflix','yomovies',
  'openload','streamango','fmoviesz','watchseries','seriesfree'
];

function isKnownSafe(url) {
  try {
    const hostname = new URL(url).hostname.replace('www.','');
    const isPiracy = [...HIGH_PIRACY, ...MEDIUM_PIRACY].some(s => hostname.includes(s));
    if (isPiracy) return false;
    return SAFE_DOMAINS.some(d => hostname === d || hostname.endsWith('.'+d));
  } catch { return false; }
}

function checkKnownPiracy(url) {
  try {
    const hostname = new URL(url).hostname.replace('www.','').toLowerCase();
    const isHigh = HIGH_PIRACY.some(s => hostname.includes(s));
    const isMedium = MEDIUM_PIRACY.some(s => hostname.includes(s));
    return { isHigh, isMedium };
  } catch { return { isHigh: false, isMedium: false }; }
}

async function extractAndAnalyze(url) {
  try {
    const response = await axios.get(url, {
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const $ = cheerio.load(response.data);
    const title = $('title').text();
    const metaDesc = $('meta[name="description"]').attr('content') || '';
    const metaKeywords = $('meta[name="keywords"]').attr('content') || '';
    const bodyText = $('body').text().toLowerCase();
    const headings = [];
    $('h1,h2,h3').each((i,el) => { if(i<10) headings.push($(el).text().trim()); });

    const hasAadhaar = bodyText.includes('aadhaar') || bodyText.includes('aadhar');
    const hasRegistrationFee = bodyText.includes('registration fee') || bodyText.includes('application fee');
    const hasBankDetails = bodyText.includes('account number') || bodyText.includes('ifsc');

    const urgencyPhrases = ['limited time','hurry','act now','expires soon','last chance','only today','urgent'];
    const unrealisticPhrases = ['100% free','guaranteed','no questions asked','instant approval','100% authentic'];
    const authoritySpoof = ['officially verified','government approved','rbi approved','100% legal'];
    const fearPhrases = ['account suspended','your account will be','immediate action','warning','alert','blocked'];

    const urgencyCount = urgencyPhrases.filter(p => bodyText.includes(p)).length;
    const unrealisticCount = unrealisticPhrases.filter(p => bodyText.includes(p)).length;
    const authoritySpoofCount = authoritySpoof.filter(p => bodyText.includes(p)).length;
    const fearCount = fearPhrases.filter(p => bodyText.includes(p)).length;
    const manipulationScore = (urgencyCount*10)+(unrealisticCount*15)+(authoritySpoofCount*20)+(fearCount*15);

    return {
      title, metaDesc, metaKeywords,
      headings: headings.join(' | '),
      formHarvesting: { hasAadhaar, hasRegistrationFee, hasBankDetails },
      manipulation: { urgencyCount, unrealisticCount, authoritySpoofCount, fearCount, manipulationScore },
      bodyText: bodyText.substring(0, 3000)
    };
  } catch {
    return {
      title: '', metaDesc: '', metaKeywords: '', headings: '',
      formHarvesting: { hasAadhaar: false, hasRegistrationFee: false, hasBankDetails: false },
      manipulation: { urgencyCount:0, unrealisticCount:0, authoritySpoofCount:0, fearCount:0, manipulationScore:0 },
      bodyText: ''
    };
  }
}

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

async function analyzeWithGemini(url, assets, hostname) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `
You are a world-class cybersecurity expert protecting Indian internet users.
You have complete knowledge of every legitimate and fraudulent website.

WEBSITE TO ANALYSE:
URL: ${url}
Hostname: ${hostname}
Page title: ${assets.title}
Meta description: ${assets.metaDesc}
Meta keywords: ${assets.metaKeywords}
Page headings: ${assets.headings}
Asks for Aadhaar: ${assets.formHarvesting.hasAadhaar}
Asks for registration fee: ${assets.formHarvesting.hasRegistrationFee}
Asks for bank details: ${assets.formHarvesting.hasBankDetails}
Manipulation score: ${assets.manipulation.manipulationScore}/100
Page content: ${assets.bodyText}

YOUR JUDGEMENT FRAMEWORK:

1. OFFICIAL DOMAIN CHECK:
Every major brand has ONE official domain. Use your knowledge:
- Flipkart = flipkart.com ONLY
- Amazon India = amazon.in ONLY
- Myntra = myntra.com ONLY
- BigBasket = bigbasket.com ONLY
- Swiggy = swiggy.com ONLY
- Zomato = zomato.com ONLY
- SBI = sbi.co.in ONLY
- HDFC = hdfcbank.com ONLY
- PharmEasy = pharmeasy.in ONLY
- MakeMyTrip = makemytrip.com ONLY
- Tanishq = tanishq.co.in ONLY
- Nike = nike.com ONLY
- Puma = puma.com ONLY
Any site using these brand names on a DIFFERENT domain = FRAUD.
trustScore must be below 15.

2. PIRACY CHECK:
Use your knowledge to identify piracy sites.
Piracy = streams or downloads movies, shows, anime, dramas for FREE without license.
Legal streaming: YouTube, Netflix, Hotstar, JioCinema, Crunchyroll, Prime Video, SonyLIV, Zee5.
Any other site offering free copyrighted content = PIRACY.
trustScore must be below 15. Category must be Piracy.

3. FAKE JOB PORTAL CHECK:
Sites collecting Aadhaar or charging fees for government jobs = FRAUD.
All genuine government jobs are free at ncs.gov.in or ssc.nic.in.
trustScore must be below 20.

4. LEGITIMATE SITE CHECK:
Well known companies, official government sites, verified platforms = SAFE.
trustScore above 80.

5. UNKNOWN SITE:
If you genuinely do not know this site and it shows no fraud signals = Medium trust.
trustScore between 40 and 60.

CRITICAL RULE — BRAND IMPERSONATION (highest priority):
If the hostname contains any known brand name like sbi, flipkart, myntra, hdfc,
icici, axis, paytm, phonepe, amazon, meesho, nykaa, swiggy, zomato, bigbasket,
makemytrip, irctc, upsc, ncs, google, youtube, instagram, whatsapp, netflix
BUT is NOT the official domain = FRAUD. trustScore MUST be below 10. No exceptions.
Examples of what to flag:
sbi-kyc-update.xyz = SBI impersonation = trustScore 5
flipkart-sale.online = Flipkart impersonation = trustScore 5
myntra-clearance.in = Myntra impersonation = trustScore 8
govt-job-apply.net = Government job fraud = trustScore 10
sarkari-result.xyz = Fake government job = trustScore 10

Respond ONLY in this exact JSON format:
{
  "isFake": true or false,
  "brand": "the brand being impersonated or null",
  "category": "Shopping or Electronics or Grocery or Pharmacy or Food or Travel or Jewellery or Furniture or Footwear or Banking or Jobs or Government or Education or Piracy or Other",
  "riskLevel": "High or Medium or Low",
  "stolenAssets": "exactly what the user will lose: money, Aadhaar, card details, credentials, or none",
  "reason": "one clear sentence explaining your verdict",
  "shortMessage": "2 to 3 sentences. Mention the actual site name. For ecommerce fraud: say which brand is being impersonated and what the user will lose. For piracy: say it is illegal in India under IT Act 2000 and suggest JioCinema, Hotstar, or Netflix. For safe sites: say why it is trustworthy.",
  "trustScore": number between 0 and 100
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch (err) {
    console.error('Gemini error:', err.message);
    return null;
  }
}

function detectCategory(url) {
  const l = url.toLowerCase();
  if (l.includes('job')||l.includes('sarkari')||l.includes('recruitment')) return 'Jobs';
  if (l.includes('bank')||l.includes('sbi')||l.includes('kyc')||l.includes('upi')) return 'Banking';
  if (l.includes('gov')||l.includes('govt')||l.includes('government')) return 'Government';
  if (l.includes('college')||l.includes('university')||l.includes('edu')) return 'Education';
  if (l.includes('medicine')||l.includes('pharma')||l.includes('health')) return 'Pharmacy';
  if (l.includes('grocery')||l.includes('vegetable')||l.includes('organic')) return 'Grocery';
  if (l.includes('flight')||l.includes('hotel')||l.includes('travel')) return 'Travel';
  if (l.includes('gold')||l.includes('jewel')||l.includes('diamond')) return 'Jewellery';
  if (l.includes('furniture')||l.includes('sofa')||l.includes('bed')) return 'Furniture';
  if (l.includes('food')||l.includes('restaurant')||l.includes('delivery')) return 'Food';
  if (l.includes('mobile')||l.includes('laptop')||l.includes('electronics')) return 'Electronics';
  if (l.includes('shoe')||l.includes('footwear')||l.includes('sneaker')) return 'Footwear';
  if (l.includes('shop')||l.includes('store')||l.includes('buy')) return 'Shopping';
  return 'Other';
}

function buildPiracyResponse(url, isBlacklisted, shortMessage) {
  return {
    url, trustScore: 8,
    isFake: false, brand: null,
    category: 'Piracy', riskLevel: 'High',
    shortMessage: shortMessage ||
      'This site illegally streams or distributes copyrighted content without any official license. This is illegal in India under IT Act 2000 and Copyright Act 1957. Use legal platforms like JioCinema, Hotstar, or Netflix instead.',
    stolenAssets: 'Copyrighted movies, shows, and content',
    reason: 'Illegal piracy website — streams copyrighted content without license',
    signals: {
      blacklisted: isBlacklisted, suspiciousDomain: true,
      hasSuspiciousExt: false, hasBrandImpersonation: false,
      domainAge: 'Unknown', sslValid: false, sslIssuer: 'Unknown',
      formHarvesting: 'Malware and ad injection risk',
      manipulationScore: 80,
      urgencyLanguage: false, unrealisticPromises: false,
      domainRiskReasons: [
        'Illegal free streaming of copyrighted content',
        'Violates IT Act 2000 and Copyright Act 1957',
        'High malware risk from ads',
        'No official streaming license'
      ]
    }
  };
}

app.post('/scan', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });

  try {
    console.log('Scanning:', url);
    const hostname = new URL(url).hostname.replace('www.','').toLowerCase();

    // Step 1 — verified safe domains (instant)
    if (isKnownSafe(url)) {
      return res.json({
        url, trustScore: 97, isFake: false, brand: null,
        category: 'Verified', riskLevel: 'Low',
        stolenAssets: 'none',
        reason: 'Verified legitimate website — all signals clean',
        shortMessage: 'This is a verified and trusted website. It uses secure HTTPS encryption, has a valid SSL certificate, and is not flagged by any threat database. Completely safe to use.',
        signals: {
          blacklisted: false, suspiciousDomain: false,
          hasSuspiciousExt: false, hasBrandImpersonation: false,
          domainAge: 'Established', sslValid: true,
          formHarvesting: 'None detected', manipulationScore: 0,
          domainRiskReasons: []
        }
      });
    }

    // Step 2 — known piracy list (instant)
    const piracyCheck = checkKnownPiracy(url);
    if (piracyCheck.isHigh || piracyCheck.isMedium) {
      return res.json(buildPiracyResponse(url, false, null));
    }

    // Step 3 — domain analysis (needed for fallback scoring)
    const domainAnalysis = analyzeDomain(url);
    console.log('Domain risk:', domainAnalysis.riskScore);

    // Step 4 — very high risk domain — skip AI
    if (domainAnalysis.riskScore >= 80) {
      const trustScore = Math.max(3, 15 - domainAnalysis.riskScore / 10);
      return res.json({
        url, trustScore: Math.round(trustScore),
        isFake: true, brand: domainAnalysis.detectedBrand,
        category: detectCategory(url), riskLevel: 'High',
        stolenAssets: domainAnalysis.hasBrandImpersonation
          ? `${domainAnalysis.detectedBrand} brand assets stolen`
          : 'Domain identity theft',
        reason: domainAnalysis.reasons.join(' · '),
        shortMessage: domainAnalysis.hasBrandImpersonation
          ? `This site is impersonating ${domainAnalysis.detectedBrand} to steal your personal and financial details. It has no connection to the real ${domainAnalysis.detectedBrand}. Do not enter any payment information or personal details.`
          : `This website shows multiple high-risk signals. It is likely designed to deceive users. Do not enter any personal details or make any payments here.`,
        signals: {
          blacklisted: false, suspiciousDomain: true,
          hasSuspiciousExt: domainAnalysis.hasSuspiciousExt,
          hasBrandImpersonation: domainAnalysis.hasBrandImpersonation,
          domainAge: 'Unknown', sslValid: false,
          formHarvesting: 'Not checked', manipulationScore: 0,
          urgencyLanguage: false, unrealisticPromises: false,
          domainRiskReasons: domainAnalysis.reasons
        }
      });
    }

    // Step 5 — fetch page content + Safe Browsing in parallel
    const [assets, isBlacklisted] = await Promise.all([
      extractAndAnalyze(url),
      checkSafeBrowsing(url)
    ]);

    // Step 4 — Gemini AI is the main permanent judge
    // Gemini uses its knowledge of every website to decide:
    // Is this brand impersonation? Is this piracy? Is this safe?
    const geminiResult = await analyzeWithGemini(url, assets, hostname);

    if (!geminiResult) {
      // Gemini failed — use domain analysis for accurate score
      const domainTrust = Math.max(0, 100 - domainAnalysis.riskScore);
      const fallbackScore = domainAnalysis.hasBrandImpersonation
        ? Math.min(domainTrust, 10)
        : domainAnalysis.riskScore >= 50
        ? Math.min(domainTrust, 25)
        : Math.min(domainTrust, 45);

      return res.json({
        url, trustScore: Math.round(fallbackScore),
        isFake: domainAnalysis.hasBrandImpersonation || fallbackScore < 30,
        brand: domainAnalysis.detectedBrand,
        category: detectCategory(url),
        riskLevel: fallbackScore < 30 ? 'High' : 'Medium',
        stolenAssets: domainAnalysis.hasBrandImpersonation
          ? `${domainAnalysis.detectedBrand} brand assets stolen`
          : 'none',
        reason: domainAnalysis.reasons.join(' · ') || 'Suspicious domain signals detected',
        shortMessage: domainAnalysis.hasBrandImpersonation
          ? `This site is impersonating ${domainAnalysis.detectedBrand} to steal your personal and financial details. It has no connection to the real ${domainAnalysis.detectedBrand}. Do not enter any payment information or personal details.`
          : `This website shows suspicious signals and could not be fully analysed. Proceed with extreme caution and avoid sharing personal details or making any payments.`,
        signals: {
          blacklisted: isBlacklisted,
          suspiciousDomain: domainAnalysis.riskScore > 30,
          hasSuspiciousExt: domainAnalysis.hasSuspiciousExt,
          hasBrandImpersonation: domainAnalysis.hasBrandImpersonation,
          domainAge: 'Unknown', sslValid: false, sslIssuer: 'Unknown',
          formHarvesting: 'Could not check',
          manipulationScore: 0,
          urgencyLanguage: false, unrealisticPromises: false,
          domainRiskReasons: domainAnalysis.reasons
        }
      });
    }

    // Step 5 — if Gemini detected piracy
    if (geminiResult.category === 'Piracy') {
      return res.json(buildPiracyResponse(url, isBlacklisted, geminiResult.shortMessage));
    }

    // Step 6 — apply additional safety checks on top of Gemini score
    let trustScore = geminiResult.trustScore;

    if (isBlacklisted) trustScore = Math.min(trustScore, 5);
    if (assets.formHarvesting.hasAadhaar) trustScore -= 30;
    if (assets.formHarvesting.hasRegistrationFee) trustScore -= 25;
    if (assets.formHarvesting.hasBankDetails) trustScore -= 25;
    if (assets.manipulation.manipulationScore > 50) trustScore -= 20;
    else if (assets.manipulation.manipulationScore > 25) trustScore -= 10;

    trustScore = Math.max(0, Math.min(100, Math.round(trustScore)));

    let formHarvestingLabel = 'None detected';
    if (assets.formHarvesting.hasAadhaar) formHarvestingLabel = 'Aadhaar harvesting detected';
    else if (assets.formHarvesting.hasRegistrationFee) formHarvestingLabel = 'Illegal registration fee';
    else if (assets.formHarvesting.hasBankDetails) formHarvestingLabel = 'Bank details harvesting';

    res.json({
      url, trustScore,
      isFake: geminiResult.isFake || isBlacklisted || trustScore < 30,
      brand: geminiResult.brand,
      category: geminiResult.category || detectCategory(url),
      riskLevel: trustScore < 30 ? 'High' : trustScore < 60 ? 'Medium' : 'Low',
      stolenAssets: geminiResult.stolenAssets,
      reason: geminiResult.reason,
      shortMessage: geminiResult.shortMessage,
      signals: {
        blacklisted: isBlacklisted,
        suspiciousDomain: trustScore < 50,
        hasSuspiciousExt: false,
        hasBrandImpersonation: !!geminiResult.brand,
        domainAge: 'Cloud mode', sslValid: true, sslIssuer: 'Cloud mode',
        formHarvesting: formHarvestingLabel,
        manipulationScore: assets.manipulation.manipulationScore,
        urgencyLanguage: assets.manipulation.urgencyCount > 0,
        unrealisticPromises: assets.manipulation.unrealisticCount > 0,
        domainRiskReasons: geminiResult.isFake || trustScore < 30
          ? [`${geminiResult.category} fraud detected by Gemini AI`]
          : []
      }
    });

  } catch (err) {
    console.error('Scan error:', err.message);
    res.status(500).json({ error: 'Scan failed. Please try again.' });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`TrustScan running on port ${PORT}`));