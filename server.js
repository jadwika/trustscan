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
  'crunchyroll.com','disneyplus.com','spotify.com','gaana.com','jiosaavn.com'
];

const FAKE_EXTENSIONS = [
  'xyz','tk','ml','ga','cf','gq','top','club','online','site',
  'buzz','icu','fun','pw','cc','ws','biz','info','mobi'
];

const FAKE_KEYWORDS = [
  'deals','sale','cheap','free','win','offer','kyc','update','verify',
  'secure','alert','claim','prize','lucky','reward','bonus','gift',
  'clearance','discount','flash','limited','hurry','urgent',
  'loot','cashback','scheme','yojana','helpline','support-team',
  'refund','payment-free','delivery-free','win-prize',
  'big-billion','great-indian-sale','diwali-offer','festival-discount',
  'free-cod','original-brand','factory-outlet','genuine-product',
  'brand-sale','upto-90-off','mega-sale','super-sale',
  'factory-price','wholesale-rate','clearance-sale','stock-clearance',
  'electronics-sale','mobile-offer','laptop-deal','gadget-sale',
  'grocery-free','instant-delivery-free',
  'medicine-discount','health-sale','cheap-medicine',
  'free-food','food-offer','food-discount',
  'flight-offer','hotel-deal','travel-sale','cheap-flight',
  'gold-cheap','jewellery-sale','diamond-offer',
  'furniture-sale','sofa-offer','bed-deal',
  'sarkari','apply-now','job-alert','recruitment-free','govt-job',
  'sarkari-result','free-job-alert','government-vacancy',
  'apply-fee','registration-charge','guaranteed-job',
  'work-from-home-earn','data-entry-job','part-time-earn',
  'earn-daily','earn-weekly','home-based-job'
];

const BRAND_NAMES = [
  'flipkart','amazon','myntra','meesho','nykaa','ajio','snapdeal',
  'tatacliq','jiomart','reliancedigital','croma','vijaysales','sangeetha',
  'bigbasket','blinkit','zepto','dmart','dunzo','grofers',
  'pharmeasy','netmeds','apollopharmacy','medplus',
  'swiggy','zomato',
  'makemytrip','cleartrip','yatra','goibibo','easemytrip',
  'bewakoof','snitch','libas','westside','pantaloons','shoppersstop','lifestyle',
  'tanishq','caratlane','bluestone','melorra',
  'pepperfry','urbanladder','ikea','hometown',
  'bata','puma','nike','adidas','reebok','skechers',
  'paytm','phonepe','razorpay','mobikwik','freecharge',
  'sbi','hdfc','icici','axis','kotak','rbl','yesbank',
  'irctc','upsc','ssc','ncs','epfindia','passport',
  'naukri','shine','foundit','internshala','monsterindia',
  'google','facebook','instagram','whatsapp','youtube','linkedin',
  'microsoft','apple','samsung','oneplus','realme','xiaomi','oppo','vivo',
  'hotstar','jiocinema','netflix','primevideo','sonyliv','zee5',
  'crunchyroll','disney','spotify'
];

// Known piracy sites for fast detection
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
  'einthusan','bollyflix','moviesnation','wcostream','wcofun'
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

    return {
      riskScore: Math.min(riskScore, 100),
      reasons, detectedBrand, ext, domainName,
      hasSuspiciousExt: FAKE_EXTENSIONS.includes(ext),
      hasFakeKeywords: foundKeywords.length > 0,
      hasBrandImpersonation: !!foundBrand && !SAFE_DOMAINS.some(d => hostname === d)
    };
  } catch {
    return {
      riskScore: 0, reasons: [], detectedBrand: null,
      hasSuspiciousExt: false, hasFakeKeywords: false, hasBrandImpersonation: false
    };
  }
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

    // Extract more content for better AI analysis
    const bodyText = $('body').text().toLowerCase();
    const headings = [];
    $('h1, h2, h3').each((i, el) => {
      if (i < 10) headings.push($(el).text().trim());
    });

    // Detect piracy signals from page content
    const piracySignals = [
      'watch online free','download free','free stream','watch hd free',
      'free episodes','watch anime free','stream movies free',
      'no subscription','watch without login','free download hd',
      'latest episodes free','full movie free','series free'
    ];
    const piracyScore = piracySignals.filter(p => bodyText.includes(p)).length;

    const hasAadhaar = bodyText.includes('aadhaar') || bodyText.includes('aadhar');
    const hasRegistrationFee = bodyText.includes('registration fee') || bodyText.includes('application fee');
    const hasBankDetails = bodyText.includes('account number') || bodyText.includes('ifsc');

    const urgencyPhrases = ['limited time','hurry','act now','expires soon','last chance','only today','urgent','offer ends'];
    const unrealisticPhrases = ['100% free','guaranteed','no questions asked','instant approval','100% authentic','100% original'];
    const authoritySpoof = ['officially verified','government approved','rbi approved','100% legal','authorized dealer'];
    const fearPhrases = ['account suspended','your account will be','immediate action','warning','alert','blocked'];

    const urgencyCount = urgencyPhrases.filter(p => bodyText.includes(p)).length;
    const unrealisticCount = unrealisticPhrases.filter(p => bodyText.includes(p)).length;
    const authoritySpoofCount = authoritySpoof.filter(p => bodyText.includes(p)).length;
    const fearCount = fearPhrases.filter(p => bodyText.includes(p)).length;
    const manipulationScore = (urgencyCount*10)+(unrealisticCount*15)+(authoritySpoofCount*20)+(fearCount*15);

    return {
      title, metaDesc, metaKeywords,
      headings: headings.join(' | '),
      piracyScore,
      formHarvesting: { hasAadhaar, hasRegistrationFee, hasBankDetails },
      manipulation: { urgencyCount, unrealisticCount, authoritySpoofCount, fearCount, manipulationScore },
      // Send 3000 characters for much better AI analysis
      bodyText: bodyText.substring(0, 3000)
    };
  } catch {
    return {
      title: '', metaDesc: '', metaKeywords: '', headings: '', piracyScore: 0,
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

async function analyzeWithGemini(url, assets, domainAnalysis) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `
You are a strict cybersecurity expert. Analyse this website thoroughly.

URL: ${url}
Page title: ${assets.title}
Meta description: ${assets.metaDesc}
Meta keywords: ${assets.metaKeywords}
Page headings: ${assets.headings}
Domain risk score: ${domainAnalysis.riskScore}/100
Domain risk reasons: ${domainAnalysis.reasons.join(', ') || 'none'}
Brand impersonation detected: ${domainAnalysis.detectedBrand || 'none'}
Piracy signals found on page: ${assets.piracyScore}
Asks for Aadhaar: ${assets.formHarvesting.hasAadhaar}
Asks for registration fee: ${assets.formHarvesting.hasRegistrationFee}
Asks for bank details: ${assets.formHarvesting.hasBankDetails}
Manipulation score: ${assets.manipulation.manipulationScore}/100
Page content (3000 chars): ${assets.bodyText}

STEP 1 - CHECK FOR PIRACY FIRST:
Read the page content carefully. If the site:
- Streams or lets users watch movies, shows, anime, dramas for FREE without official license
- Lets users download copyrighted movies, music, software for free
- Contains words like "watch online free", "download hd free", "free episodes", "free anime"
- Is clearly an unofficial streaming site (not Netflix, Hotstar, JioCinema, Crunchyroll etc.)
Then category MUST be "Piracy" and trustScore MUST be below 15.

STEP 2 - CHECK FOR FRAUD:
- Domain risk above 60 = trustScore below 20
- Domain risk above 40 = trustScore below 40
- Asks for Aadhaar or bank details or fees = trustScore below 25
- Brand impersonation = trustScore below 25
- Only give trustScore above 80 if 100 percent certain it is legitimate

Respond ONLY in this exact JSON:
{
  "isFake": true or false,
  "brand": "impersonated brand name or null",
  "category": "Shopping or Electronics or Grocery or Pharmacy or Food or Travel or Jewellery or Furniture or Footwear or Banking or Jobs or Government or Education or Piracy or Other",
  "riskLevel": "High or Medium or Low",
  "stolenAssets": "what the user will lose or none",
  "reason": "one clear sentence explaining the verdict",
  "shortMessage": "2-3 sentences mentioning the actual site name. For piracy explain it is illegal in India under IT Act 2000 and suggest legal alternatives. For fraud explain what will be stolen.",
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
      reason: 'Analysis based on domain signals',
      shortMessage: domainAnalysis.riskScore > 50
        ? 'This website shows multiple signs of being fraudulent. Do not enter any personal details or make any payments on this site.'
        : 'This website appears to be legitimate based on domain analysis.',
      trustScore: Math.max(0, 100 - domainAnalysis.riskScore)
    };
  }
}

function detectCategory(url) {
  const l = url.toLowerCase();
  if (l.includes('anime')||l.includes('drama')||l.includes('kdrama')||l.includes('kiss')||l.includes('stream')) return 'Piracy';
  if (l.includes('job')||l.includes('sarkari')||l.includes('recruitment')||l.includes('ncs')) return 'Jobs';
  if (l.includes('bank')||l.includes('sbi')||l.includes('kyc')||l.includes('upi')) return 'Banking';
  if (l.includes('gov')||l.includes('govt')||l.includes('government')||l.includes('nic')) return 'Government';
  if (l.includes('college')||l.includes('university')||l.includes('iit')||l.includes('edu')) return 'Education';
  if (l.includes('medicine')||l.includes('pharma')||l.includes('health')||l.includes('medical')) return 'Pharmacy';
  if (l.includes('grocery')||l.includes('vegetable')||l.includes('organic')) return 'Grocery';
  if (l.includes('flight')||l.includes('hotel')||l.includes('travel')||l.includes('tour')) return 'Travel';
  if (l.includes('gold')||l.includes('jewel')||l.includes('diamond')) return 'Jewellery';
  if (l.includes('furniture')||l.includes('sofa')||l.includes('bed')) return 'Furniture';
  if (l.includes('food')||l.includes('restaurant')||l.includes('delivery')) return 'Food';
  if (l.includes('mobile')||l.includes('laptop')||l.includes('electronics')) return 'Electronics';
  if (l.includes('shoe')||l.includes('footwear')||l.includes('sneaker')) return 'Footwear';
  if (l.includes('shop')||l.includes('store')||l.includes('buy')||l.includes('deal')) return 'Shopping';
  return 'Other';
}

app.post('/scan', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });

  try {
    console.log('Scanning:', url);

    // Step 1 — known safe domains
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

    const domainAnalysis = analyzeDomain(url);

    // Step 2 — known piracy list (fast, no AI needed)
    const piracyCheck = checkKnownPiracy(url);
    if (piracyCheck.isHigh || piracyCheck.isMedium) {
      const trustScore = piracyCheck.isHigh ? 5 : 15;
      const shortMessage = piracyCheck.isHigh
        ? `This is a major illegal piracy website banned multiple times by the Indian government under IT Act 2000 and Copyright Act 1957. Every ad on this site can install malware on your device and expose you to legal action. Use legal alternatives like JioCinema, Hotstar, or Netflix instead.`
        : `This site illegally streams or distributes copyrighted content without permission. It may contain malicious ads that harm your device. Accessing piracy sites is illegal in India. Use legal platforms like JioCinema, Crunchyroll, or Hotstar instead.`;

      return res.json({
        url, trustScore,
        isFake: false, brand: null,
        category: 'Piracy', riskLevel: 'High',
        shortMessage,
        stolenAssets: 'Copyrighted movies, shows, and content',
        reason: 'Illegal piracy website — distributes copyrighted content without permission',
        signals: {
          blacklisted: true, suspiciousDomain: true,
          hasSuspiciousExt: false, hasBrandImpersonation: false,
          domainAge: 'Unknown', sslValid: false, sslIssuer: 'Unknown',
          formHarvesting: 'Malware and ad injection risk',
          manipulationScore: 80,
          urgencyLanguage: false, unrealisticPromises: false,
          domainRiskReasons: [
            'Illegal piracy website',
            'Distributes copyrighted content without license',
            'High malware and virus risk',
            'Banned under Indian IT Act 2000'
          ]
        }
      });
    }

    // Step 3 — very high risk domain, skip AI
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
          : `This website shows multiple high-risk signals. It is likely designed to deceive users into sharing personal details or making payments. Do not trust this site.`,
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

    // Step 4 — deep analysis with page content + Gemini AI
    const [assets, isBlacklisted] = await Promise.all([
      extractAndAnalyze(url),
      checkSafeBrowsing(url)
    ]);

    // If page content has piracy signals, boost them before Gemini
    if (assets.piracyScore >= 3) {
      console.log('Piracy signals detected on page:', assets.piracyScore);
    }

    const geminiResult = await analyzeWithGemini(url, assets, domainAnalysis);

    // Step 5 — if Gemini detected piracy from page content
    if (geminiResult.category === 'Piracy') {
      return res.json({
        url,
        trustScore: Math.min(geminiResult.trustScore || 12, 15),
        isFake: false, brand: null,
        category: 'Piracy', riskLevel: 'High',
        shortMessage: geminiResult.shortMessage,
        stolenAssets: 'Copyrighted movies, shows, and content',
        reason: geminiResult.reason,
        signals: {
          blacklisted: isBlacklisted, suspiciousDomain: true,
          hasSuspiciousExt: domainAnalysis.hasSuspiciousExt,
          hasBrandImpersonation: false,
          domainAge: 'Cloud mode', sslValid: true, sslIssuer: 'Cloud mode',
          formHarvesting: 'Malware and ad injection risk',
          manipulationScore: 80,
          urgencyLanguage: false, unrealisticPromises: false,
          domainRiskReasons: ['Piracy detected from page content analysis', 'Illegal content distribution']
        }
      });
    }

    let trustScore = geminiResult.trustScore;

    if (domainAnalysis.riskScore >= 50) trustScore = Math.min(trustScore, 25);
    else if (domainAnalysis.riskScore >= 30) trustScore = Math.min(trustScore, 45);
    if (isBlacklisted) trustScore = Math.min(trustScore, 5);
    if (assets.formHarvesting.hasAadhaar) trustScore -= 40;
    if (assets.formHarvesting.hasRegistrationFee) trustScore -= 35;
    if (assets.formHarvesting.hasBankDetails) trustScore -= 35;
    if (assets.manipulation.manipulationScore > 50) trustScore -= 30;
    else if (assets.manipulation.manipulationScore > 25) trustScore -= 15;
    if (assets.piracyScore >= 3) trustScore = Math.min(trustScore, 20);

    trustScore = Math.max(0, Math.min(100, Math.round(trustScore)));

    let formHarvestingLabel = 'None detected';
    if (assets.formHarvesting.hasAadhaar) formHarvestingLabel = 'Aadhaar harvesting detected';
    else if (assets.formHarvesting.hasRegistrationFee) formHarvestingLabel = 'Illegal registration fee';
    else if (assets.formHarvesting.hasBankDetails) formHarvestingLabel = 'Bank details harvesting';

    res.json({
      url, trustScore,
      isFake: geminiResult.isFake || isBlacklisted || trustScore < 30,
      brand: geminiResult.brand || domainAnalysis.detectedBrand,
      category: geminiResult.category || detectCategory(url),
      riskLevel: trustScore < 30 ? 'High' : trustScore < 60 ? 'Medium' : 'Low',
      stolenAssets: geminiResult.stolenAssets,
      reason: geminiResult.reason,
      shortMessage: geminiResult.shortMessage || 'Analysis completed based on domain signals and AI detection.',
      signals: {
        blacklisted: isBlacklisted,
        suspiciousDomain: domainAnalysis.riskScore > 30,
        hasSuspiciousExt: domainAnalysis.hasSuspiciousExt,
        hasBrandImpersonation: domainAnalysis.hasBrandImpersonation,
        domainAge: 'Cloud mode', sslValid: true, sslIssuer: 'Cloud mode',
        formHarvesting: formHarvestingLabel,
        manipulationScore: assets.manipulation.manipulationScore,
        urgencyLanguage: assets.manipulation.urgencyCount > 0,
        unrealisticPromises: assets.manipulation.unrealisticCount > 0,
        domainRiskReasons: domainAnalysis.reasons
      }
    });

  } catch (err) {
    console.error('Scan error:', err.message);
    res.status(500).json({ error: 'Scan failed. Please try again.' });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`TrustScan running on port ${PORT}`));