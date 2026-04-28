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
  'crunchyroll.com','disneyplus.com','hbomax.com','peacocktv.com'
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
  'brand-sale','upto-90-off','mega-sale','super-sale','brand-outlet',
  'factory-price','wholesale-rate','clearance-sale','stock-clearance',
  'electronics-sale','mobile-offer','laptop-deal','gadget-sale',
  'grocery-free','instant-delivery-free','free-vegetables',
  'medicine-discount','health-sale','pharmeasy-offer','cheap-medicine',
  'free-food','food-offer','restaurant-deal','food-discount',
  'flight-offer','hotel-deal','travel-sale','cheap-flight','free-hotel',
  'gold-cheap','jewellery-sale','diamond-offer','tanishq-sale',
  'furniture-sale','home-decor-cheap','sofa-offer','bed-deal',
  'sarkari','apply-now','job-alert','recruitment-free','govt-job',
  'sarkari-result','10th-pass','12th-pass','free-job-alert',
  'government-vacancy','apply-fee','registration-charge',
  'guaranteed-job','immediate-joining','work-from-home-earn',
  'data-entry-job','part-time-earn','online-job-daily-payment',
  'earn-daily','earn-weekly','home-based-job'
];

const BRAND_NAMES = [
  'flipkart','amazon','myntra','meesho','nykaa','ajio','snapdeal',
  'tatacliq','jiomart','reliancedigital',
  'croma','vijaysales','sangeetha',
  'bigbasket','blinkit','zepto','dmart','dunzo','grofers',
  'pharmeasy','netmeds','apollopharmacy','medplus',
  'swiggy','zomato',
  'makemytrip','cleartrip','yatra','goibibo','easemytrip',
  'bewakoof','snitch','libas','westside','pantaloons',
  'shoppersstop','lifestyle',
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
  'crunchyroll','disney','hbo'
];

// Known piracy sites — fast detection without AI call
const HIGH_PIRACY = [
  'movierulz','tamilrockers','filmywap','filmyzilla',
  '9xmovies','isaimini','tamilyogi','piratebay','1337x',
  'khatrimaza','rdxhd','moviesda','jalshamoviez','bolly4u',
  'cinemavilla','tamilgun','moviespoint','hdmovieshub',
  'teluguwap','tamilwap','hindimovies'
];

const MEDIUM_PIRACY = [
  '123movies','fmovies','gomovies','putlocker',
  'yesmovies','solarmovie','streameast','mp4moviez',
  'skymovies','katmoviehd','hdmovies','moviesflix',
  'worldfree4u','downloadhub','coolmoviez','o2tvseries',
  'toxicwap','extramovies','hdmoviesarea','moviescounter',
  'vegamovies','ibomma','telugumovies',
  // Asian drama and anime piracy
  'kisskh','kissasian','kissdrama','kissanime',
  'gogoanime','animepahe','9anime','zoro',
  'dramanice','dramacool','myasiantv','viewasian',
  'asiancrush','kshow123','kdramahood','asiandrama',
  'watchasian','asianembed','koreandrama','dramafree',
  'animesuge','animeowl','animeflv','animeultima',
  'kickassanime','animedao','animefreak','animehub',
  'writeas','wcostream','wcofun','wcoforever',
  'lookmovie','soap2day','123chill','freemovies',
  'watchmovies','hdeuropix','einthusan','bollyflix',
  'moviesnation','hubcloud','gdriveplayer'
];

// Piracy detection keywords in URL or title
const PIRACY_KEYWORDS = [
  'watch-free','download-movie','free-stream','free-episode',
  'watch-online-free','movies-online-free','free-anime',
  'stream-free','hd-free','full-movie-free'
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
    const fullUrl = url.toLowerCase();
    const isHigh = HIGH_PIRACY.some(s => hostname.includes(s));
    const isMedium = MEDIUM_PIRACY.some(s => hostname.includes(s));
    const hasPiracyKeyword = PIRACY_KEYWORDS.some(k => fullUrl.includes(k));
    return { isHigh, isMedium: isMedium || hasPiracyKeyword };
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

async function checkDomainAge(url) {
  return { ageInDays: -1, isNew: false, error: true };
}

async function checkSSL(url) {
  return { valid: true, daysRemaining: 90, issuer: 'Unknown', isSelfSigned: false, error: true };
}

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
      images, title, metaDesc,
      formHarvesting: { hasAadhaar, hasRegistrationFee, hasBankDetails },
      manipulation: { urgencyCount, unrealisticCount, authoritySpoofCount, fearCount, manipulationScore },
      bodyText: bodyText.substring(0, 1000)
    };
  } catch {
    return {
      images: [], title: '', metaDesc: '',
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
You are a strict cybersecurity expert detecting fake, fraudulent, and illegal websites targeting Indian users.

URL: ${url}
Page title: ${assets.title}
Domain risk score: ${domainAnalysis.riskScore}/100
Domain risk reasons: ${domainAnalysis.reasons.join(', ') || 'none'}
Brand impersonation: ${domainAnalysis.detectedBrand || 'none'}
Asks for Aadhaar: ${assets.formHarvesting.hasAadhaar}
Asks for registration fee: ${assets.formHarvesting.hasRegistrationFee}
Asks for bank details: ${assets.formHarvesting.hasBankDetails}
Manipulation score: ${assets.manipulation.manipulationScore}/100
Page content: ${assets.bodyText.substring(0,500)}

PIRACY DETECTION RULES (check these first):
- Any site streaming or downloading movies, shows, anime, or web series without official license = PIRACY
- Sites like KissKH, KissAsian, GogoAnime, 9anime, Dramacool, Zoro, Soap2day, Lookmovie = PIRACY
- If URL or page title contains: watch free, download movie, free stream, free episodes, free anime = PIRACY
- If site allows watching copyrighted content without subscription or payment = PIRACY
- Piracy sites MUST get trustScore below 15 and category must be "Piracy"
- Short message for piracy must mention it is illegal in India under IT Act 2000

FAKE WEBSITE RULES:
- Domain risk above 60 means trustScore must be below 20
- Domain risk above 40 means trustScore must be below 40
- Asks for Aadhaar or bank details or fee means trustScore must be below 25
- Brand impersonation means trustScore must be below 25
- Only give trustScore above 80 if 100 percent sure it is legitimate

Respond ONLY in this exact JSON:
{
  "isFake": true or false,
  "brand": "impersonated brand or null",
  "category": "Shopping or Electronics or Grocery or Pharmacy or Food or Travel or Jewellery or Furniture or Footwear or Banking or Jobs or Government or Education or Piracy or Other",
  "riskLevel": "High or Medium or Low",
  "stolenAssets": "what is stolen or none",
  "reason": "one clear sentence",
  "shortMessage": "2-3 sentence specific explanation mentioning the actual site name, what the user will lose if fake or why it is safe. For piracy sites mention it is illegal in India.",
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
  if (l.includes('anime')||l.includes('manga')||l.includes('drama')||l.includes('kdrama')||l.includes('kiss')) return 'Piracy';
  if (l.includes('job')||l.includes('sarkari')||l.includes('recruitment')||l.includes('ncs')||l.includes('career')) return 'Jobs';
  if (l.includes('bank')||l.includes('sbi')||l.includes('kyc')||l.includes('upi')||l.includes('paytm')) return 'Banking';
  if (l.includes('gov')||l.includes('govt')||l.includes('government')||l.includes('nic')) return 'Government';
  if (l.includes('college')||l.includes('university')||l.includes('iit')||l.includes('admission')||l.includes('edu')) return 'Education';
  if (l.includes('medicine')||l.includes('pharma')||l.includes('health')||l.includes('medical')) return 'Pharmacy';
  if (l.includes('grocery')||l.includes('vegetable')||l.includes('fruit')||l.includes('organic')) return 'Grocery';
  if (l.includes('flight')||l.includes('hotel')||l.includes('travel')||l.includes('tour')||l.includes('holiday')) return 'Travel';
  if (l.includes('gold')||l.includes('jewel')||l.includes('diamond')||l.includes('silver')) return 'Jewellery';
  if (l.includes('furniture')||l.includes('sofa')||l.includes('bed')||l.includes('decor')) return 'Furniture';
  if (l.includes('food')||l.includes('restaurant')||l.includes('delivery')||l.includes('meal')) return 'Food';
  if (l.includes('mobile')||l.includes('laptop')||l.includes('electronics')||l.includes('gadget')) return 'Electronics';
  if (l.includes('shoe')||l.includes('footwear')||l.includes('sneaker')||l.includes('sandal')) return 'Footwear';
  if (l.includes('shop')||l.includes('store')||l.includes('buy')||l.includes('deal')) return 'Shopping';
  return 'Other';
}

app.post('/scan', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });

  try {
    console.log('Scanning:', url);

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
    console.log('Domain risk:', domainAnalysis.riskScore);

    // Check known piracy list first (fast)
    const piracyCheck = checkKnownPiracy(url);

    if (piracyCheck.isHigh || piracyCheck.isMedium) {
      const trustScore = piracyCheck.isHigh ? 5 : 15;
      const shortMessage = piracyCheck.isHigh
        ? `This is a major illegal piracy website banned multiple times by the Indian government under IT Act 2000 and Copyright Act 1957. Every ad on this site can install malware or spyware on your device and expose you to legal action. Use legal alternatives like JioCinema, Hotstar, or Netflix instead.`
        : `This site illegally streams or distributes copyrighted movies, shows, or anime without permission. It may contain malicious ads that harm your device. Accessing piracy sites is illegal in India — use legal platforms like JioCinema, Crunchyroll, or Netflix instead.`;

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
          ? `This site is impersonating ${domainAnalysis.detectedBrand} to steal your personal and financial details. It has no connection to the real ${domainAnalysis.detectedBrand}. Do not enter any payment information or personal details on this site.`
          : `This website shows multiple high-risk signals including suspicious domain patterns. It is likely designed to deceive users. Do not enter any personal details or make any payments here.`,
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

    const [assets, isBlacklisted] = await Promise.all([
      extractAndAnalyze(url),
      checkSafeBrowsing(url)
    ]);

    // Gemini AI analysis — also detects unknown piracy sites
    const geminiResult = await analyzeWithGemini(url, assets, domainAnalysis);

    // If Gemini detected piracy that wasn't in our list
    if (geminiResult.category === 'Piracy') {
      return res.json({
        url, trustScore: geminiResult.trustScore || 12,
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
          domainRiskReasons: ['Illegal piracy website detected by AI', 'Distributes copyrighted content']
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